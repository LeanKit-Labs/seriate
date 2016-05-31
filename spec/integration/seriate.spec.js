require( "../setup" );
var config = require( "./local-config.json" );
var getRowId = ( function() {
	var _id = 0;
	return function() {
		return _id++;
	};
}() );
var id1, id2;

function insertTestRows( sql ) {
	id1 = getRowId();
	id2 = getRowId();
	return sql.execute( config, {
			preparedSql: "insert into NodeTestTable (v1, i1) values (@v1, @i1); insert into NodeTestTable (v1, i1) values (@v2, @i2); ",
			params: {
				i1: {
					val: id1,
					type: sql.INT
				},
				v1: {
					val: "result1",
					type: sql.NVARCHAR
				},
				i2: {
					val: id2,
					type: sql.INT
				},
				v2: {
					val: "result2",
					type: sql.NVARCHAR
				}
			}
		} );
}

function deleteTestRows( sql ) {
	return sql.execute( config, {
		preparedSql: "DELETE FROM NodeTestTable; DELETE FROM NodeTestTableNoIdent"
	} );
}

describe( "Seriate Integration Tests", function() {
	var sql, connected;
	before( function() {
		this.timeout( 20000 );
		sql = proxyquire( "../src/index", {} );
		var masterCfg = _.extend( {}, config, { name: "master", database: "master", options: { database: "master" } } );

		function dropDatabase() {
			return sql.execute( masterCfg, {
				query: "IF DB_ID('" + config.database + "') IS NOT NULL\n" + "BEGIN\n" + "    ALTER DATABASE " + config.database + " SET SINGLE_USER WITH ROLLBACK IMMEDIATE;\n" + "    DROP DATABASE " + config.database + ";\n" + "END"
			} );
		}

		function createDatabase() {
			return sql.execute( masterCfg, {
				query: "create database " + config.database
			} );
		}

		function setupPrerequisites() {
			return sql.getPlainContext( config )
				.step( "CreateTable", {
					query: "create table NodeTestTable (bi1 bigint not null identity(1,1) primary key, v1 varchar(255), i1 int null)"
				} )
				.step( "CreateSecondTable", {
					query: "create table NodeTestTableNoIdent (bi1 bigint not null primary key, v1 varchar(255), i1 int null)"
				} )
				.step( "CreateProc", {
					query: "CREATE PROC NodeTestMultipleProc ( @i1 int ) AS SELECT	bi1, v1, i1 FROM NodeTestTable WHERE i1 = @i1; SELECT totalRows = COUNT(*) FROM NodeTestTable;"
				} )
				.then( function() {} );
		}

		sql.once( "connected", function() {
			connected = true;
		} );

		return dropDatabase()
			.then( createDatabase )
			.then( setupPrerequisites );
	} );

	it( "should connect successfully", function() {
		connected.should.equal.true;
	} );

	it( "should expose mssql.MAX", function() {
		sql.MAX.should.equal( require( "mssql" ).MAX );
	} );

	after( function( done ) {
		sql.once( "closed", function( connection ) {
			done();
		} );
		sql.closeConnection( "default" );
		sql.closeConnection( "master" );
	} );

	describe( "when executing within a TransactionContext", function() {
		describe( "and committing the transaction", function() {
			var id, insResult, resultsCheck, checkError, readCheck;

			before( function( done ) {
				id = getRowId();
				readCheck = function( done ) {
					sql.execute( config, {
						preparedSql: "select * from NodeTestTable where i1 = @i1",
						params: {
							i1: {
								val: id,
								type: sql.INT
							}
						}
					} ).then( function( res ) {
						resultsCheck = res;
						done();
					}, function( err ) {
							checkError = err;
							done();
						} );
				};
				sql.getTransactionContext( config )
					.step( "insert", {
						preparedSql: "insert into NodeTestTable (v1, i1) values (@v1, @i1); select SCOPE_IDENTITY() AS NewId;",
						params: {
							i1: {
								val: id,
								type: sql.INT
							},
							v1: {
								val: "testy",
								type: sql.NVARCHAR
							}
						}
					} )
					.end( function( res ) {
						insResult = res;
						res.transaction
							.commit()
							.then( function() {
								readCheck( done );
							} );
					} )
					.error( function( err ) {
						done( err );
					} );
			} );

			it( "should have return inserted row", function() {
				resultsCheck.length.should.equal( 1 );
				( typeof checkError ).should.equal( "undefined" );
			} );

			it( "should have returned the identity of inserted row", function() {
				insResult.sets.insert[ 0 ].NewId.should.be.ok;
				( typeof insResult.sets.insert[ 0 ].NewId ).should.equal( "number" );
			} );

			after( function() {
				return deleteTestRows( sql );
			} );
		} );

		describe( "and rolling back the transaction", function() {
			var id, readCheck, resultsCheck, checkError;
			before( function( done ) {
				id = getRowId();
				readCheck = function( done ) {
					sql.execute( config, {
						preparedSql: "select * from NodeTestTable where i1 = @i1;",
						params: {
							i1: {
								val: id,
								type: sql.INT
							}
						}
					} ).then( function( res ) {
						resultsCheck = res;
						done();
					}, function( err ) {
							checkError = err;
							done();
						} );
				};
				sql.getTransactionContext( config )
					.step( "insert", {
						preparedSql: "insert into NodeTestTable (v1, i1) values (@v1, @i1);",
						params: {
							i1: {
								val: id,
								type: sql.INT
							},
							v1: {
								val: "testy",
								type: sql.NVARCHAR
							}
						}
					} )
					.end( function( res ) {
						res.transaction
							.rollback()
							.then( function() {
								readCheck( done );
							} );
					} )
					.error( function( err ) {
						done( err );
					} );
			} );
			after( function() {
				return deleteTestRows( sql );
			} );
			it( "should show that the row was not inserted", function() {
				resultsCheck.length.should.equal( 0 );
				( typeof checkError ).should.equal( "undefined" );
			} );
		} );
	} );

	describe( "when updating a row", function() {
		var id, insResults, insertErr, updateErr, updResults;

		before( function() {
			id = getRowId();

			function insert() {
				return sql.execute( config, {
					preparedSql: "insert into NodeTestTable (v1, i1) values (@v1, @i1)",
					params: {
						i1: {
							val: id,
							type: sql.INT
						},
						v1: {
							val: "inserty",
							type: sql.NVARCHAR
						}
					}
				} ).then( undefined, function( err ) {
					insertErr = err;
				} );
			}

			function insertCheck() {
				return sql.execute( config, {
					preparedSql: "select * from NodeTestTable where i1 = @i1",
					params: {
						i1: {
							val: id,
							type: sql.INT
						}
					}
				} ).then( function( res ) {
					insResults = res;
				} );
			}

			function updateCheck() {
				return sql.execute( config, {
					preparedSql: "select * from NodeTestTable where i1 = @i1",
					params: {
						i1: {
							val: id,
							type: sql.INT
						}
					}
				} ).then( function( res ) {
					updResults = res;
				} );
			}

			function update() {
				return sql.execute( config, {
					preparedSql: "update NodeTestTable set v1 = @v1 where i1 = @i1",
					params: {
						i1: {
							val: id,
							type: sql.INT
						},
						v1: {
							val: "updatey",
							type: sql.NVARCHAR
						}
					}
				} ).then( undefined, function( err ) {
					updateErr = err;
				} );
			}

			return insert()
				.then( insertCheck )
				.then( update )
				.then( updateCheck );
		} );

		after( function() {
			return deleteTestRows( sql );
		} );

		it( "should have inserted the row", function() {
			insResults.length.should.equal( 1 );
		} );

		it( "should have updated row", function() {
			updResults[ 0 ].v1.should.equal( "updatey" );
		} );

		it( "should not have errored on insert", function() {
			should.not.exist( insertErr );
		} );

		it( "should not have errored on update", function() {
			should.not.exist( updateErr );
		} );
	} );

	describe( "when using default connection configuration option", function() {
		var result;

		before( function() {
			return insertTestRows( sql )
				.then( function() {
					return sql.execute( {
						preparedSql: "select v1 from NodeTestTable where i1 = @i1",
						params: {
							i1: {
								val: id1,
								type: sql.INT
							}
						}
					} );
				} )
				.then( function( res ) {
					result = res;
				} );
		} );

		after( function() {
			return deleteTestRows( sql );
		} );

		it( "should utilize default options", function() {
			result.should.eql( [ { v1: "result1" } ] );
		} );
	} );

	describe( "when executing a stored procedure", function() {
		var procResults;

		before( function() {
			return insertTestRows( sql )
				.then( function() {
					return sql.execute( config, {
						procedure: "NodeTestMultipleProc",
						params: {
							i1: {
								val: id1,
								type: sql.INT
							}
						}
					} ).then( function( res ) {
						procResults = res[ 0 ];
					} );
				} );
		} );

		after( function() {
			return deleteTestRows( sql );
		} );

		it( "should return multiple recordsets because, stored procedure", function() {
			procResults.length.should.equal( 2 );
			procResults[ 0 ].length.should.equal( 1 );
			procResults[ 1 ].length.should.equal( 1 );
			procResults[ 0 ][ 0 ].v1.should.equal( "result1" );
			procResults[ 1 ][ 0 ].totalRows.should.be.above( 0 );
			procResults.returnValue.should.equal( 0 );
		} );
	} );

	describe( "when retrieving multiple record sets", function() {
		before( function() {
			return insertTestRows( sql );
		} );

		after( function() {
			return deleteTestRows( sql );
		} );

		describe( "with plain SQL", function() {
			var multipleRSPlainResults;
			before( function() {
				return sql.execute( "default", {
					query: "select * from NodeTestTable where i1 = @i1; select * from NodeTestTable where i1 = @i2;",
					params: {
						i1: {
							val: id1,
							type: sql.INT
						},
						i2: {
							val: id2,
							type: sql.INT
						}
					},
					multiple: true
				} ).then( function( res ) {
					multipleRSPlainResults = res;
				} );
			} );

			it( "should have 2 record sets from plain sql", function() {
				multipleRSPlainResults.length.should.equal( 2 );
				multipleRSPlainResults[ 0 ].length.should.equal( 1 );
				multipleRSPlainResults[ 1 ].length.should.equal( 1 );
				multipleRSPlainResults[ 0 ][ 0 ].v1.should.equal( "result1" );
				multipleRSPlainResults[ 1 ][ 0 ].v1.should.equal( "result2" );
				( typeof multipleRSPlainResults.returnValue ).should.equal( "undefined" );
			} );
		} );

		describe( "with prepared SQL", function() {
			var multipleResults;

			before( function() {
				return sql.execute( config, {
					preparedSql: "select * from NodeTestTable where i1 = @i1; select * from NodeTestTable where i1 = @i2;",
					params: {
						i1: {
							val: id1,
							type: sql.INT
						},
						i2: {
							val: id2,
							type: sql.INT
						}
					},
					multiple: true
				} ).then( function( res ) {
					multipleResults = res;
				} );
			} );

			it( "should have 2 record sets from prepared sql", function() {
				multipleResults.length.should.equal( 2 );
				multipleResults[ 0 ].length.should.equal( 1 );
				multipleResults[ 1 ].length.should.equal( 1 );
				multipleResults[ 0 ][ 0 ].v1.should.equal( "result1" );
				multipleResults[ 1 ][ 0 ].v1.should.equal( "result2" );
				multipleResults.returnValue.should.equal( 0 );
			} );
		} );

		describe( "with stored procedures", function() {
			var multipleRSProcResults;

			before( function() {
				return sql.execute( {
					procedure: "NodeTestMultipleProc",
					params: {
						i1: {
							val: id1,
							type: sql.INT
						}
					}
				} ).then( function( res ) {
					multipleRSProcResults = res[ 0 ];
				} );
			} );

			it( "should have 2 record sets from procedure", function() {
				multipleRSProcResults.length.should.equal( 2 );
				multipleRSProcResults[ 0 ].length.should.equal( 1 );
				multipleRSProcResults[ 1 ].length.should.equal( 1 );
				multipleRSProcResults[ 0 ][ 0 ].v1.should.equal( "result1" );
				multipleRSProcResults[ 1 ][ 0 ].totalRows.should.be.above( 0 );
				multipleRSProcResults.returnValue.should.equal( 0 );
			} );
		} );
	} );

	describe( "when failing to connect", function() {
		var failed;
		before( function( done ) {
			sql.once( "failed", function( connection ) {
				failed = connection;
				done();
			} );

			sql.addConnection( {
				name: "lol",
				host: "lol",
				user: "lol",
				password: "lol",
				database: "lol"
			} );
		} );

		it( "should emit failed with an error", function() {
			failed.name.should.equal( "lol" );
			failed.should.have.property( "error" );
		} );
	} );

	[ "query", "preparedSql" ].forEach( function( sqlKey ) {
		describe( "when inserting a list of values with " + sqlKey, function() {
			afterEach( function() {
				return deleteTestRows( sql );
			} );

			it( "should insert a row for each item", function( done ) {
				var step = {
					params: {
						v1s: {
							val: [ "one", "two", "three", "four with \"quotes\"" ],
							type: sql.NVARCHAR( 100 ),
							asTable: true
						},
						i1: {
							val: 123,
							type: sql.INT
						}
					}
				};

				step[ sqlKey ] = "INSERT INTO NodeTestTable (v1, i1) SELECT value, @i1 FROM @v1s;";

				sql.getPlainContext( config )
					.step( "insert", step )
					.end( function( res ) {
						sql.execute( config, {
							query: "SELECT v1, i1 FROM NodeTestTable;"
						} ).then( function( res ) {
							res.should.eql( [
								{ v1: "one", i1: 123 },
								{ v1: "two", i1: 123 },
								{ v1: "three", i1: 123 },
								{ v1: "four with \"quotes\"", i1: 123 }
							] );
							done();
						}, function( err ) {
							done( err );
						} );
					} );
			} );
		} );

		describe( "when inserting a list of objects with " + sqlKey, function() {
			afterEach( function() {
				return deleteTestRows( sql );
			} );

			it( "should insert a row for each item", function( done ) {
				var step = {
					params: {
						v1s: {
							val: [ { id: 1, name: "Foo" }, { id: 2, name: "Bar" } ],
							asTable: {
								id: sql.BIGINT,
								name: sql.NVARCHAR( 200 )
							}
						},
						i1: {
							val: 123,
							type: sql.INT
						}
					}
				};

				step[ sqlKey ] = "INSERT INTO NodeTestTableNoIdent (bi1, v1, i1) SELECT id, name, @i1 FROM @v1s;";

				sql.getPlainContext( config )
					.step( "insert", step )
					.end( function( res ) {
						sql.execute( config, {
							query: "SELECT bi1, v1, i1 FROM NodeTestTableNoIdent;"
						} ).then( function( res ) {
							res.should.eql( [
								{ bi1: "1", v1: "Foo", i1: 123 },
								{ bi1: "2", v1: "Bar", i1: 123 }
							] );
							done();
						}, function( err ) {
							done( err );
						} );
					} );
			} );
		} );
	} );

	describe( "when providing an isolation level", function() {
		var levels = [ "READ_UNCOMMITTED", "READ_COMMITTED", "REPEATABLE_READ", "SERIALIZABLE", "SNAPSHOT" ];

		levels.forEach( function( level ) {
			it( "should allow isolation level " + level, function() {
				var isolationConfig = _.extend( { isolationLevel: sql[ level ] }, config );
				return sql.getTransactionContext( isolationConfig )
					.step( "isolation", {
						query: sql.fromFile( "./sql/isolation" )
					} )
					.then( function( result ) {
						result.transaction
							.commit()
							.then( function() {
								result.sets.isolation[0].level.should.equal( level );
							} );
					} );
			} );

			var stringyLevel = level.toLowerCase();
			it( "should allow stringy isolation level '" + stringyLevel + "'", function() {
				var isolationConfig = _.extend( { isolationLevel: stringyLevel }, config );
				return sql.getTransactionContext( isolationConfig )
					.step( "isolation", {
						query: sql.fromFile( "./sql/isolation" )
					} )
					.then( function( result ) {
						result.transaction
							.commit()
							.then( function() {
								result.sets.isolation[0].level.should.equal( level );
							} );
					} );
			} );
		} );

		it( "should throw error when provided a bad isolation level string", function() {
			var isolationConfig = _.extend( { isolationLevel: "foo" }, config );
			return sql.getTransactionContext( isolationConfig )
					.step( "isolation", {
						query: sql.fromFile( "./sql/isolation" )
					} )
					.then( null, function( err ) {
						err.message.should.equal( "TransactionContext Error. Failed on step \"startingTransaction\" with: \"Unknown isolation level: \"foo\"\"" );
					} );
		} );
	} );
} );
