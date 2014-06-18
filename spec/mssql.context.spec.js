var config = require('configya')('local-config.json');
var nodemssql = require('mssql');
var sqlContext = require('../src/mssql-context.js')(config);
require('should');
var _ = require('lodash');

var uniqueRowId = 0;

var getTwoParmVals = function(i1Val, v1Val) {
	return [{
		v1: {
			sqlType: nodemssql.NVarChar,
			value: v1Val
		}
	}, {
		i1: {
			sqlType: nodemssql.Int,
			value: i1Val
		}
	}];
};

before(function(done) {
	//create SQL entities for the test methods to use
	var beforeContext = sqlContext.getNewExecutionContext(function(err) {
		console.log('issuing set single user');
		beforeContext.execQuery("if db_id('tds_node_test') is not null ALTER DATABASE [tds_node_test] SET SINGLE_USER WITH ROLLBACK IMMEDIATE",
			function(err, records) {
				console.log('issuing drop database');
				beforeContext.execQuery("if db_id('tds_node_test') is not null drop database tds_node_test",
					function(err, records) {
						if (err) throw err;
						console.log('issuing create database');
						beforeContext.execQuery("create database tds_node_test",
							function(err, records) {
								if (err) throw err;
								console.log('issuing create table');
								beforeContext.execQuery("create table tds_node_test..NodeTestTable (bi1 bigint not null identity(1,1) primary key, v1 varchar(255), i1 int null)",
									function(err, rowCount) {
										if (err) throw err;
										beforeContext.execQuery("create table tds_node_test..NodeTestTableNoIdent (bi1 bigint not null primary key, v1 varchar(255), i1 int null)",
											function(err, rowCount) {
												done();
											});
									});
							});
					});
			});
	});
});

describe('SQL transaction ops', function() {
	it('should rollback a transaction', function() {
		var rowId = ++uniqueRowId;
		var inssql = "insert into tds_node_test..NodeTestTable (v1, i1) values (@v1, @i1)";
		var selsql = "select * from tds_node_test..NodeTestTable where i1 = @i1";

		var ctxTrans = sqlContext.getNewExecutionContext(function(err) {
			(err === null).should.be.true;
			var ctxNoTrans = sqlContext.getNewExecutionContext(function(err) {
				ctxTrans.startTransaction(function(err) {
					(err === null).should.be.true;
					ctxTrans.execPrepared(inssql, function(err, records) {
						(err === null).should.be.true;
						ctxTrans.rollback(function(err) {
							(err === null).should.be.true;
							ctxTrans.execPrepared(selsql, function(err, records) {
								if (err) console.log(err);
								(err === null).should.be.true;

								//verify that no rows were returned
								records.length.should.equal(0);
							}, [{
								i1: {
									sqlType: nodemssql.Int,
									value: rowId
								}
							}]);
						});
					}, getTwoParmVals(rowId, 'fuuuu'));
				});
			});
		});
	});

	it('should participate in a transaction', function() {
		var rowId = ++uniqueRowId;
		var inssql = "insert into tds_node_test..NodeTestTable (v1, i1) values (@v1, @i1)";
		var selsql = "select * from tds_node_test..NodeTestTable with (readpast) where i1 = @i1";

		var ctxTrans = sqlContext.getNewExecutionContext(function(err) {
			(err === null).should.be.true;
			var ctxNoTrans = sqlContext.getNewExecutionContext(function(err) {

				//start a trasaction in one context and insert a row
				ctxTrans.startTransaction(function(err) {
					(err === null).should.be.true;
					ctxTrans.execPrepared(inssql, function(err, records) {
						(err === null).should.be.true;

						//attempt to read the row in a 2nd context
						ctxNoTrans.execPrepared(selsql, function(err, records) {
							if (err) console.log(err);
							(err === null).should.be.true;

							//verify that no rows were returned
							records.length.should.equal(0);

							//commit the transaction and re-attempt the read
							ctxTrans.commit(function(err) {
								(err === null).should.be.true;
								ctxNoTrans.execPrepared(selsql, function(err, records) {
									(err === null).should.be.true;

									//verify that the new row is returned
									records.length.should.equal(1);
								}, [{
									i1: {
										sqlType: nodemssql.Int,
										value: rowId
									}
								}]);
							});
						}, [{
							i1: {
								sqlType: nodemssql.Int,
								value: rowId
							}
						}]);
					}, getTwoParmVals(rowId, 'fuuuu'));
				});
			});
		});
	});
});

