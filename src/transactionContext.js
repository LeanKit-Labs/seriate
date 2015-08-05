var when = require( "when" );
var util = require( "util" );
var log = require( "./log" )( "seriate.transaction" );
var sql = require( "mssql" );

function errorHandler( err ) {
	this.err = err;
	this.transition( "error" );
}

module.exports = function( SqlContext ) {
	var TransactionContext = SqlContext.extend( {
		states: {
			connecting: {
				success: "startingTransaction"
			},
			startingTransaction: {
				_onEnter: function() {
					this.transaction = this.transaction || new sql.Transaction( this.connection );
					var args = [ function( err ) {
						if ( err ) {
							this.handle( "error", err );
						} else {
							this.handle( "success" );
						}
					}.bind( this ) ];
					if ( this.isolationLevel ) {
						args.unshift( this.isolationLevel );
					}
					this.transaction.begin.apply( this.transaction, args );
				},
				success: function() {
					this.nextState();
				},
				error: errorHandler
			},
			done: {
				_onEnter: function() {
					var self = this;
					self.emit( "end", {
						sets: self.results,
						transaction: {
							commit: function() {
								return when.promise( function( resolve, reject ) {
									self.transaction.commit( function( commitError ) {
										if ( commitError ) {
											self.transaction.rollback( function( rollbackErr ) {
												if ( rollbackErr ) {
													var message = util.format( "Error occurred during automatic roll back after a commit error.\n\tCommit error: %s\n\tRollback error: %s\n",
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
							rollback: function() {
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
				_onEnter: function() {
					var message = util.format( "TransactionContext Error. Failed on step \"%s\" with: \"%s\"", this.priorState, this.err.message );
					this.err.message = message;

					if ( this.transaction ) {
						this.transaction.rollback( function( rollbackErr ) {
							if ( rollbackErr ) {
								message = util.format( "Error occurred during automatic roll back after error on transaction on step %s.\n\tTransaction error: %s\n\tRollback error: %s\n",
														this.priorState,
														this.err.message,
														rollbackErr );
							}
							log.error( message );
							this.emit( "error", new Error( message ) );
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
