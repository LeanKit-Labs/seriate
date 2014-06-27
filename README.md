#ms-squeal
=========

A cross platform node module for Microsoft SQL Server based on [node-mssql](https://www.npmjs.org/package/mssql)

##API

The follow methods are exposed on the module:

|method name         | description              |
|--------------------|--------------------------|
|`getPlainContext(connectionConfig)` | returns transaction-less database context.
|`getTransactionContext(connectionConfig)` | returns a context associating *one* transaction with a connection.
|`executeTransaction(connectionConfig, queryOptions)` | shortcut method to execute *one* command on a transaction context
|`execute(connectionConfig, queryOptions)` | shortcut method to execute *one* command on a plain (transaction-less) context.

###getPlainContext(connectionConfig)

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

This method returns a `TransactionContext` instance, and allows you to add 1 or more steps to the context, with each step representing a query/command that should be executed in the database. Steps are given an `alias` (which is used to identify the result set returned), and the query details can be provided as an object (which we'll see below), or a callback that takes an `execute` continuation (which is used to process your query options argument). Let's take a look at the first approach:

####Specifying a step using just the query options object argument

Here's an example of using a plain context to read a table:

	squeal.getPlainContext( {
		user: 'username',
		password: 'pwd',
		server: '127.0.0.1',
		database: 'master'
	})
	.step( 'readUsers', {
		query: 'select * From sys.sysusers'
	})
	.end(function(sets){
		// sets has a "readUsers" property
		// which contains the results of the query
	})
	.error(function(err){
		console.log(err);
	});

Note that the `SqlContext` instance returns from `getPlainContext` has a `step` method with a signature of `(alias, queryOptions)`. The possible values for a `queryOptions` argument are:

	{
		query: "plain sql query here",
		procedure: "stored procedure name to execute",
		preparedSql: "prepared SQL statement",
		params: {
			param1Name: {
				type: sql.NVARCHAR,
				val: "paramValue"
			},
			param2Name: {
				type: sql.Int,
				val: 123
			},
			param3Name: "param3Value"
		}
	}

You can only use *one* of the three sql-related fields: `query`, `procedure` or `preparedSql`. The module infers from which one you use as to how it should execute (and it's checked in that order). If you query takes params, you can provide a `params` object, where each key represents a parameter name and the value can be an object that provides the `val` and `type` (types are pulled from the `mssql` module), or the value can be a primitive value which will be passed as the paramter value.

The `end` method of a `SqlContext` instance takes a callback which receives a `sets` argument. The `sets` argument contains the dataset(s) from each step (using the step `alias` as the property name). The `error` method allows you to pass a callback that will receive an error notfication if anything fails. Note that calling `end` or `error` is what *starts* the unit of work handled by the context.

####Specifying a step using a callback that takes an `execute` continuation

Here's an example of using a plain context to read a table, and then use data from that read to determine details about the next step:

	squeal.getPlainContext( {
		user: 'username',
		password: 'pwd',
		server: '127.0.0.1',
		database: 'master'
	})
	.step( 'readUsers', {
		query: 'select * From sys.sysusers'
	})
	.step( 'usersTransforms', function(execute, data) {
		// data will contain a `readUsers` property with
		// the prior step's results in an array. You can
		// use this approach with a callback to dynamically
		// determine what's fed to this step's executable
		// action. Let's pretend we fished out a particular
		// user from the readUsers step and then did this:
		var userId = getUserIdFrom(data.readUsers);
		execute({
			procedure: "GetExtendedUserInfo",
			params: {
				userid: userId
			}
		})
	})
	.end(function(sets){
		// sets has a "readUsers" property
		// which contains the results of the query
	})
	.error(function(err){
		console.log(err);
	});

The above example shows both `step` approaches side-by-side.

###getTransactionContext(connectionConfig)
The `getTransactionContext` method returns a `TransactionContext` instance - which for the most part is nearly identical to a `SqlContext` instance - however, a transaction is started as the context begins its work, and you have the option to commit or rollback in the `end` method's callback. For example:

	squeal.getTransactionContext( {
		user: 'username',
		password: 'pwd',
		server: '127.0.0.1',
		database: 'master'
	})
	.step( 'readUsers', {
		query: 'select * From sys.sysusers'
	})
	.step( 'usersTransforms', function(execute, data) {
		// data will contain a `readUsers` property with
		// the prior step's results in an array. You can
		// use this approach with a callback to dynamically
		// determine what's fed to this step's executable
		// action. Let's pretend we fished out a particular
		// user from the readUsers step and then did this:
		var userId = getUserIdFrom(data.readUsers);
		execute({
			procedure: "GetExtendedUserInfo",
			params: {
				userid: userId
			}
		})
	})
	.end(function(result){
		// the result arg contains a `sets` property
		// with all the dataset results from the steps
		// in this context, but it also contains a transaction
		// member that contains a `commit` and `rollback` method.
		// Calling either commit or rollback returns a promise
		// and will also cause the underlying connection to be
		// closed for you afterwards.
		result.transaction
			.commit()
			.then(function() {
				console.log("Yay, we're not afraid of commitment...");
			}, function(err){
				console.log("O NOES! An error");
			});
	})
	.error(function(err){
		console.log(err);
	});

You can see that the main difference between a `SqlContext` and `TransactionContext` is that the argument passed to the `end` callback contains more than just the `sets` (data sets) in the `TransactionContext`. A `TransactionContext` does not automatically call `commit` for you - that's in your hands (for now). However, if an error occurs, it will call `rollback` and then close the connection.

###executeTransaction(connectionConfig, queryOptions)
This is a shortcut method to getting a `TransactionContext` instance to execute one step. It returns a promise, and the `result` argument that's normally fed to the `end` method's callback is passed to the success handler of the promise, and any errors are passed to the error handler. For example:

	squeal.executeTransaction( config, {
		procedure: "UpdateCustomer",
		params: {
			customerid: {
				val: id,
				type: sql.INT
			},
			balance: {
				val: 45334,
				type: sql.MONEY
			}
		}
	} ).then( function( res ) {
		// you can choose to commit or rollback here
		// result sets would be under res.sets
		return res.transaction
			.commit()
			.then(function(){
				console.log("Updated customer balance....")
			});
	}, function( err ) {
		console.log( err );
	} );



###execute(connectionConfig, queryOptions)
This is a shortcut method to getting a `SqlContext` instance to execute one step. It returns a promise, and the `result` argument that's normally fed to the `end` method's callback is passed to the success handler of the promise, and any errors are passed to the error handler. For example:

	squeal.execute( config, {
		preparedSql: "select * from someTable where id = @id",
		params: {
			id: {
				val: 123,
				type: sql.INT
			}
		}
	} ).then( function( data ) {
		//result sets are directly under data here
	}, function( err ) {
		console.log( err );
	} );

##Getting Setup/Testing/etc.

* You'll need to run `npm install` at the root of this project once you clone it to install the dependencies.
* To run unit tests: `npm test`
* To run integration tests: `npm run intspec`
* To run the example module: `npm run example`

*Please* note that in order to run the integration tests, you will need to create a `local-config.json` file in the `spec/integration` directory, matching something similar to this:

	{
		"server": "10.0.1.16",
		"user": "username",
		"password": "pwd",
		"database": "master",
		"pool": {
			"max": 10,
			"min": 2,
			"idleTimeoutMillis": 30000
		}
	}


