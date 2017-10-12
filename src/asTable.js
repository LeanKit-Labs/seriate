var _ = require( "lodash" );
var sql = require( "mssql" );
var xmldom = require( "xmldom" );
var domImplementation = new xmldom.DOMImplementation();
var xmlSerializer = new xmldom.XMLSerializer();
var buildTableVariableSql = require( "./build-table-variable-sql" );
var xmldom = require( "xmldom" );

function toXml( values, schema ) {
	var doc = domImplementation.createDocument();
	var keys = _.keys( schema );

	var root = values.map( function( obj ) {
		return keys.reduce( function( row, key ) {
			var value = obj[ key ];
			if ( value !== null && value !== undefined ) {
				row.setAttribute( key, _.isDate( value ) ? value.toISOString() : value );
			}
			return row;
		}, doc.createElement( "row" ) );
	} )
	.reduce( function( parent, child ) {
		parent.appendChild( child );
		return parent;
	}, doc.createElement( "result" ) );

	return xmlSerializer.serializeToString( root );
}

module.exports = {
	matchesParam: function( param ) {
		return !!param.asTable;
	},
	createParameter: function( val, key ) {
		if ( val.asTable === true ) {
			val.asTable = {
				value: val.type
			};
			val.val = val.val.map( function( x ) {
				return { value: x };
			} );
		}

		return {
			key: key + "Xml",
			type: sql.NVarChar,
			value: toXml( val.val, val.asTable )
		};
	},
	transformQuery: function( params, query ) {
		return _( params )
		.pairs()
		.filter( function( pair ) {
			return pair[ 1 ].asTable;
		} )
		.map( function( pair ) {
			return buildTableVariableSql( pair[ 0 ], pair[ 1 ].asTable, pair[ 1 ].val.length );
		} )
		.value()
		.join( "\n\n" ) + query;
	}
};
