SELECT	 [Id]
		,[Title]
		,[Description]
		,[ClassOfServiceEnabled]
		,[OrganizationId]
FROM	[dbo].[Board]
WHERE	id = @id
