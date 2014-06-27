var gulp = require( 'gulp' );
var mocha = require( 'gulp-mocha' );

gulp.task( 'test', function() {
	gulp.src( './spec/unit/*.spec.js' )
		.pipe( mocha( {
			reporter: 'spec'
		} ) )
		.on( 'error', function( err ) {
			console.log( err );
		} );
} );

gulp.task( 'watch', function() {
	gulp.watch( [ './spec/*.spec.js', './src/**' ], [ 'test' ] );
} );