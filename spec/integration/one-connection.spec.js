require( "../setup" );
var localConfig = require( "./local-config.json" );

describe( "Seriate Integration Tests - one-connection pool", function() {
	var config, sql;

	before( function() {
		config = Object.assign( {}, localConfig, {
			pool: {
				min: 1,
				max: 1
			}
		} );

		sql = proxyquire( "../src/index", {} );
	} );

	describe( "when plain context has two steps on it", function() {
		it( "should use same connection on both", function() {
			return sql.getPlainContext( config )
				.step( "spid1", { query: "SELECT @@SPID spid" } )
				.step( "spid2", { query: "SELECT @@SPID spid" } )
				.then( function( data ) {
					data.spid2[ 0 ].spid.should.equal( data.spid1[ 0 ].spid );
				} )
				// eslint-disable-next-line no-console
				.catch( console.log );
		} );
	} );

	describe( "when temp table is loaded and transaction errs", function() {
		var error;

		before( function() {
			return sql.getTransactionContext( config )
				.step( "bulk", {
					bulkLoadTable: {
						name: "#oops",
						columns: {
							foo: {
								type: sql.NVARCHAR( 50 ),
								nullable: false
							}
						},
						rows: [ { foo: "bar" } ]
					}
				} )
				.step( "err", { query: "SELECT * FROM NoSuchTable;" } )
				.then( function() {} )
				.catch( function( e ) {
					error = e;
				} );
		} );

		it( "should throw RequestError", function() {
			error.should.be.instanceof( Error );
			error.name.should.equal( "RequestError" );
		} );

		it( "should drop temp table from connection", function() {
			return sql.first( config, { query: "SELECT OBJECT_ID('tempdb..#oops') id;" } )
				.then( function( row ) {
					should.equal( row.id, null );
				} );
		} );
	} );

	describe( "when temp table to be loaded already exists", function() {
		function loadTwiceAndRead( useExisting ) {
			var sets;

			return sql.getTransactionContext( config )
				.step( "bulk1", {
					bulkLoadTable: {
						name: "#exists",
						columns: {
							id: {
								type: sql.INT
							}
						},
						rows: [ { id: 1 } ]
					}
				} )
				.step( "bulk2", {
					bulkLoadTable: {
						name: "#exists",
						columns: { id: { type: sql.INT } },
						rows: [ { id: 2 } ],
						useExisting: useExisting
					}
				} )
				.step( "query", { query: "SELECT * FROM #exists ORDER BY id" } )
				.then( function( result ) {
					sets = result.sets;
					return result.transaction.commit();
				} )
				.then( function() {
					return sets.query;
				} );
		}

		describe( "and useExisting is not specified", function() {
			it( "should drop it and recreate it", function() {
				return loadTwiceAndRead( false ).should.eventually.eql( [
					{ id: 2 }
				] );
			} );
		} );

		describe( "and useExisting is specified", function() {
			it( "should add to it", function() {
				return loadTwiceAndRead( true ).should.eventually.eql( [
					{ id: 1 },
					{ id: 2 }
				] );
			} );
		} );
	} );
} );
