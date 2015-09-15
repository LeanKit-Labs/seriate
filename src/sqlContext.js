var _ = require( "lodash" );
var when = require( "when" );
var lift = require( "when/node" ).lift;
var sql = require( "mssql" );
var util = require( "util" );
var log = require( "./log" )( "seriate.sql" );
var Monologue = require( "monologue.js" );
var machina = require( "machina" );

function errorHandler( err ) {
	this.err = err;
	this.transition( "error" );
}

function nonPreparedSql( state, name, options ) {
	var req = new sql.Request( state.transaction || state.connection );
	req.multiple = options.hasOwnProperty( "multiple" ) ? options.multiple : false;
	_.each( options.params, function( val, key ) {
		if ( typeof val === "object" ) {
			req.input( key, val.type, val.val );
		} else {
			req.input( key, val );
		}
	} );
	var operation = options.query ? "query" : "execute";
	var sqlCmd = options.query || options.procedure;
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
	_.each( options.params, function( val, key ) {
		if ( typeof val === "object" ) {
			cmd.input( key, val.type );
			paramKeyValues[ key ] = val.val;
		} else {
			cmd.input( key );
			paramKeyValues[ key ] = val;
		}
	} );
	var prepare = lift( cmd.prepare ).bind( cmd );
	var execute = lift( cmd.execute ).bind( cmd );
	var unprepare = lift( cmd.unprepare ).bind( cmd );
	function op() {
		return prepare( options.preparedSql )
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
			var exec = function( options ) {
				executeSql( fsm, name, options )
					.then(
						fsm.handle.bind( fsm, "success" ),
						fsm.handle.bind( fsm, "error" )
					);
			};
			stepAction.call(
				fsm,
				exec,
				fsm.results
			);
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
