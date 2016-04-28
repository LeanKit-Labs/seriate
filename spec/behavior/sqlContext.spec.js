require( "../setup" );
var mockConnectionFn = require( "../data/mockConnection" );
var when = require( "when" );

/***************************************************

	SqlContext *Successful* Execution Tests

****************************************************/
describe( "SqlContext", function() {
	var sql, seriate, reqMock, prepMock;
	function setup() {
		var request = { query: _.noop, execute: _.noop, input: _.noop };
		var preparedStatement = {
			prepare: _.noop,
			execute: _.noop,
			unprepare: _.noop,
			input: _.noop,
			procedure: undefined,
			params: undefined
		};
		reqMock = sinon.mock( request );
		prepMock = sinon.mock( preparedStatement );

		var connection = mockConnectionFn( true );
		var mssql = require( "mssql" );
		sql = _.merge( mssql, {
			Connection: function() {
				return connection;
			},
			Request: function() {
				return request;
			},
			PreparedStatement: function() {
				return preparedStatement;
			},
			"@global": true
		} );

		seriate = proxyquire( "../src/index", {
			mssql: sql
		} );
		seriate.addConnection( {} );
	}

	describe( "when getting a SqlContext instance", function() {
		var ctx;
		before( function() {
			setup();
			ctx = seriate.getPlainContext();
		} );

		it( "should start in uninitialized", function() {
			ctx.states.uninitialized.should.be.ok;
		} );
	} );

	describe( "when adding a duplicate step to a context", function() {
		var ctx;
		before( function() {
			setup();
			ctx = seriate.getPlainContext();
			ctx.step( "read", {
				query: "select * from sys.tables"
			} );
		} );

		it( "should throw an exception on duplicate step", function() {
			( function() {
				ctx.step( "read", {
					query: "O NO U DIDNT!"
				} );
			} ).should.throw( /A step by that name already exists/ );
		} );
	} );

	describe( "when calling a query without parameters", function() {
		var ctx, result;
		before( function() {
			setup();
			reqMock.expects( "query" )
				.withArgs( "select * from sys.tables" )
				.once()
				.callsArgWith( 1, null, fakeRecords );

			ctx = seriate.getPlainContext();
			ctx.step( "read", {
				query: "select * from sys.tables"
			} ).then( function( res ) {
				result = res;
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

		it( "should call query on request", function() {
			reqMock.verify();
		} );

		it( "should provide correct structure in results object", function() {
			result.should.eql( {
				read: fakeRecords
			} );
		} );
	} );

	describe( "when calling a stored procedure without parameters", function() {
		var ctx, result;
		before( function() {
			setup();
			reqMock.expects( "execute" )
				.withArgs( "sp_who2" )
				.once()
				.callsArgWith( 1, null, fakeRecords );

			ctx = seriate.getPlainContext();
			return ctx.step( "proc", {
				procedure: "sp_who2"
			} ).end( function( res ) {
				result = res;
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

		it( "should call execute on request", function() {
			reqMock.verify();
		} );

		it( "should provide correct structure in results object", function() {
			result.should.eql( {
				proc: fakeRecords
			} );
		} );
	} );

	describe( "when executing a stored procedure with parameters", function() {
		var ctx, result;
		before( function() {
			setup();
			reqMock.expects( "execute" )
				.withArgs( "sp_who2" )
				.once()
				.callsArgWith( 1, null, fakeRecords );

			reqMock.expects( "input" )
				.withArgs( "param1", sql.INT, 9 ).once();
			reqMock.expects( "input" )
				.withArgs( "param2", "Hai Mom" ).once();

			ctx = seriate.getPlainContext();
			return ctx.step( "proc", {
				procedure: "sp_who2",
				params: {
					param1: {
						type: sql.INT,
						val: 9
					},
					param2: "Hai Mom"
				}
			} ).then( function( res ) {
				result = res;
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

		it( "should call execute and input for each parameter", function() {
			reqMock.verify();
		} );

		it( "should provide correct structure in results object", function() {
			result.should.eql( {
				proc: fakeRecords
			} );
		} );
	} );

	describe( "when calling prepared sql with parameters", function() {
		var ctx, result;
		before( function() {
			setup();
			prepMock.expects( "prepare" )
				.withArgs( "select * from sys.tables where type_desc = @usertable" )
				.callsArgWith( 1, undefined )
				.once();

			prepMock.expects( "execute" )
				.withArgs( {
					usertable: "USER_TABLE"
				} )
				.callsArgWith( 1, null, fakeRecords )
				.once();

			prepMock.expects( "input" )
				.withArgs( "usertable", sql.NVarChar )
				.once();

			prepMock.expects( "unprepare" )
				.callsArgWith( 0, undefined )
				.once();

			ctx = seriate.getPlainContext();
			return ctx.step( "prepped", {
				preparedSql: "select * from sys.tables where type_desc = @usertable",
				params: {
					usertable: {
						type: sql.NVarChar,
						val: "USER_TABLE"
					}
				}
			} ).then( function( res ) {
				result = res;
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

		it( "should call prepare, execute, unprepare on prepared statement and input for each parameter", function() {
			prepMock.verify();
		} );

		it( "should provide correct structure in results object", function() {
			result.should.eql( {
				prepped: fakeRecords
			} );
		} );
	} );

	describe( "when executing a query throws an error", function() {
		function reqSetup() {
			var testError = new Error( "faux pas" );
			testError.precedingErrors = [
				{ message: "preceding one" },
				{ message: "preceding two" }
			];

			setup();
			reqMock.expects( "query" )
				.withArgs( "select * from sys.tables" )
				.callsArgWith( 1, testError, undefined )
				.once();

			return seriate.getPlainContext();
		}

		describe( "when passing an error handler", function() {
			var error;
			before( function() {
				var ctx = reqSetup();

				return ctx.step( "read", {
					query: "select * from sys.tables"
				} ).then( undefined, function( err ) {
					error = err;
				} );
			} );

			it( "should report error correctly", function() {
				error.message.should.equal( "SqlContext Error. Failed on step \"read\" with: \"faux pas\"\n\tPreceding error: preceding one\n\tPreceding error: preceding two" );
			} );

			it( "should call query on request", function() {
				reqMock.verify();
			} );

			it( "should capture the failing step name on the error", function() {
				error.step.should.equal( "read" );
			} );
		} );

		describe( "when handling the error from the returned promise", function() {
			var error;
			before( function() {
				var ctx = reqSetup();

				return ctx.step( "read", {
					query: "select * from sys.tables"
				} ).then().catch( function( err ) {
					error = err;
				} );
			} );

			it( "should report error correctly", function() {
				error.message.should.equal( "SqlContext Error. Failed on step \"read\" with: \"faux pas\"\n\tPreceding error: preceding one\n\tPreceding error: preceding two" );
			} );

			it( "should call query on request", function() {
				reqMock.verify();
			} );

			it( "should capture the failing step name on the error", function() {
				error.step.should.equal( "read" );
			} );
		} );
	} );

	describe( "when executing a proc throws an error", function() {
		function reqSetup() {
			setup();
			reqMock.expects( "execute" )
				.withArgs( "sp_who2" )
				.callsArgWith( 1, new Error( "faux pas" ), undefined )
				.once();

			return seriate.getPlainContext();
		}

		describe( "when passing an error handler", function() {
			var error;
			before( function() {
				var ctx = reqSetup();

				return ctx.step( "proc", {
					procedure: "sp_who2"
				} ).then( undefined, function( err ) {
					error = err;
				} );
			} );

			it( "should report error correctly", function() {
				error.message.should.equal( "SqlContext Error. Failed on step \"proc\" with: \"faux pas\"" );
			} );

			it( "should call execute on request", function() {
				reqMock.verify();
			} );

			it( "should capture the failing step name on the error", function() {
				error.step.should.equal( "proc" );
			} );
		} );

		describe( "when handling the error from the returned promise", function() {
			var error;
			before( function() {
				var ctx = reqSetup();

				return ctx.step( "proc", {
					procedure: "sp_who2"
				} ).then().catch( function( err ) {
					error = err;
				} );
			} );

			it( "should report error correctly", function() {
				error.message.should.equal( "SqlContext Error. Failed on step \"proc\" with: \"faux pas\"" );
			} );

			it( "should call execute on request", function() {
				reqMock.verify();
			} );

			it( "should capture the failing step name on the error", function() {
				error.step.should.equal( "proc" );
			} );
		} );
	} );

	describe( "when executing prepared throws an error", function() {
		function prepSetup() {
			setup();
			prepMock.expects( "prepare" )
				.withArgs( "select * from sys.tables where type_desc = @usertable" )
				.callsArgWith( 1, undefined )
				.once();

			prepMock.expects( "execute" )
				.withArgs( {
					usertable: "USER_TABLE"
				} )
				.callsArgWith( 1, new Error( "faux pas" ) )
				.once();

			prepMock.expects( "unprepare" )
				.callsArgWith( 0, null )
				.once();

			prepMock.expects( "input" )
				.withArgs( "usertable", sql.NVarChar )
				.once();

			return seriate.getPlainContext();
		}

		describe( "when passing an error handler", function() {
			var error;
			before( function() {
				var ctx = prepSetup();

				return ctx.step( "prepped", {
					preparedSql: "select * from sys.tables where type_desc = @usertable",
					params: {
						usertable: {
							type: sql.NVarChar,
							val: "USER_TABLE"
						}
					}
				} ).then( undefined, function( err ) {
					error = err;
				} );
			} );

			it( "should report error correctly", function() {
				error.message.should.equal( "SqlContext Error. Failed on step \"prepped\" with: \"faux pas\"" );
			} );

			it( "should execute preparedSql with correct parameters", function() {
				prepMock.verify();
			} );

			it( "should capture the failing step name on the error", function() {
				error.step.should.equal( "prepped" );
			} );
		} );

		describe( "when handling the error from the returned promise", function() {
			var error;
			before( function() {
				var ctx = prepSetup();

				return ctx.step( "prepped", {
					preparedSql: "select * from sys.tables where type_desc = @usertable",
					params: {
						usertable: {
							type: sql.NVarChar,
							val: "USER_TABLE"
						}
					}
				} ).then().catch( function( err ) {
					error = err;
				} );
			} );

			it( "should report error correctly", function() {
				error.message.should.equal( "SqlContext Error. Failed on step \"prepped\" with: \"faux pas\"" );
			} );

			it( "should execute preparedSql with correct parameters", function() {
				prepMock.verify();
			} );

			it( "should capture the failing step name on the error", function() {
				error.step.should.equal( "prepped" );
			} );
		} );
	} );

	describe( "when skipping execute call on a step", function() {
		var ctx;
		before( function() {
			setup();

			reqMock.expects( "query" )
				.withArgs( "select * from sys.tables" )
				.callsArgWith( 1, null, fakeRecords )
				.once();

			ctx = seriate.getPlainContext();
			return ctx
				.step( "skipped", function( execute ) {
					return;
				} )
				.step( "read", {
					query: "select * from sys.tables"
				} );
		} );

		it( "should continue to next step", function() {
			reqMock.verify();
		} );
	} );

	describe( "when failing to return promise", function() {
		var runaway;
		before( function() {
			setup();

			reqMock.expects( "query" )
				.withArgs( "select * from sys.tables" )
				.never();

			return seriate.getPlainContext()
				.step( "badPromise", function( execute ) {
					runaway = when( true )
						.delay( 1 ) // Here to delay the call to execute but allow fsm to transition to success state
						.then( function() {
							execute( {
								query: "select * from sys.tables"
							} );
						} );
				} );
		} );

		it( "should throw error", function( done ) {
			return runaway
				.catch( function( err ) {
					err.should.be.instanceof( Error );
					done();
				} );
		} );

		it( "should not invoke sql", function( ) {
			reqMock.verify();
		} );
	} );

	describe( "when a step return rejects a promise", function() {
		var error;
		before( function() {
			setup();

			return seriate.getPlainContext()
				.step( "brokenPromise", function( execute ) {
					return when.reject( new Error( "NOPE!" ) );
				} )
				.then( null, function( err ) {
					error = err;
				} );
		} );

		it( "should reject the context", function( ) {
			error.should.be.instanceof( Error );
			error.message.should.contain( "NOPE!" );
		} );
	} );

	describe( "when a step throws an error", function() {
		var error;
		before( function() {
			setup();

			return seriate.getPlainContext()
				.step( "brokenPromise", function( execute ) {
					throw new Error( "NOPE!" );
				} )
				.then( null, function( err ) {
					error = err;
				} );
		} );

		it( "should reject the context", function( ) {
			error.should.be.instanceof( Error );
			error.message.should.contain( "NOPE!" );
		} );
	} );

	describe( "with metrics", function() {
		describe( "when executing a query", function() {
			var metrics, adapter;
			before( function() {
				metrics = require( "metronic" )();
				adapter = require( "../data/mockAdapter" )();
				metrics.use( adapter );
				setup();

				reqMock.expects( "query" )
					.withArgs( "query" )
					.once()
					.callsArgWith( 1, null, fakeRecords );

				seriate.useMetrics( metrics, "seriate-tests" );
				return seriate.execute( { name: "read", query: "query" } )
					.then( _.identity );
			} );

			it( "should correctly call all steps", function() {
				reqMock.verify();
			} );

			it( "should capture metrics for each step", function() {
				return adapter.should.partiallyEql( {
					durations: [
						{
							key: "seriate-tests.sql.read.duration",
							type: "time",
							units: "ms"
						}
					],
					metrics: [
						{
							key: "seriate-tests.sql.read.attempted",
							type: "meter",
							units: "count",
							value: 1
						},
						{
							key: "seriate-tests.sql.read.succeeded",
							type: "meter",
							units: "count",
							value: 1
						}
					]
				} );
			} );
		} );

		describe( "when executing a procedure", function() {
			var metrics, adapter;
			before( function() {
				metrics = require( "metronic" )();
				adapter = require( "../data/mockAdapter" )();
				metrics.use( adapter );
				setup();

				reqMock.expects( "execute" )
					.withArgs( "myStoredProc" )
					.once()
					.callsArgWith( 1, null, fakeRecords );

				seriate.useMetrics( metrics, "seriate-tests" );
				return seriate.execute( { procedure: "myStoredProc" } )
					.then( _.identity );
			} );

			it( "should correctly call all steps", function() {
				reqMock.verify();
			} );

			it( "should capture metrics for each step", function() {
				return adapter.should.partiallyEql( {
					durations: [
						{
							key: "seriate-tests.sql.myStoredProc.duration",
							type: "time",
							units: "ms"
						}
					],
					metrics: [
						{
							key: "seriate-tests.sql.myStoredProc.attempted",
							type: "meter",
							units: "count",
							value: 1
						},
						{
							key: "seriate-tests.sql.myStoredProc.succeeded",
							type: "meter",
							units: "count",
							value: 1
						}
					]
				} );
			} );
		} );

		describe( "when executing multiple steps", function() {
			var metrics, adapter;
			before( function() {
				metrics = require( "metronic" )();
				adapter = require( "../data/mockAdapter" )();
				metrics.use( adapter );
				setup();

				reqMock.expects( "query" )
					.withArgs( "query" )
					.once()
					.callsArgWith( 1, null, fakeRecords );

				reqMock.expects( "execute" )
					.withArgs( "procedure" )
					.once()
					.callsArgWith( 1, null, fakeRecords );

				prepMock.expects( "prepare" )
					.withArgs( "prepared" )
					.callsArgWith( 1, undefined )
					.once();

				prepMock.expects( "execute" )
					.callsArgWith( 1, null, fakeRecords )
					.once();

				prepMock.expects( "unprepare" )
					.callsArgWith( 0, undefined )
					.once();

				seriate.useMetrics( metrics, "seriate-tests" );
				return seriate.getPlainContext()
					.step( "read", { query: "query" } )
					.step( "proc", { procedure: "procedure" } )
					.step( "prepared", { preparedSql: "prepared" } )
					.then( _.identity );
			} );

			it( "should correctly call all steps", function() {
				reqMock.verify();
				prepMock.verify();
			} );

			it( "should capture metrics for each step", function() {
				return adapter.should.partiallyEql( {
					durations: [
						{
							key: "seriate-tests.sql.read.duration",
							type: "time",
							units: "ms"
						},
						{
							key: "seriate-tests.sql.proc.duration",
							type: "time",
							units: "ms"
						},
						{
							key: "seriate-tests.sql.prepared.duration",
							type: "time",
							units: "ms"
						}
					],
					metrics: [
						{
							key: "seriate-tests.sql.read.attempted",
							type: "meter",
							units: "count",
							value: 1
						},
						{
							key: "seriate-tests.sql.read.succeeded",
							type: "meter",
							units: "count",
							value: 1
						},
						{
							key: "seriate-tests.sql.proc.attempted",
							type: "meter",
							units: "count",
							value: 1
						},
						{
							key: "seriate-tests.sql.proc.succeeded",
							type: "meter",
							units: "count",
							value: 1
						},
						{
							key: "seriate-tests.sql.prepared.attempted",
							type: "meter",
							units: "count",
							value: 1
						},
						{
							key: "seriate-tests.sql.prepared.succeeded",
							type: "meter",
							units: "count",
							value: 1
						}
					]
				} );
			} );
		} );
	} );
} );
