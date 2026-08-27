using brownstone_hub_api.Data;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Xunit;

namespace brownstone_hub_api.Tests.Migrations;

public sealed class RentPaymentAccessMigrationTests
{
    private const string PreviousMigration = "20260825040744_AddRememberMeSessionPersistence";
    private const string Migration = "20260825192508_AddRentPaymentAccessApproval";

    [Fact]
    public void Approval_migration_preserves_no_row_as_the_denied_default_and_enforces_one_current_row_per_organization()
    {
        using var db = new DataContext(new DbContextOptionsBuilder<DataContext>()
            .UseSqlServer("Server=(localdb)\\mssqllocaldb;Database=RentPaymentAccessMigrationMetadata;Trusted_Connection=True")
            .Options);

        var sql = db.GetService<IMigrator>().GenerateScript(
            PreviousMigration,
            Migration,
            MigrationsSqlGenerationOptions.Idempotent);

        sql.Should().Contain("[financial].[RentPaymentAccessRequests]");
        sql.Should().Contain("[financial].[RentPaymentAccessAuditEvents]");
        sql.Should().Contain("IX_RentPaymentAccessRequests_OrganizationId");
        sql.Should().Contain("UNIQUE");
        sql.Should().Contain("IX_RentPaymentAccessRequests_PublicId");
        sql.Should().Contain("[RowVersion] rowversion NOT NULL");
        sql.Should().Contain("FK_RentPaymentAccessAuditEvents_RentPaymentAccessRequests_RentPaymentAccessRequestId");
        sql.Should().NotContain("INSERT INTO [financial].[RentPaymentAccessRequests]",
            "organizations without an approval row must remain NotRequested and denied");
        sql.Should().NotContain("UPDATE [financial].[RentPaymentAccessRequests]",
            "the migration must not auto-approve or otherwise backfill organizations");
    }
}
