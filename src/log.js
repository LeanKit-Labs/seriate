var _ = require( "lodash" );
var postal = require( "postal" );
var logFn = require( "whistlepunk" );
var logger = logFn( postal, {} );
var logs = {};
var topics = [];

function configure( config ) {
	var envDebug = !!process.env.DEBUG;
	if ( envDebug ) {
		logger = logFn( postal, { adapters: { debug: { level: 5 } } } );
	} else {
		logger = logFn( postal, config );
	}

	_.each( logs, function( log ) {
		log.reset();
	} );
	logs = {};
	_.each( topics, createLog );
}

function createLog( topic ) {
	if ( !_.contains( topics, topic ) && !logs[ topic ] ) {
		var log = logger( topic );
		if ( logs[ topic ] ) {
			logs[ topic ].reset();
		}
		topics.push( log );
		logs[ topic ] = log;
		return log;
	} else {
		return logs[ topic ];
	}
}

module.exports = function( config, ns ) {
	if ( typeof config === "string" ) {
		ns = config;
	} else {
		configure( config );
	}
	return ns ? createLog( ns ) : createLog;
};
