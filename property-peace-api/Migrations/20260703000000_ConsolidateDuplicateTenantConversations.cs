using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using brownstone_hub_api.Data;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(DataContext))]
    [Migration("20260703000000_ConsolidateDuplicateTenantConversations")]
    public partial class ConsolidateDuplicateTenantConversations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF OBJECT_ID('tempdb..#DuplicateTenantConversationMap') IS NOT NULL
                    DROP TABLE #DuplicateTenantConversationMap;

                WITH ConversationPersonKeys AS (
                    SELECT
                        c.Id,
                        c.LandlordId,
                        COALESCE(
                            CASE WHEN t.UserId IS NOT NULL THEN CONCAT('USER:', CAST(t.UserId AS varchar(20))) END,
                            CASE WHEN otherParticipant.UserId IS NOT NULL THEN CONCAT('USER:', CAST(otherParticipant.UserId AS varchar(20))) END,
                            CASE WHEN NULLIF(LTRIM(RTRIM(t.Email)), '') IS NOT NULL THEN CONCAT('EMAIL:', LOWER(LTRIM(RTRIM(t.Email)))) END,
                            CASE WHEN c.TenantId IS NOT NULL THEN CONCAT('TENANT:', CAST(c.TenantId AS varchar(20))) END
                        ) AS PersonKey,
                        COALESCE(c.LastMessageAt, c.UpdatedAt, c.CreatedAt) AS SortDate
                    FROM communication.Conversations c
                    LEFT JOIN tenant.Tenants t ON t.Id = c.TenantId
                    OUTER APPLY (
                        SELECT TOP 1 cp.UserId
                        FROM communication.ConversationParticipants cp
                        WHERE cp.ConversationId = c.Id
                          AND cp.UserId <> c.LandlordId
                          AND cp.IsDeleted = 0
                        ORDER BY cp.UserId
                    ) otherParticipant
                    WHERE c.IsGroupChat = 0
                      AND (c.TenantId IS NOT NULL OR otherParticipant.UserId IS NOT NULL)
                ),
                RankedConversations AS (
                    SELECT
                        Id,
                        LandlordId,
                        PersonKey,
                        FIRST_VALUE(Id) OVER (
                            PARTITION BY LandlordId, PersonKey
                            ORDER BY SortDate DESC, Id DESC
                        ) AS CanonicalConversationId,
                        ROW_NUMBER() OVER (
                            PARTITION BY LandlordId, PersonKey
                            ORDER BY SortDate DESC, Id DESC
                        ) AS RowNumber
                    FROM ConversationPersonKeys
                    WHERE PersonKey IS NOT NULL
                )
                SELECT Id AS DuplicateConversationId, CanonicalConversationId
                INTO #DuplicateTenantConversationMap
                FROM RankedConversations
                WHERE RowNumber > 1;

                IF EXISTS (SELECT 1 FROM #DuplicateTenantConversationMap)
                BEGIN
                    INSERT INTO communication.ConversationParticipants (ConversationId, UserId, IsAdmin, JoinedAt, IsDeleted)
                    SELECT
                        m.CanonicalConversationId,
                        cp.UserId,
                        CAST(MAX(CASE WHEN cp.IsAdmin = 1 THEN 1 ELSE 0 END) AS bit) AS IsAdmin,
                        MIN(cp.JoinedAt) AS JoinedAt,
                        0
                    FROM communication.ConversationParticipants cp
                    INNER JOIN #DuplicateTenantConversationMap m ON m.DuplicateConversationId = cp.ConversationId
                    WHERE cp.IsDeleted = 0
                      AND NOT EXISTS (
                          SELECT 1
                          FROM communication.ConversationParticipants existing
                          WHERE existing.ConversationId = m.CanonicalConversationId
                            AND existing.UserId = cp.UserId
                            AND existing.IsDeleted = 0
                      )
                    GROUP BY m.CanonicalConversationId, cp.UserId;

                    UPDATE msg
                    SET ConversationId = m.CanonicalConversationId
                    FROM communication.Messages msg
                    INNER JOIN #DuplicateTenantConversationMap m ON m.DuplicateConversationId = msg.ConversationId;

                    IF OBJECT_ID('maintenance.MaintenanceRequests') IS NOT NULL
                    BEGIN
                        UPDATE mr
                        SET ConversationId = m.CanonicalConversationId
                        FROM maintenance.MaintenanceRequests mr
                        INNER JOIN #DuplicateTenantConversationMap m ON m.DuplicateConversationId = mr.ConversationId;
                    END

                    IF OBJECT_ID('dbo.CollectionsAgentActions') IS NOT NULL
                    BEGIN
                        UPDATE caa
                        SET ConversationId = m.CanonicalConversationId
                        FROM dbo.CollectionsAgentActions caa
                        INNER JOIN #DuplicateTenantConversationMap m ON m.DuplicateConversationId = caa.ConversationId;
                    END

                    DELETE cp
                    FROM communication.ConversationParticipants cp
                    INNER JOIN #DuplicateTenantConversationMap m ON m.DuplicateConversationId = cp.ConversationId;

                    UPDATE canonical
                    SET
                        LastMessageAt = latest.LastMessageAt,
                        LastMessagePreview = latest.LastMessagePreview,
                        LastMessageBy = latest.LastMessageBy,
                        UpdatedAt = SYSUTCDATETIME(),
                        HasUrgentItems = CASE WHEN urgent.HasUrgent = 1 THEN CAST(1 AS bit) ELSE canonical.HasUrgentItems END
                    FROM communication.Conversations canonical
                    INNER JOIN (
                        SELECT DISTINCT CanonicalConversationId FROM #DuplicateTenantConversationMap
                    ) affected ON affected.CanonicalConversationId = canonical.Id
                    OUTER APPLY (
                        SELECT TOP 1
                            m.CreatedAt AS LastMessageAt,
                            LEFT(m.Content, 500) AS LastMessagePreview,
                            m.SenderId AS LastMessageBy
                        FROM communication.Messages m
                        WHERE m.ConversationId = canonical.Id
                          AND m.IsDeleted = 0
                        ORDER BY m.CreatedAt DESC, m.Id DESC
                    ) latest
                    OUTER APPLY (
                        SELECT CASE WHEN EXISTS (
                            SELECT 1
                            FROM communication.Messages m
                            WHERE m.ConversationId = canonical.Id
                              AND m.IsUrgent = 1
                              AND m.IsDeleted = 0
                        ) THEN 1 ELSE 0 END AS HasUrgent
                    ) urgent;

                    DELETE c
                    FROM communication.Conversations c
                    INNER JOIN #DuplicateTenantConversationMap m ON m.DuplicateConversationId = c.Id;
                END

                DROP TABLE #DuplicateTenantConversationMap;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Data consolidation is intentionally irreversible.
        }
    }
}
