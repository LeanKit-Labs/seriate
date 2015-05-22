var records = require( "./fakeRecordSet.json" );

describe( "Seriate Unit Tests", function() {
	describe( "when using not providing a DB configuration argument", function() {
		var seriate, stubConfig, fakeQueryOptions, fakeContext;
		beforeEach( function() {
			stubConfig = { msg: "booyah!" };
			fakeQueryOptions = { msg: "you didn't say the magic word..." };
			fakeContext = {
				step: sinon.stub().returnsThis(),
				end: sinon.stub().returnsThis(),
				error: sinon.stub().returnsThis(),
				on: sinon.stub()
			};
			seriate = seriateFactory();
			seriate.TransactionContext = sinon.stub().returns( fakeContext );
			seriate.SqlContext = sinon.stub().returns( fakeContext );
			seriate.setDefaultConfig( stubConfig );
		} );
		it( "should use default config when calling getTransactionContext", function() {
			seriate.getTransactionContext();
			seriate.TransactionContext.calledWith( { connectionCfg: stubConfig } );
		} );
		it( "should use default config when calling getPlainContext", function() {
			seriate.getPlainContext();
			seriate.SqlContext.calledWith( { connectionCfg: stubConfig } );
		} );
		it( "should use default config when calling execute", function() {
			seriate.execute( fakeQueryOptions );
			fakeContext.step.calledWith( "__result__", fakeQueryOptions );
			seriate.SqlContext.calledWith( { connectionCfg: stubConfig } );
		} );
		it( "should use default config when calling executeTransaction", function() {
			seriate.executeTransaction( fakeQueryOptions );
			fakeContext.step.calledWith( "__result__", fakeQueryOptions );
			seriate.TransactionContext.calledWith( { connectionCfg: stubConfig } );
		} );
		it( "should use default config when calling first", function() {
			seriate.first( fakeQueryOptions );
			fakeContext.step.calledWith( "__result__", fakeQueryOptions );
			seriate.SqlContext.calledWith( { connectionCfg: stubConfig } );
		} );
	} );
} );
