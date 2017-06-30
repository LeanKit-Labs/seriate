## 0.7.*

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
