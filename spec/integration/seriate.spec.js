var sql = seriateFactory();
var config = require( "./local-config.json" );
var getRowId = ( function() {
	var _id = 0;
	return function() {
		return _id++;
	};
}() );
var _ = require( "lodash" );
var id1, id2;

function insertTestRows() {
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

function deleteTestRows() {
	return sql.execute( config, {
		preparedSql: "DELETE FROM NodeTestTable"
	} );
}

describe( "Seriate Integration Tests", function() {
	before( function( done ) {
		this.timeout( 20000 );
		var masterCfg = _.extend( {}, config, { database: "master" } );
		sql.execute( masterCfg, {
			query: "if db_id('" + config.database + "') is not null drop database " + config.database
		} ).then( function() {
			sql.execute( masterCfg, {
				query: "create database " + config.database
			} ).then( function() {
				sql.getPlainContext( config )
					.step( "CreateTable", {
						query: "create table NodeTestTable (bi1 bigint not null identity(1,1) primary key, v1 varchar(255), i1 int null)"
					} )
					.step( "CreateSecondTable", {
						query: "create table NodeTestTableNoIdent (bi1 bigint not null primary key, v1 varchar(255), i1 int null)"
					} )
					.end( function() {
						sql.getPlainContext( config )
							.step( "CreateProc", {
								query: "CREATE PROC NodeTestMultipleProc ( @i1 int ) AS SELECT	bi1, v1, i1 FROM NodeTestTable WHERE i1 = @i1; SELECT totalRows = COUNT(*) FROM NodeTestTable;"
							} )
							.end( function() {
								done();
							} )
							.error( function( err ) {
								console.log( err );
								done();
							} );
					} )
					.error( function( err ) {
						console.log( err );
						done();
					} );
			} );
		} );
	} );

	describe( "When executing within a TransactionContext", function() {
		describe( "and committing the transaction", function() {
			var id, context, insError, insResult, resultsCheck, checkError, readCheck;
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
				context = sql
					.getTransactionContext( config )
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
						insError = err;
						done();
					} );
			} );
			after( function() {
				return deleteTestRows();
			} );
			it( "should have return inserted row", function() {
				resultsCheck.length.should.equal( 1 );
				( typeof checkError ).should.equal( "undefined" );
			} );
			it( "should have returned the identity of inserted row", function() {
				insResult.sets.insert[ 0 ].NewId.should.be.ok;
				( typeof insResult.sets.insert[ 0 ].NewId ).should.equal( "number" );
			} );
		} );
		describe( "and rolling back the transaction", function() {
			var id, context, insError, readCheck, resultsCheck, checkError;
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
				context = sql
					.getTransactionContext( config )
					.step( "insert", {
						preparedSql: "insert into NodeTestTable (v1, i1) values (@v1, @i1)",
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
						insError = err;
						done();
					} );
			} );
			after( function() {
				return deleteTestRows();
			} );
			it( "should show that the row was not inserted", function() {
				resultsCheck.length.should.equal( 0 );
				( typeof checkError ).should.equal( "undefined" );
			} );
		} );
	} );
	describe( "When updating a row", function() {
		var id, insertCheck, insResults, updateCmd, updateErr, updateCheck, updResults;
		before( function( done ) {
			id = getRowId();
			insertCheck = function( done ) {
				sql.execute( config, {
					preparedSql: "select * from NodeTestTable where i1 = @i1",
					params: {
						i1: {
							val: id,
							type: sql.INT
						}
					}
				} ).then( function( res ) {
					insResults = res;
					done();
				} );
			};
			updateCheck = function( done ) {
				sql.execute( config, {
					preparedSql: "select * from NodeTestTable where i1 = @i1",
					params: {
						i1: {
							val: id,
							type: sql.INT
						}
					}
				} ).then( function( res ) {
					updResults = res;
					done();
				} );
			};
			updateCmd = function( done ) {
				sql.execute( config, {
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
				} ).then( function() {
					updateCheck( done );
				}, function( err ) {
						updateErr = err;
					} );
			};
			sql.execute( config, {
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
			} ).then( function() {
				insertCheck( done );
			} );
		} );
		after( function() {
			return deleteTestRows();
		} );

		it( "should have inserted the row", function() {
			insResults.length.should.equal( 1 );
		} );
		it( "should show the updates", function( done ) {
			updateCmd( function() {
				updResults[ 0 ].v1.should.equal( "updatey" );
				done();
			} );
		} );
	} );
	describe( "When using default connection configuration option", function() {
		it( "Should utilize default options", function( done ) {
			sql.setDefaultConfig( config );
			sql.execute( {
				preparedSql: "select * from NodeTestTable where i1 = @i1",
				params: {
					i1: {
						val: getRowId(),
						type: sql.INT
					}
				}
			} ).then( function( /* res */ ) {
				done();
			} );
		} );
	} );
	describe( "When executing a stored procedure", function() {
		var procResults;
		before( function() {
			return insertTestRows()
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
						procResults = res;
					}, function( err ) {
						console.log( err );
					} );
				} );
		} );
		after( function() {
			return deleteTestRows();
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
	describe( "When retrieving multiple record sets", function() {
		before( function() {
			return insertTestRows();
		} );
		after( function() {
			return deleteTestRows();
		} );
		describe( "with plain SQL", function() {
			var multipleRSPlainResults;
			before( function( done ) {
				sql.execute( config, {
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
					done();
				}, function( err ) {
					console.log( err );
					done();
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
			before( function( done ) {
				sql.execute( config, {
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
					done();
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
			before( function( done ) {
				sql.execute( config, {
					procedure: "NodeTestMultipleProc",
					params: {
						i1: {
							val: id1,
							type: sql.INT
						}
					}
				} ).then( function( res ) {
					multipleRSProcResults = res;
					done();
				}, function( err ) {
						console.log( err );
						done();
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
} );
