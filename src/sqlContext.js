var _ = require( "lodash" );
var when = require( "when" );
var lift = require( "when/node" ).lift;
var sql = require( "mssql" );
var util = require( "util" );
var log = require( "./log" )( "seriate.sql" );
var Monologue = require( "monologue.js" );
var machina = require( "machina" );
var Readable = require( "stream" ).Readable;

var specialParamOptions = [
	require( "./asTable" ),
	require( "./asList" )
];

util.inherits( DataResultStream, Readable );

function DataResultStream( request, options ) {
	var self = this;
	Readable.call( this, _.extend( {}, options, { objectMode: true } ) );

	request.on( "recordset", function( columns ) {
		self.push( { recordset: columns } );
	} );

	request.on( "row", function( row ) {
		self.push( { row: row } );
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
	var table = new sql.Table( options.bulkLoadTable.name );
	table.create = true;

	_.forEach( options.bulkLoadTable.columns, function( column, columnName ) {
		table.columns.add( columnName, column.type, { nullable: column.nullable === undefined ? true : column.nullable } );
	} );

	var columnNames = Object.keys( options.bulkLoadTable.columns );

	options.bulkLoadTable.rows.forEach( function( row ) {
		var values = columnNames.map( function( columnName ) {
			return row[ columnName ];
		} );

		table.rows.add.apply( table.rows, values );
	} );

	var req = new sql.Request( state.transaction || state.connection );

	return when.resolve()
	.then( function() {
		var dropSql = "IF OBJECT_ID('tempdb.." + options.bulkLoadTable.name + "') IS NOT NULL DROP TABLE " + options.bulkLoadTable.name + ";";
		if ( isTempTableName( options.bulkLoadTable.name ) ) {
			// Add step at end to drop temp table
			addState( state, name + "-drop", function( execute ) {
				return execute( { query: dropSql } );
			} );
			if ( !options.bulkLoadTable.useExisting ) {
				// Make sure we're not adding to an existing temp table
				return nonPreparedSql( state, name + "-pre-drop", { query: dropSql } );
			}
		}
	} )
	.then( function() {
		return instrument( state, name, function() {
			return lift( req.bulk ).bind( req )( table );
		} );
	} );
}

function createParameter( val, key ) {
	if ( typeof val !== "object" ) {
		return {
			key: key,
			value: val
		};
	}

	var specialOption = _.find( specialParamOptions, function( option ) {
		return option.matchesParam( val );
	} );

	return specialOption ? specialOption.createParameter( val, key ) : {
		key: key,
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
	var req = new sql.Request( state.transaction || state.connection );
	req.multiple = options.hasOwnProperty( "multiple" ) ? options.multiple : false;

	var params = createParameters( options.params );

	params.forEach( function( param ) {
		if ( param.type ) {
			req.input( param.key, param.type, param.value );
		} else {
			req.input( param.key, param.value );
		}
	} );

	var operation = options.query ? "query" : "execute";
	var sqlCmd = transformQuery( options.params, options.query || options.procedure );

	return instrument( state, name, function() {
		if ( !options.stream ) {
			return lift( req[ operation ] ).bind( req )( sqlCmd );
		}
		var stream;
		req.stream = true;
		stream = new DataResultStream( req );
		req[ operation ]( sqlCmd );
		return when.resolve( stream );
	} );
}

function preparedSql( state, name, options ) {
	var cmd = new sql.PreparedStatement( state.transaction || state.connection );
	cmd.multiple = options.hasOwnProperty( "multiple" ) ? options.multiple : false;

	var params = createParameters( options.params );
	var paramKeyValues = {};

	params.forEach( function( param ) {
		cmd.input( param.key, param.type );
		paramKeyValues[ param.key ] = param.value;
	} );

	var prepare = lift( cmd.prepare ).bind( cmd );
	var execute = lift( cmd.execute ).bind( cmd );
	var unprepare = lift( cmd.unprepare ).bind( cmd );
	var statement = transformQuery( options.params, options.preparedSql );

	return instrument( state, name, function() {
		return prepare( statement )
			.then( function() {
				if ( options.stream ) {
					cmd.stream = true;

					// Can't use the lifted execute here because we need the
					// request returned by the original callback version, which the
					// lift would replace with a promise.
					var req = cmd.execute( paramKeyValues, _.noop );
					var stream = new DataResultStream( req );
					stream.on( "end", unprepare );
					return when.resolve( stream );
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
		throw new Error( "A step by that name already exists: " + fsm.instance );
	}

	fsm.pipeline.push( name );
	fsm.states[ name ] = {
		_onEnter: function() {
			var promise;
			var exec = function( options ) {
				promise = executeSql( fsm, name, options );
				return promise;
			};

			try {
				var stepReturnValue = stepAction.call(
					fsm,
					exec,
					fsm.results
				);

				when( stepReturnValue )
					.then( function( result ) {
						return when( promise ) // We'll not force the caller to return the execute promise
							.then( function( promiseResult ) {
								return result || promiseResult;
							} );
					} )
					.then( fsm.handle.bind( fsm, "success" ), fsm.handle.bind( fsm, "error" ) ) ;
			} catch ( err ) {
				fsm.handle( "error", err );
			}
		},
		success: function( result ) {
			fsm.results[ name ] = result;
			fsm.emit( "data", result );
			fsm.nextState();
		},
		error: errorHandler
	};
}

module.exports = function() {
	var SqlContext = machina.Fsm.extend( {
		_connected: function( connection ) {
			this.connection = connection;
			this.handle( "success" );
		},

		_connectionError: function( err ) {
			this.handle( "error", err );
		},

		initialState: "uninitialized",

		initialize: function( options ) {
			this.results = {};
			this.pipeline = [];
			this.pipePos = -1;
			this.metrics = options.metrics;
			this.metricsNamespace = options.namespace;
			options.connection
				.then(
					this._connected.bind( this ),
					this._connectionError.bind( this )
				);
		},

		nextState: function() {
			this.pipePos += 1;
			var nextState = this.pipeline[ this.pipePos ] || "done";
			this.transition( nextState );
		},

		states: {
			uninitialized: {
				start: "connecting",
				"*": function() {
					this.deferUntilTransition( "connecting" );
				}
			},
			connecting: {
				success: function() {
					this.nextState();
				},
				error: function( err ) {
					this.err = err;
					this.transition( "error" );
				}
			},

			done: {
				_onEnter: function() {
					this.emit( "end", this.results );
				}
			},

			error: {
				_onEnter: function() {
					var precedingErrorMessage = _.map( this.err && this.err.precedingErrors, function( error ) {
						return "\n\tPreceding error: " + error.message;
					} ).join( "" );

					var message = util.format( "SqlContext Error. Failed on step \"%s\" with: \"%s\"%s", this.priorState, this.err.message, precedingErrorMessage );
					log.error( message );
					this.err.message = message;
					this.err.step = this.priorState;
					this.emit( "error", this.err );
				}
			}
		},

		step: function( alias, stepAction ) {
			var opt;
			if ( typeof stepAction === "object" ) {
				opt = stepAction;
				stepAction = function( execute ) {
					return execute( opt );
				};
			}
			addState( this, alias, stepAction );
			return this;
		},

		deferredStart: function() {
			if ( !this._started ) {
				process.nextTick( function() {
					this.handle( "start" );
				}.bind( this ) );
				this._started = true;
			}
		},

		end: function( fn ) {
			this.on( "end", fn );
			this.deferredStart();
			return this;
		},

		error: function( fn ) {
			this.on( "error", fn );
			this.deferredStart();
			return this;
		},

		then: function( success, failure ) {
			var deferred = when.defer();
			function onSuccess( result ) {
				deferred.resolve( result );
			}
			function onFailure( error ) {
				deferred.reject( error );
			}

			this.end( onSuccess );
			this.error( onFailure );

			return deferred.promise
				.then( success, failure );
		},

		abort: function() {
			this.handle( "error", "Operation aborted" );
		}

	} );

	Monologue.mixInto( SqlContext );

	return SqlContext;
};
