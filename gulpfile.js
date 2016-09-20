/**
 * Created by ui on 16/3/17.
 */
'use strict';

var gulp = require('gulp');
var browserify = require('browserify');
var source = require('vinyl-source-stream');
var sourcemaps = require('gulp-sourcemaps');
var babel = require('gulp-babel');
var concat = require('gulp-concat');
var babelify = require('babelify');
var uglify = require('gulp-uglify');
var rename = require('gulp-rename');
var buffer = require('gulp-buffer');


var src_static = ['index.html','login.html','login.css','style.css','school.png','pen.png'];
var dest = 'backend/public/';


gulp.task('move-file', function() {
    gulp.src(src_static)
        .pipe(gulp.dest(dest));
});


gulp.task('browserify-js', function () {
     browserify('./js/main.js')
         .transform(babelify,  {presets: ['es2015', 'react']})
         .bundle()
         .pipe(source('bundle.js')) // gives streaming vinyl file object
         .pipe(buffer()) // <----- convert from streaming to buffered vinyl file object
         // .pipe(uglify()) // now gulp-uglify works
         .pipe(gulp.dest('./backend/js/'));
});

gulp.task('build', ['browserify-js', 'move-file']);

gulp.task('watch', ['browserify-js'], function () {
    gulp.watch('./js/**/*.js', ['browserify-js']);
});
