using System.Text.RegularExpressions;
using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace brownstone_hub_api.Tests.ShortStay;

public sealed class ShortStayCollectionApplicationPersistenceTests
{
    [Fact]
    public async Task Application_round_trips_exact_properties_and_only_safe_review_references()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = Context(connection);
        await CreateTables(db);
        await SeedParents(db);
        var now = DateTimeOffset.UtcNow;
        db.ShortStayCollectionApplications.Add(new ShortStayCollectionApplication
        {
            OrganizationId = 10, ApplicantUserId = 1, StripeAccountId = "acct_applicant",
            Status = ShortStayCollectionApplicationStatus.Submitted,
            IdentityVerificationSessionId = "vs_123", SubmittedAt = now,
            AuthorityAttestedAt = now, FeePolicyConsentVersion = "fees-v1",
            ApprovalCaseReference = "case-123", PropertyAuthorityConfirmedAt = now,
            CreatedAt = now, UpdatedAt = now,
            Properties = [new() { PropertyId = 20 }, new() { PropertyId = 21 }]
        });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        var saved = await db.ShortStayCollectionApplications.Include(x => x.Properties).SingleAsync();
        Assert.Equal(1, saved.ApplicantUserId);
        Assert.Equal("acct_applicant", saved.StripeAccountId);
        Assert.Equal("case-123", saved.ApprovalCaseReference);
        Assert.Equal(now, saved.PropertyAuthorityConfirmedAt);
        Assert.Equal([20L, 21L], saved.Properties.Select(x => x.PropertyId).Order().ToArray());
        Assert.Equal(ShortStayCollectionApplicationStatus.Submitted, saved.Status);
        var entity = db.Model.FindEntityType(typeof(ShortStayCollectionApplication))!;
        Assert.True(entity.FindProperty(nameof(ShortStayCollectionApplication.RowVersion))!.IsConcurrencyToken);
        Assert.DoesNotContain(entity.GetProperties(), p => Regex.IsMatch(p.Name, "bank|address|birth|photo|guest|document|evidence|payeeuserid", RegexOptions.IgnoreCase));
    }

    [Fact]
    public async Task Relational_constraints_reject_duplicate_active_applications_sessions_and_property_memberships()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = Context(connection);
        await CreateTables(db);
        await SeedParents(db);
        var insert = "INSERT INTO ShortStayCollectionApplications (Id, OrganizationId, ApplicantUserId, StripeAccountId, Status, CreatedAt, UpdatedAt, RowVersion, IdentityVerificationSessionId) VALUES ({0}, {1}, {2}, {3}, {4}, {5}, {6}, {7}, {8})";
        async Task Add(long id, long org, long user, string status, string? session = null) =>
            await db.Database.ExecuteSqlRawAsync(insert, id, org, user, "acct_test", status, "2026-01-01", "2026-01-01", 1, session);
        await Add(1, 10, 1, "Draft", "vs_first");
        await Assert.ThrowsAsync<SqliteException>(() => Add(2, 10, 1, "Submitted"));
        await Assert.ThrowsAsync<SqliteException>(() => Add(2, 10, 2, "Draft", "vs_first"));
        await Assert.ThrowsAsync<SqliteException>(() => Add(2, 10, 2, "Invalid"));
        await Assert.ThrowsAsync<SqliteException>(() => Add(2, 999, 2, "Draft"));
        await Assert.ThrowsAsync<SqliteException>(() => Add(2, 10, 999, "Draft"));
        await Add(2, 10, 2, "Rejected");
        await Add(3, 10, 2, "Draft");
        await db.Database.ExecuteSqlRawAsync("INSERT INTO ShortStayCollectionApplicationProperties (ShortStayCollectionApplicationId, PropertyId) VALUES (1, 20)");
        await Assert.ThrowsAsync<SqliteException>(() => db.Database.ExecuteSqlRawAsync("INSERT INTO ShortStayCollectionApplicationProperties (ShortStayCollectionApplicationId, PropertyId) VALUES (1, 20)"));
        await Assert.ThrowsAsync<SqliteException>(() => db.Database.ExecuteSqlRawAsync("INSERT INTO ShortStayCollectionApplicationProperties (ShortStayCollectionApplicationId, PropertyId) VALUES (1, 999)"));
        await Assert.ThrowsAsync<SqliteException>(() => db.Database.ExecuteSqlRawAsync("INSERT INTO ShortStayCollectionApplicationProperties (ShortStayCollectionApplicationId, PropertyId) VALUES (999, 20)"));
    }

    [Fact]
    public async Task Stale_application_row_version_rejects_a_competing_update()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var first = Context(connection);
        await CreateTables(first);
        await SeedParents(first);
        var now = DateTimeOffset.UtcNow;
        first.ShortStayCollectionApplications.Add(new ShortStayCollectionApplication
        {
            OrganizationId = 10, ApplicantUserId = 1, StripeAccountId = "acct_applicant",
            CreatedAt = now, UpdatedAt = now
        });
        await first.SaveChangesAsync();
        first.ChangeTracker.Clear();
        await using var second = Context(connection);
        var a = await first.ShortStayCollectionApplications.SingleAsync();
        var b = await second.ShortStayCollectionApplications.SingleAsync();
        a.Status = ShortStayCollectionApplicationStatus.Submitted;
        a.RowVersion++;
        await first.SaveChangesAsync();
        b.Status = ShortStayCollectionApplicationStatus.IdentityPending;
        b.RowVersion++;
        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => second.SaveChangesAsync());
    }

    private static DataContext Context(SqliteConnection connection) => new(new DbContextOptionsBuilder<DataContext>().UseSqlite(connection).Options);

    private static async Task CreateTables(DataContext db)
    {
        await db.Database.ExecuteSqlRawAsync("CREATE TABLE Users (Id INTEGER PRIMARY KEY)");
        await db.Database.ExecuteSqlRawAsync("CREATE TABLE Organizations (Id INTEGER PRIMARY KEY)");
        await db.Database.ExecuteSqlRawAsync("CREATE TABLE Properties (Id INTEGER PRIMARY KEY, OrganizationId INTEGER)");
        var ddl = db.Database.GenerateCreateScript();
        foreach (var table in new[] { "ShortStayCollectionApplications", "ShortStayCollectionApplicationProperties" })
        {
            var match = Regex.Match(ddl, $"CREATE TABLE [^;]*\\\"{table}\\\"[^;]*;", RegexOptions.Singleline);
            Assert.True(match.Success, $"EF must create {table}");
            await db.Database.ExecuteSqlRawAsync(match.Value);
        }
        foreach (Match index in Regex.Matches(ddl, "CREATE (?:UNIQUE )?INDEX [^;]*ShortStayCollectionApplication[^;]*;", RegexOptions.Singleline))
            await db.Database.ExecuteSqlRawAsync(index.Value);
    }

    private static async Task SeedParents(DataContext db)
    {
        await db.Database.ExecuteSqlRawAsync("INSERT INTO Users (Id) VALUES (1), (2)");
        await db.Database.ExecuteSqlRawAsync("INSERT INTO Organizations (Id) VALUES (10)");
        await db.Database.ExecuteSqlRawAsync("INSERT INTO Properties (Id, OrganizationId) VALUES (20, 10), (21, 10)");
    }
}
