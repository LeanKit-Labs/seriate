var nodemssql = require('mssql');
var _ = require('lodash');


var config;

var getConfig = function() {
	return {
		user: config.get('tdsUserName', 'kanban_user'),
		password: config.get('tdsPassword', 'wrathofkhanban.com'),
		server: config.get('tdsServer', 'localhost'),
		database: config.get('tdsDatabase', 'master'),
		pool: {
			max: 20,
			min: 0,
			idleTimeoutMillis: 30000
		}
	};
};

var getConnection = function(done) {
	var connection = new nodemssql.Connection(getConfig(), function(err) {
		done(err);
	});
	return connection;
};

var addRequestParams = function(request, params) {
	_.forEach(params, function(paramObj) {
		var param = _.map(paramObj, function(v, k) {
			return k;
		});
		if (paramObj[param[0]].sqlType) {
			request.input(param[0], paramObj[param[0]].sqlType, paramObj[param[0]].value);
		} else {
			request.input(param[0], paramObj[param[0]].value);
		}
	});
};

var addPsInputs = function(request, params) {
	var paramValues = {};
	_.forEach(params, function(paramObj) {
		var param = _.map(paramObj, function(v, k) {
			return k;
		});
		if (paramObj[param[0]].sqlType) {
			request.input(param[0], paramObj[param[0]].sqlType);
		} else {
			request.input(param[0]);
		}
		paramValues[param[0]] = paramObj[param[0]].value;
	});
	return paramValues;
};



var SqlContext = function(done) {
	this.connection = getConnection(done);
};

SqlContext.prototype.close = function() {
	if (this.connection) {
		this.connection.close();
		this.connection = null;
	}
};

SqlContext.prototype.startTransaction = function(done) {
	if (this.connection) {
		this.transaction = new nodemssql.Transaction(this.connection);
		this.transaction.begin(done);
	}
};

SqlContext.prototype.commit = function(done) {
	if (this.transaction) {
		this.transaction.commit(done);
		this.transaction = null;
	}
}

SqlContext.prototype.rollback = function(done) {
	if (this.transaction) {
		this.transaction.rollback(done);
		this.transaction = null;
	}
}

SqlContext.prototype.execPrepared = function(sql, done, params) {
	var ps;
	if (this.transaction) {
		ps = new nodemssql.PreparedStatement(this.transaction);
	} else {
		ps = new nodemssql.PreparedStatement(this.connection);
	}

	var idSql = sql + '; select SCOPE_IDENTITY();';

	var paramVals = addPsInputs(ps, params);
	ps.prepare(idSql, function(err) {
		if (err) {
			done(err);
		} else {
			ps.execute(paramVals, function(err, recordset) {
				if (err) {
					done(err);
				} else {
					ps.unprepare(function(err) {
						done(err, recordset);
					});
				}
			});
		}
	});

};

SqlContext.prototype.execQuery = function(sql, done, params) {
	var request;
	if (this.transaction) {
		request = new nodemssql.Request(this.transaction);
	} else {
		request = new nodemssql.Request(this.connection);
	}
	var idSql = sql + '; select SCOPE_IDENTITY();';
	if (params) {
		addRequestParams(request, params);
	}
	request.query(idSql, function(err, recordset) {
		if (err) {
			if (done) done(err);
		} else {
			if (done) {
				done(null, recordset);
			}
		}
	});

};

module.exports = function(moduleConfig) {
	config = moduleConfig;
	var allCtx = [];
	return {
		getNewExecutionContext: function(done) {
			var newctx = new SqlContext(done);
			allCtx.push(newctx);
			return newctx;
		},
		shutdown: function() {
			_.forEach(allCtx, function(ctx) {
				ctx.close();
			})
		}
	}

}