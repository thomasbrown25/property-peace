using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Xunit;

namespace brownstone_hub_api.Tests.Migrations;

public sealed class ShortStayBookingFoundationMigrationTests
{
    private const string Previous = "20261021020438_AddShortStayGuidebookDraft";
    private const string Current = "20261021034208_AddShortStayBookingFoundation";

    [Fact]
    public void Migration_is_additive_and_preserves_the_prior_guidebook_chain()
    {
        using var db = CreateContext();
        var assembly = db.GetService<IMigrationsAssembly>();
        Assert.Contains(Previous, assembly.Migrations.Keys);
        Assert.Contains(Current, assembly.Migrations.Keys);
        Assert.True(string.CompareOrdinal(Current, Previous) > 0);
        var previous = assembly.CreateMigration(assembly.Migrations[Previous], db.Database.ProviderName!).TargetModel;
        Assert.Null(previous.FindEntityType(typeof(ShortStayReservation)));
        Assert.Null(previous.FindEntityType(typeof(ShortStayOccupancyClaim)));

        var migration = assembly.CreateMigration(assembly.Migrations[Current], db.Database.ProviderName!);
        Assert.Equal(new[] { "ShortStayReservations", "ShortStayReservationNights", "ShortStayOccupancyClaims" },
            migration.UpOperations.OfType<CreateTableOperation>().Select(t => t.Name));
        Assert.Equal(new[] { "LodgingTaxRatePercent", "TaxPolicyAttestedAtUtc", "TaxPolicyAttestedByUserId" },
            migration.UpOperations.OfType<AddColumnOperation>().Select(c => c.Name));
        Assert.All(migration.UpOperations.OfType<AddColumnOperation>(), c => Assert.True(c.IsNullable));
        Assert.Empty(migration.UpOperations.OfType<DropTableOperation>());
        Assert.Empty(migration.UpOperations.OfType<DropColumnOperation>());
        Assert.Empty(migration.UpOperations.OfType<SqlOperation>());
        Assert.False(db.Database.HasPendingModelChanges());
    }

    [Fact]
    public void Sql_server_script_enforces_unique_claim_composite_relations_and_quote_limits()
    {
        using var db = CreateContext();
        var sql = db.GetService<IMigrator>().GenerateScript(Previous, Current);
        Assert.Contains("PRIMARY KEY ([UnitId], [Date])", sql);
        Assert.Contains("FOREIGN KEY ([ReservationId], [UnitId]) REFERENCES [listing].[ShortStayReservations] ([Id], [UnitId])", sql);
        Assert.Contains("FOREIGN KEY ([ReservationId], [UnitId], [Date]) REFERENCES [listing].[ShortStayReservationNights] ([ReservationId], [UnitId], [Date])", sql);
        Assert.Contains("CK_ShortStayReservations_Quote", sql);
        Assert.Contains("[TotalCents] <= 99999999", sql);
        Assert.Contains("CK_ShortStayReservations_Status", sql);
        Assert.Contains("CK_ShortStayListings_TaxAttestation", sql);
        Assert.Contains("CK_ShortStayListings_LodgingTaxRatePercent", sql);
        Assert.Contains("CREATE UNIQUE INDEX [IX_ShortStayReservations_PublicCode]", sql);
        Assert.Contains("CREATE UNIQUE INDEX [IX_ShortStayReservations_OperationId]", sql);
        Assert.DoesNotContain("DROP TABLE", sql);
        Assert.DoesNotContain("DROP COLUMN", sql);
    }

    private static DataContext CreateContext() => new(new DbContextOptionsBuilder<DataContext>()
        .UseSqlServer("Server=192.0.2.1;Database=BookingMigrationMetadata;User Id=invalid;Password=invalid")
        .Options);
}
