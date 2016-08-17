var _ = require( "lodash" );
var when = require( "when" );
var lift = require( "when/node" ).lift;
var sql = require( "mssql" );
var declare = require( "mssql/lib/datatypes" ).declare;
var util = require( "util" );
var utils = require( "./utils" );
var log = require( "./log" )( "seriate.sql" );
var Monologue = require( "monologue.js" );
var machina = require( "machina" );
var xmldom = require( "xmldom" );
var domImplementation = new xmldom.DOMImplementation();
var xmlSerializer = new xmldom.XMLSerializer();

function errorHandler( err ) {
	this.err = err;
	this.transition( "error" );
}

function buildTableVariableSql( key, schema ) {
	return _.template( utils.fromFile( "./sql/buildTableVar.sql.template" ) )( {
		name: key,
		schema: _.mapValues( schema, function( typeDef ) {
			if ( _.isFunction( typeDef ) ) {
				typeDef = typeDef();
			}
			return declare( typeDef.type, typeDef );
		} )
	} ) + "\n";
}

function toXml( values, schema ) {
	var doc = domImplementation.createDocument();
	var root = doc.createElement( "result" );
	var keys = _.keys( schema );

	values.map( function( obj ) {
		var row = doc.createElement( "row" );
		keys.forEach( function( key ) {
			var value = obj[ key ];
			if ( value !== null && value !== undefined ) {
				row.setAttribute( key, _.isDate( value ) ? value.toISOString() : value );
			}
		} );
		return row;
	} )
	.forEach( root.appendChild.bind( root ) );

	return xmlSerializer.serializeToString( root );
}

function createParameter( val, key ) {
	if ( typeof val !== "object" ) {
		return {
			key: key,
			value: val
		};
	}

	// for backward compatibility with boolean asTable
	if ( val.asTable === true ) {
		val.asTable = {
			value: val.type
		};
		val.val = val.val.map( function( x ) {
			return { value: x };
		} );
	}

	if ( val.asTable ) {
		return {
			key: key + "Xml",
			type: sql.NVarChar,
			value: toXml( val.val, val.asTable ),
			sqlPrefix: buildTableVariableSql( key, val.asTable )
		};
	}
	return {
		key: key,
		type: val.type,
		value: val.val
	};
}

function nonPreparedSql( state, name, options ) {
	var req = new sql.Request( state.transaction || state.connection );
	req.multiple = options.hasOwnProperty( "multiple" ) ? options.multiple : false;

	var params = _.map( options.params, createParameter );

	params.forEach( function( param ) {
			if ( param.type ) {
				req.input( param.key, param.type, param.value );
			} else {
				req.input( param.key, param.value );
			}
		} );

	var operation = options.query ? "query" : "execute";
	var prefix = _.pluck( params, "sqlPrefix" ).join( "" );
	var sqlCmd = prefix + ( options.query || options.procedure );

	if ( state.metrics ) {
		return state.metrics.instrument(
			{
				key: [ "sql", name ],
				namespace: state.metricsNamespace,
				call: function( cb ) {
					return req[ operation ]( sqlCmd, cb );
				},
				success: _.identity,
				failure: _.identity
			}
		);
	} else {
		return lift( req[ operation ] ).bind( req )( sqlCmd );
	}
}

function preparedSql( state, name, options ) {
	var cmd = new sql.PreparedStatement( state.transaction || state.connection );
	cmd.multiple = options.hasOwnProperty( "multiple" ) ? options.multiple : false;

	var params = _.map( options.params, createParameter );

	var paramKeyValues = {};
	params.forEach( function( param ) {
		cmd.input( param.key, param.type );
		paramKeyValues[ param.key ] = param.value;
	} );

	var prepare = lift( cmd.prepare ).bind( cmd );
	var execute = lift( cmd.execute ).bind( cmd );
	var unprepare = lift( cmd.unprepare ).bind( cmd );
	var prefix = _.pluck( params, "sqlPrefix" ).join( "" );
	var statement = prefix + options.preparedSql;

	function op() {
		return prepare( statement )
			.then( function() {
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
	}
	if ( state.metrics ) {
		return state.metrics.instrument(
			{
				key: [ "sql", name ],
				namespace: state.metricsNamespace,
				call: function() {
					return op();
				},
				success: _.identity,
				failure: _.identity
			}
		);
	} else {
		return op();
	}
}

function executeSql( state, name, options ) {
	if ( options.query || options.procedure ) {
		return nonPreparedSql( state, name, options );
	} else {
		return preparedSql( state, name, options );
	}
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
