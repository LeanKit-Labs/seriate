var when = require( "when" );
var _ = require( "lodash" );
var Monologue = require( "monologue.js" ).prototype;
var sql = require( "mssql" );
var connections = require( "./connections" );
var SqlContext = require( "./sqlContext" )();
var TransactionContext = require( "./transactionContext" )( SqlContext );
var utils = require( "./utils" );
var tedious = require( "tedious" );

// I've seen things you people wouldn't believe
// WHAT DO YOU MEAN BY 'YOU PEOPLE'?!
/*
	No really, what's the deal here?
	Well - it seems that tedious + mssql do not reset connections for us.
	So we made them. (really, mssql would ideally be doing this when verifying or
	in an acquire hook before handing connection to a consumer.) Instead, we've
	patched tedious (and we're not crazy about this) to:
		* reset before transactions & prepared SQL (but it will wait until the transaction is done or until after
		  the prepared SQL is unprepared.)
		* reset before any batch that's not a transaction or prepared SQL

	The `inTransaction` and `resetConnectionOnNextRequest` values are internal to tedious,
	and we added `isInPreparedSqlQuery` as part of the patch below.
*/
var existing = tedious.Connection.prototype.makeRequest;
tedious.Connection.prototype.makeRequest = function( request, packetType, payload ) {
	if ( this.inTransaction || this.isInPreparedSqlQuery ||
		this.isInBulkLoadOperation || this.resetConnectionOnNextRequest ) {
		if ( request.sqlTextOrProcedure === "sp_unprepare" ) {
			this.isInPreparedSqlQuery = false;
		}
		return existing.call( this, request, packetType, payload );
	} else {
		return this.reset( function() {
			if ( request.sqlTextOrProcedure === "sp_prepare" ) {
				this.isInPreparedSqlQuery = true;
			}
			return existing.call( this, request, packetType, payload );
		}.bind( this ) );
	}
};

var origNewBulkLoad = tedious.Connection.prototype.newBulkLoad;
tedious.Connection.prototype.newBulkLoad = function( table, callback ) {
	var thus = this;
	var result = origNewBulkLoad.call( this, table, function() {
		callback.apply( this, arguments );
		thus.isInBulkLoadOperation = false;
	} );
	return result;
};

var origExecBulkLoad = tedious.Connection.prototype.execBulkLoad;
tedious.Connection.prototype.execBulkLoad = function() {
	this.isInBulkLoadOperation = true;
	return origExecBulkLoad.apply( this, arguments );
};

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
		delete args[ args.length - 1 ].stream;
		return this.execute.apply( this, args ).then( function( rows ) {
			return rows[ 0 ];
		} );
	},
	fromFile: utils.fromFile,
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

_.each( sql.ISOLATION_LEVEL, function( val, key ) {
	seriate[ key ] = sql.ISOLATION_LEVEL[ key ];
} );

seriate.MAX = sql.MAX;

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
