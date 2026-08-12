using System.Reflection;
using brownstone_hub_api.Data;
using brownstone_hub_api.Domain.Screening;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.Screening;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Screening;

public sealed class ScreeningConsentOrchestrationTests
{
    private static readonly DateTimeOffset Now = new(2026, 8, 7, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task Invitation_persists_server_policy_and_quote_then_delivers_Property_Peace_link_without_provider_session()
    {
        await using var h = await Harness.CreateAsync();
        var result = await h.Service.CreateInvitationAsync(Command());

        result.Status.Should().Be(ScreeningStatus.ConsentPending);
        h.Gateway.QuoteRequests.Should().ContainSingle();
        h.Gateway.SessionRequests.Should().BeEmpty("consent must occur after the applicant sees the quote");
        h.Delivery.Requests.Should().ContainSingle();
        h.Delivery.Requests[0].ApplicantAccessUri.Host.Should().Be("apply.propertypeace.test");

        var order = await h.Db.TenantScreeningOrders.SingleAsync();
        order.ProviderKey.Should().Be("server-provider");
        order.PermissiblePurposeStatement.Should().Be("Rental housing eligibility");
        order.PermissiblePurposeVersion.Should().Be("purpose-server-v3");
        order.DisclosureVersion.Should().Be("disclosure-server-v4");
        order.AuthorizationVersion.Should().Be("authorization-server-v5");
        order.RentalCriteriaVersion.Should().Be("criteria-server-v6");
        order.PricingPolicyVersion.Should().Be("pricing-server-v7");
        order.UnitId.Should().Be(21);
        order.RequesterMemberRole.Should().Be("Manager");
        order.RequesterAuthorityVerifiedAt.Should().Be(Now);
        order.ApplicantAccessTokenHash.Should().HaveLength(64);
        order.ApplicantAccessExpiresAt.Should().Be(Now.AddDays(90));
        order.ApplicantAccessExpiresAt.Should().BeAfter(order.QuoteExpiresAt);
        order.ProviderOrderId.Should().BeNull();

        typeof(CreateTenantScreeningInvitationCommand).GetProperties().Select(x => x.Name).Should().NotContain(x =>
            x.Contains("Provider", StringComparison.OrdinalIgnoreCase) || x.Contains("Version", StringComparison.OrdinalIgnoreCase) || x.Contains("Policy", StringComparison.OrdinalIgnoreCase));
        typeof(StaffScreeningOrderResult).GetProperties().Select(x => x.Name).Should().NotContain(x =>
            new[] { "Token", "Link", "Uri", "Contact", "Hash", "Provider" }.Any(term => x.Contains(term, StringComparison.OrdinalIgnoreCase)));
    }

    [Theory]
    [InlineData("pricing-other", 4500, 750, true, 60)]
    [InlineData("pricing-server-v7", 5001, 750, true, 60)]
    [InlineData("pricing-server-v7", 4500, 751, true, 60)]
    [InlineData("pricing-server-v7", 4500, 1, false, 60)]
    [InlineData("pricing-server-v7", 4500, 750, true, 121)]
    public async Task Invalid_provider_quote_is_rejected_before_order_session_or_delivery(
        string version, long applicantAmount, long platformFee, bool markupPermitted, int lifetimeMinutes)
    {
        await using var h = await Harness.CreateAsync();
        h.Policy.Snapshot = Policy(markupPermitted: markupPermitted);
        h.Gateway.QuoteFactory = request => Quote(request, version, applicantAmount, platformFee, lifetimeMinutes);

        await h.Service.Invoking(x => x.CreateInvitationAsync(Command())).Should().ThrowAsync<ScreeningPolicyViolationException>();
        (await h.Db.TenantScreeningOrders.CountAsync()).Should().Be(0);
        h.Gateway.SessionRequests.Should().BeEmpty();
        h.Delivery.Requests.Should().BeEmpty();
    }

    [Fact]
    public async Task Applicant_reads_quote_and_policy_without_staff_or_provider_secrets()
    {
        await using var h = await Harness.CreateAsync();
        await h.Service.CreateInvitationAsync(Command());
        var rawToken = h.Delivery.Requests.Single().RawToken;

        var invitation = await h.Service.GetApplicantInvitationAsync(rawToken);

        invitation.QuoteReference.Should().Be("quote-reference-1");
        invitation.ApplicantAmountMinor.Should().Be(4500);
        invitation.PlatformFeeMinor.Should().Be(750);
        invitation.PermissiblePurposeStatement.Should().Be("Rental housing eligibility");
        invitation.DisclosureStatement.Should().Be("Disclosure text");
        invitation.AuthorizationStatement.Should().Be("Authorization text");
        typeof(ApplicantScreeningInvitationResult).GetProperties().Select(x => x.Name).Should().NotContain(x =>
            x.Contains("Requester", StringComparison.OrdinalIgnoreCase) || x.Contains("Organization", StringComparison.OrdinalIgnoreCase) ||
            x == "ProviderKey" || x == "ProviderOrderId" || x.Contains("Token", StringComparison.OrdinalIgnoreCase));
        invitation.ToString().Should().NotContain(rawToken).And.NotContain("quote-reference-1");
    }

    [Fact]
    public async Task Consent_hashes_network_evidence_starts_provider_once_and_never_persists_or_logs_raw_values()
    {
        await using var h = await Harness.CreateAsync();
        await h.Service.CreateInvitationAsync(Command());
        var token = h.Delivery.Requests.Single().RawToken;
        const string ip = "203.0.113.42";
        const string userAgent = "SecretBrowser/9.9";

        var started = await h.Service.ConsentAndStartAsync(token, "quote-reference-1", "disclosure-server-v4", "authorization-server-v5", ip, userAgent);

        started.Outcome.Should().Be(ScreeningConsentOutcome.Started);
        started.ContinuationUri.Should().Be(new Uri("https://screening.example.test/start?token=provider-secret"));
        h.Gateway.SessionRequests.Should().ContainSingle(x => x.ScreeningOrderId == started.OrderId);
        var order = await h.Db.TenantScreeningOrders.SingleAsync();
        order.Status.Should().Be(ScreeningStatus.PaymentPending);
        order.ProviderOrderId.Should().Be("provider-order-1");
        var evidence = await h.Db.ScreeningConsentEvidence.SingleAsync();
        var payment = await h.Db.ScreeningPaymentEvidence.SingleAsync();
        payment.Status.Should().Be(ScreeningPaymentEventStatus.AuthorizationInitiated);
        payment.Revision.Should().Be(1);
        payment.ApplicantAmountMinor.Should().Be(order.ApplicantAmountMinor);
        payment.QuoteReferenceHash.Should().HaveLength(64).And.NotContain("quote-reference-1");
        payment.PaymentOperationReferenceHash.Should().HaveLength(64).And.NotContain("payment-operation-1");
        evidence.IpAddressHash.Should().HaveLength(64).And.NotContain(ip);
        evidence.UserAgentHash.Should().HaveLength(64).And.NotContain(userAgent);
        evidence.QuoteReferenceHash.Should().HaveLength(64).And.NotContain("quote-reference-1");
        (order.ToString() + evidence + started).Should().NotContain(token).And.NotContain(ip).And.NotContain(userAgent).And.NotContain("provider-secret");
        ScreeningPersistenceTypes().SelectMany(t => t.GetProperties()).Should().NotContain(p =>
            p.Name.Contains("RawToken", StringComparison.OrdinalIgnoreCase) || p.Name.Contains("ContinuationUri", StringComparison.OrdinalIgnoreCase) || p.Name == "IpAddress" || p.Name == "UserAgent");
    }

    [Fact]
    public async Task Applicant_paid_order_cannot_advance_when_hosted_boundary_omits_payment_initiation_evidence()
    {
        await using var h = await Harness.CreateAsync();
        h.Gateway.OmitPaymentEvidence = true;
        await h.Service.CreateInvitationAsync(Command());
        var token = h.Delivery.Requests.Single().RawToken;

        await h.Service.Invoking(x => x.ConsentAndStartAsync(token, "quote-reference-1", "disclosure-server-v4",
                "authorization-server-v5", "ip", "ua"))
            .Should().ThrowAsync<ScreeningPaymentEvidenceException>();

        var order = await h.Db.TenantScreeningOrders.SingleAsync();
        order.Status.Should().Be(ScreeningStatus.ConsentPending);
        order.ProviderOrderId.Should().BeNull();
        (await h.Db.ScreeningPaymentEvidence.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task Landlord_paid_start_records_explicit_server_billing_responsibility_evidence()
    {
        await using var h = await Harness.CreateAsync();
        await h.Service.CreateInvitationAsync(new(10, 100, 30, "standard", ScreeningPayer.Landlord, "landlord-key"));
        var token = h.Delivery.Requests.Single().RawToken;

        await h.Service.ConsentAndStartAsync(token, "quote-reference-1", "disclosure-server-v4",
            "authorization-server-v5", "ip", "ua");

        var payment = await h.Db.ScreeningPaymentEvidence.SingleAsync();
        payment.Source.Should().Be(ScreeningPaymentEvidenceSource.ServerBillingResponsibility);
        payment.ActorUserId.Should().Be(100);
        payment.LandlordAmountMinor.Should().Be(4500);
        payment.ApplicantAmountMinor.Should().Be(0);
        (await h.Db.TenantScreeningOrders.SingleAsync()).Status.Should().Be(ScreeningStatus.Processing);
    }

    [Fact]
    public async Task Invitation_rejects_missing_or_mismatched_unit_and_requester_without_property_authority()
    {
        await using (var missing = await Harness.CreateAsync())
        {
            missing.Db.Units.Remove(await missing.Db.Units.SingleAsync());
            await missing.Db.SaveChangesAsync();
            await missing.Service.Invoking(x => x.CreateInvitationAsync(Command()))
                .Should().ThrowAsync<ScreeningResourceNotFoundException>();
        }

        await using (var mismatched = await Harness.CreateAsync())
        {
            (await mismatched.Db.Units.SingleAsync()).PropertyId = 999;
            await mismatched.Db.SaveChangesAsync();
            await mismatched.Service.Invoking(x => x.CreateInvitationAsync(Command()))
                .Should().ThrowAsync<ScreeningApplicationIneligibleException>();
        }

        await using (var unauthorized = await Harness.CreateAsync())
        {
            var property = await unauthorized.Db.Properties.SingleAsync();
            property.LandlordId = 999;
            property.PrimaryManagerId = 998;
            await unauthorized.Db.SaveChangesAsync();
            await unauthorized.Service.Invoking(x => x.CreateInvitationAsync(Command()))
                .Should().ThrowAsync<ScreeningAuthorizationException>();
        }
    }

    [Theory]
    [InlineData("wrong-quote", "disclosure-server-v4", "authorization-server-v5")]
    [InlineData("quote-reference-1", "wrong-disclosure", "authorization-server-v5")]
    [InlineData("quote-reference-1", "disclosure-server-v4", "wrong-authorization")]
    public async Task Consent_mismatch_is_rejected_before_evidence_and_provider(string quote, string disclosure, string authorization)
    {
        await using var h = await Harness.CreateAsync();
        await h.Service.CreateInvitationAsync(Command());
        var token = h.Delivery.Requests.Single().RawToken;

        await h.Service.Invoking(x => x.ConsentAndStartAsync(token, quote, disclosure, authorization, "203.0.113.1", "ua"))
            .Should().ThrowAsync<ScreeningConsentMismatchException>();
        h.Gateway.SessionRequests.Should().BeEmpty();
        (await h.Db.ScreeningConsentEvidence.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task Expired_access_and_expired_quote_are_enforced_independently_before_provider()
    {
        await using (var expiredAccess = await Harness.CreateAsync())
        {
            await expiredAccess.Service.CreateInvitationAsync(Command());
            var token = expiredAccess.Delivery.Requests.Single().RawToken;
            var stored = await expiredAccess.Db.TenantScreeningOrders.SingleAsync();
            stored.ApplicantAccessExpiresAt = Now.AddMinutes(-1);
            await expiredAccess.Db.SaveChangesAsync();

            await expiredAccess.Service.Invoking(x => x.GetApplicantInvitationAsync(token))
                .Should().ThrowAsync<ScreeningAccessExpiredException>();
            expiredAccess.Gateway.SessionRequests.Should().BeEmpty();
        }

        await using (var expiredQuote = await Harness.CreateAsync())
        {
            await expiredQuote.Service.CreateInvitationAsync(Command());
            var token = expiredQuote.Delivery.Requests.Single().RawToken;
            var stored = await expiredQuote.Db.TenantScreeningOrders.SingleAsync();
            stored.QuoteExpiresAt = Now.AddMinutes(-1);
            await expiredQuote.Db.SaveChangesAsync();

            (await expiredQuote.Service.GetApplicantInvitationAsync(token)).QuoteExpiresAt.Should().BeBefore(Now);
            await expiredQuote.Service.Invoking(x => x.ConsentAndStartAsync(token, "quote-reference-1", "disclosure-server-v4", "authorization-server-v5", "ip", "ua"))
                .Should().ThrowAsync<ScreeningInvitationExpiredException>();
            expiredQuote.Gateway.SessionRequests.Should().BeEmpty();
        }
    }

    [Fact]
    public async Task Consent_retry_does_not_create_second_provider_order_or_leak_stale_uri()
    {
        await using var h = await Harness.CreateAsync();
        await h.Service.CreateInvitationAsync(Command());
        var token = h.Delivery.Requests.Single().RawToken;
        var first = await h.Service.ConsentAndStartAsync(token, "quote-reference-1", "disclosure-server-v4", "authorization-server-v5", "ip", "ua");

        var retry = await h.Service.ConsentAndStartAsync(token, "quote-reference-1", "disclosure-server-v4", "authorization-server-v5", "ip", "ua");

        first.Outcome.Should().Be(ScreeningConsentOutcome.Started);
        retry.Outcome.Should().Be(ScreeningConsentOutcome.AlreadyStarted);
        retry.ContinuationUri.Should().BeNull();
        h.Gateway.SessionRequests.Should().ContainSingle();
        (await h.Db.ScreeningConsentEvidence.CountAsync()).Should().Be(1);
    }

    [Fact]
    public async Task Delivery_failure_remains_consent_pending_and_retry_rotates_token_without_provider_call()
    {
        await using var h = await Harness.CreateAsync();
        h.Delivery.FailNext = true;
        var failure = await h.Service.Invoking(x => x.CreateInvitationAsync(Command())).Should().ThrowAsync<ScreeningDeliveryException>();
        var order = await h.Db.TenantScreeningOrders.SingleAsync();
        var failedToken = h.Delivery.Requests.Single().RawToken;
        var failedHash = order.ApplicantAccessTokenHash;
        order.Status.Should().Be(ScreeningStatus.ConsentPending);

        await h.Service.RetryInvitationDeliveryAsync(10, 100, failure.Which.OrderId);

        h.Delivery.Requests.Should().HaveCount(2);
        h.Delivery.Requests[1].RawToken.Should().NotBe(failedToken);
        order.ApplicantAccessTokenHash.Should().NotBe(failedHash);
        h.Gateway.SessionRequests.Should().BeEmpty();
        await h.Service.Invoking(x => x.GetApplicantInvitationAsync(failedToken)).Should().ThrowAsync<ScreeningInvalidInvitationException>();
        (failure.Which.ToString() + order).Should().NotContain(failedToken);
    }

    [Fact]
    public async Task Staff_authorization_and_scoped_idempotency_are_preserved()
    {
        await using var h = await Harness.CreateAsync(role: "Viewer");
        await h.Service.Invoking(x => x.CreateInvitationAsync(Command())).Should().ThrowAsync<ScreeningAuthorizationException>();
        h.Gateway.CallCount.Should().Be(0);

        await using var authorized = await Harness.CreateAsync();
        var first = await authorized.Service.CreateInvitationAsync(Command());
        var replay = await authorized.Service.CreateInvitationAsync(Command());
        replay.Should().Be(first);
        authorized.Gateway.QuoteRequests.Should().ContainSingle();
        authorized.Delivery.Requests.Should().ContainSingle();
        var conflict = new CreateTenantScreeningInvitationCommand(10, 100, 30, "premium", ScreeningPayer.Applicant, "raw-key");
        await authorized.Service.Invoking(x => x.CreateInvitationAsync(conflict)).Should().ThrowAsync<ScreeningIdempotencyConflictException>();
    }

    private static Type[] ScreeningPersistenceTypes() =>
        [typeof(TenantScreeningOrder), typeof(ScreeningConsentEvidence), typeof(ScreeningPaymentEvidence), typeof(ScreeningTransitionEvent), typeof(ScreeningWebhookInboxEvent)];

    private static CreateTenantScreeningInvitationCommand Command() => new(10, 100, 30, "standard", ScreeningPayer.Applicant, "raw-key");

    private static ScreeningPolicySnapshot Policy(bool markupPermitted = true) => new(
        "server-provider", "Rental housing eligibility", "purpose-server-v3", "Disclosure text", "disclosure-server-v4",
        "Authorization text", "authorization-server-v5", "Criteria text", "criteria-server-v6", "pricing-server-v7",
        "standard", ["credit", "criminal", "eviction"], 5000, applicantTotalExpresslyUnrestricted: false,
        maximumPlatformFeeMinor: 750, markupPermitted, TimeSpan.FromMinutes(5), TimeSpan.FromMinutes(120));

    private static AuthoritativeScreeningQuote Quote(ScreeningQuoteRequest request, string version = "pricing-server-v7",
        long applicantAmount = 4500, long platformFee = 750, int lifetimeMinutes = 60)
    {
        var provider = applicantAmount - platformFee - 250;
        return AuthoritativeScreeningQuote.Create(request, "quote-reference-1", request.Payer,
            request.Payer == ScreeningPayer.Landlord ? applicantAmount : 0,
            request.Payer == ScreeningPayer.Applicant ? applicantAmount : 0,
            provider, platformFee, 250, "USD", Now.AddMinutes(lifetimeMinutes), version, Now);
    }

    private sealed class Harness : IAsyncDisposable
    {
        private Harness(DataContext db, Gateway gateway, PolicyResolver policy, Delivery delivery, TenantScreeningService service)
            => (Db, Gateway, Policy, Delivery, Service) = (db, gateway, policy, delivery, service);
        public DataContext Db { get; }
        public Gateway Gateway { get; }
        public PolicyResolver Policy { get; }
        public Delivery Delivery { get; }
        public TenantScreeningService Service { get; }

        public static async Task<Harness> CreateAsync(string role = "Manager", DateTimeOffset? now = null, DateTimeOffset? clockNow = null)
        {
            var db = new DataContext(new DbContextOptionsBuilder<DataContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
            db.Organizations.Add(new Organization { Id = 10, Name = "Org" });
            db.Users.Add(new User { Id = 100, Email = "staff@test.invalid", FirstName = "Staff", LastName = "User" });
            db.OrganizationMembers.Add(new OrganizationMember { Id = 11, OrganizationId = 10, UserId = 100, Role = role, IsActive = true });
            db.Properties.Add(new Property { Id = 20, OrganizationId = 10, LandlordId = 100, State = "CA", StreetAddress = "1 Main", City = "X", ZipCode = "00000" });
            db.Units.Add(new Unit { Id = 21, PropertyId = 20, Name = "A" });
            db.RentalApplications.Add(new RentalApplication { Id = 30, OrganizationId = 10, PropertyId = 20, UnitId = 21, LandlordId = 100,
                Status = EApplicationStatus.Submitted, FirstName = "Ada", LastName = "Lovelace", Email = "applicant@test.invalid",
                DateOfBirth = new DateTime(1990, 1, 1) });
            await db.SaveChangesAsync();
            db.ChangeTracker.Clear();
            var quoteNow = now ?? Now;
            var gateway = new Gateway(request => Quote(request));
            var policy = new PolicyResolver { Snapshot = Policy() };
            var delivery = new Delivery();
            var service = new TenantScreeningService(db, gateway, policy, delivery, new LinkFactory(), new Verifier(quoteNow),
                new FixedTimeProvider(clockNow ?? quoteNow));
            return new Harness(db, gateway, policy, delivery, service);
        }
        public ValueTask DisposeAsync() => Db.DisposeAsync();
    }

    private sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider { public override DateTimeOffset GetUtcNow() => now; }
    private sealed class PolicyResolver : IScreeningPolicyResolver
    {
        public ScreeningPolicySnapshot Snapshot { get; set; } = null!;
        public Task<ScreeningPolicySnapshot> ResolveAsync(ScreeningPolicyResolutionRequest request, CancellationToken cancellationToken = default) => Task.FromResult(Snapshot);
    }
    private sealed class LinkFactory : IScreeningApplicantLinkFactory
    {
        public Uri CreateApplicantAccessLink(string rawToken) => new($"https://apply.propertypeace.test/screening?access={Uri.EscapeDataString(rawToken)}");
    }
    private sealed class Delivery : IScreeningApplicantInvitationDelivery
    {
        public bool FailNext { get; set; }
        public List<ScreeningApplicantInvitationDeliveryRequest> Requests { get; } = [];
        public Task DeliverAsync(ScreeningApplicantInvitationDeliveryRequest request, CancellationToken cancellationToken = default)
        {
            Requests.Add(request);
            if (FailNext) { FailNext = false; throw new InvalidOperationException("mail failed with secret details"); }
            return Task.CompletedTask;
        }
    }
    private sealed class Gateway(Func<ScreeningQuoteRequest, AuthoritativeScreeningQuote> quoteFactory) : IScreeningProviderGateway
    {
        public Func<ScreeningQuoteRequest, AuthoritativeScreeningQuote> QuoteFactory { get; set; } = quoteFactory;
        public List<ScreeningQuoteRequest> QuoteRequests { get; } = [];
        public List<CreateApplicantScreeningSessionRequest> SessionRequests { get; } = [];
        public int CallCount => QuoteRequests.Count + SessionRequests.Count;
        public bool OmitPaymentEvidence { get; set; }
        public Task<AuthoritativeScreeningQuote> GetAuthoritativeQuoteAsync(ScreeningQuoteRequest request, CancellationToken cancellationToken = default)
        { QuoteRequests.Add(request); return Task.FromResult(QuoteFactory(request)); }
        public Task<ApplicantHostedSessionResult> CreateApplicantHostedSessionAsync(CreateApplicantScreeningSessionRequest request, CancellationToken cancellationToken = default)
        {
            SessionRequests.Add(request);
            var payment = OmitPaymentEvidence ? null : new ScreeningPaymentOperationEvidence(
                "payment-operation-1", ScreeningPaymentEventStatus.AuthorizationInitiated,
                Now, failureCode: null, Now);
            return Task.FromResult(new ApplicantHostedSessionResult("provider-order-1", new Uri("https://screening.example.test/start?token=provider-secret"),
                Now.AddMinutes(15), [new Uri("https://screening.example.test")], Now, payment));
        }
        public Task<NormalizedScreeningStatusUpdate> GetStatusAsync(ScreeningStatusRequest request, CancellationToken cancellationToken = default) =>
            Task.FromResult(new NormalizedScreeningStatusUpdate(request.ProviderOrderId, ScreeningStatus.PaymentPending, Now, null, Now));
    }
    private sealed class Verifier(DateTimeOffset now) : IScreeningCallbackVerifier
    {
        public ValueTask<VerifiedScreeningCallbackEnvelope> VerifyAsync(string providerKey, ScreeningCallbackRequest request, CancellationToken cancellationToken = default) => throw new NotSupportedException();
    }
}
