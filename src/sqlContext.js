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

function errorHandler( err ) {
	this.err = err;
	this.transition( "error" );
}

function buildTableVariableSql( key, val ) {
	return _.template( utils.fromFile( "./sql/buildTableVar" ) )( {
		name: key,
		type: declare( val.type, val )
	} );
}

function toXml( values ) {
	return "<result>" + values.map( function( value ) {
		return "<row value=\"" + value.toString().replace( /"/g, "&quot;" ) + "\"/>";
	} ) + "</result>";
}

function nonPreparedSql( state, name, options ) {
	var req = new sql.Request( state.transaction || state.connection );
	req.multiple = options.hasOwnProperty( "multiple" ) ? options.multiple : false;

	var tableVariables = "";
	_.each( options.params, function( val, key ) {
		if ( typeof val === "object" ) {
			if ( val.asTable ) {
				tableVariables = tableVariables + buildTableVariableSql( key, val );
				req.input( key + "Xml", sql.Xml(), toXml( val.val ) );
			} else {
				req.input( key, val.type, val.val );
			}
		} else {
			req.input( key, val );
		}
	} );
	var operation = options.query ? "query" : "execute";
	if ( tableVariables ) {
		tableVariables += "\n";
	}

	var sqlCmd = tableVariables + ( options.query || options.procedure );
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
	var paramKeyValues = {};
	var tableVariables = "";

	_.each( options.params, function( val, key ) {
		if ( typeof val === "object" ) {
			if ( val.asTable ) {
				tableVariables = tableVariables + buildTableVariableSql( key, val );
				var xml = toXml( val.val );
				cmd.input( key + "Xml", sql.Xml(), xml );
				paramKeyValues[ key + "Xml" ] = xml;
			} else {
				cmd.input( key, val.type );
				paramKeyValues[ key ] = val.val;
			}
		} else {
			cmd.input( key );
			paramKeyValues[ key ] = val;
		}
	} );
	var prepare = lift( cmd.prepare ).bind( cmd );
	var execute = lift( cmd.execute ).bind( cmd );
	var unprepare = lift( cmd.unprepare ).bind( cmd );
	if ( tableVariables ) {
		tableVariables += "\n";
	}
	var statement = tableVariables + options.preparedSql;
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
			var execCalled = false;
			var skipped = false;
			var exec = function( options ) {
				if ( skipped ) {
					var err = new Error( "Step '" + name + "' has already been skipped. Did you forget to return a promise?" );
					errorHandler.call( fsm, err ); // Attempt to reject promise for sql transaction
					throw err; // Reject the runaway promise
				}

				execCalled = true;
				executeSql( fsm, name, options )
					.then(
						fsm.handle.bind( fsm, "success" ),
						fsm.handle.bind( fsm, "error" )
					);
			};

			var stepReturnValue = stepAction.call(
				fsm,
				exec,
				fsm.results
			);

			when( stepReturnValue )
				.then( function() {
					if ( !execCalled ) {
						skipped = true;
						fsm.nextState();
					}
				}, fsm.handle.bind( fsm, "error" ) );
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
					var message = util.format( "SqlContext Error. Failed on step \"%s\" with: \"%s\"", this.priorState, this.err.message );
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
