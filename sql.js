var _ = require( 'lodash' ),
	types = require( 'mssql' ).TYPES,
	proxy = {};

_.each( types, function( val, key ) {
	proxy[ key ] = types[ key ];
	proxy[ key.toUpperCase() ] = types[ key ];
} );

module.exports = proxy;