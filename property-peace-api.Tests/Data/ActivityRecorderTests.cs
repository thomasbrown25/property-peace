using System.Security.Claims;
using System.Text.RegularExpressions;
using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace brownstone_hub_api.Tests.ActivityRecording;

public sealed class ActivityRecorderTests
{
    [Fact]
    public async Task Relational_create_update_noop_soft_and_hard_delete_have_durable_safe_actor_scoped_events()
    {
        await using var f = await Fixture.Create();
        var account = new BankAccount { OrganizationId = 17, DisplayName = "SECRET bank label", StripeAccountId = "SECRET stripe", Last4 = "1234" };
        f.Db.BankAccounts.Add(account);
        Assert.Equal(1, await f.Db.SaveChangesAsync());
        Assert.True(account.Id > 0);
        var created = await f.Db.ActivityEvents.SingleAsync();
        Assert.Equal(account.Id, created.RelatedId);
        Assert.Equal("BankAccount", created.ActivityType);
        Assert.Equal("Created", created.Operation);
        Assert.Equal(17, created.OrganizationId);
        Assert.Equal(42, created.PerformedByUserId);
        Assert.Equal("User #42", created.PerformedByName);
        Assert.Equal(DateTimeKind.Utc, created.CreatedAt.Kind);
        Assert.DoesNotContain("SECRET", created.Title + created.Message);
        Assert.DoesNotContain("1234", created.Message);
        Assert.Equal(0, await f.Db.SaveChangesAsync());
        account.DisplayName = "new SECRET";
        f.Db.SaveChanges(); // synchronous path shares recording/guards
        account.IsActive = false;
        await f.Db.SaveChangesAsync();
        f.Db.BankAccounts.Remove(account);
        await f.Db.SaveChangesAsync();
        f.Db.ChangeTracker.Clear();
        Assert.Empty(await f.Db.BankAccounts.ToListAsync());
        Assert.Equal(new[] { "Created", "Updated", "Deleted", "Deleted" },
            await f.Db.ActivityEvents.OrderBy(e => e.Id).Select(e => e.Operation).ToArrayAsync());
    }

    [Fact]
    public async Task Activity_write_failure_rolls_back_mutation_and_retry_does_not_duplicate_history()
    {
        await using var f = await Fixture.Create();
        await f.Db.Database.ExecuteSqlRawAsync("CREATE TRIGGER fail_activity BEFORE INSERT ON ActivityEvents BEGIN SELECT RAISE(ABORT, 'activity failure'); END;");
        var account = new BankAccount { OrganizationId = 17, StripeAccountId = "private" };
        f.Db.Add(account);
        await Assert.ThrowsAsync<DbUpdateException>(() => f.Db.SaveChangesAsync());
        Assert.Equal(0, await f.Db.BankAccounts.AsNoTracking().CountAsync());
        Assert.Equal(0, await f.Db.ActivityEvents.AsNoTracking().CountAsync());
        Assert.Equal(EntityState.Added, f.Db.Entry(account).State);
        await f.Db.Database.ExecuteSqlRawAsync("DROP TRIGGER fail_activity");
        await f.Db.SaveChangesAsync();
        Assert.Equal(1, await f.Db.BankAccounts.CountAsync());
        Assert.Equal(account.Id, (await f.Db.ActivityEvents.SingleAsync()).RelatedId);
    }

    [Fact]
    public async Task Entity_write_failure_does_not_leave_phantom_events()
    {
        await using var f = await Fixture.Create();
        await f.Db.Database.ExecuteSqlRawAsync("CREATE TRIGGER fail_account BEFORE INSERT ON BankAccounts BEGIN SELECT RAISE(ABORT, 'mutation failure'); END;");
        f.Db.Add(new BankAccount { OrganizationId = 17 });
        await Assert.ThrowsAsync<DbUpdateException>(() => f.Db.SaveChangesAsync());
        Assert.Empty(await f.Db.ActivityEvents.ToListAsync());
        Assert.DoesNotContain(f.Db.ChangeTracker.Entries<ActivityEvent>(), e => e.State == EntityState.Added);
    }

