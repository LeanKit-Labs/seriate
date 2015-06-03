var gulp = require( "gulp" );
var mocha = require( "gulp-mocha" );
var istanbul = require( "gulp-istanbul" );
var allSrcFiles = "./src/**/*.js";
var allTestFiles = "./spec/**/*.spec.js";
var unitTestFiles = "./spec/unit/**/*.spec.js";
var intTestFiles = "./spec/integration/**/*.spec.js";
var gulpMocha = require( "gulp-spawn-mocha" );
var gutil = require( "gulp-util" );

function runMocha( singleRun, files ) {
	return gulp.src( files, { read: false } )
		.pipe( gulpMocha( {
			R: "spec",
			r: [
				"./spec/helpers/node-setup.js"
			]
		} ) ).on( "error", function() {
			if ( singleRun ) {
				process.exit( 1 );
			}
		} );
}

gulp.task( "test-unit", [ "format" ], function() {
	return runMocha( true, unitTestFiles );
} );

gulp.task( "test-int", [ "format" ], function() {
	return runMocha( true, intTestFiles );
} );

gulp.task( "test", [ "format" ], function() {
	return runMocha( true, allTestFiles );
} );

var jscs = require( "gulp-jscs" );
var gulpChanged = require( "gulp-changed" );

gulp.task( "format", [ "jshint" ], function() {
	return gulp.src( [ "**/*.js", "!node_modules/**" ] )
		.pipe( jscs( {
			configPath: ".jscsrc",
			fix: true
		} ) )
		.on( "error", function( error ) {
			gutil.log( gutil.colors.red( error.message ) );
			this.end();
		} )
		.pipe( gulpChanged( ".", { hasChanged: gulpChanged.compareSha1Digest } ) )
		.pipe( gulp.dest( "." ) );
} );

var jshint = require( "gulp-jshint" );
var stylish = require( "jshint-stylish" );

gulp.task( "jshint", function() {
	return gulp.src( allSrcFiles )
		.on( "error", function( error ) {
			gutil.log( gutil.colors.red( error.message + " in " + error.fileName ) );
			this.end();
		} )
		.pipe( jshint() )
		.pipe( jshint.reporter( stylish ) )
		.pipe( jshint.reporter( "fail" ) );
} );

gulp.task( "watch", [ "test" ], function() {
	gulp.watch( [ allTestFiles, allSrcFiles ], [ "test" ] );
} );

gulp.task( "coverage", [ "format" ], function( cb ) {
	gulp.src( [ allSrcFiles ] )
		.pipe( istanbul() ) // Covering files
		.pipe( istanbul.hookRequire() ) // Force `require` to return covered files
		.on( "finish", function() {
			gulp.src( [ "./spec/helpers/node-setup.js", allTestFiles ] )
				.pipe( mocha() )
				.pipe( istanbul.writeReports() ) // Creating the reports after tests runned
				.on( "end", function() {
					process.exit();
				} );
		} );
} );
