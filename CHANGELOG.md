## 0.5.*

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
