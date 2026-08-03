using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.StripeRentPayments;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.StripeRentPayments;

public sealed class StripeRentPaymentFlowTests
{
    [Fact]
    public async Task CreateAsync_CreatesPlatformIntentAndPersistsAuthorizedReservation()
    {
        await using var context = CreateContext();
        await SeedLeaseAsync(context, 44, 9);
        var gateway = IntentGateway("pi_123");
        StripeRentIntentRequest? captured = null;
        gateway.Setup(x => x.CreatePaymentIntentAsync(It.IsAny<StripeRentIntentRequest>(), It.IsAny<CancellationToken>()))
            .Callback<StripeRentIntentRequest, CancellationToken>((request, _) => captured = request)
            .ReturnsAsync(new StripeRentIntentResult("pi_123", "secret_123"));

        var result = await CreateService(context, gateway.Object, true).CreateAsync(
            new(44, 9, 7, "op_123", 125_00, "usd", "acct_snapshot", "July rent"));

        result.PaymentIntentId.Should().Be("pi_123");
        captured!.IdempotencyKey.Should().Be("rent-payment:op_123");
        var stored = await context.StripeRentPayments.SingleAsync();
        stored.DestinationStripeAccountId.Should().Be("acct_snapshot");
        stored.Status.Should().Be(StripeRentPaymentStatus.Created);
    }

