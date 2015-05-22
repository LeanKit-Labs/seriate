var when = require( "when" );

function errorHandler( err ) {
	this.err = err;
	this.transition( "error" );
}

module.exports = function( sql, SqlContext ) {
	var TransactionContext = SqlContext.extend( {
		states: {
			uninitialized: {
				start: "connecting"
			},
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
									self.transaction.commit( function( err ) {
										if ( self.connection.close ) {
											self.connection.close();
										}
										if ( err ) {
											self.transaction.rollback( function() {
												// TODO: capture error if one happens during
												// rollback and attach as inner exception?
												reject( err );
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
										if ( self.connection.close ) {
											self.connection.close();
										}
										if ( err ) {
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
					this.err.message = "Seriate SqlContext Error. Failed on step '" + this.priorState + "'." + this.err.message;
					this.transaction.rollback( function() {
						this.emit( "error", this.err );
					}.bind( this ) );
					if ( this.connection.close ) {
						this.connection.close();
					}
				}
			}
		}
	} );

	return TransactionContext;
};
