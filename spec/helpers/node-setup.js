global.proxyquire = require( "proxyquire" ).noPreserveCache();
global.expect = require( "expect.js" );
global.when = require( "when" );
global.sinon = require( "sinon" );
require( "sinon-as-promised" )( global.when.Promise );
global.expect = require( "sinon-expect" ).enhance( global.expect, global.sinon, "was" );
global.Monologue = require( "monologue.js" );
global.machina = require( "machina" );
global.fakeRecords = require( "../unit/fakeRecordSet.json" );

global.mssqlFactory = function mssqlFactory( stubs, transform ) {
	var sql = proxyquire( "mssql", stubs || {} );
	if ( transform ) {
		transform( sql );
	}
	return sql;
};
