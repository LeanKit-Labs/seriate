ms-squeal
=========

A cross platform node module for Microsoft SQL Server based on [node-mssql](https://www.npmjs.org/package/mssql)

## Quick Start

 * Create a JSON configuration object for connection parameters
 * Call getNewConnectionContext passing in the configuration object to get a SQL connection context
 * Call methods on the connection context to execute SQL

Example code
```js
var sql = require( 'ms-squeal' );
var config = {server: 'localhost', user: 'sqlUser', password: 'sqlPass', database: 'master'};
var sqlConn = sql.getNewConnectionContext(config, function(err) {
	sqlConn.execQuery("select * from sys.tables", function(err, records) {
		//records contains entire result set in an array of objects with
		//key values that match the selected column names
		console.log(records[0].object_id);
	});
});
```

## Documentation

See the specification tests for detailed examples of method use.

### Module API

 * getNewConnectionContext(connectionConfig, doneCallback) - returns an object that wraps a SQL connection along with some state information. The connectionConfig object is passed directly to node-mssql, so refer to their [documentation](https://github.com/patriksimek/node-mssql#cfg-basic) to see all the options. doneCallback if fired once the connection is established, and accepts a single parameter with error information.

 * shutdown() - Closes the SQL connection for any open connection objects allocated from getNewConnectionContext calls.

### Connection Context API

  * execQuery(sqlString, doneCallback, parameters) - Executes the passed SQL string. doneCallback will fire on statement completion and accepts an error parameter and the result set from the SQL statement, if any. The parameters argument is optional and only used if the sqlString value contains named "@" parameters. See [below](#paramFormat) for the format used to specify parameter values.

  * execPrepared(sqlString, doneCallback, parameters) - Executes the SQL string as a prepared statement. Parameters are the same as for execQuery.

  * close() - Closes the SQL connection

  * startTransaction(doneCallback) - Starts a SQL transaction. All subsequent SQL operations on the context will participate in the transaction until commit or rollback is called. doneCallback is fired on completion, and accepts a single parameter with error information.

  * commit(doneCallback) - Commits a transaction in progress. doneCallback is fired on completion, and accepts a single parameter with error information.

  * rollback(doneCallback) - Executes a rollback on the transaction in progress. doneCallback is fired on completion, and accepts a single parameter with error information.


 ### <a name="paramFormat"></a>Parameter formats
  Parameters are passed to queries as an array JSON objects. Each object's key is the parameter name that should match an @ variable name in the SQL string. Each value is a sub-object with keys "sqlType" and "value". subType should be one of the supported node-mssql [types](https://github.com/patriksimek/node-mssql#data-types). Currently, the node-mssql module must be reqired to access the variables that represent different data types. This may be fixed in future releases.