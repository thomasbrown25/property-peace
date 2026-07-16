-- Renames LandlordId to UserId on lease_shield.Conversations.
-- Run once to align with the code (model uses UserId).
-- Requires: lease_shield.Conversations table and core.Users table.

SET NOCOUNT ON;

-- Drop FK if it exists
IF EXISTS (
    SELECT 1 FROM sys.foreign_keys fk
    JOIN sys.tables t ON fk.parent_object_id = t.object_id
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE s.name = 'lease_shield' AND t.name = 'Conversations' AND fk.name = 'FK_Conversations_Users_LandlordId'
)
BEGIN
    ALTER TABLE lease_shield.Conversations
    DROP CONSTRAINT FK_Conversations_Users_LandlordId;
    PRINT 'Dropped FK_Conversations_Users_LandlordId.';
END

-- Drop index IX_Conversations_LandlordId if exists
IF EXISTS (
    SELECT 1 FROM sys.indexes i
    JOIN sys.tables t ON i.object_id = t.object_id
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE s.name = 'lease_shield' AND t.name = 'Conversations' AND i.name = 'IX_Conversations_LandlordId'
)
BEGIN
    DROP INDEX IX_Conversations_LandlordId ON lease_shield.Conversations;
    PRINT 'Dropped IX_Conversations_LandlordId.';
END

-- Drop index IX_Conversations_LandlordId_UpdatedAt if exists
IF EXISTS (
    SELECT 1 FROM sys.indexes i
    JOIN sys.tables t ON i.object_id = t.object_id
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE s.name = 'lease_shield' AND t.name = 'Conversations' AND i.name = 'IX_Conversations_LandlordId_UpdatedAt'
)
BEGIN
    DROP INDEX IX_Conversations_LandlordId_UpdatedAt ON lease_shield.Conversations;
    PRINT 'Dropped IX_Conversations_LandlordId_UpdatedAt.';
END

-- Rename column LandlordId -> UserId (only if LandlordId exists and UserId does not)
IF EXISTS (
    SELECT 1 FROM sys.columns c
    JOIN sys.tables t ON c.object_id = t.object_id
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE s.name = 'lease_shield' AND t.name = 'Conversations' AND c.name = 'LandlordId'
)
AND NOT EXISTS (
    SELECT 1 FROM sys.columns c
    JOIN sys.tables t ON c.object_id = t.object_id
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE s.name = 'lease_shield' AND t.name = 'Conversations' AND c.name = 'UserId'
)
BEGIN
    EXEC sp_rename 'lease_shield.Conversations.LandlordId', 'UserId', 'COLUMN';
    PRINT 'Renamed LandlordId to UserId on lease_shield.Conversations.';
END
ELSE IF EXISTS (
    SELECT 1 FROM sys.columns c
    JOIN sys.tables t ON c.object_id = t.object_id
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE s.name = 'lease_shield' AND t.name = 'Conversations' AND c.name = 'UserId'
)
    PRINT 'Column UserId already exists on lease_shield.Conversations; skip rename.';
ELSE
    PRINT 'Column LandlordId not found; no rename performed.';

-- Create index IX_Conversations_UserId if not exists
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes i
    JOIN sys.tables t ON i.object_id = t.object_id
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE s.name = 'lease_shield' AND t.name = 'Conversations' AND i.name = 'IX_Conversations_UserId'
)
BEGIN
    CREATE INDEX IX_Conversations_UserId ON lease_shield.Conversations (UserId);
    PRINT 'Created IX_Conversations_UserId.';
END

-- Create index IX_Conversations_UserId_UpdatedAt if not exists
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes i
    JOIN sys.tables t ON i.object_id = t.object_id
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE s.name = 'lease_shield' AND t.name = 'Conversations' AND i.name = 'IX_Conversations_UserId_UpdatedAt'
)
BEGIN
    CREATE INDEX IX_Conversations_UserId_UpdatedAt ON lease_shield.Conversations (UserId, UpdatedAt);
    PRINT 'Created IX_Conversations_UserId_UpdatedAt.';
END

-- Add FK to core.Users if not exists
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys fk
    JOIN sys.tables t ON fk.parent_object_id = t.object_id
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE s.name = 'lease_shield' AND t.name = 'Conversations' AND fk.name = 'FK_Conversations_Users_UserId'
)
BEGIN
    ALTER TABLE lease_shield.Conversations
    ADD CONSTRAINT FK_Conversations_Users_UserId
    FOREIGN KEY (UserId) REFERENCES core.Users(Id)
    ON DELETE NO ACTION;
    PRINT 'Added FK_Conversations_Users_UserId.';
END
ELSE
    PRINT 'FK_Conversations_Users_UserId already exists.';

PRINT 'Done.';
