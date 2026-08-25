using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Xunit;

namespace brownstone_hub_api.Tests.Services.RentPaymentAccess;

public sealed class RentPaymentAccessRowVersionRelationalTests
{
    [Fact]
    public async Task Mapping_and_database_generate_rowversion_on_insert_and_update()
    {
        var databasePath = Path.Combine(
            Path.GetTempPath(), $"rent-payment-access-rowversion-{Guid.NewGuid():N}.db");
        var options = new DbContextOptionsBuilder<DataContext>()
            .UseSqlite($"Data Source={databasePath};Pooling=False")
            .Options;

        try
        {
            await using var db = new DataContext(options);
            await db.Database.ExecuteSqlRawAsync(Schema);
            var rowVersion = db.Model.FindEntityType(typeof(RentPaymentAccessRequest))!
                .FindProperty(nameof(RentPaymentAccessRequest.RowVersion))!;
            rowVersion.IsConcurrencyToken.Should().BeTrue();
            rowVersion.ValueGenerated.Should().Be(ValueGenerated.OnAddOrUpdate);

            var request = new RentPaymentAccessRequest
            {
                OrganizationId = 701,
                Status = RentPaymentAccessStatus.Pending,
                RequestedByUserId = 41,
                RequestedAtUtc = new DateTime(2031, 4, 5, 14, 30, 0, DateTimeKind.Utc),
                StatusChangedAtUtc = new DateTime(2031, 4, 5, 14, 30, 0, DateTimeKind.Utc),
                RowVersion = [9]
            };
            db.RentPaymentAccessRequests.Add(request);
            await db.SaveChangesAsync();
            var insertedVersion = request.RowVersion.ToArray();
            insertedVersion.Should().HaveCount(8);
            insertedVersion.Should().NotEqual([9]);

            request.Status = RentPaymentAccessStatus.Approved;
            request.StatusChangedAtUtc = request.StatusChangedAtUtc.AddMinutes(1);
            await db.SaveChangesAsync();

            await using var verification = new DataContext(options);
            var persisted = await verification.RentPaymentAccessRequests.AsNoTracking().SingleAsync();
            persisted.RowVersion.Should().HaveCount(8);
            persisted.RowVersion.Should().NotEqual(insertedVersion);
        }
        finally
        {
            if (System.IO.File.Exists(databasePath)) System.IO.File.Delete(databasePath);
        }
    }

    private const string Schema = """
        CREATE TABLE RentPaymentAccessRequests (
            Id INTEGER NOT NULL CONSTRAINT PK_RentPaymentAccessRequests PRIMARY KEY AUTOINCREMENT,
            PublicId TEXT NOT NULL,
            OrganizationId INTEGER NOT NULL,
            Status TEXT NOT NULL,
            RequestedByUserId INTEGER NOT NULL,
            RequestedAtUtc TEXT NOT NULL,
            ReviewedByUserId INTEGER NULL,
            ReviewedAtUtc TEXT NULL,
            DecisionReason TEXT NULL,
            InternalNotes TEXT NULL,
            StatusChangedAtUtc TEXT NOT NULL,
            RowVersion BLOB NOT NULL DEFAULT (randomblob(8))
        );
        CREATE TRIGGER generate_rent_access_rowversion_after_update
        AFTER UPDATE ON RentPaymentAccessRequests
        WHEN NEW.RowVersion = OLD.RowVersion
        BEGIN
            UPDATE RentPaymentAccessRequests
            SET RowVersion = randomblob(8)
            WHERE Id = NEW.Id;
        END;
        """;
}
