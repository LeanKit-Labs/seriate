SELECT
	CASE transaction_isolation_level
		WHEN 1 THEN 'READ_UNCOMMITTED'
		WHEN 2 THEN 'READ_COMMITTED'
		WHEN 3 THEN 'REPEATABLE_READ'
		WHEN 4 THEN 'SERIALIZABLE'
		WHEN 5 THEN 'SNAPSHOT'
		ELSE 'Unknown'
	END AS level
FROM sys.dm_exec_sessions
where session_id = @@SPID
