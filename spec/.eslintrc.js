module.exports = {
	extends: "leankit/test",

	rules: {
		strict: "off",
		"new-cap": 0,
		"no-template-curly-in-string": "off",
		"object-shorthand": "off"
	},

	globals: {
		proxyquire: true,
		sinon: true,
		should: true,
		expect: true,
		fakeRecords: true,
		_: true
	}
};
