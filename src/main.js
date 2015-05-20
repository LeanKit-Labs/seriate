var when = require( "when" );
var fs = require( "fs" );
var path = require( "path" );
var callsite = require( "callsite" );
var _config;

function promisify( context, queryOptions ) {
	context.step( "__result__", queryOptions );
	return when.promise( function( resolve, reject, notify ) {
		context
			.end( resolve )
			.error( reject )
			.on( "data", notify );
	} );
}

function isAbsolutePath( p ) {
	return path.resolve( p ) === path.normalize( p ).replace( /(.+)([\/|\\])$/, "$1" );
}

module.exports = function( SqlContextCtor, TransactionContextCtor ) {
	return {
		SqlContext: SqlContextCtor,
		TransactionContext: TransactionContextCtor,
		getTransactionContext: function( config ) {
			return new this.TransactionContext( {
					connectionCfg: config || _config
				} );
		},
		getPlainContext: function( config ) {
			return new this.SqlContext( {
					connectionCfg: config || _config
				} );
		},
		executeTransaction: function( connCfg, queryOptions ) {
			if ( arguments.length === 1 ) {
				queryOptions = connCfg;
				connCfg = undefined;
			}
			return promisify( new this.TransactionContext( {
				connectionCfg: connCfg || _config
			} ), queryOptions );
		},
		execute: function( connCfg, queryOptions ) {
			if ( arguments.length === 1 ) {
				queryOptions = connCfg;
				connCfg = undefined;
			}
			return promisify( new this.SqlContext( {
				connectionCfg: connCfg || _config
			} ), queryOptions )
				.then( function( data ) {
					return data.__result__;
				} );
		},
		first: function() {
			var args = Array.prototype.slice.call( arguments, 0 );
			return this.execute.apply( this, args ).then( function( rows ) {
				return rows[ 0 ];
			} );
		},
		_getFilePath: function( p ) {
			// If we're not dealing with an absolute path, then we
			// need to get the *calling* code's directory, since
			// the sql file is being referenced relative to that location
			if ( !isAbsolutePath( p ) ) {
				var stack = callsite();
				var requester = stack[ 2 ].getFileName();
				p = path.join( path.dirname( requester ), p );
			}

			return p;
		},
		fromFile: function( p ) {
			p = this._getFilePath( p );
			var ext = path.extname( p );
			p = ( ext === "." ) ? ( p + "sql" ) : ( ext.length === 0 ) ? p + ".sql" : p;
			return fs.readFileSync( p, { encoding: "utf8" } );
		},
		setDefaultConfig: function( config ) {
			_config = config;
		}
	};
};
