/* eslint-disable prefer-rest-params */
const tedious = require( "tedious" );

// I've seen things you people wouldn't believe
// WHAT DO YOU MEAN BY 'YOU PEOPLE'?!
/*
	No really, what's the deal here?
	Well - it seems that tedious + mssql do not reset connections for us.
	So we made them. (really, mssql would ideally be doing this when verifying or
	in an acquire hook before handing connection to a consumer.) Instead, we've
	patched tedious (and we're not crazy about this) to:
		* reset before transactions & prepared SQL (but it will wait until the transaction is done or until after
		  the prepared SQL is unprepared.)
		* reset before any batch that's not a transaction or prepared SQL

	The `inTransaction` and `resetConnectionOnNextRequest` values are internal to tedious,
	and we added `isInPreparedSqlQuery` as part of the patch below.
*/
if ( !tedious.Connection.prototype.makeRequest.__seriatePatched ) {
	const existing = tedious.Connection.prototype.makeRequest;
	tedious.Connection.prototype.makeRequest = function( request, packetType, payload ) {
		if ( this.inTransaction || this.isInPreparedSqlQuery ||
			this.isInBulkLoadOperation || this.resetConnectionOnNextRequest ) {
			if ( request.sqlTextOrProcedure === "sp_unprepare" ) {
				this.isInPreparedSqlQuery = false;
			}
			return existing.call( this, request, packetType, payload );
		}
		return this.reset( function() {
			if ( request.sqlTextOrProcedure === "sp_prepare" ) {
				this.isInPreparedSqlQuery = true;
			}
			return existing.call( this, request, packetType, payload );
		}.bind( this ) );
	};
	tedious.Connection.prototype.makeRequest.__seriatePatched = true;
}

if ( !tedious.Connection.prototype.newBulkLoad.__seriatePatched ) {
	const origNewBulkLoad = tedious.Connection.prototype.newBulkLoad;
	tedious.Connection.prototype.newBulkLoad = function( table, callback ) {
		// eslint-disable-next-line consistent-this
		const thus = this;
		const result = origNewBulkLoad.call( this, table, function() {
			callback.apply( this, arguments );
			thus.isInBulkLoadOperation = false;
		} );
		return result;
	};
	tedious.Connection.prototype.newBulkLoad.__seriatePatched = true;
}

if ( !tedious.Connection.prototype.execBulkLoad.__seriatePatched ) {
	const origExecBulkLoad = tedious.Connection.prototype.execBulkLoad;
	tedious.Connection.prototype.execBulkLoad = function() {
		this.isInBulkLoadOperation = true;
		return origExecBulkLoad.apply( this, arguments );
	};
	tedious.Connection.prototype.execBulkLoad.__seriatePatched = true;
}
