DECLARE @parameter table (
  [value] bigint
)

  DECLARE @parameterIdoc int
  EXEC sp_xml_preparedocument @parameterIdoc OUTPUT, @parameterXml
  INSERT @parameter SELECT [value]
  FROM OPENXML(@parameterIdoc, '//row', 1) WITH (
    [value] bigint
  );
  EXEC sp_xml_removedocument @parameterIdoc;


