var sql = require( 'mssql' );
var Monologue = require( 'monologue.js' );
var machina = require( 'machina' )();
var SqlContext = require( '../src/sqlContext.js' )( sql, Monologue, machina );
var TransactionContext = require( '../src/transactionContext.js' )( sql, SqlContext );
var seriate = require( '../src/main.js' )( SqlContext, TransactionContext );

module.exports = seriate;