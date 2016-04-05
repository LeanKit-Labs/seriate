var _ = require( "lodash" );
var fs = require( "fs" );
var path = require( "path" );
var callsite = require( "callsite" );

var fileCache = {};

function isAbsolutePath( p ) {
	return path.resolve( p ) === path.normalize( p ).replace( /(.+)([\/|\\])$/, "$1" );
}

function _getFilePath( p ) {
	// If we're not dealing with an absolute path, then we
	// need to get the *calling* code's directory, since
	// the sql file is being referenced relative to that location
	if ( !isAbsolutePath( p ) ) {
		var stack = callsite();
		var requester = stack[ 2 ].getFileName();
		p = path.join( path.dirname( requester ), p );
	}
	return p;
}

module.exports = {
	fromFile: function( p ) {
		p = _getFilePath( p );
		var ext = path.extname( p );
		p = ( ext === "." ) ? ( p + "sql" ) : ( ext.length === 0 ) ? p + ".sql" : p;
		var content = fileCache[ p ];
		if ( _.isEmpty( content ) ) {
			content = fs.readFileSync( p, { encoding: "utf8" } );
			fileCache[ p ] = content;
		}
		return content;
	}
};
