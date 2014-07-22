var when = require( 'when' );
var SqlContext;
var TransactionContext;

function promisify( context, queryOptions ) {
	context.step( 'result', queryOptions );
	return when.promise( function( resolve, reject, notify ) {
		context
			.end( resolve )
			.error( reject )
			.on( 'data', notify );
	} );
}

module.exports = function( mssql, SqlContextCtor, TransactionContextCtor ) {
	SqlContext = SqlContextCtor;
	TransactionContext = TransactionContextCtor;
	return {
		sql: mssql,
		getTransactionContext: function( config ) {
			return new TransactionContext( {
				connectionCfg: config
			} );
		},
		getPlainContext: function( config ) {
			return new SqlContext( {
				connectionCfg: config
			} );
		},
		executeTransaction: function( connCfg, queryOptions ) {
			return promisify( new TransactionContext( {
				connectionCfg: connCfg
			} ), queryOptions );
		},
		execute: function( connCfg, queryOptions ) {
			return promisify( new SqlContext( {
				connectionCfg: connCfg
			} ), queryOptions );
		}
	};
};