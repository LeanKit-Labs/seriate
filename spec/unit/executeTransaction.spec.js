var records = require( "./fakeRecordSet.json" );

describe( "Seriate Unit Tests", function() {
	describe( "when using seriate.executeTransaction", function() {
		var reqStub, connStub, prepStub, seriate, sql, tranStub;
		beforeEach( function() {
			sql = mssqlFactory( {}, function( _sql ) {
				// First - we need stub instances of several mssql
				// constructors,and we need to invoke callbacks
				// passed to some of them
				reqStub = sinon.createStubInstance( _sql.Request );
				reqStub.query.callsArgWith( 1, null, records );
				reqStub.execute.callsArgWith( 1, null, records );
				connStub = sinon.createStubInstance( _sql.Connection );
				prepStub = sinon.createStubInstance( _sql.PreparedStatement );
				prepStub.prepare.callsArgWith( 1, null );
				prepStub.execute.callsArgWith( 1, null, records );
				prepStub.unprepare.callsArgWith( 0, null );
				tranStub = sinon.createStubInstance( _sql.Transaction );
				tranStub.begin.callsArgWith( 0, null );
				tranStub.commit.callsArgWith( 0, null );
				tranStub.rollback.callsArgWith( 0, null );

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

				sinon.stub( _sql, "PreparedStatement", function() {
					return prepStub;
				} );

				sinon.stub( _sql, "Transaction", function() {
					return tranStub;
				} );
			} );

			seriate = seriateFactory( {
				mssql: sql
			} );
		} );

		it( "should return expected data", function( done ) {
			seriate.executeTransaction( {}, {
				query: "select * from sys.tables"
			} ).then( function( res ) {
				res.transaction.should.have.keys( "rollback", "commit" );
				res.transaction.commit()
					.then( function() {
						tranStub.commit.should.be.calledOnce;
						tranStub.rollback.should.not.be.called;
						res.sets.__result__.should.eql( records );
						done();
					} );
			} );
		} );

		describe( "when transaction fails to begin", function() {
			beforeEach( function() {
				tranStub.begin.callsArgWith( 0, new Error(), null );
			} );
			it( "should invoke error handler", function( done ) {
				seriate.executeTransaction( {}, {
					query: "select * from sys.tables"
				} ).then( null, function( res ) {
					tranStub.commit.should.not.be.called;
					reqStub.query.should.not.be.called;
					done();
				} );
			} );
		} );

		describe( "when explicitly rolling back", function() {
			it( "should rollback and not commit", function( done ) {
				seriate.executeTransaction( {}, {
					query: "select * from sys.tables"
				} ).then( function( res ) {
					res.transaction.rollback()
						.then( function() {
							tranStub.commit.should.not.be.called;
							tranStub.rollback.should.be.calledOnce;
							done();
						} );
				} );
			} );
		} );

		describe( "when rolling back because of an error", function() {
			beforeEach( function() {
				reqStub.query.callsArgWith( 1, new Error(), null );
				reqStub.execute.callsArgWith( 1, new Error(), null );
			} );
			it( "should automatically roll back", function( done ) {
				seriate.executeTransaction( {}, {
					query: "select * from sys.tables"
				} ).then( null, function( res ) {
					tranStub.commit.should.not.be.called;
					tranStub.rollback.should.be.calledOnce;
					done();
				} );
			} );
		} );

		describe( "when rolling back because of a commit invocation error", function() {
			beforeEach( function() {
				tranStub.commit.callsArgWith( 0, new Error(), null );
			} );
			it( "should automatically roll back", function( done ) {
				seriate.executeTransaction( {}, {
					query: "select * from sys.tables"
				} ).then( function( res ) {
					res.transaction.commit().then( null, function() {
						tranStub.rollback.should.be.calledOnce;
						done();
					} );
				} );
			} );
		} );

		describe( "when rolling back fails", function() {
			beforeEach( function() {
				tranStub.rollback.callsArgWith( 0, new Error(), null );
			} );
			it( "should reject", function( done ) {
				seriate.executeTransaction( {}, {
					query: "select * from sys.tables"
				} ).then( function( res ) {
					res.transaction.rollback().then( null, function() {
						done();
					} );
				} );
			} );
		} );
	} );
} );
