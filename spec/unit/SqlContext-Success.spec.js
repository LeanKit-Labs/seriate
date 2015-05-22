/***************************************************

	SqlContext *Successful* Execution Tests

****************************************************/
describe( "Seriate Unit Tests", function() {
	describe( "With Successful SqlContext Executions", function() {
		var reqStub, connStub, prepStub, sql, seriate;
		function testSetup() {
		}
		beforeEach( function() {
			sql = mssqlFactory( {}, function( _sql ) {
				// First - we need stub instances of several mssql
				// constructors,and we need to invoke callbacks
				// passed to some of them
				reqStub = sinon.createStubInstance( _sql.Request );
				reqStub.query.callsArgWith( 1, null, fakeRecords );
				reqStub.execute.callsArgWith( 1, null, fakeRecords );
				connStub = sinon.createStubInstance( _sql.Connection );
				prepStub = sinon.createStubInstance( _sql.PreparedStatement );
				prepStub.prepare.callsArgWith( 1, null );
				prepStub.execute.callsArgWith( 1, null, fakeRecords );
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

			seriate = seriateFactory( {
				mssql: sql
			} );
		} );

		describe( "when getting a SqlContext instance", function() {
			var ctx;
			beforeEach( function() {
				ctx = new seriate.SqlContext();
			} );
			it( "should start in uninitialized", function() {
				ctx.states.uninitialized.should.be.ok;
			} );
		} );

		describe( "when adding a step with same name as an existing step", function() {
			var ctx;
			beforeEach( function() {
				ctx = new seriate.SqlContext();
				ctx.step( "read", {
					query: "select * from sys.tables"
				} );
			} );
			it( "should create a \"read\" state", function() {
				( function() {
					ctx.step( "read", {
						query: "O NO U DIDNT!"
					} );
				} ).should.throw( /A step by that name already exists/ );
			} );
		} );

		describe( "when adding a step using query options object", function() {
			/***************************************************
				PLAIN QUERY TESTING WITH SUCCESSFUL EXECUTION
			****************************************************/
			describe( "with a plain query to execute", function() {
				var ctx;
				beforeEach( function() {
					ctx = new seriate.SqlContext();
					ctx.step( "read", {
						query: "select * from sys.tables"
					} );
				} );
				it( "should create a \"read\" state", function() {
					ctx.states.read.should.be.ok;
				} );
				it( "should create \"read\" state success handler", function() {
					ctx.states.read.success.should.be.ok;
				} );
				it( "should create \"read\" state error handler", function() {
					ctx.states.read.error.should.be.ok;
				} );
			} );

			describe( "and executing a query with no params", function() {
				var ctx;
				beforeEach( function() {
					ctx = new seriate.SqlContext();
					ctx.step( "read", {
						query: "select * from sys.tables"
					} );
				} );
				it( "should call \"query\" on the Request instance", function( done ) {
					ctx.end( function() {
						reqStub.query.should.be.calledWith( "select * from sys.tables" );
						done();
					} );
				} );
				it( "should provide correct structure in results object", function( done ) {
					ctx.end( function( res ) {
						res.should.eql( {
							read: fakeRecords
						} );
						done();
					} );
				} );
				it( "should NOT call the error handler on a successful execution", function( done ) {
					var calledErr = false;
					ctx.error( function() {
						calledErr = true;
					} ).end( function() {
						calledErr.should.equal( false );
						done();
					} );
				} );
			} );

			/*******************************************************
				STORED PROCEDURE TESTING WITH SUCCESSFUL EXECUTION
			********************************************************/
			describe( "with a stored procedure", function() {
				var ctx;
				beforeEach( function() {
					ctx = new seriate.SqlContext();
					ctx.step( "proc", {
						procedure: "sp_who2"
					} );
				} );
				it( "should create a \"proc\" state", function() {
					ctx.states.proc.should.be.ok;
				} );
				it( "should create \"proc\" state success handler", function() {
					ctx.states.proc.success.should.be.ok;
				} );
				it( "should create \"proc\" state error handler", function() {
					ctx.states.proc.error.should.be.ok;
				} );
			} );

			describe( "and executing a proc with no params", function() {
				var ctx;
				beforeEach( function() {
					ctx = new seriate.SqlContext();
					ctx.step( "proc", {
						procedure: "sp_who2"
					} );
				} );
				it( "should call \"execute\" on the Request instance", function( done ) {
					ctx.end( function() {
						reqStub.execute.should.be.calledWith( "sp_who2" );
						done();
					} );
				} );
				it( "should provide correct structure in results object", function( done ) {
					ctx.end( function( res ) {
						res.should.eql( {
							proc: fakeRecords
						} );
						done();
					} );
				} );
				it( "should NOT call the error handler on a successful execution", function( done ) {
					var calledErr = false;
					ctx.error( function() {
						calledErr = true;
					} ).end( function() {
						calledErr.should.equal( false );
						done();
					} );
				} );
			} );

			describe( "and executing a proc with params", function() {
				var ctx;
				beforeEach( function() {
					ctx = new seriate.SqlContext();
					ctx.step( "proc", {
						procedure: "sp_who2",
						params: {
							param1: {
								type: sql.INT,
								val: 9
							},
							param2: "Hai Mom"
						}
					} );
				} );
				it( "should call \"execute\" on the Request instance", function( done ) {
					ctx.end( function() {
						reqStub.execute.should.be.calledWith( "sp_who2" );
						done();
					} );
				} );
				it( "should provide correct structure in results object", function( done ) {
					ctx.end( function( res ) {
						res.should.eql( {
							proc: fakeRecords
						} );
						done();
					} );
				} );
				it( "should call \"input\" on the Request instance for param1", function( done ) {
					ctx.end( function() {
						reqStub.input.should.be.calledTwice;
						reqStub.input.should.be.calledWith( "param1", sql.INT, 9 );
						done();
					} );
				} );
				it( "should call \"input\" on the Request instance for param2", function( done ) {
					ctx.end( function() {
						reqStub.input.should.be.calledTwice;
						reqStub.input.should.be.calledWith( "param2", "Hai Mom" );
						done();
					} );
				} );
				it( "should NOT call the error handler on a successful execution", function( done ) {
					var calledErr = false;
					ctx.error( function() {
						calledErr = true;
					} ).end( function() {
						calledErr.should.equal( false );
						done();
					} );
				} );
			} );

			/*******************************************************
				PREPARED SQL TESTING WITH SUCCESSFUL EXECUTION
			********************************************************/
			describe( "with prepared sql", function() {
				var ctx;
				beforeEach( function() {
					ctx = new seriate.SqlContext();
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
				it( "should create a \"prepped\" state", function() {
					ctx.states.prepped.should.be.ok;
				} );
				it( "should create \"prepped\" state success handler", function() {
					ctx.states.prepped.success.should.be.ok;
				} );
				it( "should create \"prepped\" state error handler", function() {
					ctx.states.prepped.error.should.be.ok;
				} );
			} );

			describe( "and executing prepared sql with params", function() {
				var ctx;
				beforeEach( function() {
					ctx = new seriate.SqlContext();
					ctx.step( "prepped", {
						preparedSql: "select * from sys.tables where type_desc = @usertable",
						params: {
							usertable: {
								type: sql.NVarChar,
								val: "USER_TABLE"
							}
						}
					} );
					//ctx.on( "*", console.log );
				} );
				it( "should call \"prepare\" on the PreparedStatement instance", function( done ) {
					ctx.end( function() {
						prepStub.prepare.should.be.calledWith( "select * from sys.tables where type_desc = @usertable" );
						done();
					} );
				} );
				it( "should call \"execute\" on the PreparedStatement instance", function( done ) {
					ctx.end( function() {
						prepStub.execute.should.be.calledWith( {
							usertable: "USER_TABLE"
						} );
						done();
					} );
				} );
				it( "should call \"unprepare\" on the PreparedStatement instance", function( done ) {
					//console.log( prepStub.unprepare );
					ctx.end( function() {
						prepStub.unprepare.should.be.calledOnce;
						done();
					} );
				} );
				it( "should provide correct structure in results object", function( done ) {
					ctx.end( function( res ) {
						res.should.eql( {
							prepped: fakeRecords
						} );
						done();
					} );
				} );
				it( "should call \"input\" on the PreparedStatement instance for usertable parameter", function( done ) {
					ctx.end( function() {
						prepStub.input.should.be.calledOnce.and.calledWith( "usertable", sql.NVarChar );
						done();
					} );
				} );
				it( "should NOT call the error handler on a successful execution", function( done ) {
					var calledErr = false;
					ctx.error( function() {
						calledErr = true;
					} ).end( function() {
						calledErr.should.equal( false );
						done();
					} );
				} );
			} );
		} );
	} );
} );