    [Fact]
    public async Task Existing_transaction_uses_savepoint_and_preserves_earlier_work_on_activity_failure()
    {
        await using var f = await Fixture.Create();
        await using var transaction = await f.Db.Database.BeginTransactionAsync();
        f.Db.Add(new BankAccount { OrganizationId = 17, DisplayName = "earlier" });
        await f.Db.SaveChangesAsync();
        await f.Db.Database.ExecuteSqlRawAsync("CREATE TRIGGER fail_activity BEFORE INSERT ON ActivityEvents BEGIN SELECT RAISE(ABORT, 'activity failure'); END;");
        f.Db.Add(new BankAccount { OrganizationId = 18, DisplayName = "failed" });
        await Assert.ThrowsAsync<DbUpdateException>(() => f.Db.SaveChangesAsync());
        Assert.Equal(new[] { 17L }, await f.Db.BankAccounts.AsNoTracking().Select(b => b.OrganizationId).ToArrayAsync());
        Assert.Equal(new[] { 17L }, await f.Db.ActivityEvents.AsNoTracking().Select(b => b.OrganizationId).ToArrayAsync());
        await transaction.RollbackAsync();
        Assert.Empty(await f.Db.ActivityEvents.AsNoTracking().ToArrayAsync());
    }

    [Fact]
    public async Task Accept_false_preserves_caller_state_and_append_only_guard_is_enforced()
    {
        await using var f = await Fixture.Create();
        var account = new BankAccount { OrganizationId = 17 };
        f.Db.Add(account);
        await f.Db.SaveChangesAsync(false);
        Assert.Equal(EntityState.Added, f.Db.Entry(account).State);
        f.Db.ChangeTracker.AcceptAllChanges();
        Assert.Equal(0, await f.Db.SaveChangesAsync());
        var activity = await f.Db.ActivityEvents.SingleAsync();
        activity.Message = "tamper";
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.Db.SaveChangesAsync());
    }

    [Fact]
    public async Task All_supported_aggregates_resolve_actual_relationships_and_checklist_child_changes_collapse()
    {
        await using var db = Memory();
        var property = new Property { Id = 10, OrganizationId = 17 };
        var unit = new Unit { Id = 20, Property = property, PropertyId = 10, OrganizationId = 17 };
        var lease = new Lease { Id = 30, Unit = unit, UnitId = 20, OrganizationId = 17 };
        var checklist = new Checklist { Id = 40, Property = property, PropertyId = 10, Lease = lease, LeaseId = 30 };
        checklist.Items.Add(new ChecklistItem { Name = "SECRET inspection", Checklist = checklist });
        var subscription = new ShortStayIcalSubscription { Unit = unit, UnitId = 20, OrgId = 17, EncryptedUrl = "SECRET URL", UrlFingerprint = "fingerprint" };
        db.AddRange(property, unit, lease, checklist,
            new LeaseAgreement { Lease = lease, LeaseId = 30 },
            new BankAccount { OrganizationId = 17 },
            new OrganizationMember { OrganizationId = 17, Email = "SECRET email" },
            new StaffMember { OrganizationId = 17 },
            new Listing { Property = property, PropertyId = 10 },
            new ShortStayBlock { Unit = unit, UnitId = 20 }, subscription,
            new ShortStayIcalOccurrence { Subscription = subscription, UidKey = "private", RecurrenceKey = "private" },
            new ShortStayNightlyRateOverride { Unit = unit, UnitId = 20 },
            new ShowingAvailability { OrganizationId = 17 },
            new Showing { OrganizationId = 17, PropertyId = 10 },
            ShortStayReservation.CreateHold(20, 10, 17, 1, 2, "SECRET stripe", new(2026, 11, 1), new(2026, 11, 2), 1, [10000L], DateTimeOffset.UtcNow.AddMinutes(10), DateTimeOffset.UtcNow),
            new Tenant { OrganizationId = 17, Unit = unit, Firstname = "SECRET", Lastname = "tenant" },
            new Announcement { OrganizationId = 17, Title = "SECRET", Message = "SECRET" },
            new Payment { Lease = lease, LeaseId = 30, PropertyId = 10 },
            new OrganizationChecklistItem { OrganizationId = 17 });
        await db.SaveChangesAsync();
        var types = await db.ActivityEvents.Select(e => e.ActivityType).Distinct().ToListAsync();
        Assert.Equal(new[] { "Announcement", "BankAccount", "Booking", "Calendar", "Checklist", "Lease", "LeaseAgreement", "Listing", "Payment", "Property", "TeamMember", "Tenant" }, types.OrderBy(x => x));
        Assert.All(await db.ActivityEvents.ToListAsync(), e => { Assert.Equal(17, e.OrganizationId); Assert.True(e.RelatedId > 0); Assert.Equal("System", e.PerformedByName); Assert.DoesNotContain("SECRET", e.Title + e.Message); });
        var agreement = await db.ActivityEvents.SingleAsync(e => e.ActivityType == "LeaseAgreement");
        Assert.Equal(10, agreement.PropertyId);
        Assert.Equal(30, agreement.LeaseId);
        Assert.Single(await db.ActivityEvents.Where(e => e.ActivityType == "Checklist" && e.RelatedId == 40).ToListAsync());
        checklist.Items.First().Notes = "SECRET child edit";
        await db.SaveChangesAsync();
        var updated = await db.ActivityEvents.OrderBy(e => e.Id).LastAsync();
        Assert.Equal("Checklist", updated.ActivityType);
        Assert.Equal("Updated", updated.Operation);
        Assert.Equal(40, updated.RelatedId);
        Assert.Equal(30, updated.LeaseId);
    }

    [Fact]
    public async Task Organizationless_and_conflicting_relationships_never_use_actor_organization()
    {
        await using var db = Memory();
        var property = new Property { OrganizationId = 18 };
        db.AddRange(new Property(), new BankAccount { OrganizationId = 17 },
            new Listing { OrganizationId = 17, Property = property }, property);
        await db.SaveChangesAsync();
        Assert.DoesNotContain(await db.ActivityEvents.ToListAsync(), e => e.ActivityType == "Listing");
        Assert.Equal(new[] { 17L, 18L }, await db.ActivityEvents.Select(e => e.OrganizationId).OrderBy(x => x).ToArrayAsync());
    }

    [Fact]
    public async Task Relational_generated_property_lease_and_agreement_ids_are_final_and_child_hard_delete_retains_scope()
    {
        await using var f = await Fixture.Create("Properties", "Units", "Leases", "LeaseAgreements", "Checklists", "ChecklistItems");
        var property = new Property { OrganizationId = 17 };
        var unit = new Unit { Property = property };
        var lease = new Lease { Unit = unit };
        var agreement = new LeaseAgreement { Lease = lease };
        var checklist = new Checklist { Property = property, Lease = lease };
        checklist.Items.Add(new ChecklistItem { Checklist = checklist, Name = "item" });
        f.Db.AddRange(property, unit, lease, agreement, checklist);
        await f.Db.SaveChangesAsync();
        Assert.True(property.Id > 0 && lease.Id > 0 && agreement.Id > 0);
        var recorded = await f.Db.ActivityEvents.SingleAsync(e => e.ActivityType == "LeaseAgreement");
        Assert.Equal(agreement.Id, recorded.RelatedId);
        Assert.Equal(property.Id, recorded.PropertyId);
        Assert.Equal(lease.Id, recorded.LeaseId);
        Assert.Equal(17, recorded.OrganizationId);
        f.Db.ChangeTracker.Clear();
        agreement = await f.Db.LeaseAgreements.SingleAsync(); // deliberately unloaded navigation graph
        f.Db.Remove(agreement);
        await f.Db.SaveChangesAsync();
        recorded = await f.Db.ActivityEvents.OrderBy(e => e.Id).LastAsync();
        Assert.Equal("Deleted", recorded.Operation);
        Assert.Equal(property.Id, recorded.PropertyId);
        Assert.Equal(lease.Id, recorded.LeaseId);
        var item = await f.Db.ChecklistItems.SingleAsync();
        item.Notes = "private child update";
        await f.Db.SaveChangesAsync();
        recorded = await f.Db.ActivityEvents.OrderBy(e => e.Id).LastAsync();
        Assert.Equal("Checklist", recorded.ActivityType);
        Assert.Equal(checklist.Id, recorded.RelatedId);
        Assert.Equal(lease.Id, recorded.LeaseId);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Activity_failure_restores_update_or_delete_for_retry(bool delete)
    {
        await using var f = await Fixture.Create();
        var account = new BankAccount { OrganizationId = 17, DisplayName = "original" };
        f.Db.Add(account);
        await f.Db.SaveChangesAsync();
        await f.Db.Database.ExecuteSqlRawAsync("CREATE TRIGGER fail_activity BEFORE INSERT ON ActivityEvents BEGIN SELECT RAISE(ABORT, 'activity failure'); END;");
        if (delete) f.Db.Remove(account); else account.DisplayName = "changed";
        await Assert.ThrowsAsync<DbUpdateException>(() => f.Db.SaveChangesAsync());
        Assert.Equal("original", (await f.Db.BankAccounts.AsNoTracking().SingleAsync()).DisplayName);
        Assert.Equal(delete ? EntityState.Deleted : EntityState.Modified, f.Db.Entry(account).State);
        Assert.Single(await f.Db.ActivityEvents.ToListAsync());
        await f.Db.Database.ExecuteSqlRawAsync("DROP TRIGGER fail_activity");
        await f.Db.SaveChangesAsync();
        Assert.Equal(delete ? 0 : 1, await f.Db.BankAccounts.CountAsync());
        Assert.Equal(2, await f.Db.ActivityEvents.CountAsync());
    }

    [Fact]
    public async Task Existing_append_only_guards_fail_before_any_activity_is_written()
    {
        await using var db = Memory();
        var milestone = new ActivityEvent { ActivityType = "Property", Operation = "Created", OrganizationId = 17, RelatedId = 1, CreatedAt = DateTime.UtcNow };
        db.Add(milestone);
        await db.SaveChangesAsync();
        db.Remove(milestone);
        db.Add(new BankAccount { OrganizationId = 17 });
        await Assert.ThrowsAsync<InvalidOperationException>(() => db.SaveChangesAsync());
        Assert.Empty(await db.BankAccounts.AsNoTracking().ToListAsync());
        Assert.Single(await db.ActivityEvents.AsNoTracking().ToListAsync());
    }

    [Fact]
    public async Task Inactive_lease_is_updated_but_explicit_soft_delete_is_deleted()
    {
        await using var db = Memory();
        var property = new Property { OrganizationId = 17 };
        var lease = new Lease { Unit = new Unit { Property = property }, OrganizationId = 17 };
        db.Add(lease);
        await db.SaveChangesAsync();
        lease.IsActive = false;
        await db.SaveChangesAsync();
        Assert.Equal("Updated", (await db.ActivityEvents.OrderBy(e => e.Id).LastAsync()).Operation);
        lease.IsDeleted = true;
        await db.SaveChangesAsync();
        Assert.Equal("Deleted", (await db.ActivityEvents.OrderBy(e => e.Id).LastAsync()).Operation);
    }

    private static DataContext Memory() => new(new DbContextOptionsBuilder<DataContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private sealed class FixedAccessor : IHttpContextAccessor
    {
        public HttpContext? HttpContext { get; set; }
    }

    private sealed class Fixture : IAsyncDisposable
    {
        private readonly SqliteConnection connection;
        public DataContext Db { get; }
        private Fixture(SqliteConnection connection)
        {
            this.connection = connection;
            var accessor = new FixedAccessor { HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity([
                new Claim(ClaimTypes.NameIdentifier, "42"), new Claim(ClaimTypes.Name, "SECRET email"), new Claim("OrganizationId", "999")], "test")) } };
            Db = new DataContext(new DbContextOptionsBuilder<DataContext>().UseSqlite(connection).Options, accessor);
        }
        public static async Task<Fixture> Create(params string[] additionalTables)
        {
            var connection = new SqliteConnection("Data Source=:memory:;Foreign Keys=False");
            await connection.OpenAsync();
            var f = new Fixture(connection);
            var ddl = f.Db.Database.GenerateCreateScript();
            foreach (var table in new[] { "BankAccounts", "ActivityEvents" }.Concat(additionalTables))
            {
                var create = Regex.Match(ddl, $"CREATE TABLE \\\"{table}\\\"[^;]*;", RegexOptions.Singleline);
                Assert.True(create.Success, $"Missing EF DDL: {table}");
                await f.Db.Database.ExecuteSqlRawAsync(create.Value.Replace("nvarchar(max)", "TEXT"));
            }
            return f;
        }
        public async ValueTask DisposeAsync()
        {
            await Db.DisposeAsync();
            new HttpContextAccessor().HttpContext = null;
            await connection.DisposeAsync();
        }
    }
}
