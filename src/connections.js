var _ = require( "lodash" );
var when = require( "when" );
var sql = require( "mssql" );
var log = require( "./log" )( "seriate.connection" );

var state = {
	pools: {},
	connections: {},
	configurations: {},
	aliases: {}
};

function addConnection( config ) {
	var name = getName( config );
	var original = getConfiguration( name );
	var alias = getAlias( config );
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
	var name = getName( config );
	var pool = state.pools[ name ];

	if ( pool ) {
		pool.close();
	}
}

function connect( name, config ) {
	var pool = getPool( name );
	if ( pool ) {
		log.warn( "Connection for \"%s\" that already exists - existing connection pool will be used.", name );
		return state.connections[ name ];
	}
	log.info( "Connecting to \"%s\" ( %s:%d - %s as %s )",
		name,
		config.host || config.server,
		config.port || 1433,
		config.database,
		config.user );
	pool = state.pools[ name ] = new sql.Connection( config );

	pool.on( "connect", function() {
		log.info( "Connected to \"%s\"", name );
	} );

	pool.on( "close", function() {
		log.info( "Closed connection to \"%s\"", name );
		pool.removeAllListeners();
		delete state.connections[ name ];
		delete state.pools[ name ];
	} );

	pool.on( "error", function( err ) {
		log.error( "Failed to connection to \"%s\" with: %s", name, err );
		delete state.connections[ name ];
		delete state.pools[ name ];
		pool.removeAllListeners();
	} );

	state.pools[ name ] = pool;
	state.connections[ name ] = pool.connect()
		.then( function() {
			return pool;
		} );
	return state.connections[ name ];
}

function getConnection( config ) {
	var name = getName( config );
	var pool = state.pools[ name ];
	var connection = state.connections[ name ];
	var configuration = state.configurations[ name ];
	var aliasedName = state.aliases[ name ];
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
		return when.reject( new Error( "No connection named \"" + name + "\" exists" ) );
	} else {
		return addConnection( config );
	}
}

function getConfiguration( name ) {
	return state.configurations[ name ];
}

function getName( config ) {
	var name;
	if ( config === undefined ) {
		name = "default";
	} else if ( _.isString( config ) ) {
		name = config;
	} else if ( config.name ) {
		name = config.name;
	} else {
		if ( getConfiguration( "default" ) ) {
			name = getAlias( config );
		} else {
			name = "default";
		}
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

module.exports = {
	state: state,
	add: addConnection,
	close: closeConnection,
	get: getConnection,
	reset: resetState
};
