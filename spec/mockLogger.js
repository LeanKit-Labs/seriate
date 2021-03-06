const namespaces = {};
const adapter = {
	namespaces: namespaces,
	init: function( ns ) {
		if ( !namespaces[ ns ] ) {
			namespaces[ ns ] = { entries: [] };
		}
		namespaces[ ns ].entries = {
			info: [],
			debug: [],
			warn: [],
			error: []
		};
		return namespaces[ ns ];
	},
	reset: function( ns ) {
		this.init( ns );
	},
	onLog: function( data ) {
		let ns = namespaces[ data.namespace ];
		if ( !ns ) {
			ns = this.init( data.namespace );
		}
		ns.entries[ data.type ].push( data.msg );
	}
};

_.bindAll( adapter );

module.exports = function mockLogAdapter( config ) {
	if ( _.isObject( config ) ) {
		return adapter;
	} else if ( config ) {
		const ns = _.isArray( config ) ? config : [ config ];
		ns.forEach( adapter.init.bind( adapter ) );
		return adapter;
	}
	return namespaces;
};
