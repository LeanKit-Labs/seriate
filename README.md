ms-squeal
=========

A cross platform node module for Microsoft SQL Server based on node-mssql

## Quick Start

 * Create a JSON configuration file for connection parameters
 * Require the configya module and pass it the connection configuration file

Example configuration file
```js
{"tdsServer": "localhost", "tdsUserName": "sqluser", "tdsPassword": "sqlpass"}
```

Example usage
```js
var sql = require( 'ms-squeal' );
```