describe('SQL DML ops', function() {
	it('should retrieve the identity key of an inserted row', function() {
		var rowId = ++uniqueRowId;
		var sql = "insert into tds_node_test..NodeTestTable (v1, i1) values (@v1, @i1)";
		var context = sqlContext.getNewExecutionContext(function(err) {
			context.execPrepared(sql, function(err, records) {
				if (err) console.log('sql error', err);
				(err === null).should.be.true;
				records[0].should.be.ok;
				var identity = records[0][''];
				identity.should.be.above(0);
			}, getTwoParmVals(rowId, 'fuuuu'));
		});

	});

	it('should update a row', function() {

		//insert a test row, update it and select to verify

		var rowId = ++uniqueRowId;
		var sql = "insert into tds_node_test..NodeTestTable (v1, i1) values (@v1, @i1)";
		var context = sqlContext.getNewExecutionContext(function(err) {
			context.execPrepared(sql, function(err, records) {
				if (err) console.log('sql error', err);
				(err === null).should.be.true;

				var updSql = 'update tds_node_test..NodeTestTable set v1 = @v1 where i1 = @i1';
				context.execPrepared(updSql, function(err, records) {
					(err === null).should.be.true;
					//select row and verify
					var selSql = 'select * from tds_node_test..NodeTestTable where i1 = @i1';
					context.execPrepared(selSql, function(err, records) {
						(err === null).should.be.true;
						records.length.should.equal(1);
						records[0].v1.should.equal('blah blah');
						records[0].i1.should.equal(rowId);
					}, [{
						i1: {
							sqlType: nodemssql.Int,
							value: rowId
						}
					}]);
				}, getTwoParmVals(rowId, 'blah blah'));
			}, getTwoParmVals(rowId, 'fuuuu'));
		});
	});

	it('should insert a row', function() {

		//insert a test row and select to verify

		var rowId = ++uniqueRowId;
		var sql = "insert into tds_node_test..NodeTestTableNoIdent (bi1, v1, i1) values (55, @v1, @i1)";
		var context = sqlContext.getNewExecutionContext(function(err) {
			context.execPrepared(sql, function(err, records) {
				if (err) console.log('sql error', err);
				(err === null).should.be.true;

				//select row and verify
				var selSql = 'select * from tds_node_test..NodeTestTableNoIdent where i1 = @i1';
				context.execPrepared(selSql, function(err, records) {
					(err === null).should.be.true;
					records.length.should.equal(1);
					records[0].v1.should.equal('fuuuu');
					records[0].i1.should.equal(rowId);
				}, [{
					i1: {
						sqlType: nodemssql.Int,
						value: rowId
					}
				}]);

			}, getTwoParmVals(rowId, 'fuuuu'));
		});
	});
});

describe('prepared statement ops', function() {
	it('should execute prepared with single param', function() {
		var sql = "select * from sys.tables where type_desc = @usertable";
		var context = sqlContext.getNewExecutionContext(function(err) {
			context.execPrepared(sql, function(err, records) {
				if (err) console.log('sql error', err);
				(err === null).should.be.true;
				records.length.should.be.above(0);
				_.forEach(records, function(record) {
					record.object_id.should.be.above(0);
				});
			}, [{
				usertable: {
					sqlType: nodemssql.NVarChar,
					value: 'USER_TABLE'
				}
			}]);
		});
	});

	it('should execute prepared with multiple params', function() {
		var sql = "select * from sys.tables where type_desc = @usertable and is_ms_shipped = @mss";
		var context = sqlContext.getNewExecutionContext(function(err) {
			context.execPrepared(sql, function(err, records) {
				if (err) console.log('sql error', err);
				(err === null).should.be.true;
				records.length.should.be.above(0);
				_.forEach(records, function(record) {
					record.object_id.should.be.above(0);
				});
			}, [{
				usertable: {
					sqlType: nodemssql.NVarChar,
					value: 'USER_TABLE'
				}
			}, {
				mss: {
					sqlType: nodemssql.Bit,
					value: true
				}
			}]);
		});
	});
});

describe('basic db select ops', function() {

	it('should exec no param query', function() {
		var sql = "select 40 + 2 as answer, 'hello world' as greeting";
		var context = sqlContext.getNewExecutionContext(function(err) {
			context.execQuery(sql, function(err, records) {
				if (err) console.log('sql error', err);
				(err === null).should.be.true;
				records.length.should.be.equal(1);
				records[0].answer.should.equal(42);
				records[0].greeting.should.equal('hello world');
			});
		});
	});

	it('should exec query with one param', function() {
		var sql = "select * from sys.tables where type_desc = @usertable";
		var context = sqlContext.getNewExecutionContext(function(err) {
			context.execQuery(sql, function(err, records) {
				if (err) console.log('sql error', err);
				(err === null).should.be.true;
				records.length.should.be.above(0);
				_.forEach(records, function(record) {
					record.object_id.should.be.above(0);
				});
			}, [{
				usertable: {
					sqlType: nodemssql.NVarChar,
					value: 'USER_TABLE'
				}
			}]);
		});
	});

	it('should exec query with multiple params', function() {
		var sql = "select * from sys.tables where type_desc = @usertable and is_ms_shipped = @mss";
		var context = sqlContext.getNewExecutionContext(function(err) {
			context.execQuery(sql, function(err, records) {
				if (err) console.log('sql error', err);
				(err === null).should.be.true;
				records.length.should.be.above(0);
				_.forEach(records, function(record) {
					record.object_id.should.be.above(0);
				});
			}, [{
				usertable: {
					value: 'USER_TABLE'
				}
			}, {
				mss: {
					sqlType: nodemssql.Bit,
					value: true
				}
			}]);
		});
	});

});