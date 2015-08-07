function createAdapter() {
	return {
		durations: [],
		metrics: [],
		convert: undefined,
		onMetric: function( data ) {
			if ( data.type === "time" ) {
				this.durations.push( data );
			} else {
				this.metrics.push( data );
			}
		},
		setConverter: function( convert ) {
			this.convert = convert;
		}
	};
}

module.exports = createAdapter;
