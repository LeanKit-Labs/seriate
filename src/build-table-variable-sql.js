const _ = require( "lodash" );
const declare = require( "mssql/lib/datatypes" ).declare;
const utils = require( "./utils" );

module.exports = function buildTableVariableSql( key, schema, hasData ) {
	return `${ _.template( utils.fromFile( "./sql/buildTableVar.sql.template" ) )( {
		name: key,
		schema: _.mapValues( schema, function( typeDef ) {
			if ( _.isFunction( typeDef ) ) {
				typeDef = typeDef();
			}
			return declare( typeDef.type, typeDef );
		} ),
		hasData
	} ) }\n`;
};
