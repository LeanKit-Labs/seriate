# Seriate
=========

A cross platform node module for Microsoft SQL Server based on [node-mssql](https://www.npmjs.org/package/mssql)

## Connections and Pooling
Each connection configuration provided creates a connection pool for the parameters specified by the configuration. When connecting to a single database, use `setDefault` to specify a global/ambient connection pool and all future API calls made without a connection configuration or name argument will use that connection pool. If connections to multiple databases are required, provide an name in the configuration when calling `addConnection` and use the name in place of that configuration when making an API call targeting that connection.

### Connection Configuration
A connection configuration provides information on how to connect to the datbase server and how to handle connection pooling. Seriate will _not_ create multiple connection pools for the same database; i.e. if different pooling parameters are provided but all other parameters are the same as a previous configuration, Seriate just uses the previously created pool without any changes made.

> Note: the name property is optional and only useful when managing multiple connection pools to different databases.

#### SQL authentication example (default instance)
```javascript
{
	"name": "default",
	"host": "127.0.0.1",
	"user": "nodejs",
	"password": "mypassword",
	"database": "master",
	"pool": {
		"max": 10,
		"min": 4,
		"idleTimeoutMillis": 30000
	}
}
```

#### SQL authentication example (named instance)
```javascript
{
	"name": "default",
	"host": "127.0.0.1",
	"port": "12345", // find the port of your instance in the SQL Server Configuration Manager
	"user": "nodejs",
	"password": "mypassword",
	"database": "master",
	"pool": {
		"max": 10,
		"min": 4,
		"idleTimeoutMillis": 30000
	}
}
```

The port for your named instance can be found in SQL Server Configuration Manager under:
`SQL Server Network Configuration ->
 Protocols for [instance name] ->
 TCP/IP (properties) ->
 IP Addresses tab ->
 IPAll group ->
 TCP Dynamic Ports value`.

Alternatively, you can specify the server as `server: yourServer\\instanceName`, but there are some caveats:

 * The SQL Server Browser service must be running
 * You cannot use `.` as the server name. It must be a name that can be resolved via DNS (ex. `localhost`)
 * There may be local firewall configuration settings that need adjustment

#### Trusted/NTLM authentication example
```javascript
{
	"name": "default",
	"host": "127.0.0.1",
	"user": "windowsUser",
	"password": "windowsUserPassword",
	"database": "master",
	"domain": "yourDomain", // should be machine name if the server is not in an AD domain
	"pool": {
		"max": 10,
		"min": 4,
		"idleTimeoutMillis": 30000
	}
}
```

### Connectivity Events
Seriate emits connectivity events from the top level library:

 * connected
 * closed
 * failed

Each event includes a `name` property that represents which connection the event is happening on. If the event is failed, an `error` property will have the error that caused the failure.

## API

Sql type constants are exposed in both Pascal Case and all capitals off of the library. See the listing at the end of this document.

### Summary
The follow methods are exposed on the module:

|method name         | description              |
|--------------------|--------------------------|
|`addConnection( config )`| Adds a named connection pool for use in other API calls.
|`setDefault( config )` | Sets an ambient/global connection pool for all commands that don't specify a connection.
|`getPlainContext( [connection] )` | returns transaction-less database context.
|`getTransactionContext( [connection] )` | returns a context associating *one* transaction with a connection.
|`executeTransaction( [connection,] queryOptions )` | shortcut method to execute *one* command on a transaction context
|`execute( [connection,] queryOptions )` | shortcut method to execute *one* command on a plain (transaction-less) context.
|`first( [connection,] queryOptions )` | shortcut method that returns only the first row of a result set (calls `execute` under the hood)
|`fromFile( path )` | Allows you to read a `.sql` file instead of in-lining your SQL in your JavaScript.
|`useMetrics( metronic [, namespace ]  )` | Pass metronic instance to `seriate` and optionally set namespace.

> NOTE: The `connection` argument can be omitted to use a default config, an existing configuration name or a new configuration.

### addConnection( config )
Creates a named connection pool for future use. If the name is omitted and no default has been specified, it has the same effect as calling `setDefault`.

### setDefault( config )
Creates a connection pool with the name "default" for future use. If other API calls are made with no `connection` argument, the connection pool created by this call will be used.

### getPlainContext( [connection] )

This method returns a `TransactionContext` instance, and allows you to add 1 or more steps to the context, with each step representing a query/command that should be executed in the database. Steps are given an `alias` (which is used to identify the result set returned), and the query details can be provided as an object (which we"ll see below), or a callback that takes an `execute` continuation (which is used to process your query options argument). Let's take a look at the first approach:

#### Specifying a step using just the query options object argument

Here's an example of using a plain context to read a table:

```javascript
// set a default connection pool
sql.setDefault( {
	user: "username",
	password: "pwd",
	host: "127.0.0.1",
	database: "master"
} );

sql.getPlainContext()
	.step( "readUsers", {
		query: "select * From sys.sysusers"
		// optionally you could do this if the
		// above query were in a readUsers.sql file
		// query: sql.fromFile( "readUsers" );
	} )
	.end( function( sets ){
		// sets has a "readUsers" property
		// which contains the results of the query
	} )
	.error( function( err ){
		console.log( err );
	} );
```

Note that the `SqlContext` instance returns from `getPlainContext` has a `step` method with a signature of `(alias, queryOptions)`. The possible values for a `queryOptions` argument are:

```javascript
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
	},
	multiple: false
}
```

You can only use *one* of the three sql-related fields: `query`, `procedure` or `preparedSql`. The module infers from which one you use as to how it should execute (and it's checked in that order). If you query takes params, you can provide a `params` object, where each key represents a parameter name and the value can be an object that provides the `val` and `type` (types are pulled from the `mssql` module), or the value can be a primitive value which will be passed as the paramter value. If multiple recordsets are expected from a `query` or `preparedSql`, set the `multiple` field to `true`. Multiple recordsets are automatically supported when executing a stored procedure. (NOTE: if you use multiple recordsets, your result set for a step will be an array of records sets (i.e. - nested arrays), rather than an array of a single record set).

The `end` method of a `SqlContext` instance takes a callback which receives a `sets` argument. The `sets` argument contains the dataset(s) from each step (using the step `alias` as the property name). The `error` method allows you to pass a callback that will receive an error notfication if anything fails. Note that calling `end` or `error` is what *starts* the unit of work handled by the context.

#### Specifying a step using a callback that takes an `execute` continuation

Here's an example of using a plain context to read a table, and then use data from that read to determine details about the next step:

```javascript
// add a named connection pool
sql.addConnection( {
	name: "example-1",
	user: "username",
	password: "pwd",
	host: "127.0.0.1",
	database: "master"
} );

sql.getPlainContext( "example-1" )
	.step( "readUsers", {
		query: "select * From sys.sysusers"
	} )
	.step( "usersTransforms", function( execute, data ) {
		// data will contain a `readUsers` property with
		// the prior step's results in an array. You can
		// use this approach with a callback to dynamically
		// determine what's fed to this step's executable
		// action. Let's pretend we fished out a particular
		// user from the readUsers step and then did this:
		var userId = getUserIdFrom( data.readUsers );
		execute( {
			procedure: "GetExtendedUserInfo",
			params: {
				userid: userId
			}
		} )
	} )
	.end( function( sets ) {
		// sets has a "readUsers" property
		// which contains the results of the query
	} )
	.error( function( err ) {
		console.log( err );
	} );
```

The above example shows both `step` approaches side-by-side.

### getTransactionContext( [connection] )
The `getTransactionContext` method returns a `TransactionContext` instance - which for the most part is nearly identical to a `SqlContext` instance - however, a transaction is started as the context begins its work, and you have the option to commit or rollback in the `end` method's callback. For example:

```javascript
// note: name defaults to "default"
// if no prior default connection was
// specified.
sql.addConnection( {
	user: "username",
	password: "pwd",
	host: "127.0.0.1",
	database: "master"
})

sql.getTransactionContext()
	.step( "readUsers", {
		query: "select * From sys.sysusers"
	} )
	.step( "usersTransforms", function( execute, data ) {
		// data will contain a `readUsers` property with
		// the prior step's results in an array. You can
		// use this approach with a callback to dynamically
		// determine what's fed to this step's executable
		// action. Let's pretend we fished out a particular
		// user from the readUsers step and then did this:
		var userId = getUserIdFrom( data.readUsers );
		execute( {
			procedure: "GetExtendedUserInfo",
			params: {
				userid: userId
			}
		} )
	} )
	.end( function( result ) {
		// the result arg contains a `sets` property
		// with all the dataset results from the steps
		// in this context, but it also contains a transaction
		// member that contains a `commit` and `rollback` method.
		// Calling either commit or rollback returns a promise.
		result.transaction
			.commit()
			.then(function() {
				console.log( "Yay, we"re not afraid of commitment..." );
			}, function( err ) {
				console.log( "O NOES! An error" );
			} );
	} )
	.error( function( err ){
		console.log( err );
	} );
```

You can see that the main difference between a `SqlContext` and `TransactionContext` is that the argument passed to the `end` callback contains more than just the `sets` (data sets) in the `TransactionContext`. A `TransactionContext` does not automatically call `commit` for you - that's in your hands (for now). However, if an error occurs, it will call `rollback`.

### executeTransaction( [connection,] queryOptions )
This is a shortcut method to getting a `TransactionContext` instance to execute one step. It returns a promise, and the `result` argument that's normally fed to the `end` method's callback is passed to the success handler of the promise, and any errors are passed to the error handler. For example:

```javascript
// re-use of this variable to API calls
// will result in the same underlying pool
// being used.
var connection = {
	user: "username",
	password: "pwd",
	host: "127.0.0.1",
	database: "master"
};

sql.executeTransaction( connection, {
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
	} ).then( function( data ) {
		// you can choose to commit or rollback here
		// data.result is your result set
		// data also contains a transaction prop
		// with commit/rollback methods
		return data.transaction
			.commit()
			.then( function() {
				console.log( "Updated customer balance...." );
			} );
	}, function( err ) {
		console.log( err );
	} );
```


### execute( [connection,] queryOptions )
This is a shortcut method to getting a `SqlContext` instance to execute one step. It returns a promise, and the query result is passed to the success handler of the promise, and any errors are passed to the error handler. For example:

```javascript
// re-use of this variable to API calls
// will result in the same underlying pool
// being used.
var connection = {
	user: "username",
	password: "pwd",
	host: "127.0.0.1",
	database: "master"
};

sql.execute( connection, {
		name: "selectFromSomeTableById",
		preparedSql: "select * from someTable where id = @id",
		params: {
			id: {
				val: 123,
				type: sql.INT
			}
		}
	} ).then( function( data ) {
		//data is the query result set
	}, function( err ) {
		console.log( err );
	} );
```

### useMetrics( metrics [, namespace ] )
Seriate will record metrics around each database call but only if a metronic instance is provided via this call. The optional namespace argument allows you to control the namespace used for all metrics captured.

> Note: when calling `execute`, `executeTransaction` or `first`, provide a step name via a `name` property in the options.

## So How Does This Work?
Read this far, eh? Great - now we can talk about how it works under the hood.

### Contexts as Acceptor-style FSMs
The `SqlContext` constructor function is derived from `machina.Fsm` (the constructor function used to create a finite state machine in the [`machina`](https://github.com/ifandelse/machina.js) library). `SqlContext` starts with only the following states: `uninitialized`, `connecting`, `done` and `error`. The FSM loosely acts as an acceptor-style FSM - with each step resulting in either a success or error result, determining if it continues on to the eventual `done` state, or lands in `error`.

### Adding Steps -> Adding States to the FSM
When you use the `step` call to add a step to the context, the `alias` you provide becomes a new state name which is added to the underlying FSM, and the action you specify via the `queryOptions` argument (or the alternative syntax using the callback that takes the `execute` continuation), becomes the entry action for this new state. Success and error input handlers are also added to this state, and are triggered based on the results of the call to the database that occurs in the entry action. The new state names you add are queued up in a `pipeline` array, so that the order in which you added them can be maintained once the FSM begins executing.

### Starting Execution
Once you"ve added the steps you want executed as part of the unit of work, you have to use the `end` or `error` calls to start execution. Under the hood, calling either `end` or `error` results in the FSM being told to handle a `start` input. Let's pretend you have a `SqlContext`, and you"ve added two steps to it: `readCustomer` and `updateContact`. The FSM starts in the uninitialized state, and once it receives the `start` input, proceeds to the `connecting` state where it opens a connection to the database. Assuming a successful connection, it then proceeds to the `readUsers` state added by our first step. Again, assuming success, the next state would be `updateContact`, and finally the `done` state. As the FSM enters the `done` state, it emits the result to the callback passed to `end`. If any state encounters an error along the way, it transitions to the `error` state. Upon entering the `error` state, the FSM emits the error to the callback passed to `error`. Here's a directed graph showing the scenario I just described (the states that are always part of the FSM are in blue, and the ones added by the :

![](SqlContextFSM.png)

### TransactionContext Flow
The `TransactionContext` is mostly identical to the SqlContext, except that it has an extra state after `connecting` - the `startingTransaction` state. Here's the same scenario we described above in a `TransactionContext`:

![](TransactionContextFSM.png)

## Getting Set Up/Testing/etc.

* You"ll need to run `npm install` at the root of this project once you clone it to install the dependencies.
* To run unit tests: `npm test`
* To run integration tests: `npm run intspec`
* To run the example module: `npm run example`

*Please* note that in order to run the integration tests, you will need to create a `local-config.json` file in the `spec/integration` directory, matching something similar to this:

```javascript
{
	"host": "10.0.1.16",
	"user": "username",
	"password": "pwd",
	"database": "master",
	"pool": {
		"max": 10,
		"min": 2,
		"idleTimeoutMillis": 30000
	}
}
```

## Sql Constants
Pascal and Upper case properties:
```javascript
VarChar 				VARCHAR
NVarChar 				NVARCHAR
Text 					TEXT
Int 					INT
BigInt 					BIGINT
TinyInt					TINYINT
SmallInt 				SMALLINT
Bit 					BIT
Float 					FLOAT
Numeric 				NUMERIC
Decimal 				DECIMAL
Real 					REAL
Date 					DATE
DateTime 				DATETIME
DateTime2 				DATETIME2
DateTimeOffset 			DATETIMEOFFSET
SmallDateTime 			SMALLDATETIME
Time 					TIME
UniqueIdentifier 		UNIQUEIDENTIFIER
SmallMoney 				SMALLMONEY
Money 					MONEY
Binary 					BINARY
VarBinary				VARBINARY
Image					IMAGE
Xml 					XML
Char 					CHAR
NChar 					NCHAR
NText					NTEXT
						TVP
						UDT
Geography				GEOGRAPHY
Geometry				GEOMETRY
```
