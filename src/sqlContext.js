var _ = require( "lodash" );
var util = require( "util" );
var EventEmitter = require( "events" );

var machina = require( "machina" );
var log = require( "debug" )( "seriate:sql" );
var addState = require( "./sqlContextUtils" ).addState;

module.exports = function() {
	const SqlContext = machina.Fsm.extend( {
		_connected( connection ) {
			this.connection = connection;
			this.handle( "success" );
		},

		_connectionError( err ) {
			this.handle( "error", err );
		},

		initialState: "uninitialized",

		initialize( options ) {
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

		nextState() {
			this.pipePos += 1;
			const nextState = this.pipeline[ this.pipePos ] || "done";
			this.transition( nextState );
		},

		states: {
			uninitialized: {
				start: "connecting",
				"*"() {
					this.deferUntilTransition( "connecting" );
				}
			},
			connecting: {
				success() {
					this.nextState();
				},
				error( err ) {
					this.err = err;
					this.transition( "error" );
				}
			},

			done: {
				_onEnter() {
					this.emit( "end", this.results );
				}
			},

			error: {
				_onEnter() {
					const precedingErrorMessage = _.map( this.err && this.err.precedingErrors, function( error ) {
						return `\n\tPreceding error: ${ error.message }`;
					} ).join( "" );

					const message = util.format( "SqlContext Error. Failed on step \"%s\" with: \"%s\"%s", this.priorState, this.err.message, precedingErrorMessage );
					log( message );
					this.err.message = message;
					this.err.step = this.priorState;
					this.emit( "error", this.err );
				}
			}
		},

		step( alias, stepAction ) {
			let opt;
			if ( typeof stepAction === "object" ) {
				opt = stepAction;
				stepAction = function( execute ) {
					return execute( opt );
				};
			}
			addState( this, alias, stepAction );
			return this;
		},

		deferredStart() {
			if ( !this._started ) {
				process.nextTick( function() {
					this.handle( "start" );
				}.bind( this ) );
				this._started = true;
			}
		},

		end( fn ) {
			this.on( "end", fn );
			this.deferredStart();
			return this;
		},

		error( fn ) {
			this.on( "error", fn );
			this.deferredStart();
			return this;
		},

		then( success, failure ) {
			return new Promise( ( resolve, reject ) => {
				this.end( resolve );
				this.error( reject );
			} ).then( success, failure );
		},

		abort() {
			this.handle( "error", "Operation aborted" );
		},
		...EventEmitter.prototype
	} );

	return SqlContext;
};
