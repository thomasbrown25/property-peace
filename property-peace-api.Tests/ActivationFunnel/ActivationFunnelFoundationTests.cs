using System.Reflection;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.ActivationFunnel;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.ActivationFunnel;
using FluentAssertions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace brownstone_hub_api.Tests.ActivationFunnel;

public sealed class ActivationFunnelFoundationTests
{
    private static readonly DateTimeOffset Occurred = new(2026, 8, 10, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public void Contract_IsExactlyTheStableTenMilestones()
    {
        ActivationMilestones.All.Should().Equal(
            "property_added", "listing_published", "lead_received", "showing_booked",
            "application_completed", "screening_completed", "lease_signed", "tenant_invited",
            "first_rent_recorded_or_paid", "maintenance_closed");
        ActivationMilestones.All.Should().OnlyHaveUniqueItems();
    }

    [Fact]
    public async Task RelationalConstraints_RejectDuplicateSubjectAndSourceReplay_ButAllowNullSources()
    {
        await using var fixture = await SqliteFixture.CreateAsync();
        fixture.Db.ActivationMilestoneOccurrences.Add(Occurrence(1, "property_added", "property:1", "property", "1"));
        await fixture.Db.SaveChangesAsync();

        fixture.Db.ActivationMilestoneOccurrences.Add(Occurrence(1, "property_added", "property:1", null, null));
        await Assert.ThrowsAsync<DbUpdateException>(() => fixture.Db.SaveChangesAsync());
        fixture.Db.ChangeTracker.Clear();

        fixture.Db.ActivationMilestoneOccurrences.Add(Occurrence(1, "listing_published", "listing:8", "property", "1"));
        await Assert.ThrowsAsync<DbUpdateException>(() => fixture.Db.SaveChangesAsync());
        fixture.Db.ChangeTracker.Clear();

        fixture.Db.ActivationMilestoneOccurrences.AddRange(
            Occurrence(1, "lead_received", "lead:1", null, null),
            Occurrence(1, "lead_received", "lead:2", null, null));
        await fixture.Db.SaveChangesAsync();
        (await fixture.Db.ActivationMilestoneOccurrences.CountAsync()).Should().Be(3);
    }

    [Fact]
    public async Task Occurrences_AreAppendOnlyAtDataContextBoundary()
    {
        await using var fixture = await SqliteFixture.CreateAsync();
        var occurrence = Occurrence(1, "property_added", "property:1", null, null);
        fixture.Db.Add(occurrence);
        await fixture.Db.SaveChangesAsync();

        occurrence.IsTimestampEstimated = true;
        await Assert.ThrowsAsync<InvalidOperationException>(() => fixture.Db.SaveChangesAsync());
        fixture.Db.Entry(occurrence).State = EntityState.Deleted;
        await Assert.ThrowsAsync<InvalidOperationException>(() => fixture.Db.SaveChangesAsync());
    }

    [Fact]
    public async Task Recorder_IsIdempotent_UsesTimeProvider_AndRequiresUtc()
    {
        await using var fixture = await SqliteFixture.CreateAsync();
        var recorded = new DateTimeOffset(2026, 8, 11, 9, 30, 0, TimeSpan.Zero);
        var recorder = new ActivationOccurrenceRecorder(fixture.Db, new FixedTimeProvider(recorded));
        var request = new ActivationOccurrenceRequest(7, "lead_received", "lead:42", Occurred, false,
            "lead_event", "evt-42", ActorUserId: 91);

        (await recorder.RecordAsync(request)).Should().BeTrue();
        (await recorder.RecordAsync(request)).Should().BeFalse();

        var saved = await fixture.Db.ActivationMilestoneOccurrences.SingleAsync();
        saved.RecordedAtUtc.Should().Be(recorded.UtcDateTime);
        saved.OccurredAtUtc.Should().Be(Occurred.UtcDateTime);
        saved.ActorUserId.Should().Be(91);
        var nonUtc = request with { SubjectId = "lead:43", OccurredAtUtc = Occurred.ToOffset(TimeSpan.FromHours(-5)) };
        await Assert.ThrowsAsync<ArgumentException>(() => recorder.RecordAsync(nonUtc));
        await Assert.ThrowsAsync<ArgumentOutOfRangeException>(() => recorder.RecordAsync(request with { Milestone = "invented" }));
        await Assert.ThrowsAsync<ArgumentException>(() => recorder.RecordAsync(request with
        {
            SubjectId = "lead:blank-type", SourceEventType = " ", SourceEventId = "evt-blank-type"
        }));
        await Assert.ThrowsAsync<ArgumentException>(() => recorder.RecordAsync(request with
        {
            SubjectId = "lead:blank-id", SourceEventType = "lead_event", SourceEventId = " "
        }));
    }

    [Fact]
    public async Task Recorder_TreatsAnExactSourceReplayAsIdempotent_ButRejectsAConflictingSourceReuse()
    {
        await using var fixture = await SqliteFixture.CreateAsync();
        var recorder = new ActivationOccurrenceRecorder(fixture.Db, new FixedTimeProvider(Occurred));
        var original = new ActivationOccurrenceRequest(7, "lead_received", "lead:42", Occurred, false, "lead_event", "evt-42");

        (await recorder.RecordAsync(original)).Should().BeTrue();
        (await recorder.RecordAsync(original)).Should().BeFalse();
        await Assert.ThrowsAsync<InvalidOperationException>(() => recorder.RecordAsync(original with
        {
            SubjectId = "lead:43"
        }));
        await Assert.ThrowsAsync<InvalidOperationException>(() => recorder.RecordAsync(original with
        {
            Milestone = "showing_booked",
            SubjectId = "showing:43"
        }));
        (await fixture.Db.ActivationMilestoneOccurrences.CountAsync()).Should().Be(1);
    }

    [Fact]
    public async Task Recorder_RejectsCrossedSubjectAndSourceReplayInsteadOfHidingItAsSubjectIdempotency()
    {
        await using var fixture = await SqliteFixture.CreateAsync();
        var recorder = new ActivationOccurrenceRecorder(fixture.Db, new FixedTimeProvider(Occurred));
        var first = new ActivationOccurrenceRequest(7, "lead_received", "lead:42", Occurred, false, "lead_event", "evt-42");
        var second = first with { SubjectId = "lead:43", SourceEventId = "evt-43" };
        (await recorder.RecordAsync(first)).Should().BeTrue();
        (await recorder.RecordAsync(second)).Should().BeTrue();

        await Assert.ThrowsAsync<InvalidOperationException>(() => recorder.RecordAsync(first with
        {
            SourceEventId = "evt-43"
        }));
        (await fixture.Db.ActivationMilestoneOccurrences.CountAsync()).Should().Be(2);
    }

    [Fact]
    public async Task Projection_IsBounded_UsesInclusiveStartExclusiveEnd_AndReturnsOnlyAggregateContract()
    {
        await using var fixture = await SqliteFixture.CreateAsync();
        fixture.Db.AddRange(
            Occurrence(1, "property_added", "property:1", null, null, Occurred),
            Occurrence(2, "property_added", "property:2", null, null, Occurred, estimated: true),
            Occurrence(1, "lead_received", "lead:1", null, null, Occurred.AddDays(1)),
            Occurrence(3, "lead_received", "lead:3", null, null, Occurred.AddDays(2)));
        await fixture.Db.SaveChangesAsync();
        var projection = new ActivationFunnelProjection(fixture.Db);

        var report = await projection.GetAsync(Occurred, Occurred.AddDays(2));

        report.Milestones.Select(x => x.Milestone).Should().Equal(ActivationMilestones.All);
        report.Milestones.Single(x => x.Milestone == "property_added").Should().BeEquivalentTo(
            new ActivationFunnelMilestoneDto("property_added", 2, 2, 1));
        report.Milestones.Single(x => x.Milestone == "lead_received").OccurrenceCount.Should().Be(1);
        report.GetType().GetProperties().Select(x => x.Name).Should().NotContain(
            new[] { "Name", "Email", "Phone", "SubjectId", "SourceEventId", "Amount", "Payload" });

        await Assert.ThrowsAsync<ArgumentOutOfRangeException>(() => projection.GetAsync(Occurred, Occurred));
        await Assert.ThrowsAsync<ArgumentOutOfRangeException>(() => projection.GetAsync(Occurred, Occurred.AddDays(367)));
        await Assert.ThrowsAsync<ArgumentException>(() => projection.GetAsync(Occurred.ToOffset(TimeSpan.FromHours(1)), Occurred.AddDays(1)));
    }

    [Fact]
    public void Api_IsAdminOnlyReadOnlyAndDoesNotExposeIngestion()
    {
        var controller = typeof(ActivationFunnelController);
        controller.GetCustomAttribute<AuthorizeAttribute>()!.Roles.Should().Be("Admin");
        controller.GetCustomAttribute<RouteAttribute>()!.Template.Should().Be("api/admin/activation-funnel");
        var publicActions = controller.GetMethods(BindingFlags.Instance | BindingFlags.Public)
            .Where(x => x.DeclaringType == controller).ToArray();
        publicActions.Should().ContainSingle();
        publicActions.Single().GetCustomAttribute<HttpGetAttribute>().Should().NotBeNull();
        publicActions.SelectMany(x => x.GetCustomAttributes()).Should().NotContain(a =>
            a is HttpPostAttribute || a is HttpPutAttribute || a is HttpPatchAttribute);
    }

    private static ActivationMilestoneOccurrence Occurrence(long organizationId, string milestone, string subjectId,
        string? sourceType, string? sourceId, DateTimeOffset? occurred = null, bool estimated = false) => new()
    {
        OrganizationId = organizationId,
        Milestone = milestone,
        SubjectId = subjectId,
        OccurredAtUtc = (occurred ?? Occurred).UtcDateTime,
        RecordedAtUtc = Occurred.AddHours(1).UtcDateTime,
        IsTimestampEstimated = estimated,
        SourceEventType = sourceType,
        SourceEventId = sourceId
    };

    private sealed class FixedTimeProvider(DateTimeOffset value) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => value;
    }

