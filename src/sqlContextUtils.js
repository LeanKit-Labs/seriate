/* eslint-disable max-nested-callbacks */
const sql = require( "mssql" );
const util = require( "util" );
const _ = require( "lodash" );
const Readable = require( "stream" ).Readable;

const specialParamOptions = [
	require( "./asTable" ),
	require( "./asList" )
];

util.inherits( DataResultStream, Readable );

function DataResultStream( request, options ) {
	const self = this;
	Readable.call( this, _.extend( {}, options, { objectMode: true } ) );

	request.on( "recordset", function( columns ) {
		self.push( { recordset: columns } );
	} );

	request.on( "row", function( row ) {
		self.push( { row } );
	} );

	request.on( "error", function( error ) {
		self.emit( "error", error );
	} );

	request.on( "done", function() {
		self.push( null );
	} );
}

DataResultStream.prototype._read = _.noop;

function errorHandler( err ) {
	this.err = err;
	this.transition( "error" );
}

function instrument( state, name, op ) {
	if ( !state.metrics ) {
		return op();
	}

	return state.metrics.instrument(
		{
			key: [ "sql", name ],
			namespace: state.metricsNamespace,
			call: op,
			success: _.identity,
			failure: _.identity
		}
	);
}

function bulkLoadTable( state, name, options ) {
	const table = new sql.Table( options.bulkLoadTable.name );
	table.create = true;

	_.forEach( options.bulkLoadTable.columns, function( column, columnName ) {
		table.columns.add( columnName, column.type, { nullable: column.nullable === undefined ? true : column.nullable } );
	} );

	const columnNames = Object.keys( options.bulkLoadTable.columns );

	options.bulkLoadTable.rows.forEach( function( row ) {
		const values = columnNames.map( function( columnName ) {
			return row[ columnName ];
		} );

		table.rows.add( ...values );
	} );

	const req = new sql.Request( state.transaction || state.connection );

	return Promise.resolve()
		.then( function() {
			if ( !isTempTableName( options.bulkLoadTable.name ) ) {
				return;
			}

			const dropSql = `IF OBJECT_ID('tempdb..${ options.bulkLoadTable.name }') IS NOT NULL DROP TABLE ${ options.bulkLoadTable.name };`;

			if ( !options.bulkLoadTable.useExisting ) {
			// Make sure we're not adding to an existing temp table
				nonPreparedSql( state, `${ name }-pre-drop`, { query: dropSql } );
			}

			// Accumulate list of tables on state, which is the transaction object, to enforce appropriate scope
			// Keep this list to avoid double-dropping tables when we bulk load the same temp table more than once using `useExisting`
			state.droppedTempTables = state.droppedTempTables || {};

			if ( state.droppedTempTables[ options.bulkLoadTable.name ] ) {
				return;
			}

			state.droppedTempTables[ options.bulkLoadTable.name ] = true;

			// Add to drop sql for each temp table, to be run in a single step at end of transaction
			if ( state.tempTablesDropSql ) {
				state.tempTablesDropSql += `\n${ dropSql }`;
			} else {
				state.tempTablesDropSql = dropSql;

				// Add step at end to drop temp tables
				addState( state, "__drop-temp-tables", function( execute ) {
					return execute( { query: state.tempTablesDropSql } );
				} );
			}
		} )
		.then( function() {
			return instrument( state, name, function() {
				return util.promisify( req.bulk ).bind( req )( table );
			} );
		} );
}

function createParameter( val, key ) {
	if ( typeof val !== "object" ) {
		return {
			key,
			value: val
		};
	}

	const specialOption = _.find( specialParamOptions, function( option ) {
		return option.matchesParam( val );
	} );

	return specialOption ? specialOption.createParameter( val, key ) : {
		key,
		type: val.type,
		value: val.val
	};
}

function createParameters( params ) {
	return _( params )
		.map( createParameter )
		.flatten()
		.value();
}

function transformQuery( params, query ) {
	return specialParamOptions.reduce( function( acc, option ) {
		return option.transformQuery( params, acc );
	}, query );
}

