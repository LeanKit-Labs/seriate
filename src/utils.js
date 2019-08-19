const _ = require( "lodash" );
const fs = require( "fs" );
const path = require( "path" );
const callsite = require( "callsite" );

const fileCache = {};

function isAbsolutePath( p ) {
	// eslint-disable-next-line no-useless-escape
	return path.resolve( p ) === path.normalize( p ).replace( /(.+)([\/|\\])$/, "$1" );
}

function _getFilePath( p ) {
	// If we're not dealing with an absolute path, then we
	// need to get the *calling* code's directory, since
	// the sql file is being referenced relative to that location
	if ( !isAbsolutePath( p ) ) {
		const stack = callsite();
		const requester = stack[ 2 ].getFileName();
		p = path.join( path.dirname( requester ), p );
	}
	return p;
}

module.exports = {
	fromFile( p ) {
		p = _getFilePath( p );
		const ext = path.extname( p );
		// eslint-disable-next-line no-nested-ternary
		p = ( ext === "." ) ? ( `${ p }sql` ) : ( ext.length === 0 ) ? `${ p }.sql` : p;
		let content = fileCache[ p ];
		if ( _.isEmpty( content ) ) {
			content = fs.readFileSync( p, { encoding: "utf8" } );
			fileCache[ p ] = content;
		}
		return content;
	}
};