    [Fact]
    public async Task CreateAsync_RejectsPayeeWithoutInternalApprovalBeforeStripe()
    {
        await using var context = CreateContext();
        await SeedLeaseAsync(context, 44, 9);
        var gateway = IntentGateway("pi_unapproved");
        var connectedGateway = new Mock<IStripeConnectedAccountGateway>();
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Stripe:RentPaymentsEnabled"] = "true"
        }).Build();
        var risk = new StripeRentRiskService(context, connectedGateway.Object, configuration, TimeProvider.System);

        var act = () => CreateService(context, gateway.Object, true, risk).CreateAsync(
            new(44, 9, 7, "op_unapproved", 125_00, "usd", "acct_unapproved", "July rent"));

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*not eligible for rent collection*");
        gateway.VerifyNoOtherCalls();
        connectedGateway.VerifyNoOtherCalls();
        (await context.StripeRentPayments.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task CreateAsync_ReplayRechecksPayeeEligibilityBeforeStripe()
    {
        await using var context = CreateContext();
        await SeedLeaseAsync(context, 44, 9);
        var gateway = IntentGateway("pi_replay");
        var risk = new Mock<IStripeRentRiskService>();
        risk.SetupSequence(x => x.EvaluateCollectionPayeeAsync(It.IsAny<StripeRentPayment>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RentTransferRiskDecision.Allow())
            .ReturnsAsync(RentTransferRiskDecision.Deny("approval revoked"));
        var service = CreateService(context, gateway.Object, true, risk.Object);
        var command = new CreateStripeRentPaymentCommand(
            44, 9, 7, "op_replay", 125_00, "usd", "acct_replay", "July rent");
        await service.CreateAsync(command);

        var replay = () => service.CreateAsync(command);

        await replay.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*not eligible for rent collection*");
        gateway.Verify(x => x.CreatePaymentIntentAsync(It.IsAny<StripeRentIntentRequest>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task UpdateAsync_RechecksPayeeEligibilityBeforeStripe()
    {
        await using var context = CreateContext();
        await SeedLeaseAsync(context, 1, 2);
        var payment = NewPayment("pi_update_denied");
        context.StripeRentPayments.Add(payment);
        await context.SaveChangesAsync();
        var gateway = new Mock<IStripeRentGateway>();
        gateway.Setup(x => x.UpdatePaymentIntentAsync(payment.PaymentIntentId, It.IsAny<StripeRentIntentRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new StripeRentIntentResult(payment.PaymentIntentId, "secret"));
        var risk = new Mock<IStripeRentRiskService>();
        risk.Setup(x => x.EvaluateCollectionPayeeAsync(It.IsAny<StripeRentPayment>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RentTransferRiskDecision.Deny("approval revoked"));

        var act = () => CreateService(context, gateway.Object, true, risk.Object)
            .UpdateAsync(new(payment.PaymentIntentId, payment.LeaseId, payment.TenantUserId, 5_000, null));

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*not eligible for rent collection*");
        gateway.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task CreateAsync_RejectsDestinationThatIsNoLongerAssignedToLease()
    {
        await using var context = CreateContext();
        await SeedLeaseAsync(context, 44, 9);
        await SeedLeaseDestinationAsync(context, 44, 9, "acct_current");
        context.StripeConnectedPayeeReviews.Add(new StripeConnectedPayeeReview
        {
            UserId = 42,
            StripeAccountId = "acct_stale",
            Status = StripePayeeReviewStatus.PayoutApproved,
            PropertyAuthorityAttested = true,
            ApprovedOrganizationId = 9,
            ApprovedAt = DateTimeOffset.UtcNow.AddDays(-1),
            CreatedAt = DateTimeOffset.UtcNow.AddDays(-2),
            UpdatedAt = DateTimeOffset.UtcNow,
            ExternalAccountFingerprint = "fp_stale",
            PayoutSchedulePolicy = "manual"
        });
        context.OrganizationMembers.Add(new OrganizationMember
        {
            UserId = 42, OrganizationId = 9, Role = "Owner", IsActive = true
        });
        await context.SaveChangesAsync();
        var connectedGateway = new Mock<IStripeConnectedAccountGateway>();
        connectedGateway.Setup(x => x.GetSnapshotAsync("acct_stale", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new StripeConnectedAccountSnapshot("acct_stale", DateTimeOffset.UtcNow,
                true, true, true, "active", [], [], null, "fp_stale", "manual", false));
        var risk = new StripeRentRiskService(context, connectedGateway.Object,
            new ConfigurationBuilder().Build(), TimeProvider.System);
        var gateway = IntentGateway("pi_stale_destination");

        var act = () => CreateService(context, gateway.Object, true, risk).CreateAsync(
            new(44, 9, 7, "op_stale_destination", 125_00, "usd", "acct_stale", "July rent"));

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*not eligible for rent collection*");
        gateway.VerifyNoOtherCalls();
        (await context.StripeRentPayments.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task CreateAsync_RejectsAmountAboveOutstandingAndExistingReservationsBeforeStripe()
    {
        await using var context = CreateContext();
        await SeedLeaseAsync(context, 1, 2, rent: 50m, startMonthsAgo: 1);
        var reserved = NewPayment("pi_reserved");
        reserved.AmountCents = 6_000;
        context.StripeRentPayments.Add(reserved);
        await context.SaveChangesAsync();
        var gateway = new Mock<IStripeRentGateway>();

        var act = () => CreateService(context, gateway.Object, true).CreateAsync(
            new(1, 2, 3, "op_over", 5_000, "usd", "acct_landlord", null));

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*outstanding balance*reservations*");
        gateway.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task UpdateAsync_ExcludesOwnReservationButHonorsOtherReservations()
    {
        await using var context = CreateContext();
        await SeedLeaseAsync(context, 1, 2, rent: 50m, startMonthsAgo: 2);
        var own = NewPayment("pi_own"); own.AmountCents = 4_000;
        var other = NewPayment("pi_other"); other.OperationId = "op_other"; other.AmountCents = 3_000;
        context.AddRange(own, other); await context.SaveChangesAsync();
        var gateway = new Mock<IStripeRentGateway>();
        gateway.Setup(x => x.UpdatePaymentIntentAsync("pi_own", It.IsAny<StripeRentIntentRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new StripeRentIntentResult("pi_own", "secret"));
        var service = CreateService(context, gateway.Object, true);
        var outstandingCents = checked((long)decimal.Round(
            (await brownstone_hub_api.Utils.RentCalculator.GetOutstandingForTenantAsync(context, 1)) * 100m,
            0,
            MidpointRounding.AwayFromZero));
        var availableAfterOtherReservation = outstandingCents - other.AmountCents;

        await service.UpdateAsync(new("pi_own", 1, 3, availableAfterOtherReservation, null));
        var tooMuch = () => service.UpdateAsync(new UpdateStripeRentPaymentCommand(
            "pi_own", 1, 3, availableAfterOtherReservation + 1, null));

        (await context.StripeRentPayments.SingleAsync(x => x.PaymentIntentId == "pi_own")).AmountCents.Should().Be(availableAfterOtherReservation);
        await tooMuch.Should().ThrowAsync<InvalidOperationException>();
    }

    [Fact]
    public async Task CreateAsync_RejectsRevokedTenantMembershipInsideReservationBoundary()
    {
        await using var context = CreateContext();
        await SeedLeaseAsync(context, 44, 9);
        var memberships = await context.TenantLeases.ToListAsync();
        context.TenantLeases.RemoveRange(memberships);
        await context.SaveChangesAsync();
        var gateway = new Mock<IStripeRentGateway>();

        var act = () => CreateService(context, gateway.Object, true).CreateAsync(
            new(44, 9, 7, "op_revoked", 5_000, "usd", "acct_snapshot", null));

        await act.Should().ThrowAsync<UnauthorizedAccessException>().WithMessage("*tenant*lease*");
        gateway.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task CreateAsync_DoesNotDoubleSubtractCompletedAllocationOrCountFeeAndProcessingRowsAsRent()
    {
        await using var context = CreateContext();
        await SeedLeaseAsync(context, 1, 2, rent: 50m, startMonthsAgo: 1);
        context.Payments.AddRange(
            new Payment { LeaseId = 1, PropertyId = 1, OrganizationId = 2, Amount = 40m, PaymentDate = DateTime.UtcNow, Status = "Completed" },
            new Payment { LeaseId = 1, PropertyId = 1, OrganizationId = 2, Amount = 90m, PaymentDate = DateTime.UtcNow, Status = "Completed", FeeId = 55 },
            new Payment { LeaseId = 1, PropertyId = 1, OrganizationId = 2, Amount = 90m, PaymentDate = DateTime.UtcNow, Status = "Processing" });
        var held = NewPayment("pi_held");
        held.AmountCents = 4_000;
        held.Status = StripeRentPaymentStatus.Held;
        held.AllocationCompletedAt = DateTimeOffset.UtcNow;
        context.StripeRentPayments.Add(held);
        await context.SaveChangesAsync();
        var gateway = IntentGateway("pi_remaining");
        var outstanding = await brownstone_hub_api.Utils.RentCalculator.GetOutstandingForTenantAsync(context, 1);
        outstanding.Should().BeGreaterThanOrEqualTo(8m);
        (await context.StripeRentPayments.Where(x => x.Status == StripeRentPaymentStatus.Created).SumAsync(x => x.AmountCents)).Should().Be(0);

        var result = await CreateService(context, gateway.Object, true).CreateAsync(
            new(1, 2, 3, "op_remaining", 800, "usd", "acct_landlord", null));

        result.PaymentIntentId.Should().Be("pi_remaining");
    }

    [Fact]
    public async Task CreateAsync_ConcurrentReplayUsesOneLedgerAndStableStripeIdempotency()
    {
        var database = Guid.NewGuid().ToString();
        await using var setup = CreateContext(database); await SeedLeaseAsync(setup, 44, 9);
        var gateway = IntentGateway("pi_race");
        await using var firstContext = CreateContext(database);
        await using var secondContext = CreateContext(database);
        var command = new CreateStripeRentPaymentCommand(44, 9, 7, "op_race", 10_000, "usd", "acct_snapshot", null);

        var results = await Task.WhenAll(CreateService(firstContext, gateway.Object, true).CreateAsync(command),
            CreateService(secondContext, gateway.Object, true).CreateAsync(command));

        results.Select(x => x.PaymentIntentId).Should().OnlyContain(x => x == "pi_race");
        await using var verify = CreateContext(database);
        (await verify.StripeRentPayments.CountAsync()).Should().Be(1);
        gateway.Verify(x => x.CreatePaymentIntentAsync(It.Is<StripeRentIntentRequest>(r => r.IdempotencyKey == "rent-payment:op_race"),
            It.IsAny<CancellationToken>()), Times.Exactly(2));
    }

    [Fact]
    public async Task CreateAsync_SerializesCollectionEligibilityAcrossLeasesForSamePayee()
    {
        var database = Guid.NewGuid().ToString();
        await using (var setup = CreateContext(database))
        {
            await SeedLeaseAsync(setup, 44, 9);
            await SeedLeaseDestinationAsync(setup, 44, 9, "acct_shared");
            await SeedLeaseAsync(setup, 45, 9);
            await SeedLeaseDestinationAsync(setup, 45, 9, "acct_shared");
        }
        var gateway = new Mock<IStripeRentGateway>();
        gateway.Setup(x => x.CreatePaymentIntentAsync(It.IsAny<StripeRentIntentRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((StripeRentIntentRequest request, CancellationToken _) =>
                new StripeRentIntentResult($"pi_{request.IdempotencyKey}", "secret"));
        var risk = new Mock<IStripeRentRiskService>();
        var inFlight = 0;
        var maxInFlight = 0;
        risk.Setup(x => x.EvaluateCollectionPayeeAsync(It.IsAny<StripeRentPayment>(), It.IsAny<CancellationToken>()))
            .Returns(async () =>
            {
                var current = Interlocked.Increment(ref inFlight);
                int observed;
                while (current > (observed = Volatile.Read(ref maxInFlight)))
                    Interlocked.CompareExchange(ref maxInFlight, current, observed);
                await Task.Delay(75);
                Interlocked.Decrement(ref inFlight);
                return RentTransferRiskDecision.Allow();
            });
        await using var firstContext = CreateContext(database);
        await using var secondContext = CreateContext(database);

        await Task.WhenAll(
            CreateService(firstContext, gateway.Object, true, risk.Object).CreateAsync(
                new(44, 9, 7, "op_shared_44", 10_000, "usd", "acct_shared", null)),
            CreateService(secondContext, gateway.Object, true, risk.Object).CreateAsync(
                new(45, 9, 7, "op_shared_45", 10_000, "usd", "acct_shared", null)));

        maxInFlight.Should().Be(1);
    }

    [Fact]
    public async Task ValidateSucceededAsync_RejectsChargeWithoutExactDurableAuthority()
    {
        await using var context = CreateContext();
        context.Add(NewPayment("pi_authority"));
        await context.SaveChangesAsync();
        var service = CreateService(context, Mock.Of<IStripeRentGateway>(), true);
        var mismatched = new StripeRentPaymentSettlementAuthority(
            "pi_authority", "ch_1", 99_99, "usd", 1, 2, 3, "op_pi_authority", DateTime.UtcNow);

        var act = () => service.ValidateSucceededAsync(mismatched);

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*durable server authority*");
        (await context.StripeRentPayments.SingleAsync()).Status.Should().Be(StripeRentPaymentStatus.Created);
    }

    [Fact]
    public async Task MarkSucceededAsync_RequiresCompletedAllocation()
    {
        await using var context = CreateContext();
        context.Add(NewPayment("pi_unallocated")); await context.SaveChangesAsync();
        var gateway = new Mock<IStripeRentGateway>(); gateway.Setup(x => x.GetPaymentMethodTypeAsync("pi_unallocated", It.IsAny<CancellationToken>())).ReturnsAsync("card");

        var act = () => CreateService(context, gateway.Object, true).MarkSucceededAsync(new("pi_unallocated", "ch_1", "card", DateTimeOffset.UtcNow));

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*allocation*");
        (await context.StripeRentPayments.SingleAsync()).Status.Should().Be(StripeRentPaymentStatus.Created);
    }

    [Theory]
    [InlineData("card", 7)]
    [InlineData("us_bank_account", 14)]
    public async Task MarkSucceededAsync_UsesConservativeElapsedHoldThatGuaranteesMinimumBusinessDays(string actualMethod, int elapsedDays)
    {
        await using var context = CreateContext();
        context.Add(NewPayment("pi_hold")); AddAllocation(context, "pi_hold"); await context.SaveChangesAsync();
        var gateway = new Mock<IStripeRentGateway>();
        gateway.Setup(x => x.GetPaymentMethodTypeAsync("pi_hold", It.IsAny<CancellationToken>())).ReturnsAsync(actualMethod);
        var succeededAt = new DateTimeOffset(2026, 7, 31, 16, 0, 0, TimeSpan.Zero);

        await CreateService(context, gateway.Object, true).MarkSucceededAsync(new("pi_hold", "ch_1", "misleading-advertised-type", succeededAt));

        var stored = await context.StripeRentPayments.SingleAsync();
        stored.Status.Should().Be(StripeRentPaymentStatus.Held);
        stored.PaymentMethodType.Should().Be(actualMethod);
        stored.TransferEligibleAt.Should().Be(succeededAt.AddDays(elapsedDays));
        stored.AllocationCompletedAt.Should().NotBeNull();
    }

    [Theory]
    [InlineData(StripeRentPaymentStatus.Blocked)]
    [InlineData(StripeRentPaymentStatus.Failed)]
    [InlineData(StripeRentPaymentStatus.Canceled)]
    public async Task MarkSucceededAsync_DoesNotResurrectTerminalState(StripeRentPaymentStatus terminal)
    {
        await using var context = CreateContext();
        var payment = NewPayment("pi_terminal"); payment.Status = terminal;
        context.Add(payment); AddAllocation(context, "pi_terminal"); await context.SaveChangesAsync();
        var gateway = new Mock<IStripeRentGateway>();

        await CreateService(context, gateway.Object, true).MarkSucceededAsync(new("pi_terminal", "ch_late", "card", DateTimeOffset.UtcNow));

        (await context.StripeRentPayments.SingleAsync()).Status.Should().Be(terminal);
        gateway.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task DisputeBeforeSuccess_DurablyBlocksEvenWithoutAllocation_AndLateSuccessCannotRelease()
    {
        await using var context = CreateContext(); context.Add(NewPayment("pi_dispute")); await context.SaveChangesAsync();
        var gateway = new Mock<IStripeRentGateway>(); var service = CreateService(context, gateway.Object, true);

        await service.MarkBlockedAsync("pi_dispute", "ch_1", StripeRentPaymentBlockKind.Dispute, "dp_1", "open dispute");
        AddAllocation(context, "pi_dispute"); await context.SaveChangesAsync();
        await service.MarkSucceededAsync(new("pi_dispute", "ch_1", "card", DateTimeOffset.UtcNow));

        var stored = await context.StripeRentPayments.SingleAsync();
        stored.Status.Should().Be(StripeRentPaymentStatus.Blocked);
        stored.DisputedAt.Should().NotBeNull();
        stored.StripeDisputeId.Should().Be("dp_1");
        stored.TransferEligibleAt.Should().BeNull();
    }

    [Fact]
    public async Task RefundAfterSuccess_BlocksReleaseUsingDurableAggregate()
    {
        await using var context = CreateContext(); context.Add(NewPayment("pi_refund")); AddAllocation(context, "pi_refund"); await context.SaveChangesAsync();
        var gateway = new Mock<IStripeRentGateway>(); gateway.Setup(x => x.GetPaymentMethodTypeAsync("pi_refund", It.IsAny<CancellationToken>())).ReturnsAsync("card");
        var service = CreateService(context, gateway.Object, true);
        await service.MarkSucceededAsync(new("pi_refund", "ch_refund", "card", DateTimeOffset.UtcNow));

        await service.MarkBlockedAsync(null, "ch_refund", StripeRentPaymentBlockKind.Refund, "re_1", "refunded");

        var stored = await context.StripeRentPayments.SingleAsync();
        stored.Status.Should().Be(StripeRentPaymentStatus.Blocked);
        stored.RefundedAt.Should().NotBeNull();
        stored.StripeRefundId.Should().Be("re_1");
    }

    [Fact]
    public async Task CreateAsync_WhenPaymentsSwitchMissing_FailsClosedWithoutCallingStripe()
    {
        await using var context = CreateContext(); var gateway = new Mock<IStripeRentGateway>();
        var act = () => CreateService(context, gateway.Object, null).CreateAsync(new(1, 2, 3, "op_disabled", 100, "usd", "acct_1", null));
        await act.Should().ThrowAsync<RentPaymentsDisabledException>(); gateway.VerifyNoOtherCalls();
    }

    private static Mock<IStripeRentGateway> IntentGateway(string id)
    {
        var gateway = new Mock<IStripeRentGateway>();
        gateway.Setup(x => x.CreatePaymentIntentAsync(It.IsAny<StripeRentIntentRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new StripeRentIntentResult(id, $"secret_{id}"));
        return gateway;
    }

    private static void AddAllocation(DataContext context, string intent, decimal amount = 100m) => context.Payments.Add(new Payment
    {
        LeaseId = 1, PropertyId = 1, OrganizationId = 2, Amount = amount, PaymentDate = DateTime.UtcNow,
        Reference = intent, StripePaymentIntentId = intent, Status = "Completed"
    });

    internal static async Task SeedLeaseAsync(DataContext context, long leaseId, long organizationId, decimal rent = 1_000m, int startMonthsAgo = 2)
    {
        var lease = new Lease { Id = leaseId, UnitId = leaseId, OrganizationId = organizationId, IsActive = true,
            StartDate = DateTime.Today.AddMonths(-startMonthsAgo), EndDate = DateTime.Today.AddYears(1), RentAmount = rent, RentFrequency = "Monthly" };
        context.Leases.Add(lease);
        foreach (var userId in new long[] { 3, 7 })
        {
            var tenant = new Tenant { Id = leaseId * 100 + userId, UserId = userId, OrganizationId = organizationId,
                Firstname = "Test", Lastname = "Tenant" };
            context.Tenants.Add(tenant);
            context.TenantLeases.Add(new TenantLease { TenantId = tenant.Id, LeaseId = leaseId });
        }
        await context.SaveChangesAsync();
    }

    internal static async Task SeedLeaseDestinationAsync(DataContext context, long leaseId, long organizationId, string stripeAccountId)
    {
        var landlord = new User
        {
            Id = 10_000 + leaseId,
            Email = $"landlord-{leaseId}@example.test",
            StripeAccountEnabled = true,
            StripeAccountId = stripeAccountId
        };
        var property = new Property
        {
            Id = 20_000 + leaseId,
            LandlordId = landlord.Id,
            Landlord = landlord,
            OrganizationId = organizationId
        };
        context.Units.Add(new Unit
        {
            Id = leaseId,
            PropertyId = property.Id,
            Property = property,
            OrganizationId = organizationId
        });
        await context.SaveChangesAsync();
    }

    internal static StripeRentPaymentService CreateService(DataContext context, IStripeRentGateway gateway, bool? paymentsEnabled,
        IStripeRentRiskService? risk = null, bool? transfersEnabled = null, TimeProvider? time = null, Dictionary<string, string?>? extras = null)
    {
        var values = extras ?? new Dictionary<string, string?>();
        if (paymentsEnabled.HasValue) values["Stripe:RentPaymentsEnabled"] = paymentsEnabled.Value.ToString();
        if (transfersEnabled.HasValue) values["Stripe:TransfersEnabled"] = transfersEnabled.Value.ToString();
        if (risk == null)
        {
            var permissiveRisk = new Mock<IStripeRentRiskService>();
            permissiveRisk.Setup(x => x.EvaluateCollectionPayeeAsync(It.IsAny<StripeRentPayment>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(RentTransferRiskDecision.Allow());
            risk = permissiveRisk.Object;
        }
        return new(context, gateway, risk, new ConfigurationBuilder().AddInMemoryCollection(values).Build(),
            time ?? TimeProvider.System, Mock.Of<ILogger<StripeRentPaymentService>>());
    }

    internal static DataContext CreateContext(string? databaseName = null) => new(new DbContextOptionsBuilder<DataContext>()
        .UseInMemoryDatabase(databaseName ?? Guid.NewGuid().ToString()).Options);

    internal static StripeRentPayment NewPayment(string intentId) => new()
    {
        OperationId = $"op_{intentId}", PaymentIntentId = intentId, LeaseId = 1, OrganizationId = 2, TenantUserId = 3,
        AmountCents = 100_00, Currency = "usd", DestinationStripeAccountId = "acct_landlord",
        Status = StripeRentPaymentStatus.Created, CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow
    };
}
