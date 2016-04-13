DECLARE @<%= name %> table (
  <%= _.map( schema, function( val, key ) {
      return key + " " + val;
  } ).join( ", " ) %>
)
DECLARE @<%= name %>Idoc int
EXEC sp_xml_preparedocument @<%= name %>Idoc OUTPUT, @<%= name %>Xml
INSERT @<%= name %> SELECT <%= Object.keys( schema ).join(", ") %>
FROM OPENXML(@<%= name %>Idoc, '//row', 1) WITH (
  <%= _.map( schema, function( val, key ) {
      return key + " " + val;
  } ).join( ", " ) %>
);
EXEC sp_xml_removedocument @<%= name %>Idoc;
