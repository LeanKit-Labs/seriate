var when = require( "when" );

function mockConnectionFn( valid, rejection ) {
	var connection = {
		handles: {},
		connect: function() {
			if ( valid ) {
				this.raise( "connect" );
				return when.resolve();
			} else {
				var error = new Error( rejection );
				this.raise( "error", error );
				return when.reject( error );
			}
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
