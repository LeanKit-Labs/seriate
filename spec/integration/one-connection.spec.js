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
							type: sql.NVARCHAR(50),
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
		it( "should drop it and recreate it", function() {
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
					columns: {
						id: {
							type: sql.INT
						}
					},
					rows: [ { id: 2 } ]
				}
			} )
			.step( "query", { query: "SELECT * FROM #exists" } )
			.then( function( result ) {
				sets = result.sets;
				return result.transaction.commit();
			} )
			.then( function() {
				sets.query.should.eql( [
					{ id: 2 }
				] );
			} );
		} );
	} );
} );
