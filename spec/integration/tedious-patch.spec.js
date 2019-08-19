const localConfig = require( "./local-config.json" );

describe( "Seriate Integration Tests - Tedious connection reset patch", function() {
	let config, sql;

	beforeEach( function() {
		config = Object.assign( {}, localConfig, {
			pool: {
				min: 1,
				max: 1
			}
		} );

		sql = proxyquire( "~/src/index", {} );
	} );

	afterEach( function() {
	} );

	const deleteStep = {
		query: "DELETE FROM NodeTestTable;"
	};

	const insertStep = {
		query: "INSERT INTO NodeTestTable (v1, i1) VALUES ('a', 1);"
	};

	const selectStep = {
		query: "SELECT * FROM NodeTestTable"
	};

	const variableStep = {
		query: "SELECT @@ROWCOUNT as rows, @@IDENTITY as id"
	};

	describe( "when using plain context", function() {
		it( "should reset between steps", function() {
			return sql.getPlainContext( config )
				.step( "setup", deleteStep )
				.step( "insert", insertStep )
				.step( "select", selectStep )
				.step( "variables", variableStep )
				.then( function( result ) {
					result.variables[ 0 ].should.eql( {
						rows: 0,
						id: null
					} );
				} );
		} );
	} );

	describe( "when using transaction context, reset is run before, but not during transaction", function() {
		it( "should reset between steps", function() {
			return sql.getPlainContext( config )
				.step( "setup", deleteStep )
				.step( "insert", insertStep )
				.step( "select", selectStep )
				.then( function() {
					return sql.getTransactionContext( config )
						.step( "variables-before", variableStep )
						.step( "insert", insertStep )
						.step( "select", selectStep )
						.step( "variables-after", variableStep )
						.then( function( result ) {
							return result.transaction.commit().then( function() {
								const recordLength = result.sets.select.length;
								const lastInsertedId = +result.sets.select[ recordLength - 1 ].bi1;

								// ensure that it was cleared before the transaction
								result.sets[ "variables-before" ][ 0 ].should.eql( {
									rows: 0,
									id: null
								} );

								// ensure that it was not cleared in transaction
								result.sets[ "variables-after" ][ 0 ].should.eql( {
									rows: recordLength,
									id: lastInsertedId
								} );
							} );
						} );
				} );
		} );
	} );

	describe( "when using prepared SQL", function() {
		let result;

		beforeEach( function() {
			return sql.getPlainContext( config )
				.step( "setup", deleteStep )
				.step( "insert", insertStep )
				.step( "select", {
					preparedSql: selectStep.query
				} )
				.step( "variables", variableStep )
				.then( function( data ) {
					result = data;
				} );
		} );

		it( "should return the prepared SQL result correctly", function() {
			result.select.should.have.lengthOf( 1 );
			result.select[ 0 ].v1.should.equal( "a" );
			result.select[ 0 ].i1.should.equal( 1 );
		} );

		it( "should reset between steps (and not error from resetting between prepare call and the actual query)", function() {
			result.variables[ 0 ].should.eql( {
				rows: 0,
				id: null
			} );
		} );
	} );

	describe( "when using stored procedure", function() {
		let result;

		beforeEach( function() {
			return sql.getPlainContext( config )
				.step( "setup", deleteStep )
				.step( "insert", insertStep )
				.step( "sp", {
					procedure: "NodeTestMultipleProc",
					params: {
						i1: {
							type: sql.Int,
							val: 1
						}
					}
				} )
				.step( "variables", variableStep )
				.then( function( data ) {
					result = data;
				} );
		} );

		it( "should execute the stored procedure correctly", function() {
			const procResult = result.sp[ 0 ];
			procResult[ 0 ].should.have.lengthOf( 1 );
			procResult[ 0 ][ 0 ].i1.should.equal( 1 );
			procResult[ 1 ][ 0 ].totalRows.should.equal( 1 );
		} );

		it( "should reset between steps", function() {
			result.variables[ 0 ].should.eql( {
				rows: 0,
				id: null
			} );
		} );
	} );

	describe( "when bulk loading", function() {
		let result;

		beforeEach( function() {
			return sql.getPlainContext( config )
				.step( "setup", deleteStep )
				.step( "bulk-load", {
					bulkLoadTable: {
						name: "NodeTestTable",
						columns: {
							bi1: { type: sql.BIGINT, nullable: false },
							v1: { type: sql.VARCHAR( 255 ) },
							i1: { type: sql.INT },
							d1: { type: sql.DATETIME }
						},
						rows: [ {
							bi1: "123",
							v1: "Marvin",
							i1: 234,
							d1: new Date( 2017, 1, 2, 3, 4, 5 )
						} ]
					}
				} )
				.step( "select", selectStep )
				.step( "variables", variableStep )
				.then( function( data ) {
					result = data;
				} );
		} );

		it( "should successfully execute the bulk load", function() {
			result.select.should.have.lengthOf( 1 );
			result.select[ 0 ].should.eql( {
				bi1: "123",
				v1: "Marvin",
				i1: 234,
				d1: new Date( 2017, 1, 2, 3, 4, 5 )
			} );
		} );

		it( "should reset between steps", function() {
			result.variables[ 0 ].should.eql( {
				rows: 0,
				id: null
			} );
		} );
	} );
} );
