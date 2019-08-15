var _ = require( "lodash" );
var when = require( "when" );
var sql = require( "mssql" );
var Monologue = require( "monologue.js" ).prototype;
var log = require( "./log" )( "seriate.connection" );

var state = {
	pools: {},
	connections: {},
	configurations: {},
	aliases: {}
};

var api = _.assign( {
	state,
	add: addConnection,
	close: closeConnection,
	get: getConnection,
	getHooks,
	reset: resetState
}, Monologue );

function addConnection( config ) {
	const name = getName( config );
	const original = getConfiguration( name );
	const alias = getAlias( config );
	if ( alias !== name && !state.aliases[ alias ] ) {
		state.aliases[ alias ] = name;
	}
	if ( config.host ) {
		config.server = config.host;
	}
	if ( name === "default" || !original ) {
		state.configurations[ name ] = config;
		return connect( name, config );
	} else if ( alias === getAlias( original ) ) {
		return getConnection( config );
	}
}

function closeConnection( config ) {
	const name = getName( config );
	const pool = state.pools[ name ];

	if ( pool ) {
		pool.close();
	}
}

function connect( name, config ) {
	let pool = getPool( name );
	if ( pool ) {
		log.warn( "Connection for \"%s\" that already exists - existing connection pool will be used.", name );
		return state.connections[ name ];
	}
	log.info( "Connecting to \"%s\" ( %s:%d - %s as %s )",
		name,
		config.host || config.server,
		// eslint-disable-next-line no-magic-numbers
		config.port || 1433,
		config.database,
		config.user );
	pool = state.pools[ name ] = new sql.Connection( config );

	pool.on( "connect", function() {
		api.emit( "connected", { name } );
		log.info( "Connected to \"%s\"", name );
	} );

	pool.on( "close", function() {
		api.emit( "closed", { name } );
		log.info( "Closed connection to \"%s\"", name );
		pool.removeAllListeners();
		delete state.connections[ name ];
		delete state.pools[ name ];
	} );

	function onConnectionError( err ) {
		api.emit( "failed", { name, error: err } );
		log.error( "Failed to connection to \"%s\" with: %s", name, err );
		delete state.connections[ name ];
		delete state.pools[ name ];
		pool.removeAllListeners();
	}

	pool.on( "error", onConnectionError );

	state.pools[ name ] = pool;
	state.connections[ name ] = pool.connect()
		.then( function() {
			return pool;
		}, onConnectionError );
	return state.connections[ name ];
}

function getConnection( config ) {
	let name = getName( config );
	let pool = state.pools[ name ];
	let connection = state.connections[ name ];
	let configuration = state.configurations[ name ];
	const aliasedName = state.aliases[ name ];
	if ( !pool && !connection && aliasedName ) {
		name = aliasedName;
		pool = state.pools[ name ];
		connection = state.connections[ name ];
		configuration = state.configurations[ name ];
	}

	if ( connection ) {
		return connection;
	} else if ( pool ) {
		connection = pool.connect()
			.then( function() {
				return pool;
			} );
		state.connections[ name ] = connection;
		return connection;
	} else if ( configuration ) {
		return connect( name, configuration );
	} else if ( config === undefined || _.isString( config ) ) {
		return when.reject( new Error( `No connection named "${ name }" exists` ) );
	}
	return addConnection( config );
}

function getConfiguration( name ) {
	return state.configurations[ name ];
}

function getHooks( config ) {
	const hooks = state.configurations[ getName( config ) ];
	return {
		atTransactionStart: hooks && hooks.atTransactionStart,
		atTransactionEnd: hooks && hooks.atTransactionEnd
	};
}

function getName( config ) {
	let name;
	if ( config === undefined || config === null ) {
		name = "default";
	} else if ( _.isString( config ) ) {
		name = config;
	} else if ( config.name ) {
		name = config.name;
	} else if ( getConfiguration( "default" ) ) {
		name = getAlias( config );
	} else {
		name = "default";
	}
	return name;
}

function getAlias( config ) {
	return [ config.host || config.server, config.user, config.database, config.domain, config.port ].join( "-" );
}

function getPool( name ) {
	return state.pools[ name ];
}

function resetState() {
	state = {
		pools: {},
		connections: {},
		configurations: {},
		aliases: {}
	};
}

module.exports = api;
