require( "../setup" );

describe( "Tedious makeRequest patch", function() {
	var existingMakeRequest, existingNewBulkLoad, existingExecBulkLoad, makeRequest, Connection;

	beforeEach( function() {
		existingMakeRequest = sinon.stub();
		existingNewBulkLoad = sinon.stub().callsArgWith( 1, "ARGS" ).returns( "NEWBULK" );
		existingExecBulkLoad = sinon.stub().returns( "EXECBULK" );

		Connection = function() {
			this.inTransaction = false;
			this.resetConnectionOnNextRequest = false;
		};

		Connection.prototype.reset = function( callback ) {
			this.resetConnectionOnNextRequest = true;
			this.makeRequest( { id: "reset" } );
			this.resetConnectionOnNextRequest = false;
			callback();
		};

		Connection.prototype.makeRequest = existingMakeRequest;
		Connection.prototype.newBulkLoad = existingNewBulkLoad;
		Connection.prototype.execBulkLoad = existingExecBulkLoad;

		proxyquire( "../src/index", {
			tedious: {
				Connection: Connection
			}
		} );

		makeRequest = Connection.prototype.makeRequest;
	} );

	describe( "when executing normal queries", function() {
		var connection;

		beforeEach( function() {
			connection = new Connection();
			connection.makeRequest( { id: "a" }, "PACKETTYPE", "PAYLOAD" );
		} );

		it( "should reset before each query", function() {
			existingMakeRequest.getCall( 0 ).should.be.calledOn( connection )
				.and.calledWith( { id: "reset" } );
		} );

		it( "should call through to the original makeRequest", function() {
			existingMakeRequest.getCall( 1 ).should.be.calledOn( connection )
				.and.calledWith( { id: "a" }, "PACKETTYPE", "PAYLOAD" );
		} );

		describe( "when making a subsequent request", function() {
			beforeEach( function() {
				connection.makeRequest( { id: "b" }, "PACKETTYPE", "PAYLOAD" );
			} );

			it( "should reset before the next query", function() {
				existingMakeRequest.getCall( 2 ).should.be.calledOn( connection )
					.and.calledWith( { id: "reset" } );
			} );

			it( "should call through to the original makeRequest", function() {
				existingMakeRequest.getCall( 3 ).should.be.calledOn( connection )
					.and.calledWith( { id: "b" }, "PACKETTYPE", "PAYLOAD" );
			} );
		} );
	} );

	describe( "when executing prepared SQL", function() {
		var connection;

		beforeEach( function() {
			connection = new Connection();
			connection.makeRequest( {
				id: "prepare",
				sqlTextOrProcedure: "sp_prepare"
			}, "PACKETTYPE", "PAYLOAD" );

			connection.makeRequest( { id: "a" }, "PACKETTYPE", "PAYLOAD" );
			connection.makeRequest( { id: "b" }, "PACKETTYPE", "PAYLOAD" );

			connection.makeRequest( {
				id: "unprepare",
				sqlTextOrProcedure: "sp_unprepare"
			}, "PACKETTYPE", "PAYLOAD" );
		} );

		it( "should reset before the prepare step", function() {
			existingMakeRequest.getCall( 0 ).should.be.calledOn( connection )
				.and.calledWith( { id: "reset" } );
		} );

		it( "should call through to the original prepare call", function() {
			existingMakeRequest.getCall( 1 ).should.be.calledOn( connection )
				.and.calledWith( {
					id: "prepare",
					sqlTextOrProcedure: "sp_prepare"
				}, "PACKETTYPE", "PAYLOAD" );
		} );

		it( "should not reset before requests made before unprepare", function() {
			existingMakeRequest.getCall( 2 ).should.be.calledOn( connection )
				.and.calledWith( { id: "a" }, "PACKETTYPE", "PAYLOAD" );

			existingMakeRequest.getCall( 3 ).should.be.calledOn( connection )
				.and.calledWith( { id: "b" }, "PACKETTYPE", "PAYLOAD" );
		} );

		it( "should not reset before the unprepare call", function() {
			existingMakeRequest.getCall( 4 ).should.be.calledOn( connection )
				.and.calledWith( {
					id: "unprepare",
					sqlTextOrProcedure: "sp_unprepare"
				}, "PACKETTYPE", "PAYLOAD" );
		} );

		describe( "when making a subsequent request", function() {
			beforeEach( function() {
				connection.makeRequest( { id: "c" }, "PACKETTYPE", "PAYLOAD" );
			} );

			it( "should reset before the next query", function() {
				existingMakeRequest.getCall( 5 ).should.be.calledOn( connection )
					.and.calledWith( { id: "reset" } );
			} );

			it( "should call through to the original makeRequest", function() {
				existingMakeRequest.getCall( 6 ).should.be.calledOn( connection )
					.and.calledWith( { id: "c" }, "PACKETTYPE", "PAYLOAD" );
			} );
		} );
	} );

	describe( "when executing a transaction", function() {
		var connection;

		beforeEach( function() {
			connection = new Connection();

			connection.makeRequest( { id: "begin" }, "PACKETTYPE", "PAYLOAD" );
			connection.inTransaction = true;

			connection.makeRequest( { id: "a" }, "PACKETTYPE", "PAYLOAD" );
			connection.makeRequest( { id: "b" }, "PACKETTYPE", "PAYLOAD" );

			connection.inTransaction = false;
		} );

		it( "should reset before the transaction begins", function() {
			existingMakeRequest.getCall( 0 ).should.be.calledOn( connection )
				.and.calledWith( { id: "reset" } );
		} );

		it( "should call through to the original makeRequest", function() {
			existingMakeRequest.getCall( 1 ).should.be.calledOn( connection )
				.and.calledWith( { id: "begin" }, "PACKETTYPE", "PAYLOAD" );
		} );

		it( "should not reset before requests within the transaction", function() {
			existingMakeRequest.getCall( 2 ).should.be.calledOn( connection )
				.and.calledWith( { id: "a" }, "PACKETTYPE", "PAYLOAD" );

			existingMakeRequest.getCall( 3 ).should.be.calledOn( connection )
				.and.calledWith( { id: "b" }, "PACKETTYPE", "PAYLOAD" );
		} );

		describe( "when making a subsequent request after transaction", function() {
			beforeEach( function() {
				connection.makeRequest( { id: "c" }, "PACKETTYPE", "PAYLOAD" );
			} );

			it( "should reset before the next query", function() {
				existingMakeRequest.getCall( 4 ).should.be.calledOn( connection )
					.and.calledWith( { id: "reset" } );
			} );

			it( "should call through to the original makeRequest", function() {
				existingMakeRequest.getCall( 5 ).should.be.calledOn( connection )
					.and.calledWith( { id: "c" }, "PACKETTYPE", "PAYLOAD" );
			} );
		} );
	} );

	describe( "when doing a bulk load", function() {
		var connection;

		beforeEach( function() {
			connection = new Connection();

			connection.makeRequest( { id: "begin" }, "PACKETTYPE", "PAYLOAD" );
			connection.isInBulkLoadOperation = true;

			connection.makeRequest( { id: "a" }, "PACKETTYPE", "PAYLOAD" );
			connection.makeRequest( { id: "b" }, "PACKETTYPE", "PAYLOAD" );

			connection.isInBulkLoadOperation = false;
		} );

		it( "should reset before the bulk load begins", function() {
			existingMakeRequest.getCall( 0 ).should.be.calledOn( connection )
				.and.calledWith( { id: "reset" } );
		} );

		it( "should call through to the original makeRequest", function() {
			existingMakeRequest.getCall( 1 ).should.be.calledOn( connection )
				.and.calledWith( { id: "begin" }, "PACKETTYPE", "PAYLOAD" );
		} );

		it( "should not reset before requests within the transaction", function() {
			existingMakeRequest.getCall( 2 ).should.be.calledOn( connection )
				.and.calledWith( { id: "a" }, "PACKETTYPE", "PAYLOAD" );

			existingMakeRequest.getCall( 3 ).should.be.calledOn( connection )
				.and.calledWith( { id: "b" }, "PACKETTYPE", "PAYLOAD" );
		} );

		describe( "when making a subsequent request after bulk load", function() {
			beforeEach( function() {
				connection.makeRequest( { id: "c" }, "PACKETTYPE", "PAYLOAD" );
			} );

			it( "should reset before the next query", function() {
				existingMakeRequest.getCall( 4 ).should.be.calledOn( connection )
					.and.calledWith( { id: "reset" } );
			} );

			it( "should call through to the original makeRequest", function() {
				existingMakeRequest.getCall( 5 ).should.be.calledOn( connection )
					.and.calledWith( { id: "c" }, "PACKETTYPE", "PAYLOAD" );
			} );
		} );
	} );

	describe( "when calling newBulkLoad", function() {
		var connection, callback, result;

		beforeEach( function() {
			connection = new Connection();
			connection.isInBulkLoadOperation = true;

			callback = sinon.spy( function() {
				connection.isInBulkLoadOperation.should.equal( true );
				return "RESULT";
			} );

			result = connection.newBulkLoad( "TABLE", callback );
		} );

		it( "should return the result of calling the original newBulkLoad", function() {
			result.should.equal( "NEWBULK" );
		} );

		it( "should set isInBulkLoadOperation to false in the callback", function() {
			connection.isInBulkLoadOperation.should.equal( false );
		} );

		it( "should call the original callback", function() {
			callback.should.be.calledOnce
				.and.calledWith( "ARGS" );
		} );
	} );

	describe( "when calling execBulkLoad", function() {
		var connection, result;

		beforeEach( function() {
			connection = new Connection();

			result = connection.execBulkLoad( "ARGS" );
		} );

		it( "should set the isInBulkLoadOperation flag to true", function() {
			connection.isInBulkLoadOperation.should.equal( true );
		} );

		it( "should return the result of calling the original method", function() {
			existingExecBulkLoad.should.be.calledOnce
				.and.calledWith( "ARGS" );

			result.should.equal( "EXECBULK" );
		} );
	} );
} );
