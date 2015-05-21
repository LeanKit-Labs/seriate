/***************************************************

	SqlContext *FAILING* Execution Tests

****************************************************/
describe( "With Failing SqlContext Executions: ", function() {
	var reqStub, connStub, prepStub, sql, SqlContext;
	beforeEach( function() {
		sql = mssqlFactory( {}, function( _sql ) {
			// First - we need stub instances of several mssql
			// constructors,and we need to invoke callbacks
			// passed to some of them
			reqStub = sinon.createStubInstance( _sql.Request );
			reqStub.query.callsArgWith( 1, new Error(), null );
			reqStub.execute.callsArgWith( 1, new Error(), null );
			connStub = sinon.createStubInstance( _sql.Connection );
			prepStub = sinon.createStubInstance( _sql.PreparedStatement );
			prepStub.prepare.callsArgWith( 1, null );
			prepStub.execute.callsArgWith( 1, new Error(), null );
			prepStub.unprepare.callsArgWith( 0, null );

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
		} );
		SqlContext = require( "../../src/sqlContext.js" )( sql, Monologue, machina );
	} );
	afterEach( function() {
		sql.Connection.restore();
		sql.Request.restore();
		sql.PreparedStatement.restore();
	} );
	describe( "when adding a step using query options object", function() {
		/***************************************************
			PLAIN QUERY TESTING WITH FAILING EXECUTION
		****************************************************/
		describe( "and executing a query", function() {
			var ctx;
			beforeEach( function() {
				ctx = new SqlContext();
				ctx.step( "read", {
					query: "select * from sys.tables"
				} );
			} );
			it( "should call the error handler", function( done ) {
				ctx.error( function( err ) {
					expect( err.message.substr( 0, 47 ) ).to.be( "Seriate SqlContext Error. Failed on step 'read'" );
					done();
				} );
			} );
			it( "should NOT call the success (end) handler on a failed execution", function( done ) {
				var calledEnd = false;
				ctx.error( function() {
					expect( calledEnd ).to.be( false );
					done();
				} ).end( function() {
					calledEnd = true;
				} );
			} );
		} );

		/***************************************************
		   STORED PROCEDURE TESTING WITH FAILING EXECUTION
		****************************************************/
		describe( "and executing a proc", function() {
			var ctx;
			beforeEach( function() {
				ctx = new SqlContext();
				ctx.step( "proc", {
					procedure: "sp_who2"
				} );
			} );
			it( "should call the error handler", function( done ) {
				ctx.error( function( err ) {
					expect( err.message.substr( 0, 47 ) ).to.be( "Seriate SqlContext Error. Failed on step 'proc'" );
					done();
				} );
			} );
			it( "should NOT call the success (end) handler on a failed execution", function( done ) {
				var calledEnd = false;
				ctx.error( function() {
					expect( calledEnd ).to.be( false );
					done();
				} ).end( function() {
					calledEnd = true;
				} );
			} );
		} );

		/*******************************************************
			PREPARED SQL TESTING WITH FAILING EXECUTION
		********************************************************/
		describe( "and executing prepared sql", function() {
			var ctx;
			beforeEach( function() {
				ctx = new SqlContext();
				ctx.step( "prepped", {
					preparedSql: "select * from sys.tables where type_desc = @usertable",
					params: {
						usertable: {
							type: sql.NVarChar,
							val: "USER_TABLE"
						}
					}
				} );
			} );
			it( "should call the error handler", function( done ) {
				ctx.error( function( err ) {
					expect( err.message.substr( 0, 50 ) ).to.be( "Seriate SqlContext Error. Failed on step 'prepped'" );
					done();
				} );
			} );
			it( "should NOT call the success (end) handler on a failed execution", function( done ) {
				var calledEnd = false;
				ctx.error( function() {
					expect( calledEnd ).to.be( false );
					done();
				} ).end( function() {
					calledEnd = true;
				} );
			} );
		} );
	} );
} );
