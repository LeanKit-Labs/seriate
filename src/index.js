var when = require( "when" );
var fs = require( "fs" );
var _ = require( "lodash" );
var Monologue = require( "monologue.js" ).prototype;
var path = require( "path" );
var callsite = require( "callsite" );
var sql = require( "mssql" );
var connections = require( "./connections" );
var SqlContext = require( "./sqlContext" )();
var TransactionContext = require( "./transactionContext" )( SqlContext );
var fileCache = {};

function promisify( context, queryOptions ) {
	var name = queryOptions.name || queryOptions.procedure || "__result__";
	context.step( name, queryOptions );
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

var seriate = {
	getTransactionContext: function( connection ) {
		var options = { metrics: this.metrics, namespace: this.metricsNamespace };
		if ( connection && connection.isolationLevel ) {
			options.isolationLevel = connection.isolationLevel;
			delete connection.isolationLevel;
		}
		options.connection = connections.get( connection );
		return new TransactionContext( options );
	},
	getPlainContext: function( connection ) {
		var conn = connections.get( connection );
		var options = { metrics: this.metrics, namespace: this.metricsNamespace, connection: conn };
		return new SqlContext( options );
	},
	executeTransaction: function( connection, queryOptions ) {
		if ( arguments.length === 1 ) {
			queryOptions = connection;
			connection = undefined;
		}
		var conn = connections.get( connection );
		var options = { metrics: this.metrics, namespace: this.metricsNamespace, connection: conn };
		return promisify( new TransactionContext( options ), queryOptions );
	},
	execute: function( connection, queryOptions ) {
		if ( arguments.length === 1 ) {
			queryOptions = connection;
			connection = undefined;
		}
		var conn = connections.get( connection );
		var options = { metrics: this.metrics, namespace: this.metricsNamespace, connection: conn };
		return promisify( new SqlContext( options ), queryOptions )
			.then( function( data ) {
				if ( data.__result__ ) {
					return data.__result__;
				} else {
					return data[ queryOptions.procedure || queryOptions.name ];
				}
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
		var content = fileCache[ p ];
		if ( _.isEmpty( content ) ) {
			content = fs.readFileSync( p, { encoding: "utf8" } );
			fileCache[ p ] = content;
		}
		return content;
	},
	addConnection: function( config ) {
		connections.add( config );
	},
	setDefaultConfig: function( config ) {
		config.name = "default";
		connections.add( config );
	},
	setDefault: function( config ) {
		config.name = "default";
		connections.add( config );
	},
	closeConnection: function( config ) {
		connections.close( config );
	},
	resetConnections: function() {
		connections.reset();
	},
	useMetrics: function( metrics, namespace ) {
		this.metrics = metrics;
		this.metricsNamespace = namespace;
	}
};

_.each( sql.TYPES, function( val, key ) {
	seriate[ key ] = sql.TYPES[ key ];
	seriate[ key.toUpperCase() ] = sql.TYPES[ key ];
} );

var api = _.assign( seriate, Monologue );

connections.on( "connected", function( info ) {
	api.emit( "connected", info );
} );

connections.on( "closed", function( info ) {
	api.emit( "closed", info );
} );

connections.on( "failed", function( info ) {
	api.emit( "failed", info );
} );

module.exports = api;
