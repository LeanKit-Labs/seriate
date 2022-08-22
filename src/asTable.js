const _ = require( "lodash" );
const sql = require( "mssql" );
const xmldom = require( "@xmldom/xmldom" );
const domImplementation = new xmldom.DOMImplementation();
const xmlSerializer = new xmldom.XMLSerializer();
const buildTableVariableSql = require( "./build-table-variable-sql" );

function toXml( values, schema ) {
	const doc = domImplementation.createDocument();
	const keys = _.keys( schema );

	const root = values.map( function( obj ) {
		return keys.reduce( function( row, key ) {
			const value = obj[ key ];
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
	matchesParam( param ) {
		return !!param.asTable;
	},
	createParameter( val, key ) {
		if ( val.asTable === true ) {
			val.asTable = {
				value: val.type
			};
			val.val = val.val.map( function( x ) {
				return { value: x };
			} );
		}

		return {
			key: `${ key }Xml`,
			type: sql.NVarChar,
			value: toXml( val.val, val.asTable )
		};
	},
	transformQuery( params, query ) {
		return _( params )
			.toPairs()
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
