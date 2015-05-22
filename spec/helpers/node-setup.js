global.proxyquire = require( "proxyquire" ).noPreserveCache();
global.when = require( "when" );
global.sinon = require( "sinon" );
var chai = require( "chai" );
require( "sinon-as-promised" )( global.when.Promise );
chai.use( require( "sinon-chai" ) );
chai.use( require( "chai-as-promised" ) );
global.should = chai.should();
global.Monologue = require( "monologue.js" );
global.machina = require( "machina" );
global.fakeRecords = require( "../unit/fakeRecordSet.json" );

global.mssqlFactory = function mssqlFactory( stubs, transform ) {
	delete require.cache[require.resolve( "mssql/lib/main.js" )];
	var sql = proxyquire( "mssql", stubs || {} );
	if ( transform ) {
		transform( sql );
	}
	return sql;
};

global.seriateFactory = function( stubs ) {
	stubs = stubs || {};
	stubs.mssql = stubs.mssql || mssqlFactory();
	return proxyquire( "../../src/index.js", ( stubs || {} ) );
};
