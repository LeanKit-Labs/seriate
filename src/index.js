var _ = require( "lodash" );
var sql = require( "mssql" );
var Monologue = require( "monologue.js" );
var machina = require( "machina" );
var SqlContext = require( "../src/sqlContext.js" )( sql, Monologue, machina );
var TransactionContext = require( "../src/transactionContext.js" )( sql, SqlContext );
var seriate = require( "../src/main.js" )( SqlContext, TransactionContext );

_.each( sql.TYPES, function( val, key ) {
	seriate[ key ] = sql.TYPES[ key ];
	seriate[ key.toUpperCase() ] = sql.TYPES[ key ];
} );

module.exports = seriate;
