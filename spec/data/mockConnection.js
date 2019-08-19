function mockConnectionFn( valid, rejection ) {
	const connection = {
		handles: {},
		connect: function() {
			if ( valid ) {
				this.raise( "connect" );
				return Promise.resolve();
			}
			const error = new Error( rejection );
			this.raise( "error", error );
			return Promise.reject( error );
		},
		raise: function( event, args ) {
			this.handles[ event ].apply( undefined, args );
		},
		on: function( event, handle ) {
			this.handles[ event ] = handle;
		},
		removeAllListeners: function() {
			this.handles = {};
		}
	};
	return connection;
}

module.exports = mockConnectionFn;