function nonPreparedSql( state, name, options ) {
	const req = new sql.Request( state.transaction || state.connection );
	req.multiple = options.hasOwnProperty( "multiple" ) ? options.multiple : false;

	const params = createParameters( options.params );

	params.forEach( function( param ) {
		if ( param.type ) {
			req.input( param.key, param.type, param.value );
		} else {
			req.input( param.key, param.value );
		}
	} );

	const operation = options.query ? "query" : "execute";
	const sqlCmd = transformQuery( options.params, options.query || options.procedure );

	return instrument( state, name, function() {
		if ( !options.stream ) {
			return new Promise( ( resolve, reject ) => {
				req[ operation ]( sqlCmd, ( err, data, returnValue ) => {
					if ( err ) { return reject( err ); }

					if ( returnValue !== undefined ) {
						// stored procedures are returned with data and return value
						// this is weird, but was a result of using when.lift functionality
						// we've removed when.lift, but kept original api
						return resolve( [ data, returnValue ] );
					}
					return resolve( data );
				} );
			} );
		}
		req.stream = true;
		const stream = new DataResultStream( req );
		req[ operation ]( sqlCmd );
		return Promise.resolve( stream );
	} );
}

function preparedSql( state, name, options ) {
	const cmd = new sql.PreparedStatement( state.transaction || state.connection );
	cmd.multiple = options.hasOwnProperty( "multiple" ) ? options.multiple : false;

	const params = createParameters( options.params );
	const paramKeyValues = {};

	params.forEach( function( param ) {
		cmd.input( param.key, param.type );
		paramKeyValues[ param.key ] = param.value;
	} );

	const prepare = util.promisify( cmd.prepare ).bind( cmd );
	const execute = util.promisify( cmd.execute ).bind( cmd );
	const unprepare = util.promisify( cmd.unprepare ).bind( cmd );
	const statement = transformQuery( options.params, options.preparedSql );

	return instrument( state, name, function() {
		return prepare( statement )
			.then( function() {
				if ( options.stream ) {
					cmd.stream = true;

					// Can't use the promisified execute here because we need the
					// request returned by the original callback version, which the
					// promisify would replace with a promise.
					const req = cmd.execute( paramKeyValues, _.noop );
					const stream = new DataResultStream( req );
					stream.on( "end", unprepare );
					return Promise.resolve( stream );
				}
				return execute( paramKeyValues )
					.then( function( result ) {
						return unprepare()
							.then( function() {
								return result;
							} );
					}, function( err ) {
						return unprepare()
							.then( function() {
								throw err;
							} );
					} );
			} );
	} );
}

function isTempTableName( name ) {
	return name[ 0 ] === "#";
}

function executeSql( state, name, options ) {
	if ( options.query || options.procedure ) {
		return nonPreparedSql( state, name, options );
	}
	if ( options.preparedSql ) {
		return preparedSql( state, name, options );
	}
	if ( options.bulkLoadTable ) {
		if ( isTempTableName( options.bulkLoadTable.name ) && !state.transaction ) {
			throw new Error( "You may not bulk load a temporary table on a plain context; use a transaction context." );
		}
		return bulkLoadTable( state, name, options );
	}
	throw new Error( "The options argument must have query, procedure, preparedSql, or bulkLoadTable." );
}

function addState( fsm, name, stepAction ) {
	if ( fsm.states[ name ] ) {
		throw new Error( `A step by that name already exists: ${ fsm.instance }` );
	}

	if ( name === "__beforeHook__" ) {
		fsm.pipeline.unshift( name );
	} else {
		fsm.pipeline.push( name );
	}
	fsm.states[ name ] = {
		_onEnter() {
			let promise;
			const exec = function( options ) {
				// Capture call stack for call to execute from within a step.
				// This provides call context that would otherwise get lost when we
				// pass around an execute function and call it multiple times.
				const callStack = new Error().stack;
				promise = executeSql( fsm, name, options )
					.catch( function( error ) {
						// Remove the "Error" top line of captured stack and replace it with error message from actual error.
						const capturedStackParts = callStack.split( "\n" ).slice( 1 );
						capturedStackParts.unshift( error.toString() );
						error.stack = capturedStackParts.join( "\n" );
						throw error;
					} );
				return promise;
			};

			try {
				const stepReturnValue = stepAction.call(
					fsm,
					exec,
					fsm.results
				);

				Promise.resolve( stepReturnValue )
					.then( function( result ) {
						return Promise.resolve( promise ) // We'll not force the caller to return the execute promise
							.then( function( promiseResult ) {
								return result || promiseResult;
							} );
					} )
					.then( fsm.handle.bind( fsm, "success" ), fsm.handle.bind( fsm, "error" ) );
			} catch ( err ) {
				fsm.handle( "error", err );
			}
		},
		success( result ) {
			fsm.results[ name ] = result;
			fsm.emit( "data", result );
			fsm.nextState();
		},
		error: errorHandler
	};
}

module.exports = {
	addState
};
