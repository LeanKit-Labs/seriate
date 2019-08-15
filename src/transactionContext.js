var _ = require( "lodash" );
var when = require( "when" );
var util = require( "util" );
var log = require( "./log" )( "seriate.transaction" );
var sql = require( "mssql" );

function errorHandler( err ) {
	this.err = err;
	this.transition( "error" );
}

module.exports = function( SqlContext ) {
	const TransactionContext = SqlContext.extend( {
		states: {
			connecting: {
				success: "startingTransaction"
			},
			startingTransaction: {
				_onEnter() {
					const args = [ function( err ) {
						if ( err ) {
							this.handle( "error", err );
						} else {
							this.handle( "success" );
						}
					}.bind( this ) ];

					if ( this.isolationLevel ) {
						let isolationLevel = this.isolationLevel;
						if ( _.isString( this.isolationLevel ) ) {
							isolationLevel = sql.ISOLATION_LEVEL[ this.isolationLevel.toUpperCase() ];
							if ( isolationLevel === undefined ) {
								const err = new Error( `Unknown isolation level: "${ this.isolationLevel }"` );
								this.handle( "error", err );
							}
						}
						args.unshift( isolationLevel );
					}

					if ( this.options.atTransactionStart ) {
						const startStepAction = this.options.atTransactionStart( this.options.dataForHooks );
						this.step( "__beforeHook__", startStepAction );
					}

					if ( this.options.atTransactionEnd ) {
						const endStepAction = this.options.atTransactionEnd( this.options.dataForHooks );
						this.step( "__afterHook__", endStepAction );
					}

					this.transaction = this.transaction || new sql.Transaction( this.connection );
					this.transaction.begin( ...args );
				},
				success() {
					this.nextState();
				},
				error: errorHandler
			},
			done: {
				_onEnter() {
					const self = this;
					self.emit( "end", {
						sets: self.results,
						transaction: {
							commit() {
								return when.promise( function( resolve, reject ) {
									self.transaction.commit( function( commitError ) {
										if ( commitError ) {
											self.transaction.rollback( function( rollbackErr ) {
												if ( rollbackErr ) {
													const message = util.format( "Error occurred during automatic roll back after a commit error.\n\tCommit error: %s\n\tRollback error: %s\n",
														commitError,
														rollbackErr );
													log.error( message );
													reject( new Error( message ) );
												} else {
													reject( commitError );
												}
											} );
										} else {
											resolve();
										}
									} );
								} );
							},
							rollback() {
								return when.promise( function( resolve, reject ) {
									self.transaction.rollback( function( err ) {
										if ( err ) {
											log.error( "Error occurred while rolling back: %s", err.message );
											reject( err );
										} else {
											resolve();
										}
									} );
								} );
							}
						}
					} );
				}
			},
			error: {
				_onEnter() {
					const precedingErrorMessage = _.map( this.err && this.err.precedingErrors, function( error ) {
						return `\n\tPreceding error: ${ error.message }`;
					} ).join( "" );

					let message = util.format( "TransactionContext Error. Failed on step \"%s\" with: \"%s\"%s", this.priorState, this.err.message, precedingErrorMessage );
					this.err.message = message;
					this.err.step = this.priorState;

					if ( this.transaction ) {
						this.transaction.rollback( function( rollbackErr ) {
							if ( rollbackErr ) {
								message = util.format( "Error occurred during automatic roll back after error on transaction on step %s.\n\tTransaction error: %s\n\tRollback error: %s\n",
									this.priorState,
									this.err.message,
									rollbackErr );
								this.err.message = message;
							}
							log.error( message );
							this.emit( "error", this.err );
						}.bind( this ) );
					} else {
						log.error( message );
						this.emit( "error", this.err );
					}
				}
			}
		}
	} );

	return TransactionContext;
};
