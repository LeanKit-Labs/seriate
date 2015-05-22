var records = require( "./fakeRecordSet.json" );

describe( "Seriate Unit Tests", function() {
	describe( "when using seriate.first", function() {
		var reqStub, connStub, prepStub, seriate, sql;
		beforeEach( function() {
			sql = mssqlFactory( {}, function( _sql ) {
				// First - we need stub instances of several mssql
				// constructors,and we need to invoke callbacks
				// passed to some of them
				reqStub = sinon.createStubInstance( _sql.Request );
				reqStub.query.callsArgWith( 1, null, records );
				reqStub.execute.callsArgWith( 1, null, records );
				connStub = sinon.createStubInstance( _sql.Connection );
				// Now that we have stub instances, we need to stub
				// the calls to the constructor functions to return
				// our stubs instead
				sinon.stub( _sql, "Connection", function( opt, fn ) {
					process.nextTick( fn );
					return connStub;
				} );

				sinon.stub( _sql, "Request", function() {
					return reqStub;
				} );
			} );

			seriate = seriateFactory( {
				mssql: sql
			} );
		} );

		it( "should return the first row only", function( done ) {
			seriate.first( {}, {
				query: "select * from sys.tables"
			} ).then( function( res ) {
				res.should.eql( records[0] );
				done();
			} );
		} );
	} );
} );
