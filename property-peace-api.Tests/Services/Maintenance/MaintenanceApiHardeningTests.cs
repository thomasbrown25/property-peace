using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Timelines;
using brownstone_hub_api.Services.Maintenance;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Maintenance;

public sealed class MaintenanceApiHardeningTests
{
    private static readonly DateTimeOffset Now = new(2026, 8, 9, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public void PersistenceModel_HasRequestConcurrency_IdempotencyReceipt_AndDurableProjectionOutbox()
    {
        using var db = Db();
        db.Model.FindEntityType(typeof(MaintenanceRequest))!.FindProperty(nameof(MaintenanceRequest.RowVersion))!
            .IsConcurrencyToken.Should().BeTrue();

        var receipt = db.Model.FindEntityType(typeof(MaintenanceCommandReceipt))!;
        receipt.GetSchema().Should().Be("maintenance");
        receipt.GetIndexes().Should().ContainSingle(index => index.IsUnique &&
            index.Properties.Select(property => property.Name).SequenceEqual(new[]
            {
                nameof(MaintenanceCommandReceipt.ActorUserId), nameof(MaintenanceCommandReceipt.Operation),
                nameof(MaintenanceCommandReceipt.IdempotencyKeyHash)
            }));

        var outbox = db.Model.FindEntityType(typeof(MaintenanceTimelineOutbox))!;
        outbox.GetSchema().Should().Be("maintenance");
        outbox.FindProperty(nameof(MaintenanceTimelineOutbox.RowVersion))!.IsConcurrencyToken.Should().BeTrue();
        outbox.GetIndexes().Should().Contain(index => index.IsUnique &&
            index.Properties.Single().Name == nameof(MaintenanceTimelineOutbox.MaintenanceActivityEventId));
    }

    [Fact]
    public async Task CommandExecutor_ReplaysCompletedReceipt_RejectsPayloadReuse_AndMapsConcurrencyToConflict()
    {
        await using var db = Db();
        var executor = new MaintenanceCommandExecutor(db, new ActorAccessor(10), new FixedTime(Now),
            new MaintenanceTransactionSideEffects());
        var calls = 0;

        var first = await executor.ExecuteAsync("key-1", "request.create", "payload-a", _ =>
        {
            calls++;
            return Task.FromResult(MaintenanceApiResult<long>.Success(42));
        });
        var replay = await executor.ExecuteAsync("key-1", "request.create", "payload-a", _ =>
        {
            calls++;
            return Task.FromResult(MaintenanceApiResult<long>.Success(99));
        });
        var mismatch = await executor.ExecuteAsync("key-1", "request.create", "payload-b", _ =>
            Task.FromResult(MaintenanceApiResult<long>.Success(100)));
        var stale = await executor.ExecuteAsync<long>("key-2", "request.acknowledge", "payload", _ =>
            throw new DbUpdateConcurrencyException("stale"));

        first.Value.Should().Be(42);
        replay.Value.Should().Be(42);
        calls.Should().Be(1);
        mismatch.Code.Should().Be(MaintenanceApiResultCode.Conflict);
        mismatch.ErrorCode.Should().Be("maintenance.idempotency_payload_conflict");
        stale.Code.Should().Be(MaintenanceApiResultCode.Conflict);
        stale.ErrorCode.Should().Be("maintenance.version_conflict");
        db.MaintenanceCommandReceipts.Should().HaveCount(2);
    }

    [Fact]
    public async Task FailedTimelineProjection_RemainsDurableAndRetryCompletesExactlyOnce()
    {
        await using var db = Db();
        await Seed(db);
        var failing = new ThrowingTimelineRepository();
        var service = new MaintenanceActivityService(db, failing, new FixedTime(Now));
        var request = await db.MaintenanceRequests.Include(x => x.Property).SingleAsync();

        var activity = await service.RecordAsync(request, 10, "request.created", "maintenanceRequest", 100,
            "Maintenance request created", MaintenanceActivityVisibility.Participants);

        var pending = await db.MaintenanceTimelineOutboxes.SingleAsync();
        pending.MaintenanceActivityEventId.Should().Be(activity.Id);
        pending.ProcessedAtUtc.Should().BeNull();
        pending.AttemptCount.Should().Be(1);
        pending.NextAttemptAtUtc.Should().NotBeNull();

        var healthy = Repository(db);
        var retry = new MaintenanceActivityService(db, healthy, new FixedTime(Now.AddMinutes(5)));
        (await retry.ProjectPendingAsync(10)).Should().Be(1);
        (await retry.ProjectPendingAsync(10)).Should().Be(0);

        (await db.MaintenanceTimelineOutboxes.SingleAsync()).ProcessedAtUtc.Should().NotBeNull();
        db.ConversationTimelineEntries.Should().ContainSingle(x => x.EventId == $"activity:{activity.Id}");
    }

    private static DataContext Db() => new(new DbContextOptionsBuilder<DataContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private static ConversationTimelineRepository Repository(DataContext db) =>
        new(db, NullLogger<ConversationTimelineRepository>.Instance, new ConversationTimelineSequenceAllocator());

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

    private sealed class ActorAccessor(long userId) : IMaintenanceActorAccessor
    {
        public Task<MaintenanceActor?> GetCurrentAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult<MaintenanceActor?>(new(userId, true, false));
    }

    private sealed class FixedTime(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }

    private sealed class ThrowingTimelineRepository : IConversationTimelineRepository
    {
        public Task<ConversationTimelineEntry> AppendAsync(Dtos.Timeline.AppendTimelineEntryRequest request, CancellationToken cancellationToken = default) =>
            throw new InvalidOperationException("transient");

        public Task<Dtos.Timeline.TimelinePage> ReadAsync(long conversationId, long userId, long? afterSequence, int limit, CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();

        public Task<Dtos.Timeline.TimelinePage> ReadAsync(long conversationId, long userId, long organizationId, long? afterSequence, int limit, CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();
    }
}
