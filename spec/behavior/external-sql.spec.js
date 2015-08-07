/***************************************************

	    Loading External SQL From File

****************************************************/
require( "../setup" );

describe( "FromFile", function() {
	var seriate;
	var expected = "SELECT\t [Id]\n\t\t,[Title]\n\t\t,[Description]\n\t\t,[ClassOfServiceEnabled]\n\t\t,[OrganizationId]\nFROM\t[dbo].[Board]\nWHERE\tid = @id\n";
	before( function() {
		seriate = require( "../../src/index.js" );
	} );

	describe( "when loading a file using the extension with file name", function() {
		it( "should load expected sql from file", function() {
			seriate.fromFile( "../data/test.sql" ).should.eql( expected );
		} );
	} );

	describe( "when loading a file without using the extension", function() {
		it( "should load expected sql from file", function() {
			seriate.fromFile( "../data/test" ).should.eql( expected );
		} );
	} );

	describe( "when loading a file where file name ends with period", function() {
		it( "should load expected sql from file", function() {
			seriate.fromFile( "../data/test." ).should.eql( expected );
		} );
	} );
} );
