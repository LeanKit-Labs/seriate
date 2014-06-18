var gulp = require('gulp'),
	filter = require('gulp-filter'),
	less = require('gulp-less'),
	_ = require('lodash'),
	nodemssql = require('mssql'),
	mocha = require('gulp-mocha');

gulp.task('test', function() {
	gulp.src('./spec/*.spec.js')
		.pipe(mocha({
			reporter: 'spec'
		}))
		.on('error', function(err) {
			console.log(err);
		});
});

gulp.task('watch', function() {
	gulp.watch(['./spec/*.spec.js', './src/**'], ['test']);
});

gulp.task('default', ['test', 'watch'], function() {

});