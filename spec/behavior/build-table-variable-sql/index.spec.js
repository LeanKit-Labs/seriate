const mssql = require( "mssql" );
const utils = require( "../../../src/utils" );
const buildTableVariableSql = require( "../../../src/build-table-variable-sql" );

describe( "buildTableVariableSql", function() {
	let key, schema, hasData;

	before( function() {
		key = "parameter";
		schema = { value: mssql.BIGINT };
	} );

	describe( "when value has data", function() {
		before( function() {
			hasData = true;
		} );

		it( "should open xml document", function() {
			const expected = utils.fromFile( "./table-variable-sql-with-xml.sql" );
			const sql = buildTableVariableSql( key, schema, hasData );
			sql.should.equal( expected );
		} );
	} );

	describe( "when value has no data", function() {
		before( function() {
			hasData = false;
		} );

		it( "should not open xml document", function() {
			const expected = utils.fromFile( "./table-variable-sql-without-xml.sql" );
			const sql = buildTableVariableSql( key, schema, hasData );
			sql.should.equal( expected );
		} );
	} );
} );
