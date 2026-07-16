-- Adds State column to lease_shield.Messages (2-letter state code per message, for the state chip on responses).
-- Run once if the column is missing (e.g. migration was not applied).

SET NOCOUNT ON;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns c
    JOIN sys.tables t ON c.object_id = t.object_id
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE s.name = 'lease_shield' AND t.name = 'Messages' AND c.name = 'State'
)
BEGIN
    ALTER TABLE lease_shield.Messages
    ADD State nvarchar(2) NULL;
    PRINT 'Added State column to lease_shield.Messages.';
END
ELSE
    PRINT 'lease_shield.Messages.State already exists.';
