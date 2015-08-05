require( "../setup" );
var mockConnectionFn = require( "../data/mockConnection" );

describe( "Connections", function() {
	var connections, sql, mockConnection, config;
	before( function() {
		mockConnection = mockConnectionFn( true );
		sql = {
			Connection: function() {
				return mockConnection;
			}
		};
		connections = proxyquire( "../src/connections", {
			mssql: sql
		} );
	} );

	describe( "when requesting non-existing connection", function() {
		var byConfig, missingConfig;
		before( function() {
			missingConfig = {
				name: "missing",
				host: "newthing",
				user: "sa",
				password: "lol",
				database: "test"
			};
			byConfig = connections.get( missingConfig );
		} );

		it( "should get an error when named connection is missing", function() {
			return connections.get( "nosuch" )
				.should.eventually.be.rejectedWith( "No connection named \"nosuch\" exists" );
		} );

		it( "should create connection when new configuration is passed to get", function() {
			connections.state.configurations.missing.should.eql( missingConfig );
			connections.state.aliases[ "newthing-sa-test--" ].should.equal( "missing" );
		} );

		it( "should return new connection when configuration was provided", function() {
			return byConfig.should.eventually.eql( mockConnection );
		} );
	} );

	describe( "when adding valid new connection without name (implicit default)", function() {
		var connection;
		before( function() {
			config = {
				host: "ohhai",
				user: "sa",
				password: "sa",
				database: "databasstastic"
			};
			connection = connections.add( config );
			return connection;
		} );

		it( "should add connection as default", function() {
			connections.state.configurations.default.should.eql( config );
		} );

		it( "should add default alias", function() {
			connections.state.aliases[ "ohhai-sa-databasstastic--" ].should.equal( "default" );
		} );

		it( "should establish connection", function() {
			return connection.should.eventually.eql( mockConnection );
		} );
	} );

	describe( "when requesting connection", function() {
		var explicit, implicit, byConfig;
		before( function() {
			explicit = connections.get( "default" );
			implicit = connections.get();
			byConfig = connections.get( config );
		} );

		it( "should get default implicitly", function() {
			return implicit.should.eventually.eql( mockConnection );
		} );

		it( "should get default explicitly", function() {
			return explicit.should.eventually.eql( mockConnection );
		} );

		it( "should get default when configuration matches", function() {
			return byConfig.should.eventually.eql( mockConnection );
		} );
	} );

	describe( "when requesting connection that was closed", function() {
		var explicit, implicit, byConfig;
		before( function() {
			mockConnection.raise( "close" );
			explicit = connections.get( "default" );
			implicit = connections.get();
			byConfig = connections.get( config );
		} );

		it( "should get new connection implicitly", function() {
			return implicit.should.eventually.eql( mockConnection );
		} );

		it( "should get new connection explicitly", function() {
			return explicit.should.eventually.eql( mockConnection );
		} );

		it( "should get default when configuration matches", function() {
			return byConfig.should.eventually.eql( mockConnection );
		} );
	} );

	describe( "when requesting connection that had an error", function() {
		var explicit, implicit, byConfig;
		before( function() {
			mockConnection.raise( "error", [ new Error( "Just to be silly?" ) ] );
			explicit = connections.get( "default" );
			implicit = connections.get();
			byConfig = connections.get( config );
		} );

		it( "should get new connection implicitly", function() {
			return implicit.should.eventually.eql( mockConnection );
		} );

		it( "should get new connection explicitly", function() {
			return explicit.should.eventually.eql( mockConnection );
		} );

		it( "should get default when configuration matches", function() {
			return byConfig.should.eventually.eql( mockConnection );
		} );
	} );
} );
