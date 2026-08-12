using brownstone_hub_api.Data;
using brownstone_hub_api.Domain.Screening;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.Screening;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Screening;

public sealed class ScreeningReportAccessDurabilityTests
{
    [Fact]
    public async Task Requested_attempt_is_durable_before_provider_and_provider_failure_is_sanitized_and_finalized()
    {
        await using var h = await Harness.CreateAsync(throwProvider: true);

        await FluentActions.Invoking(() => h.Decisions.RequestReportAccessAsync(10, 100, 30,
                ScreeningReportAccessPurpose.RentalDecision))
            .Should().ThrowAsync<ScreeningReportAccessException>();

        h.Gateway.StatusObservedAtCall.Should().Be(ScreeningReportAccessAttemptStatus.Requested);
        await using var verification = h.NewContext();
        var attempt = await verification.ScreeningReportAccessAudits.SingleAsync();
        attempt.Status.Should().Be(ScreeningReportAccessAttemptStatus.Failed);
        attempt.FailureCode.Should().Be("ProviderAccessFailed");
        attempt.CompletedAt.Should().NotBeNull();
        attempt.ToString().Should().NotContain("provider-secret").And.NotContain("https://");
    }

    [Fact]
    public async Task Stale_requested_attempt_introspects_and_idempotently_revokes_active_grant_before_finalizing_without_a_url()
    {
        await using var h = await Harness.CreateAsync();
        h.Db.ScreeningReportAccessAudits.Add(new ScreeningReportAccessAudit
        {
            TenantScreeningOrderId = 30, OrganizationId = 10, ActorUserId = 100,
            ScreeningReportRevisionId = 60, AttemptSequence = 1,
            Purpose = ScreeningReportAccessPurpose.RentalDecision, RequestedAt = h.Now.AddMinutes(-10)
        });
        await h.Db.SaveChangesAsync();
        h.Gateway.RecoverySnapshot = new(ScreeningReportAccessGrantStatus.Active, h.Now.AddMinutes(1));

        (await h.Decisions.RecoverStaleReportAccessAttemptsAsync(10, TimeSpan.FromMinutes(5))).Should().Be(1);

        var audit = await h.Db.ScreeningReportAccessAudits.SingleAsync();
        audit.Status.Should().Be(ScreeningReportAccessAttemptStatus.Failed);
        audit.FailureCode.Should().Be("RecoveredGrantRevoked");
        audit.GrantReference.Should().BeNull();
        audit.GrantExpiresAt.Should().BeNull();
        h.Gateway.IntrospectionCalls.Should().Be(1);
        h.Gateway.RevocationCalls.Should().Be(1);
        h.Gateway.RecoveryRequests.Should().ContainSingle();
        h.Gateway.RecoveryRequests.Single().ProviderIdempotencyKey.Should().HaveLength(64);
        h.Gateway.RecoveryRequests.Single().GetType().GetProperties().Should().NotContain(x =>
            x.Name.Contains("Url", StringComparison.OrdinalIgnoreCase) || x.Name.Contains("Uri", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task Stale_requested_attempt_with_no_provider_grant_is_finalized_without_revocation()
    {
        await using var h = await Harness.CreateAsync();
        h.Db.ScreeningReportAccessAudits.Add(new ScreeningReportAccessAudit
        {
            TenantScreeningOrderId = 30, OrganizationId = 10, ActorUserId = 100,
            ScreeningReportRevisionId = 60, AttemptSequence = 1,
            Purpose = ScreeningReportAccessPurpose.RentalDecision, RequestedAt = h.Now.AddMinutes(-10)
        });
        await h.Db.SaveChangesAsync();
        h.Gateway.RecoverySnapshot = new(ScreeningReportAccessGrantStatus.NotFound, null);

        (await h.Decisions.RecoverStaleReportAccessAttemptsAsync(10, TimeSpan.FromMinutes(5))).Should().Be(1);

        (await h.Db.ScreeningReportAccessAudits.SingleAsync()).FailureCode.Should().Be("RecoveredNoActiveGrant");
        h.Gateway.RevocationCalls.Should().Be(0);
    }

    [Fact]
    public async Task Legal_hold_does_not_block_access_but_open_dispute_only_allows_dispute_purpose()
    {
        await using var h = await Harness.CreateAsync();
        h.Report.IsUnderLegalHold = true;
        await h.Db.SaveChangesAsync();

        (await h.Decisions.RequestReportAccessAsync(10, 100, 30, ScreeningReportAccessPurpose.RentalDecision))
            .AccessUri.Should().NotBeNull();

        h.Db.ScreeningDisputes.Add(new ScreeningDispute
        {
            LocalDisputeId = Guid.NewGuid(), TenantScreeningOrderId = 30, OrganizationId = 10,
            ProviderKey = "provider", ProviderDisputeReference = "dispute-1", Status = ScreeningDisputeStatus.Investigating,
            OpenedAt = h.Now, OriginalScreeningReportRevisionId = h.Report.Id, IssueCodesJson = "[]",
            NotesSha256Hash = new string('a', 64), RetentionExpiresAt = h.Now.AddDays(30)
        });
        h.Order.ApplyTransition(ScreeningStatus.Disputed, 2, h.Now);
        await h.Db.SaveChangesAsync();

        await FluentActions.Invoking(() => h.Decisions.RequestReportAccessAsync(10, 100, 30,
                ScreeningReportAccessPurpose.RentalDecision))
            .Should().ThrowAsync<ScreeningReportAccessDeniedException>();
        (await h.Decisions.RequestReportAccessAsync(10, 100, 30, ScreeningReportAccessPurpose.DisputeReview))
            .AccessUri.Should().NotBeNull();
    }

    [Fact]
    public async Task Server_issued_one_time_elevation_is_actor_org_purpose_expiry_scoped_and_revocable()
    {
        await using var h = await Harness.CreateAsync(includeMember: false, includeApprover: true);
        var elevation = await h.Elevations.IssueAsync(new IssueScreeningSupportElevationCommand(
            10, 200, 900, "CASE-123", "Investigate provider rendering", ScreeningReportAccessPurpose.SupportInvestigation,
            TimeSpan.FromMinutes(15), 1));

        await FluentActions.Invoking(() => h.Decisions.RequestReportAccessAsync(10, 901, 30,
                ScreeningReportAccessPurpose.SupportInvestigation, elevation.ElevationId))
            .Should().ThrowAsync<ScreeningAuthorizationException>();
        await FluentActions.Invoking(() => h.Decisions.RequestReportAccessAsync(11, 900, 30,
                ScreeningReportAccessPurpose.SupportInvestigation, elevation.ElevationId))
            .Should().ThrowAsync<ScreeningAuthorizationException>();
        await FluentActions.Invoking(() => h.Decisions.RequestReportAccessAsync(10, 900, 30,
                ScreeningReportAccessPurpose.DisputeReview, elevation.ElevationId))
            .Should().ThrowAsync<ScreeningAuthorizationException>();

        await h.Decisions.RequestReportAccessAsync(10, 900, 30,
            ScreeningReportAccessPurpose.SupportInvestigation, elevation.ElevationId);
        await FluentActions.Invoking(() => h.Decisions.RequestReportAccessAsync(10, 900, 30,
                ScreeningReportAccessPurpose.SupportInvestigation, elevation.ElevationId))
            .Should().ThrowAsync<ScreeningAuthorizationException>();

        var second = await h.Elevations.IssueAsync(new IssueScreeningSupportElevationCommand(
            10, 200, 900, "CASE-124", "Investigate provider rendering", ScreeningReportAccessPurpose.SupportInvestigation,
            TimeSpan.FromMinutes(15), 1));
        await h.Elevations.RevokeAsync(10, 200, second.ElevationId);
        await FluentActions.Invoking(() => h.Decisions.RequestReportAccessAsync(10, 900, 30,
                ScreeningReportAccessPurpose.SupportInvestigation, second.ElevationId))
            .Should().ThrowAsync<ScreeningAuthorizationException>();
    }

    [Fact]
    public void Client_report_access_DTO_has_only_purpose_and_local_elevation_id()
    {
        var names = typeof(brownstone_hub_api.Dtos.Screening.ScreeningReportAccessDto).GetProperties().Select(x => x.Name).ToArray();
        names.Should().BeEquivalentTo(["Purpose", "ElevationId"]);
    }

    private sealed class Harness : IAsyncDisposable
    {
        public required DbContextOptions<DataContext> Options { get; init; }
        public required DataContext Db { get; init; }
        public required TenantScreeningDecisionService Decisions { get; init; }
        public required ScreeningSupportElevationService Elevations { get; init; }
        public required Gateway Gateway { get; init; }
        public required TenantScreeningOrder Order { get; init; }
        public required ScreeningReportRevision Report { get; init; }
        public required DateTimeOffset Now { get; init; }
        public DataContext NewContext() => new(Options);

        public static async Task<Harness> CreateAsync(bool throwProvider = false, bool includeMember = true, bool includeApprover = false)
        {
            var now = new DateTimeOffset(2026, 8, 7, 12, 0, 0, TimeSpan.Zero);
            var options = new DbContextOptionsBuilder<DataContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
            var db = new DataContext(options);
            db.Organizations.AddRange(new Organization { Id = 10, Name = "Org" }, new Organization { Id = 11, Name = "Other" });
            db.Users.AddRange(
                new User { Id = 100, Email = "member@test", FirstName = "M", LastName = "U" },
                new User { Id = 200, Email = "owner@test", FirstName = "O", LastName = "W" },
                new User { Id = 900, Email = "support@test", FirstName = "S", LastName = "U" },
                new User { Id = 901, Email = "other-support@test", FirstName = "T", LastName = "U" });
            if (includeMember) db.OrganizationMembers.Add(new OrganizationMember { Id = 1, OrganizationId = 10, UserId = 100, Role = "Manager", IsActive = true });
            if (includeApprover) db.OrganizationMembers.Add(new OrganizationMember { Id = 2, OrganizationId = 10, UserId = 200, Role = "Owner", IsActive = true });
            db.Properties.Add(new Property { Id = 20, OrganizationId = 10, LandlordId = 100, State = "CA", StreetAddress = "1 Main", City = "X", ZipCode = "00000" });
            var order = new TenantScreeningOrder { Id = 30, OrganizationId = 10, RentalApplicationId = 70, PropertyId = 20,
                ProviderKey = "provider", ProviderOrderId = "po-1", CreatedAt = now, QuoteExpiresAt = now.AddDays(1) };
            order.ApplyTransition(ScreeningStatus.Complete, 1, now);
            var report = new ScreeningReportRevision { Id = 60, TenantScreeningOrderId = 30, OrganizationId = 10, Revision = 1,
                ProviderKey = "provider", ProviderReportReference = "report-1", ReceivedAt = now, Status = ScreeningReportStatus.Complete,
                ReportVersion = "v1", NormalizedFactsJson = "{}", NormalizedFactsSha256Hash = new string('a', 64), RetentionExpiresAt = now.AddDays(30) };
            db.TenantScreeningOrders.Add(order); db.ScreeningReportRevisions.Add(report);
            await db.SaveChangesAsync();
            var supportAuth = new SupportAuthorization();
            var gateway = new Gateway(options, now, throwProvider);
            return new Harness
            {
                Options = options, Db = db, Gateway = gateway, Order = order, Report = report, Now = now,
                Decisions = new TenantScreeningDecisionService(db, gateway, new FixedTimeProvider(now), supportAuth),
                Elevations = new ScreeningSupportElevationService(db, new FixedTimeProvider(now), supportAuth)
            };
        }
        public ValueTask DisposeAsync() => Db.DisposeAsync();
    }

    private sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider { public override DateTimeOffset GetUtcNow() => now; }
    private sealed class SupportAuthorization : IScreeningSupportAuthorization
    {
        public Task<bool> IsPlatformSupportActorAsync(long userId, CancellationToken cancellationToken = default) => Task.FromResult(userId is 900 or 901);
    }
    private sealed class Gateway(DbContextOptions<DataContext> options, DateTimeOffset now, bool throwProvider) : IScreeningProviderGateway
    {
        public ScreeningReportAccessAttemptStatus? StatusObservedAtCall { get; private set; }
        public ScreeningReportAccessGrantSnapshot RecoverySnapshot { get; set; } =
            new(ScreeningReportAccessGrantStatus.NotFound, null);
        public int IntrospectionCalls { get; private set; }
        public int RevocationCalls { get; private set; }
        public List<ScreeningReportAccessRecoveryRequest> RecoveryRequests { get; } = [];
        public async Task<ScreeningReportAccessResult> GetReportAccessAsync(ScreeningReportAccessRequest request, CancellationToken cancellationToken = default)
        {
            await using var verification = new DataContext(options);
            StatusObservedAtCall = (await verification.ScreeningReportAccessAudits
                .Where(x => x.TenantScreeningOrderId == request.ScreeningOrderId)
                .OrderByDescending(x => x.AttemptSequence)
                .FirstAsync(cancellationToken)).Status;
            if (throwProvider) throw new InvalidOperationException("provider-secret https://provider.test/raw");
            return ScreeningReportAccessResult.Create(new Uri("https://reports.provider.test/one-time-secret"), now.AddMinutes(5),
                "grant-1", [new Uri("https://reports.provider.test/")], now);
        }
        public Task<ScreeningReportAccessGrantSnapshot> IntrospectReportAccessAsync(
            ScreeningReportAccessRecoveryRequest request, CancellationToken cancellationToken = default)
        {
            IntrospectionCalls++;
            RecoveryRequests.Add(request);
            return Task.FromResult(RecoverySnapshot);
        }
        public Task<ScreeningProviderOperationResult> RevokeReportAccessAsync(
            ScreeningReportAccessRecoveryRequest request, CancellationToken cancellationToken = default)
        {
            RevocationCalls++;
            if (!RecoveryRequests.Contains(request)) RecoveryRequests.Add(request);
            return Task.FromResult(new ScreeningProviderOperationResult("revocation-evidence", "revoked"));
        }
        public Task<AuthoritativeScreeningQuote> GetAuthoritativeQuoteAsync(ScreeningQuoteRequest request, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<ApplicantHostedSessionResult> CreateApplicantHostedSessionAsync(CreateApplicantScreeningSessionRequest request, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<NormalizedScreeningStatusUpdate> GetStatusAsync(ScreeningStatusRequest request, CancellationToken cancellationToken = default) => throw new NotSupportedException();
    }
}
