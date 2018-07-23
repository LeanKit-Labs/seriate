var _ = require( "lodash" );
var when = require( "when" );
var util = require( "util" );
var Monologue = require( "monologue.js" );
var machina = require( "machina" );
var log = require( "./log" )( "seriate.sql" );
var addState = require( "./sqlContextUtils" ).addState;

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
			this.options = options;
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
