var sql = require( '../src/index.js' );
console.log( 'sql', sql);
var mod = {};

sql.getTransactionContext( {
	user: 'nodejs',
	password: 'nodejs',
	server: '10.0.1.4',
	// domain: '', // - uncomment to test NTLM
	database: 'master'
} )
	.step( 'readTables', function( execute ) {
		execute( {
			query: 'select * from sys.tables'
		} );
	} )
	.step( 'readUsers', {
		query: 'select * From sys.sysusers'
	} )
	.step( 'readLogins', function( execute, data ) {
		console.log( 'For example...some data from the last step: ' );
		console.log( data.readUsers.map( function( x ) {
			return x.name;
		} ) );
		execute( {
			query: 'select * From sys.syslogins'
		} );
	} )
	.step( 'sp_who2', {
		procedure: 'sp_who2'
	} )
	.step( 'sp_who', {
		procedure: 'sp_who'
	} )
	.step( 'preparedSql', function( execute ) {
		execute( {
			preparedSql: 'select * from sys.tables where type_desc = @usertable',
			params: {
				usertable: {
					type: sql.NVarChar,
					val: 'USER_TABLE'
				}
			}
		} );
	} ).error( function( err ) {
		console.log( 'O NOES! \n %s', err );
	} ).end( function( ctx ) {
		console.log( 'All Steps Complete' );
		console.log( Object.keys( ctx ) );
		console.log( 'We are done here. Control+C gets you out.' );
	} );

module.exports = mod;