#ms-squeal
=========

A cross platform node module for Microsoft SQL Server based on [node-mssql](https://www.npmjs.org/package/mssql)

##API

The follow methods are exposed on the module:

|method name         | description              |
|--------------------|--------------------------|
|`getTransactionContext(connectionConfig)` | returns a context associating *one* transaction with a connection.
|`getPlainContext(connectionConfig)` | returns transaction-less database context.
|`executeTransaction(connectionConfig, queryOptions)` | shortcut method to execute *one* command on a transaction context
|`execute(connectionConfig, queryOptions)` | shortcut method to execute *one* command on a plain (transaction-less) context.

###getTransactionContext(connectionConfig)

An example `connectionConfig` argument looks like this:

	{
		"server": "127.0.0.1",
		"user": "nodejs",
		"password": "mypassword",
		"database": "master",
		"pool": {
			"max": 10,
			"min": 4,
			"idleTimeoutMillis": 30000
		}
	}

This method returns a `TransactionContext` instance, and allows you to add 1 or more steps to the context, with each step representing a query/command that should executed in the database.


