using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Xunit;

namespace brownstone_hub_api.Tests.Migrations;

public sealed class ShortStayRefundAttemptMigrationTests
{
    private const string Previous = "20261021034208_AddShortStayBookingFoundation";
    private const string Current = "20261021045328_AddShortStayRefundAttempts";

    [Fact]
    public void Migration_is_additive_and_sql_enforces_durable_identity_and_review_constraints()
    {
        using var db = new DataContext(new DbContextOptionsBuilder<DataContext>()
            .UseSqlServer("Server=192.0.2.1;Database=RefundMigrationMetadata;User Id=invalid;Password=invalid").Options);
        var migration = db.GetService<IMigrationsAssembly>().CreateMigration(
            db.GetService<IMigrationsAssembly>().Migrations[Current], db.Database.ProviderName!);
        Assert.Equal(["ShortStayRefundAttempts"], migration.UpOperations.OfType<CreateTableOperation>().Select(x => x.Name));
        Assert.Empty(migration.UpOperations.OfType<DropTableOperation>());
        Assert.Empty(migration.UpOperations.OfType<AddColumnOperation>());
        Assert.Null(db.GetService<IMigrationsAssembly>().CreateMigration(
            db.GetService<IMigrationsAssembly>().Migrations[Previous], db.Database.ProviderName!).TargetModel
            .FindEntityType(typeof(ShortStayRefundAttempt)));
        var sql = db.GetService<IMigrator>().GenerateScript(Previous, Current);
        Assert.Contains("CK_ShortStayRefundAttempts_Count", sql);
        Assert.Contains("CK_ShortStayRefundAttempts_Review", sql);
        Assert.Contains("CREATE UNIQUE INDEX [IX_ShortStayRefundAttempts_ReservationId_PaymentIntentId]", sql);
        Assert.Contains("CREATE UNIQUE INDEX [IX_ShortStayRefundAttempts_IdempotencyKey]", sql);
        Assert.Contains("FOREIGN KEY ([ReservationId]) REFERENCES [listing].[ShortStayReservations]", sql);
        Assert.Contains("WHERE r.[Status] = 'RefundRequired'", sql);
        Assert.Contains("'ManualReview', SYSUTCDATETIME()", sql);
        Assert.DoesNotContain("DROP TABLE", sql);
        Assert.False(db.Database.HasPendingModelChanges());
    }
}
