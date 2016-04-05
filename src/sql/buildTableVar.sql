DECLARE @<%= name %> table (value <%= type %>)
DECLARE @<%= name %>Idoc int

EXEC sp_xml_preparedocument @<%= name %>Idoc OUTPUT, @<%= name %>Xml
INSERT @<%= name %> SELECT value FROM OPENXML(@<%= name %>Idoc, '//row', 1) WITH (value <%= type %>);
EXEC sp_xml_removedocument @<%= name %>Idoc;
