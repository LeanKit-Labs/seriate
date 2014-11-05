/*global describe,before,afterEach,it,beforeEach */
/***************************************************

	SqlContext *Successful* Execution Tests

****************************************************/

var expect = require( 'expect.js' );
var sinon = require( 'sinon' );
expect = require( 'sinon-expect' ).enhance( expect, sinon, 'was' );
var records = require( './fakeRecordSet.json' );

var Monologue = require( 'monologue.js' );
var machina = require( 'machina' )();
var sql = require( 'mssql' );
var SqlContext = require( '../../src/sqlContext.js' )( sql, Monologue, machina );

describe( 'With Successful SqlContext Executions', function() {
	var reqStub;
	var connStub;
	var prepStub;
	beforeEach( function() {
		// First - we need stub instances of several mssql
		// constructors,and we need to invoke callbacks
		// passed to some of them
		reqStub = sinon.createStubInstance( sql.Request );
		reqStub.query.callsArgWith( 1, null, records );
		reqStub.execute.callsArgWith( 1, null, records );
		connStub = sinon.createStubInstance( sql.Connection );
		prepStub = sinon.createStubInstance( sql.PreparedStatement );
		prepStub.prepare.callsArgWith( 1, null );
		prepStub.execute.callsArgWith( 1, null, records );
		prepStub.unprepare.callsArgWith( 0, null );

		// Now that we have stub instances, we need to stub
		// the calls to the constructor functions to return
		// our stubs instead
		sinon.stub( sql, 'Connection', function( opt, fn ) {
			process.nextTick( fn );
			return connStub;
		} );

		sinon.stub( sql, 'Request', function() {
			return reqStub;
		} );

		sinon.stub( sql, 'PreparedStatement', function() {
			return prepStub;
		} );
	} );
	afterEach( function() {
		sql.Connection.restore();
		sql.Request.restore();
		sql.PreparedStatement.restore();
	} );

	describe( 'when getting a SqlContext instance', function() {
		var ctx;
		before( function() {
			ctx = new SqlContext();
		} );
		it( 'should start in uninitialized', function() {
			expect( ctx.states.uninitialized ).to.be.ok();
		} );
	} );
	describe( 'when adding a step using query options object', function() {

		/***************************************************
			PLAIN QUERY TESTING WITH SUCCESSFUL EXECUTION
		****************************************************/
		describe( 'with a plain query to execute', function() {
			var ctx;
			before( function() {
				ctx = new SqlContext();
				ctx.step( 'read', {
					query: 'select * from sys.tables'
				} );
			} );
			it( 'should create a "read" state', function() {
				expect( ctx.states.read ).to.be.ok();
			} );
			it( 'should create "read" state success handler', function() {
				expect( ctx.states.read.success ).to.be.ok();
			} );
			it( 'should create "read" state error handler', function() {
				expect( ctx.states.read.error ).to.be.ok();
			} );
		} );
		describe( 'and executing a query with no params', function() {
			var ctx;
			beforeEach( function() {
				ctx = new SqlContext();
				ctx.step( 'read', {
					query: 'select * from sys.tables'
				} );
			} );
			it( 'should call "query" on the Request instance', function( done ) {
				ctx.end( function() {
					expect( reqStub.query ).was.calledWith( 'select * from sys.tables' );
					done();
				} );
			} );
			it( 'should provide correct structure in results object', function( done ) {
				ctx.end( function( res ) {
					expect( res ).to.eql( {
						read: records
					} );
					done();
				} );
			} );
			it( 'should NOT call the error handler on a successful execution', function( done ) {
				var calledErr = false;
				ctx.error( function() {
					calledErr = true;
				} ).end( function() {
					expect( calledErr ).to.be( false );
					done();
				} );
			} );
		} );

		/*******************************************************
			STORED PROCEDURE TESTING WITH SUCCESSFUL EXECUTION
		********************************************************/
		describe( 'with a stored procedure', function() {
			var ctx;
			beforeEach( function() {
				ctx = new SqlContext();
				ctx.step( 'proc', {
					procedure: 'sp_who2'
				} );
			} );
			it( 'should create a "proc" state', function() {
				expect( ctx.states.proc ).to.be.ok();
			} );
			it( 'should create "proc" state success handler', function() {
				expect( ctx.states.proc.success ).to.be.ok();
			} );
			it( 'should create "proc" state error handler', function() {
				expect( ctx.states.proc.error ).to.be.ok();
			} );
		} );
		describe( 'and executing a proc with no params', function() {
			var ctx;
			beforeEach( function() {
				ctx = new SqlContext();
				ctx.step( 'proc', {
					procedure: 'sp_who2'
				} );
			} );
			it( 'should call "execute" on the Request instance', function( done ) {
				ctx.end( function() {
					expect( reqStub.execute ).was.calledWith( 'sp_who2' );
					done();
				} );
			} );
			it( 'should provide correct structure in results object', function( done ) {
				ctx.end( function( res ) {
					expect( res ).to.eql( {
						proc: records
					} );
					done();
				} );
			} );
			it( 'should NOT call the error handler on a successful execution', function( done ) {
				var calledErr = false;
				ctx.error( function() {
					calledErr = true;
				} ).end( function() {
					expect( calledErr ).to.be( false );
					done();
				} );
			} );
		} );
		describe( 'and executing a proc with params', function() {
			var ctx;
			beforeEach( function() {
				ctx = new SqlContext();
				ctx.step( 'proc', {
					procedure: 'sp_who2',
					params: {
						param1: {
							type: sql.INT,
							val: 9
						},
						param2: 'Hai Mom'
					}
				} );
			} );
			it( 'should call "execute" on the Request instance', function( done ) {
				ctx.end( function() {
					expect( reqStub.execute ).was.calledWith( 'sp_who2' );
					done();
				} );
			} );
			it( 'should provide correct structure in results object', function( done ) {
				ctx.end( function( res ) {
					expect( res ).to.eql( {
						proc: records
					} );
					done();
				} );
			} );
			it( 'should call "input" on the Request instance for param1', function( done ) {
				ctx.end( function() {
					expect( reqStub.input ).was.calledTwice();
					expect( reqStub.input ).was.calledWith( 'param1', sql.INT, 9 );
					done();
				} );
			} );
			it( 'should call "input" on the Request instance for param2', function( done ) {
				ctx.end( function() {
					expect( reqStub.input ).was.calledTwice();
					expect( reqStub.input ).was.calledWith( 'param2', 'Hai Mom' );
					done();
				} );
			} );
			it( 'should NOT call the error handler on a successful execution', function( done ) {
				var calledErr = false;
				ctx.error( function() {
					calledErr = true;
				} ).end( function() {
					expect( calledErr ).to.be( false );
					done();
				} );
			} );
		} );

		/*******************************************************
			PREPARED SQL TESTING WITH SUCCESSFUL EXECUTION
		********************************************************/
		describe( 'with prepared sql', function() {
			var ctx;
			beforeEach( function() {
				ctx = new SqlContext();
				ctx.step( 'prepped', {
					preparedSql: 'select * from sys.tables where type_desc = @usertable',
					params: {
						usertable: {
							type: sql.NVarChar,
							val: 'USER_TABLE'
						}
					}
				} );
			} );
			it( 'should create a "prepped" state', function() {
				expect( ctx.states.prepped ).to.be.ok();
			} );
			it( 'should create "prepped" state success handler', function() {
				expect( ctx.states.prepped.success ).to.be.ok();
			} );
			it( 'should create "prepped" state error handler', function() {
				expect( ctx.states.prepped.error ).to.be.ok();
			} );
		} );
		describe( 'and executing prepared sql with params', function() {
			var ctx;
			beforeEach( function() {
				ctx = new SqlContext();
				ctx.step( 'prepped', {
					preparedSql: 'select * from sys.tables where type_desc = @usertable',
					params: {
						usertable: {
							type: sql.NVarChar,
							val: 'USER_TABLE'
						}
					}
				} );
			} );
			it( 'should call "prepare" on the PreparedStatement instance', function( done ) {
				ctx.end( function() {
					expect( prepStub.prepare ).was.calledWith( 'select * from sys.tables where type_desc = @usertable' );
					done();
				} );
			} );
			it( 'should call "execute" on the PreparedStatement instance', function( done ) {
				ctx.end( function() {
					expect( prepStub.execute ).was.calledWith( {
						usertable: 'USER_TABLE'
					} );
					done();
				} );
			} );
			it( 'should call "unprepare" on the PreparedStatement instance', function( done ) {
				ctx.end( function() {
					expect( prepStub.unprepare ).was.calledOnce();
					done();
				} );
			} );
			it( 'should provide correct structure in results object', function( done ) {
				ctx.end( function( res ) {
					expect( res ).to.eql( {
						prepped: records
					} );
					done();
				} );
			} );
			it( 'should call "input" on the PreparedStatement instance for usertable parameter', function( done ) {
				ctx.end( function() {
					expect( prepStub.input ).was.calledOnce();
					expect( prepStub.input ).was.calledWith( 'usertable', sql.NVarChar );
					done();
				} );
			} );
			it( 'should NOT call the error handler on a successful execution', function( done ) {
				var calledErr = false;
				ctx.error( function() {
					calledErr = true;
				} ).end( function() {
					expect( calledErr ).to.be( false );
					done();
				} );
			} );
		} );
	} );
} );
