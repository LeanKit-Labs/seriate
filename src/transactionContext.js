var when = require( 'when' );

function errorHandler( err ) {
	this.err = err;
	this.transition( 'Error' );
}

module.exports = function( sql, SqlContext ) {

	var TransactionContext = SqlContext.extend( {
		states: {
			uninitialized: {
				'start': 'connecting'
			},
			connecting: {
				success: 'startingTransaction'
			},
			startingTransaction: {
				_onEnter: function() {
					this.transaction = this.transaction || new sql.Transaction( this.connection );
					var args = [

 function( err ) {
							if ( err ) {
								this.handle( 'error', err );
							} else {
								this.handle( 'success' );
							}
}.bind( this ) ];
					if ( this.isolationLevel ) {
						args.shift( this.isolationLevel );
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
					self.emit( 'end', {
						sets: self.results,
						transaction: {
							commit: function() {
								return when.promise( function( resolve, reject ) {
									self.transaction.commit( function( err ) {
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
			}
		}
	} );

	return TransactionContext;
};