    private sealed class SqliteFixture : IAsyncDisposable
    {
        private readonly SqliteConnection _connection;
        public DataContext Db { get; }
        private SqliteFixture(SqliteConnection connection, DataContext db) { _connection = connection; Db = db; }
        public static async Task<SqliteFixture> CreateAsync()
        {
            var connection = new SqliteConnection("Data Source=:memory:");
            await connection.OpenAsync();
            var db = new DataContext(new DbContextOptionsBuilder<DataContext>().UseSqlite(connection).Options);
            await db.Database.ExecuteSqlRawAsync("""
                CREATE TABLE ActivationMilestoneOccurrences (
                    Id INTEGER PRIMARY KEY AUTOINCREMENT,
                    OrganizationId INTEGER NOT NULL,
                    Milestone TEXT NOT NULL,
                    SubjectId TEXT NOT NULL,
                    OccurredAtUtc TEXT NOT NULL,
                    RecordedAtUtc TEXT NOT NULL,
                    IsTimestampEstimated INTEGER NOT NULL,
                    ActorUserId INTEGER NULL,
                    SourceEventType TEXT NULL,
                    SourceEventId TEXT NULL,
                    CONSTRAINT CK_ActivationMilestoneOccurrences_Milestone CHECK (Milestone IN
                        ('property_added','listing_published','lead_received','showing_booked','application_completed',
                         'screening_completed','lease_signed','tenant_invited','first_rent_recorded_or_paid','maintenance_closed')),
                    CONSTRAINT CK_ActivationMilestoneOccurrences_SourcePair CHECK
                        ((SourceEventType IS NULL AND SourceEventId IS NULL) OR
                         (SourceEventType IS NOT NULL AND SourceEventId IS NOT NULL)));
                CREATE UNIQUE INDEX UX_ActivationOccurrence_OrganizationMilestoneSubject
                    ON ActivationMilestoneOccurrences (OrganizationId, Milestone, SubjectId);
                CREATE UNIQUE INDEX UX_ActivationOccurrence_SourceReplay
                    ON ActivationMilestoneOccurrences (OrganizationId, SourceEventType, SourceEventId)
                    WHERE SourceEventType IS NOT NULL AND SourceEventId IS NOT NULL;
                """);
            return new SqliteFixture(connection, db);
        }
        public async ValueTask DisposeAsync() { await Db.DisposeAsync(); await _connection.DisposeAsync(); }
    }
}
