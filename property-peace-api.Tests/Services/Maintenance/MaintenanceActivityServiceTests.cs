using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Timelines;
using brownstone_hub_api.Services.Maintenance;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Maintenance;

public sealed class MaintenanceActivityServiceTests
{
    private static readonly DateTimeOffset Now = new(2026, 8, 9, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task Record_IsActorAwareDurable_CreatesMaintenanceConversationLink_AndProjectionIsIdempotent()
    {
        await using var db = Db(); await Seed(db);
        var timeline = Repository(db); var service = new MaintenanceActivityService(db, timeline, new FixedTime(Now));
        var request = await db.MaintenanceRequests.Include(x => x.Property).SingleAsync();

        var activity = await service.RecordAsync(request, 10, "request.created", "maintenanceRequest", 100,
            "Maintenance request created", MaintenanceActivityVisibility.Participants, "Reported");
        await service.ProjectAsync(activity);

        activity.ActorUserId.Should().Be(10);
        db.MaintenanceActivityEvents.Should().ContainSingle();
        db.ConversationContextLinks.Should().ContainSingle(x => x.MaintenanceRequestId == 100);
        db.ConversationTimelineEntries.Should().ContainSingle(x => x.Producer == "maintenance-workflow" && x.EventId == $"activity:{activity.Id}");
        db.ConversationTimelineEntries.Single().ActorUserId.Should().Be(10);
    }

    [Fact]
    public async Task Projection_HidesFinancialEventsFromTenant_ButStaffCanSeeThem_AndContainsNoSensitiveValues()
    {
        await using var db = Db(); await Seed(db);
        var timeline = Repository(db); var service = new MaintenanceActivityService(db, timeline, new FixedTime(Now));
        var request = await db.MaintenanceRequests.Include(x => x.Property).SingleAsync();
        await service.RecordAsync(request, 10, "request.created", "maintenanceRequest", 100,
            "Maintenance request created", MaintenanceActivityVisibility.Participants, "Reported");
        await service.RecordAsync(request, 61, "estimate.submitted", "estimate", 800,
            "Maintenance estimate submitted", MaintenanceActivityVisibility.StaffOnly, "Submitted");
        var conversation = await db.Conversations.SingleAsync();

        var tenant = await timeline.ReadAsync(conversation.Id, 10, null, 20);
        var staff = await timeline.ReadAsync(conversation.Id, 61, null, 20);

        tenant.Items.Should().ContainSingle(x => x.Visibility == TimelineVisibility.Participants);
        staff.Items.Should().HaveCount(2);
        tenant.Items.Concat(staff.Items).Should().OnlyContain(x => !x.Summary.Contains('$') && !x.MetadataJson.Contains("amount", StringComparison.OrdinalIgnoreCase)
            && !x.MetadataJson.Contains("phone", StringComparison.OrdinalIgnoreCase) && !x.MetadataJson.Contains("email", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task ActivityEvidence_IsAppendOnly()
    {
        await using var db = Db(); await Seed(db);
        var service = new MaintenanceActivityService(db, Repository(db), new FixedTime(Now));
        var request = await db.MaintenanceRequests.Include(x => x.Property).SingleAsync();
        var activity = await service.RecordAsync(request, 10, "request.created", "maintenanceRequest", 100,
            "Maintenance request created", MaintenanceActivityVisibility.Participants);
        activity.Summary = "rewritten";
        await FluentActions.Invoking(() => db.SaveChangesAsync()).Should().ThrowAsync<InvalidOperationException>().WithMessage("*append-only*");
    }

    [Fact]
    public async Task MissingOrganization_IsRetriedAndNeverAcknowledgedAsProjected()
    {
        await using var db = Db(); await Seed(db);
        var request = await db.MaintenanceRequests.Include(x => x.Property).SingleAsync();
        request.OrganizationId = null;
        request.Property.OrganizationId = null;
        (await db.Tenants.SingleAsync()).OrganizationId = null;
        (await db.Leases.SingleAsync()).OrganizationId = null;
        await db.SaveChangesAsync();
        var service = new MaintenanceActivityService(db, Repository(db), new FixedTime(Now));

        await service.RecordAsync(request, 10, "request.created", "maintenanceRequest", request.Id,
            "Maintenance request created", MaintenanceActivityVisibility.Participants);

        var outbox = await db.MaintenanceTimelineOutboxes.SingleAsync();
        outbox.ProcessedAtUtc.Should().BeNull();
        outbox.AttemptCount.Should().Be(1);
        outbox.NextAttemptAtUtc.Should().Be(Now.AddMinutes(1));
        outbox.LastErrorCode.Should().Be("maintenance.organization_unresolved");
        db.ConversationTimelineEntries.Should().BeEmpty();
    }

    [Fact]
    public async Task MissingOrganization_IsSafelyBackfilledWhenAllRequestEvidenceAgrees()
    {
        await using var db = Db(); await Seed(db);
        var request = await db.MaintenanceRequests.Include(x => x.Property).SingleAsync();
        request.OrganizationId = null;
        await db.SaveChangesAsync();
        var service = new MaintenanceActivityService(db, Repository(db), new FixedTime(Now));

        await service.RecordAsync(request, 10, "request.created", "maintenanceRequest", request.Id,
            "Maintenance request created", MaintenanceActivityVisibility.Participants);

        request.OrganizationId.Should().Be(60);
        var outbox = await db.MaintenanceTimelineOutboxes.SingleAsync();
        outbox.ProcessedAtUtc.Should().Be(Now);
        outbox.LastErrorCode.Should().BeNull();
        db.ConversationTimelineEntries.Should().ContainSingle();
    }

    [Fact]
    public async Task ConflictingOrganizationEvidence_IsRetriedAndNotBackfilled()
    {
        await using var db = Db(); await Seed(db);
        var request = await db.MaintenanceRequests.Include(x => x.Property).SingleAsync();
        request.OrganizationId = null;
        (await db.Leases.SingleAsync()).OrganizationId = 61;
        await db.SaveChangesAsync();
        var service = new MaintenanceActivityService(db, Repository(db), new FixedTime(Now));

        await service.RecordAsync(request, 10, "request.created", "maintenanceRequest", request.Id,
            "Maintenance request created", MaintenanceActivityVisibility.Participants);

        request.OrganizationId.Should().BeNull();
        var outbox = await db.MaintenanceTimelineOutboxes.SingleAsync();
        outbox.ProcessedAtUtc.Should().BeNull();
        outbox.LastErrorCode.Should().Be("maintenance.organization_unresolved");
        db.ConversationTimelineEntries.Should().BeEmpty();
    }

    [Fact]
    public async Task PersistentlyUnresolvedOrganization_IsDeadLetteredWithoutBeingMarkedProcessed()
    {
        await using var db = Db(); await Seed(db);
        var request = await db.MaintenanceRequests.Include(x => x.Property).SingleAsync();
        request.OrganizationId = null;
        request.Property.OrganizationId = null;
        (await db.Tenants.SingleAsync()).OrganizationId = null;
        (await db.Leases.SingleAsync()).OrganizationId = null;
        var activity = new MaintenanceActivityEvent
        {
            MaintenanceRequestId = request.Id, ActorUserId = 10, EventType = "request.created",
            SubjectType = "maintenanceRequest", SubjectId = request.Id, Summary = "Created",
            Visibility = MaintenanceActivityVisibility.Participants, MetadataJson = "{}", OccurredAtUtc = Now
        };
        db.MaintenanceActivityEvents.Add(activity);
        db.MaintenanceTimelineOutboxes.Add(new MaintenanceTimelineOutbox
        {
            MaintenanceActivityEvent = activity, AvailableAtUtc = Now, AttemptCount = 9
        });
        await db.SaveChangesAsync();
        var service = new MaintenanceActivityService(db, Repository(db), new FixedTime(Now));

        (await service.ProjectPendingAsync()).Should().Be(0);

        var outbox = await db.MaintenanceTimelineOutboxes.SingleAsync();
        outbox.AttemptCount.Should().Be(10);
        outbox.ProcessedAtUtc.Should().BeNull();
        outbox.DeadLetteredAtUtc.Should().Be(Now);
        outbox.NextAttemptAtUtc.Should().BeNull();
        outbox.LastErrorCode.Should().Be("maintenance.organization_unresolved");
    }

    private static ConversationTimelineRepository Repository(DataContext db) => new(db, NullLogger<ConversationTimelineRepository>.Instance, new ConversationTimelineSequenceAllocator());
    private static DataContext Db() => new(new DbContextOptionsBuilder<DataContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
    private static async Task Seed(DataContext db)
    {
        db.Users.AddRange(new User { Id = 10, SettingId = 10, Email = "tenant@example.com" }, new User { Id = 61, SettingId = 61, Email = "staff@example.com" });
        db.Organizations.Add(new Organization { Id = 60, Name = "Org" });
        db.OrganizationMembers.Add(new OrganizationMember { Id = 1, OrganizationId = 60, UserId = 61, IsActive = true, CanManageMaintenance = true, Role = "Manager" });
        db.Properties.Add(new Property { Id = 40, LandlordId = 61, OrganizationId = 60, Name = "Home" });
        db.Units.Add(new Unit { Id = 50, PropertyId = 40, Name = "1A" });
        db.Tenants.Add(new Tenant { Id = 20, UserId = 10, Firstname = "T", Lastname = "U", OrganizationId = 60 });
        db.Leases.Add(new Lease { Id = 30, UnitId = 50, OrganizationId = 60, IsActive = true, IsDeleted = false });
        db.TenantLeases.Add(new TenantLease { TenantId = 20, LeaseId = 30 });
        db.MaintenanceRequests.Add(new MaintenanceRequest { Id = 100, PropertyId = 40, UnitId = 50, OrganizationId = 60, SubmittedByUserId = 10, SubmittedByTenantId = 20, SubmittedUnderLeaseId = 30, UnitName = "1A", Title = "Leak", Description = "Leak" });
        await db.SaveChangesAsync();
    }
    private sealed class FixedTime(DateTimeOffset now) : TimeProvider { public override DateTimeOffset GetUtcNow() => now; }
}
