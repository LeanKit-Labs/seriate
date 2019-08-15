var _ = require( "lodash" );

function replaceParamWithList( key, values ) {
	if ( !values || !values.length ) {
		return "(SELECT 1 WHERE 0 = 1)";
	}

	return `(${ values
		.map( function( value, index ) {
			return `@${ key }${ index }`;
		} )
		.join( ", " ) })`;
}

module.exports = {
	matchesParam( param ) {
		return param.asList === true;
	},
	createParameter( val, key ) {
		return ( val.val || [] ).map( function( value, index ) {
			return {
				key: key + index,
				type: val.type,
				value
			};
		} );
	},
	transformQuery( params, query ) {
		return _( params )
			.pairs()
			.filter( function( pair ) {
				return pair[ 1 ].asList;
			} )
			.reduce( function( acc, pair ) {
				const regex = new RegExp( `(\\(\\s*)?@${ pair[ 0 ] }\\b(\\s*\\))?`, "ig" );
				const replacement = replaceParamWithList( pair[ 0 ], pair[ 1 ].val );
				return acc.replace( regex, replacement );
			}, query );
	}
};
