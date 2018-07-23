var when = require( "when" );
var _ = require( "lodash" );
var Monologue = require( "monologue.js" ).prototype;
var sql = require( "mssql" );
var connections = require( "./connections" );
var SqlContext = require( "./sqlContext" )();
var TransactionContext = require( "./transactionContext" )( SqlContext );
var utils = require( "./utils" );
require( "./tedious-patch" );

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
	getTransactionContext: function( connectionConfig, dataForHooks ) {
		var options = { metrics: this.metrics, namespace: this.metricsNamespace };
		if ( connectionConfig && connectionConfig.isolationLevel ) {
			options.isolationLevel = connectionConfig.isolationLevel;
			delete connectionConfig.isolationLevel;
		}
		options.connection = connections.get( connectionConfig );
		var hooks = connections.getHooks( connectionConfig );
		options.atTransactionStart = hooks.atTransactionStart;
		options.atTransactionEnd = hooks.atTransactionEnd;
		options.dataForHooks = dataForHooks;
		return new TransactionContext( options );
	},
	getPlainContext: function( connection ) {
		var conn = connections.get( connection );
		var options = { metrics: this.metrics, namespace: this.metricsNamespace, connection: conn };
		return new SqlContext( options );
	},
	executeTransaction: function( connectionConfig, queryOptions, dataForHooks ) {
		if ( arguments.length === 1 ) {
			queryOptions = connectionConfig;
			connectionConfig = undefined;
		}
		var conn = connections.get( connectionConfig );
		var hooks = connections.getHooks( connectionConfig );
		var options = {
			metrics: this.metrics,
			namespace: this.metricsNamespace,
			connection: conn,
			atTransactionStart: hooks.atTransactionStart,
			atTransactionEnd: hooks.atTransactionEnd,
			dataForHooks
		};
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
