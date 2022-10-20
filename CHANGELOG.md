## 5.x

### 5.0.0

* Update xmldom
* Update dev deps
* Bump to latest node LTS

## 4.x

### 4.0.2

* Update @xmldom/xmldom to 0.8.2

### 4.0.1

* Update dependency xmldom

### 4.0.0

* Updated node version and outdated packages

## 3.x

### 3.0.0

* Add missing tedious dependency
* fix eslint error
* Consolidate test setup
* Removed var variable declarations
* Update to use native promises
* Remove unused vars
* Removed dev dep on metronic
* Replaced monologue.js with EventEmitter
* Updated machina and removed postal
* Updated lodash
* Removed whistlepunk
* Replaced jshint with eslint + nyc for coverage. Goodbye gulp.
* removed unused dependencies

## 2.x

### 2.0.0

* Added execute call stack to error

## 1.x

### 1.0.0

* Update README with atTransactionStart and atTransactionEnd details
* Added tests for start/end hooks
* Added tests for connection module, fixed linting errors and committed package lock
* Added hooks for running code at the start and/or end of a transaction

## 0.7.*

### 0.13.1

* Added ability to bulk load multiple tables in a step

### 0.13.0

* Added integration tests for Tedious patch; Moved patch to a separate file; Prevented patch from being applied twice

### 0.12.0

* Returned a promise from a test that showed errors from a timing issue
* Added behavior tests for Tedious patch
* Added a sad panda monkey patch to reset connections

### 0.11.0

* Added asList parameter option

### 0.10.0

* Add useExisting option
* Add tests for connection reuse
* Add bulkLoadTable option

### 0.9.1

* Only create xml when data is present

### 0.9.0

* Added stream option

### 0.8.1

* Fixed bug in asTable with reserved word properties

### 0.8.0

* Added support for dates and reserved word property names in asTable.

### 0.7.3

* Made asTable handle unicode.
* Set a publish config to ensure publishing to public npm

### 0.7.2

* Fixed problem handling null and undefined values in asTable parameters.

### 0.7.1

* Expose MAX from mssql for use in specifying length in data types.

### 0.7.0

* Now returning execute promise so we can manipulate the data returned from a step.

### 0.6.3

* Fix isolation level passed to mssql.

### 0.6.2

* Reject promise when step action throws error.

### 0.6.1

* Added support for object arrays to insert multiple rows with multiple columns

### 0.6.0
* Added support for value arrays to insert multiple rows
* Added ability to bypass execute callback.
* Updated readme with named instance example
* Returned additional SQL error information (preceding errors) in the error message

## 0.5.*

### 0.5.5
 * Emit connectivity events
 * Prevent reading sql files multiple times

### 0.5.4
Update mssql to 2.3.2

### 0.5.3
 * Improvement - include failed step name in  object
 * Bug fix - don't lose error context during rollback

### 0.5.2
 * Bug fix - consistently resolve/reject when using then
 * Update node-mssql to 2.2.0

### 0.5.1

Update mssql version to 2.1.8 to get 1.12.2 of tedious - new stream parsing and corrected NTLM auth.

### 0.5.0

 * Refactor of how connection pools are defined and used throughout API to address the following:
   * Bug fix - failing transactions no longer result in process crashes
   * Bug fix - failing transactions now return underlying reason for failure
   * Bug fix - multiple calls with the same connection parameters do not result in multiple connection pools
   * Bug fix - using the transaction context does not result in a closed connection pool at the end of the transaction
   * Feature - connections can specify a name to simplify future use of multiple connection pools
 * Feature - add metronic integration
 * Feature - make multi-step API calls 'then-able'
 * Refactored tests where use of stubs was not correctly asserting arguments passed to calls (tests *always* passed)
