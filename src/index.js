var when = require( "when" );
var _ = require( "lodash" );
const EventEmitter = require( "events" );

var sql = require( "mssql" );
var connections = require( "./connections" );
var SqlContext = require( "./sqlContext" )();
var TransactionContext = require( "./transactionContext" )( SqlContext );
var utils = require( "./utils" );
require( "./tedious-patch" );

function promisify( context, queryOptions ) {
	const name = queryOptions.name || queryOptions.procedure || "__result__";
	context.step( name, queryOptions );
	return when.promise( function( resolve, reject, notify ) {
		context
			.end( resolve )
			.error( reject )
			.on( "data", notify );
	} );
}

var seriate = {
	getTransactionContext( connectionConfig, dataForHooks ) {
		const options = { metrics: this.metrics, namespace: this.metricsNamespace };
		if ( connectionConfig && connectionConfig.isolationLevel ) {
			options.isolationLevel = connectionConfig.isolationLevel;
			delete connectionConfig.isolationLevel;
		}
		options.connection = connections.get( connectionConfig );
		const hooks = connections.getHooks( connectionConfig );
		options.atTransactionStart = hooks.atTransactionStart;
		options.atTransactionEnd = hooks.atTransactionEnd;
		options.dataForHooks = dataForHooks;
		return new TransactionContext( options );
	},
	getPlainContext( connection ) {
		const conn = connections.get( connection );
		const options = { metrics: this.metrics, namespace: this.metricsNamespace, connection: conn };
		return new SqlContext( options );
	},
	executeTransaction( connectionConfig, queryOptions, dataForHooks ) {
		if ( arguments.length === 1 ) {
			queryOptions = connectionConfig;
			connectionConfig = undefined;
		}
		const conn = connections.get( connectionConfig );
		const hooks = connections.getHooks( connectionConfig );
		const options = {
			metrics: this.metrics,
			namespace: this.metricsNamespace,
			connection: conn,
			atTransactionStart: hooks.atTransactionStart,
			atTransactionEnd: hooks.atTransactionEnd,
			dataForHooks
		};
		return promisify( new TransactionContext( options ), queryOptions );
	},
	execute( connection, queryOptions ) {
		if ( arguments.length === 1 ) {
			queryOptions = connection;
			connection = undefined;
		}
		const conn = connections.get( connection );
		const options = { metrics: this.metrics, namespace: this.metricsNamespace, connection: conn };
		return promisify( new SqlContext( options ), queryOptions )
			.then( function( data ) {
				if ( data.__result__ ) {
					return data.__result__;
				}
				return data[ queryOptions.procedure || queryOptions.name ];
			} );
	},
	first( ...args ) {
		delete args[ args.length - 1 ].stream;
		return this.execute( ...args ).then( function( rows ) {
			return rows[ 0 ];
		} );
	},
	fromFile: utils.fromFile,
	addConnection( config ) {
		connections.add( config );
	},
	setDefaultConfig( config ) {
		config.name = "default";
		connections.add( config );
	},
	setDefault( config ) {
		config.name = "default";
		connections.add( config );
	},
	closeConnection( config ) {
		connections.close( config );
	},
	resetConnections() {
		connections.reset();
	},
	useMetrics( metrics, namespace ) {
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

var api = _.assign( seriate, EventEmitter.prototype );

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
