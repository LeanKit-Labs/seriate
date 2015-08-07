require( "../setup" );
var records = require( "../data/fakeRecordSet.json" );
var mockConnectionFn = require( "../data/mockConnection" );

describe( "First", function() {
	var result, reqMock, transMock, seriate, sql;
	function setup() {
		var request = { query: _.noop, execute: _.noop, input: _.noop };
		var transaction = {
			begin: _.noop,
			commit: _.noop,
			rollback: _.noop
		};
		reqMock = sinon.mock( request );
		transMock = sinon.mock( transaction );

		var connection = mockConnectionFn( true );
		var mssql = require( "mssql" );
		sql = _.merge( mssql, {
			Connection: function() {
				return connection;
			},
			Request: function() {
				return request;
			},
			Transaction: function() {
				return transaction;
			},
			"@global": true
		} );

		seriate = proxyquire( "../src/index", {
			mssql: sql
		} );
		seriate.addConnection( {} );
	}

	before( function() {
		setup();
		reqMock.expects( "query" )
			.withArgs( "select * from sys.tables" )
			.once()
			.callsArgWith( 1, null, fakeRecords );

		return seriate.first( {}, {
			query: "select * from sys.tables"
		} ).then( function( res ) {
			result = res;
		} );
	} );

	it( "should make query call to request", function() {
		reqMock.verify();
	} );

	it( "should return the first row only", function() {
		result.should.eql( records[ 0 ] );
	} );
} );
