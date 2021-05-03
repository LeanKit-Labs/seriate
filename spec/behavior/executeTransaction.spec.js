const mockConnectionFn = require( "../data/mockConnection" );

describe( "ExecuteTransaction", function() {
	let sql, seriate, reqMock, transMock;
	function setup() {
		const request = { query: _.noop, execute: _.noop, input: _.noop };
		const transaction = {
			begin: _.noop,
			commit: _.noop,
			rollback: _.noop
		};
		reqMock = sinon.mock( request );
		transMock = sinon.mock( transaction );

		const connection = mockConnectionFn( true );
		const mssql = require( "mssql" );
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

		seriate = proxyquire( "~/src/index", {
			mssql: sql
		} );
		seriate.addConnection( {} );
	}

	describe( "when transaction is successful", function() {
		let result;

		before( function() {
			setup();
			transMock.expects( "begin" )
				.callsArgWith( 0, null )
				.once();

			transMock.expects( "commit" )
				.callsArgWith( 0, null )
				.once();

			reqMock.expects( "query" )
				.withArgs( "select * from sys.tables" )
				.once()
				.callsArgWith( 1, null, fakeRecords );

			return seriate.executeTransaction( {}, {
				query: "select * from sys.tables"
			} ).then( function( res ) {
				result = res;
				res.transaction.commit();
			} );
		} );

		it( "should call query on request", function() {
			reqMock.verify();
		} );

		it( "should commit transaction", function() {
			transMock.verify();
		} );

		it( "should return expected data", function() {
			result.sets.__result__.should.eql( fakeRecords );
		} );
	} );

	describe( "when transaction fails to begin", function() {
		let error;

		before( function() {
			setup();
			transMock.expects( "begin" )
				.callsArgWith( 0, new Error( "A bad thing happened :(" ), null )
				.once();

			transMock.expects( "rollback" )
				.callsArgWith( 0, null )
				.once();

			return seriate.executeTransaction( {}, {
				query: "select * from sys.tables"
			} ).then( null, function( err ) {
				error = err;
			} );
		} );

		it( "should reject promise with error", function() {
			error.message.should.eql( "TransactionContext Error. Failed on step \"startingTransaction\" with: \"A bad thing happened :(\"" );
		} );

		it( "should not progress transaction after error", function() {
			transMock.verify();
		} );
	} );

	describe( "when automatic rollback on failed transaction throws an error", function() {
		let error;

		before( function() {
			setup();
			transMock.expects( "begin" )
				.callsArgWith( 0, new Error( "A bad thing happened :(" ), null )
				.once();

			transMock.expects( "rollback" )
				.callsArgWith( 0, new Error( "This is just the worst" ) )
				.once();

			return seriate.executeTransaction( {}, {
				query: "select * from sys.tables"
			} ).then( null, function( err ) {
				error = err;
			} );
		} );

		it( "should reject promise with error", function() {
			error.message.should.contain( "Error occurred during automatic roll back after error on transaction on step startingTransaction.\n\tTransaction error: TransactionContext Error. Failed on step \"startingTransaction\" with: \"A bad thing happened :(\"\n\tRollback error: Error: This is just the worst\n" );
		} );

		it( "should not progress transaction after error", function() {
			transMock.verify();
		} );
	} );

	describe( "when explicitly rolling back", function() {
		before( function() {
			setup();
			transMock.expects( "begin" )
				.callsArgWith( 0, null )
				.once();

			transMock.expects( "rollback" )
				.callsArgWith( 0, null )
				.once();

			reqMock.expects( "query" )
				.withArgs( "select * from sys.tables" )
				.once()
				.callsArgWith( 1, null, fakeRecords );

			return seriate.executeTransaction( {}, {
				query: "select * from sys.tables"
			} ).then( function( res ) {
				return res.transaction.rollback();
			} );
		} );

		it( "should call query on request", function() {
			reqMock.verify();
		} );

		it( "should rollback transaction without a commit", function() {
			transMock.verify();
		} );
	} );

	describe( "when rolling back because of an error", function() {
		let error;

		before( function() {
			setup();
			transMock.expects( "begin" )
				.callsArgWith( 0, null )
				.once();

			reqMock.expects( "query" )
				.withArgs( "select * from sys.tables" )
				.callsArgWith( 1, new Error( "A bad thing happened :(" ) )
				.once();

			transMock.expects( "rollback" )
				.callsArgWith( 0, null )
				.once();

			return seriate.executeTransaction( {}, {
				query: "select * from sys.tables"
			} ).then( null, function( err ) {
				error = err;
			} );
		} );

		it( "should reject promise with error", function() {
			error.message.should.eql( "TransactionContext Error. Failed on step \"__result__\" with: \"A bad thing happened :(\"" );
		} );

		it( "should call query on request", function() {
			reqMock.verify();
		} );

		it( "should automatically roll back", function() {
			transMock.verify();
		} );
	} );

	describe( "when rolling back because of a commit invocation error", function() {
		let error;

		before( function() {
			setup();
			transMock.expects( "begin" )
				.callsArgWith( 0, null )
				.once();

			reqMock.expects( "query" )
				.withArgs( "select * from sys.tables" )
				.callsArgWith( 1, undefined, fakeRecords )
				.once();

			transMock.expects( "commit" )
				.callsArgWith( 0, new Error( "A bad thing happened :(" ), undefined )
				.once();

			transMock.expects( "rollback" )
				.callsArgWith( 0, null )
				.once();

			seriate.executeTransaction( {}, {
				query: "select * from sys.tables"
			} ).then( function( res ) {
				return res.transaction.commit()
					.then( undefined, function( err ) {
						error = err;
					} );
			} );
		} );

		it( "should reject promise with error", function() {
			error.message.should.eql( "A bad thing happened :(" );
		} );

		it( "should call query on request", function() {
			reqMock.verify();
		} );

		it( "should automatically roll back", function() {
			transMock.verify();
		} );
	} );

	describe( "when automatic roll back fails", function() {
		let error;

		before( function() {
			setup();
			transMock.expects( "begin" )
				.callsArgWith( 0, null )
				.once();

			reqMock.expects( "query" )
				.withArgs( "select * from sys.tables" )
				.callsArgWith( 1, undefined, fakeRecords )
				.once();

			transMock.expects( "commit" )
				.callsArgWith( 0, new Error( "A bad thing happened :(" ), undefined )
				.once();

			transMock.expects( "rollback" )
				.callsArgWith( 0, new Error( "From bad to worse" ) )
				.once();

			seriate.executeTransaction( {}, {
				query: "select * from sys.tables"
			} ).then( function( res ) {
				return res.transaction.commit()
					.then( undefined, function( err ) {
						error = err;
					} );
			} );
		} );

		it( "should reject promise with error", function() {
			error.message.should.contain( "Error occurred during automatic roll back after a commit error" );
			error.message.should.contain( "Commit error: Error: A bad thing happened :(" );
			error.message.should.contain( "Rollback error: Error: From bad to worse\n" );
		} );

		it( "should call query on request", function() {
			reqMock.verify();
		} );

		it( "should automatically roll back", function() {
			transMock.verify();
		} );
	} );

	describe( "when explicit roll back fails", function() {
		let error;

		before( function() {
			setup();
			transMock.expects( "begin" )
				.callsArgWith( 0, null )
				.once();

			reqMock.expects( "query" )
				.withArgs( "select * from sys.tables" )
				.callsArgWith( 1, undefined, fakeRecords )
				.once();

			transMock.expects( "rollback" )
				.callsArgWith( 0, new Error( "A bad thing happened :(" ) )
				.once();

			return seriate.executeTransaction( {}, {
				query: "select * from sys.tables"
			} ).then( function( res ) {
				res.transaction.rollback()
					.then( null, function( err ) {
						error = err;
					} );
			} );
		} );

		it( "should result in rejection of rollback promise", function() {
			error.message.should.eql( "A bad thing happened :(" );
		} );

		it( "should call query on request", function() {
			reqMock.verify();
		} );

		it( "should process transaction correctly", function() {
			transMock.verify();
		} );
	} );
} );
