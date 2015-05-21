/*global describe,before,afterEach,it,beforeEach */
/***************************************************

	    Loading External SQL From File

****************************************************/

var sql = require( "../../src/index.js" );
var path = require( "path" );

describe( "When calling seriate.fromFile", function() {
	var expected = "SELECT\t [Id]\n\t\t,[Title]\n\t\t,[Description]\n\t\t,[ClassOfServiceEnabled]\n\t\t,[OrganizationId]\nFROM\t[dbo].[Board]\nWHERE\tid = @id\n";
	describe( "when loading a file using the extension with file name", function() {
		it( "should load expected sql from file", function() {
			expect( sql.fromFile( "./test.sql" ) ).to.eql( expected );
		} );
	} );
	describe( "when loading a file without using the extension", function() {
		it( "should load expected sql from file", function() {
			expect( sql.fromFile( "./test" ) ).to.eql( expected );
		} );
	} );
	describe( "when loading a file where file name ends with period", function() {
		it( "should load expected sql from file", function() {
			expect( sql.fromFile( "./test." ) ).to.eql( expected );
		} );
	} );
} );
