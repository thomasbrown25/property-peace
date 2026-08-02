using brownstone_hub_api.Models;
using brownstone_hub_api.Services.StripeRentPayments;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.StripeRentPayments;

public sealed class StripeConnectedPayeeRiskTests
{
    private static readonly DateTimeOffset Now = new(2026, 8, 2, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task Registration_DetailsSubmitted_IsStripeVerifiedButNeverPayoutApproved()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        var service = new StripeConnectedPayeeService(context, new FixedTimeProvider(Now));

        await service.RegisterAsync(42, "acct_new", detailsSubmitted: true);

        var review = context.StripeConnectedPayeeReviews.Single();
        review.Status.Should().Be(StripePayeeReviewStatus.StripeVerified);
        review.ApprovedAt.Should().BeNull();
        review.PropertyAuthorityAttested.Should().BeFalse();
        review.InstantPayoutsAllowed.Should().BeFalse();
    }

    [Fact]
    public async Task Approval_RequiresEvidenceNotesAndPropertyAuthorityAttestation()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        context.StripeConnectedPayeeReviews.Add(new StripeConnectedPayeeReview
        {
            StripeAccountId = "acct_review", UserId = 42, Status = StripePayeeReviewStatus.UnderReview,
            CreatedAt = Now.AddDays(-1), UpdatedAt = Now.AddDays(-1)
        });
        await context.SaveChangesAsync();
        var service = new StripeConnectedPayeeService(context, new FixedTimeProvider(Now));

        var act = () => service.ApproveAsync("acct_review", 7, 2, "", "reviewed", false);

        await act.Should().ThrowAsync<ArgumentException>();
        context.StripeConnectedPayeeReviews.Single().Status.Should().Be(StripePayeeReviewStatus.UnderReview);
    }

    [Fact]
    public async Task Approval_PersistsAuditEvidenceWithoutKycPii()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        context.StripeConnectedPayeeReviews.Add(new StripeConnectedPayeeReview
        {
            StripeAccountId = "acct_review", UserId = 42, Status = StripePayeeReviewStatus.UnderReview,
            CreatedAt = Now.AddDays(-1), UpdatedAt = Now.AddDays(-1), LastStripeSnapshotAt = Now,
            StripeDetailsSubmitted = true, StripePayoutsEnabled = true, StripeTransfersActive = true,
            ExternalAccountFingerprint = "fp", PayoutSchedulePolicy = "manual"
        });
        context.OrganizationMembers.Add(new OrganizationMember
        {
            UserId = 42, OrganizationId = 2, Role = "Owner", IsActive = true
        });
        await context.SaveChangesAsync();
        var service = new StripeConnectedPayeeService(context, new FixedTimeProvider(Now));

        await service.ApproveAsync("acct_review", 7, 2, "stripe-dashboard:case-123", "Ownership documents reviewed", true);

        var review = context.StripeConnectedPayeeReviews.Single();
        review.Status.Should().Be(StripePayeeReviewStatus.PayoutApproved);
        review.ApprovedByUserId.Should().Be(7);
        review.ApprovalEvidence.Should().Be("stripe-dashboard:case-123");
        review.PropertyAuthorityAttested.Should().BeTrue();
        review.ApprovedOrganizationId.Should().Be(2);
        typeof(StripeConnectedPayeeReview).GetProperties().Select(x => x.Name)
            .Should().NotContain(new[] { "Ssn", "TaxId", "DateOfBirth", "IdentityDocument" });
    }

    [Theory]
    [InlineData(true, "stripe-dashboard:case-123; SSN 123-45-6789")]
    [InlineData(false, "Business EIN: 12-3456789")]
    [InlineData(false, "Bank account number 123456789012")]
    [InlineData(true, "Card: 4242 4242 4242 4242")]
    [InlineData(false, "DOB: 04/23/1985")]
    [InlineData(true, "https://files.example.test/identity/passport.jpg")]
    [InlineData(false, "Uploaded passport-front.png for review")]
    [InlineData(false, "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA")]
    [InlineData(false, "KYC payload: {\"passport_number\":\"X1234567\"}")]
    public async Task Approval_RejectsRawPiiInEvidenceOrNotes(bool putInEvidence, string pii)
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        context.StripeConnectedPayeeReviews.Add(new StripeConnectedPayeeReview
        {
            StripeAccountId = "acct_pii", UserId = 42, Status = StripePayeeReviewStatus.UnderReview,
            CreatedAt = Now.AddDays(-1), UpdatedAt = Now.AddDays(-1)
        });
        await context.SaveChangesAsync();
        var service = new StripeConnectedPayeeService(context, new FixedTimeProvider(Now));
        var evidence = putInEvidence ? pii : "stripe-dashboard:case-123";
        var notes = putInEvidence ? "Ownership and authority reviewed in Stripe Dashboard." : pii;

        var act = () => service.ApproveAsync("acct_pii", 7, 2, evidence, notes, true);

        await act.Should().ThrowAsync<ArgumentException>().WithMessage("*identity data*Stripe Dashboard*");
        context.StripeConnectedPayeeReviews.Single().Status.Should().Be(StripePayeeReviewStatus.UnderReview);
    }

    [Theory]
    [InlineData("stripe-dashboard:case-123", "Ownership and property authority reviewed in Stripe Dashboard.")]
    [InlineData("internal-case PP-2026-00421", "Active owner membership confirmed; no raw identity data retained.")]
    [InlineData("review-2026-08-02", "Tax ID and DOB verified in Stripe Dashboard on 08/02/2026; no values retained.")]
    public async Task Approval_AllowsConstrainedReferencesAndOperationalSummaries(string evidence, string notes)
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        context.StripeConnectedPayeeReviews.Add(new StripeConnectedPayeeReview
        {
            StripeAccountId = "acct_safe", UserId = 42, Status = StripePayeeReviewStatus.UnderReview,
            CreatedAt = Now.AddDays(-1), UpdatedAt = Now.AddDays(-1), LastStripeSnapshotAt = Now,
            StripeDetailsSubmitted = true, StripePayoutsEnabled = true, StripeTransfersActive = true,
            ExternalAccountFingerprint = "fp", PayoutSchedulePolicy = "manual"
        });
        context.OrganizationMembers.Add(new OrganizationMember
        {
            UserId = 42, OrganizationId = 2, Role = "Manager", IsActive = true
        });
        await context.SaveChangesAsync();
        var service = new StripeConnectedPayeeService(context, new FixedTimeProvider(Now));

        var review = await service.ApproveAsync("acct_safe", 7, 2, evidence, notes, true);

        review.ApprovalEvidence.Should().Be(evidence);
        review.ApprovalNotes.Should().Be(notes);
        review.Status.Should().Be(StripePayeeReviewStatus.PayoutApproved);
    }

    [Fact]
    public async Task RiskGate_RequiresApprovedPayeeAndFreshHealthyStripeSnapshot()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        var payment = StripeRentPaymentFlowTests.NewPayment("pi_gate");
        payment.DestinationStripeAccountId = "acct_gate";
        context.StripeConnectedPayeeReviews.Add(new StripeConnectedPayeeReview
        {
            UserId = 42, StripeAccountId = "acct_gate", Status = StripePayeeReviewStatus.PayoutApproved,
            PropertyAuthorityAttested = true, ApprovedOrganizationId = 2, ApprovedAt = Now.AddDays(-1), CreatedAt = Now.AddDays(-10),
            UpdatedAt = Now.AddDays(-1), ExternalAccountFingerprint = "ba_fp_1"
        });
        AddActiveAuthority(context);
        await context.SaveChangesAsync();
        var snapshotGateway = new StubSnapshotGateway(new StripeConnectedAccountSnapshot(
            "acct_gate", Now, true, true, true, "active", [], [], null, "ba_fp_1", "manual", false));
        var risk = new StripeRentRiskService(context, snapshotGateway, Configuration(), new FixedTimeProvider(Now));

        var decision = await risk.EvaluatePayeeAsync(payment);

        decision.Approved.Should().BeTrue();
        context.StripeConnectedPayeeReviews.Single().LastStripeSnapshotAt.Should().Be(Now);
    }

    [Theory]
    [InlineData(false, true, true, "active", null)]
    [InlineData(true, false, true, "active", null)]
    [InlineData(true, true, false, "active", null)]
    [InlineData(true, true, true, "inactive", null)]
    [InlineData(true, true, true, "active", "requirements.pending_verification")]
    public async Task RiskGate_RestrictedStripeSnapshot_AutoSuspendsAndDenies(
        bool details, bool payouts, bool transfers, string capability, string? disabledReason)
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        var payment = StripeRentPaymentFlowTests.NewPayment("pi_restricted");
        payment.DestinationStripeAccountId = "acct_restricted";
        context.StripeConnectedPayeeReviews.Add(new StripeConnectedPayeeReview
        {
            UserId = 42, StripeAccountId = "acct_restricted", Status = StripePayeeReviewStatus.PayoutApproved,
            PropertyAuthorityAttested = true, ApprovedOrganizationId = 2, ApprovedAt = Now.AddDays(-1), CreatedAt = Now.AddDays(-10),
            UpdatedAt = Now.AddDays(-1), ExternalAccountFingerprint = "fp"
        });
        AddActiveAuthority(context);
        await context.SaveChangesAsync();
        var gateway = new StubSnapshotGateway(new StripeConnectedAccountSnapshot(
            "acct_restricted", Now, details, payouts, transfers, capability, [], [], disabledReason, "fp", "manual", false));
        var risk = new StripeRentRiskService(context, gateway, Configuration(), new FixedTimeProvider(Now));

        var decision = await risk.EvaluatePayeeAsync(payment);

        decision.Approved.Should().BeFalse();
        context.StripeConnectedPayeeReviews.Single().Status.Should().Be(StripePayeeReviewStatus.Suspended);
    }

    [Fact]
    public async Task RiskGate_First90Days_EnforcesPerPaymentAndRollingVolumeLimits()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        var payment = StripeRentPaymentFlowTests.NewPayment("pi_limit");
        payment.AmountCents = 50_001;
        payment.DestinationStripeAccountId = "acct_limit";
        context.StripeConnectedPayeeReviews.Add(new StripeConnectedPayeeReview
        {
            UserId = 42, StripeAccountId = "acct_limit", Status = StripePayeeReviewStatus.PayoutApproved,
            PropertyAuthorityAttested = true, ApprovedOrganizationId = 2, ApprovedAt = Now.AddDays(-1), CreatedAt = Now.AddDays(-30),
            UpdatedAt = Now.AddDays(-1), ExternalAccountFingerprint = "fp"
        });
        AddActiveAuthority(context);
        await context.SaveChangesAsync();
        var gateway = new StubSnapshotGateway(new StripeConnectedAccountSnapshot(
            "acct_limit", Now, true, true, true, "active", [], [], null, "fp", "manual", false));
        var risk = new StripeRentRiskService(context, gateway, Configuration(new Dictionary<string, string?>
        {
            ["Stripe:ConnectedPayeeRisk:First90DaysPerPaymentLimitCents"] = "50000",
            ["Stripe:ConnectedPayeeRisk:First90DaysRollingVolumeLimitCents"] = "100000"
        }), new FixedTimeProvider(Now));

        var decision = await risk.EvaluatePayeeAsync(payment);

        decision.Approved.Should().BeFalse();
        decision.Reason.Should().Contain("per-payment");
    }

    [Fact]
    public async Task RiskGate_First90Days_CountsPendingAndAmbiguousReservations()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        var reserved = StripeRentPaymentFlowTests.NewPayment("pi_reserved");
        reserved.AmountCents = 50_000;
        reserved.DestinationStripeAccountId = "acct_reserved_limit";
        reserved.Status = StripeRentPaymentStatus.TransferReconciliationPending;
        context.StripeRentPayments.Add(reserved);
        context.StripeConnectedPayeeReviews.Add(new StripeConnectedPayeeReview
        {
            UserId = 42, StripeAccountId = "acct_reserved_limit", Status = StripePayeeReviewStatus.PayoutApproved,
            PropertyAuthorityAttested = true, ApprovedOrganizationId = 2, ApprovedAt = Now.AddDays(-1),
            CreatedAt = Now.AddDays(-30), UpdatedAt = Now, ExternalAccountFingerprint = "fp"
        });
        AddActiveAuthority(context);
        await context.SaveChangesAsync();
        var candidate = StripeRentPaymentFlowTests.NewPayment("pi_candidate");
        candidate.AmountCents = 60_000;
        candidate.DestinationStripeAccountId = "acct_reserved_limit";
        var gateway = new StubSnapshotGateway(new StripeConnectedAccountSnapshot(
            "acct_reserved_limit", Now, true, true, true, "active", [], [], null, "fp", "manual", false));
        var risk = new StripeRentRiskService(context, gateway, Configuration(new Dictionary<string, string?>
        {
            ["Stripe:ConnectedPayeeRisk:First90DaysPerPaymentLimitCents"] = "100000",
            ["Stripe:ConnectedPayeeRisk:First90DaysRollingVolumeLimitCents"] = "100000"
        }), new FixedTimeProvider(Now));

        var decision = await risk.EvaluatePayeeAsync(candidate);

        decision.Approved.Should().BeFalse();
        decision.Reason.Should().Contain("rolling-volume");
    }

    [Fact]
    public async Task Registration_ChangingDestinationAccount_ResetsAllPriorApprovalAndTrust()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        context.Users.Add(new User { Id = 42, StripeAccountId = "acct_old", StripeAccountEnabled = true });
        context.StripeConnectedPayeeReviews.Add(new StripeConnectedPayeeReview
        {
            UserId = 42, StripeAccountId = "acct_old", Status = StripePayeeReviewStatus.PayoutApproved,
            PropertyAuthorityAttested = true, ApprovalEvidence = "case-old", ApprovedAt = Now.AddDays(-10),
            ApprovedByUserId = 7, ExternalAccountFingerprint = "fp-old",
            CreatedAt = Now.AddDays(-20), UpdatedAt = Now.AddDays(-10)
        });
        await context.SaveChangesAsync();
        var service = new StripeConnectedPayeeService(context, new FixedTimeProvider(Now));

        await service.RegisterAsync(42, "acct_new", detailsSubmitted: true);

        var review = context.StripeConnectedPayeeReviews.Single();
        review.StripeAccountId.Should().Be("acct_new");
        review.Status.Should().Be(StripePayeeReviewStatus.StripeVerified);
        review.ApprovedAt.Should().BeNull();
        review.ApprovedByUserId.Should().BeNull();
        review.ApprovalEvidence.Should().BeNull();
        review.PropertyAuthorityAttested.Should().BeFalse();
        review.ExternalAccountFingerprint.Should().BeNull();

        context.Users.Single().StripeAccountEnabled.Should().BeFalse();
    }

    [Fact]
    public async Task Registration_AccountAlreadyOwnedByAnotherUser_IsRejected()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        context.StripeConnectedPayeeReviews.Add(new StripeConnectedPayeeReview
        {
            UserId = 42, StripeAccountId = "acct_owned", Status = StripePayeeReviewStatus.UnderReview,
            CreatedAt = Now.AddDays(-1), UpdatedAt = Now.AddDays(-1)
        });
        await context.SaveChangesAsync();
        var service = new StripeConnectedPayeeService(context, new FixedTimeProvider(Now));

        var act = () => service.RegisterAsync(43, "acct_owned", detailsSubmitted: true);

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*another user*");
        context.StripeConnectedPayeeReviews.Single().UserId.Should().Be(42);
    }

    [Fact]
    public async Task Registration_OrphanedApprovedAccountReassignedToUser_ResetsAllApprovalAndTrustFields()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        context.Users.Add(new User { Id = 43, StripeAccountEnabled = true, StripeAccountStatus = "payout_approved" });
        context.StripeConnectedPayeeReviews.Add(new StripeConnectedPayeeReview
        {
            UserId = null,
            StripeAccountId = "acct_orphaned",
            Status = StripePayeeReviewStatus.PayoutApproved,
            ApprovedAt = Now.AddDays(-5),
            ApprovedByUserId = 7,
            ApprovalEvidence = "case-old",
            ApprovalNotes = "old approval",
            PropertyAuthorityAttested = true,
            ApprovedOrganizationId = 2,
            SuspendedAt = Now.AddDays(-4),
            SuspendedByUserId = 8,
            SuspensionReason = "old suspension",
            LastStripeSnapshotAt = Now.AddMinutes(-1),
            StripeDetailsSubmitted = true,
            StripePayoutsEnabled = true,
            StripeTransfersActive = true,
            StripeTransferCapabilityStatus = "active",
            CurrentlyDueRequirementCount = 3,
            PastDueRequirementCount = 2,
            StripeDisabledReason = "old restriction",
            ExternalAccountFingerprint = "old-bank-digest",
            LastStripeEventId = "evt_old",
            PayoutSchedulePolicy = "daily",
            InstantPayoutsAllowed = true,
            CreatedAt = Now.AddDays(-10),
            UpdatedAt = Now.AddDays(-5)
        });
        await context.SaveChangesAsync();
        var service = new StripeConnectedPayeeService(context, new FixedTimeProvider(Now));

        await service.RegisterAsync(43, "acct_orphaned", detailsSubmitted: true);

        var review = context.StripeConnectedPayeeReviews.Single();
        review.UserId.Should().Be(43);
        review.Status.Should().Be(StripePayeeReviewStatus.StripeVerified);
        review.ApprovedAt.Should().BeNull();
        review.ApprovedByUserId.Should().BeNull();
        review.ApprovalEvidence.Should().BeNull();
        review.ApprovalNotes.Should().BeNull();
        review.PropertyAuthorityAttested.Should().BeFalse();
        review.ApprovedOrganizationId.Should().BeNull();
        review.SuspendedAt.Should().BeNull();
        review.SuspendedByUserId.Should().BeNull();
        review.SuspensionReason.Should().BeNull();
        review.LastStripeSnapshotAt.Should().BeNull();
        review.StripeDetailsSubmitted.Should().BeTrue();
        review.StripePayoutsEnabled.Should().BeFalse();
        review.StripeTransfersActive.Should().BeFalse();
        review.StripeTransferCapabilityStatus.Should().BeNull();
        review.CurrentlyDueRequirementCount.Should().Be(0);
        review.PastDueRequirementCount.Should().Be(0);
        review.StripeDisabledReason.Should().BeNull();
        review.ExternalAccountFingerprint.Should().BeNull();
        review.LastStripeEventId.Should().BeNull();
        review.PayoutSchedulePolicy.Should().Be("manual");
        review.InstantPayoutsAllowed.Should().BeFalse();
        context.Users.Single().StripeAccountEnabled.Should().BeFalse();
    }

    [Fact]
    public async Task PayeeReviewUserForeignKey_RestrictsDeletionInsteadOfOrphaningApproval()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();

        var foreignKey = context.Model.FindEntityType(typeof(StripeConnectedPayeeReview))!
            .GetForeignKeys().Single(key => key.Properties.Single().Name == nameof(StripeConnectedPayeeReview.UserId));

        foreignKey.DeleteBehavior.Should().Be(Microsoft.EntityFrameworkCore.DeleteBehavior.Restrict);
    }

    [Fact]
    public async Task IsApprovedDestination_AfterOwnerOrManagerMembershipLoss_ReturnsFalse()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        context.StripeConnectedPayeeReviews.Add(new StripeConnectedPayeeReview
        {
            UserId = 42, StripeAccountId = "acct_revoked", Status = StripePayeeReviewStatus.PayoutApproved,
            PropertyAuthorityAttested = true, ApprovedOrganizationId = 2,
            ApprovedAt = Now.AddDays(-1), CreatedAt = Now.AddDays(-10), UpdatedAt = Now
        });
        context.OrganizationMembers.Add(new OrganizationMember
        {
            UserId = 42, OrganizationId = 2, Role = "Owner", IsActive = false
        });
        await context.SaveChangesAsync();
        var service = new StripeConnectedPayeeService(context, new FixedTimeProvider(Now));

        var approved = await service.IsApprovedDestinationAsync(42, 2, "acct_revoked");

        approved.Should().BeFalse();
    }

    [Fact]
    public async Task PreTransferVerification_AfterOwnerOrManagerMembershipLoss_SuspendsAndDenies()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        context.Users.Add(new User
        {
            Id = 42, StripeAccountId = "acct_revoked", StripeAccountEnabled = true,
            StripeAccountStatus = "payout_approved"
        });
        context.StripeConnectedPayeeReviews.Add(new StripeConnectedPayeeReview
        {
            UserId = 42, StripeAccountId = "acct_revoked", Status = StripePayeeReviewStatus.PayoutApproved,
            PropertyAuthorityAttested = true, ApprovedOrganizationId = 2,
            ApprovedAt = Now.AddDays(-1), CreatedAt = Now.AddDays(-10), UpdatedAt = Now,
            ExternalAccountFingerprint = "fp", PayoutSchedulePolicy = "manual"
        });
        context.OrganizationMembers.Add(new OrganizationMember
        {
            UserId = 42, OrganizationId = 2, Role = "Viewer", IsActive = true
        });
        var payment = StripeRentPaymentFlowTests.NewPayment("pi_revoked");
        payment.OrganizationId = 2;
        payment.DestinationStripeAccountId = "acct_revoked";
        context.StripeRentPayments.Add(payment);
        await context.SaveChangesAsync();
        var gateway = new Mock<IStripeConnectedAccountGateway>(MockBehavior.Strict);
        var risk = new StripeRentRiskService(context, gateway.Object,
            new ConfigurationBuilder().Build(), new FixedTimeProvider(Now));

        var decision = await risk.EvaluatePayeeAsync(payment);

        decision.Approved.Should().BeFalse();
        decision.Reason.Should().Contain("active owner or manager");
        var review = context.StripeConnectedPayeeReviews.Single();
        review.Status.Should().Be(StripePayeeReviewStatus.Suspended);
        review.SuspensionReason.Should().Contain("active owner or manager");
        context.Users.Single().StripeAccountEnabled.Should().BeFalse();
        context.Users.Single().StripeAccountStatus.Should().Be("suspended");
        gateway.Verify(x => x.GetSnapshotAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task AccountUpdate_BankFingerprintChange_AutoSuspendsApprovedPayee()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        context.StripeConnectedPayeeReviews.Add(new StripeConnectedPayeeReview
        {
            StripeAccountId = "acct_bank", Status = StripePayeeReviewStatus.PayoutApproved,
            PropertyAuthorityAttested = true, ExternalAccountFingerprint = "old_fp",
            ApprovedAt = Now.AddDays(-1), CreatedAt = Now.AddDays(-10), UpdatedAt = Now.AddDays(-1)
        });
        await context.SaveChangesAsync();
        var service = new StripeConnectedPayeeService(context, new FixedTimeProvider(Now));

        await service.SyncStripeSnapshotAsync(new StripeConnectedAccountSnapshot(
            "acct_bank", Now, true, true, true, "active", [], [], null, "new_fp", "manual", false), "evt_account_updated");

        var review = context.StripeConnectedPayeeReviews.Single();
        review.Status.Should().Be(StripePayeeReviewStatus.Suspended);
        review.SuspensionReason.Should().Contain("bank account changed");
    }

    private static IConfiguration Configuration(Dictionary<string, string?>? values = null) =>
        new ConfigurationBuilder().AddInMemoryCollection(values ?? []).Build();

    private sealed class StubSnapshotGateway(StripeConnectedAccountSnapshot snapshot) : IStripeConnectedAccountGateway
    {
        public Task<StripeConnectedAccountSnapshot> GetSnapshotAsync(string stripeAccountId, CancellationToken cancellationToken = default) =>
            Task.FromResult(snapshot);
    }

    [Fact]
    public async Task PreTransferVerification_DeniesOrganizationOutsideApprovedAuthorityScope()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        context.StripeConnectedPayeeReviews.Add(new StripeConnectedPayeeReview
        {
            StripeAccountId = "acct_scope", Status = StripePayeeReviewStatus.PayoutApproved,
            PropertyAuthorityAttested = true, ApprovedOrganizationId = 99,
            ApprovedAt = Now.AddDays(-1), CreatedAt = Now.AddDays(-60), UpdatedAt = Now,
            ExternalAccountFingerprint = "fp"
        });
        var payment = StripeRentPaymentFlowTests.NewPayment("pi_scope");
        payment.Status = StripeRentPaymentStatus.TransferPending;
        payment.AmountCents = 10_000;
        payment.DestinationStripeAccountId = "acct_scope";
        context.StripeRentPayments.Add(payment);
        await context.SaveChangesAsync();
        var gateway = new Mock<IStripeConnectedAccountGateway>(MockBehavior.Strict);
        var risk = new StripeRentRiskService(context, gateway.Object,
            new ConfigurationBuilder().Build(), new FixedTimeProvider(Now));

        var decision = await risk.EvaluatePayeeAsync(payment);

        decision.Approved.Should().BeFalse();
        decision.Reason.Should().Contain("organization");
        gateway.Verify(x => x.GetSnapshotAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Theory]
    [InlineData("daily", false, "manual")]
    [InlineData("manual", true, "Instant")]
    public async Task PreTransferVerification_LivePayoutControlRegression_SuspendsAndDenies(
        string payoutSchedule, bool instantPayoutsAvailable, string expectedReason)
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        context.StripeConnectedPayeeReviews.Add(new StripeConnectedPayeeReview
        {
            UserId = 42, StripeAccountId = "acct_controls", Status = StripePayeeReviewStatus.PayoutApproved,
            PropertyAuthorityAttested = true, ApprovedOrganizationId = 2,
            ApprovedAt = Now.AddDays(-1), CreatedAt = Now.AddDays(-60), UpdatedAt = Now,
            ExternalAccountFingerprint = "fp"
        });
        var payment = StripeRentPaymentFlowTests.NewPayment("pi_controls");
        payment.Status = StripeRentPaymentStatus.TransferPending;
        payment.AmountCents = 10_000;
        payment.DestinationStripeAccountId = "acct_controls";
        context.StripeRentPayments.Add(payment);
        AddActiveAuthority(context);
        await context.SaveChangesAsync();
        var gateway = new Mock<IStripeConnectedAccountGateway>();
        gateway.Setup(x => x.GetSnapshotAsync("acct_controls", It.IsAny<CancellationToken>())).ReturnsAsync(new StripeConnectedAccountSnapshot(
            "acct_controls", Now, true, true, true, "active", [], [], null, "fp", payoutSchedule, instantPayoutsAvailable));
        var risk = new StripeRentRiskService(context, gateway.Object,
            new ConfigurationBuilder().Build(), new FixedTimeProvider(Now));

        var decision = await risk.EvaluatePayeeAsync(payment);

        decision.Approved.Should().BeFalse();
        decision.Reason.Should().Contain(expectedReason);
        context.StripeConnectedPayeeReviews.Single().Status.Should().Be(StripePayeeReviewStatus.Suspended);
    }

    [Fact]
    public async Task PreTransferVerification_BankSetChangesDuringFreshCheck_DeniesSameAttempt()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        context.StripeConnectedPayeeReviews.Add(new StripeConnectedPayeeReview
        {
            UserId = 42, StripeAccountId = "acct_bank_change", Status = StripePayeeReviewStatus.PayoutApproved,
            PropertyAuthorityAttested = true, ApprovedOrganizationId = 2,
            ApprovedAt = Now.AddDays(-1), CreatedAt = Now.AddDays(-60), UpdatedAt = Now,
            ExternalAccountFingerprint = "old-digest"
        });
        var payment = StripeRentPaymentFlowTests.NewPayment("pi_bank_change");
        payment.Status = StripeRentPaymentStatus.TransferPending;
        payment.AmountCents = 10_000;
        payment.DestinationStripeAccountId = "acct_bank_change";
        context.StripeRentPayments.Add(payment);
        AddActiveAuthority(context);
        await context.SaveChangesAsync();
        var gateway = new Mock<IStripeConnectedAccountGateway>();
        gateway.Setup(x => x.GetSnapshotAsync("acct_bank_change", It.IsAny<CancellationToken>())).ReturnsAsync(new StripeConnectedAccountSnapshot(
            "acct_bank_change", Now, true, true, true, "active", [], [], null, "new-digest", "manual", false));
        var risk = new StripeRentRiskService(context, gateway.Object,
            new ConfigurationBuilder().Build(), new FixedTimeProvider(Now));

        var decision = await risk.EvaluatePayeeAsync(payment);

        decision.Approved.Should().BeFalse();
        decision.Reason.Should().Contain("changed");
        context.StripeConnectedPayeeReviews.Single().SuspensionReason.Should().Contain("bank account changed");
    }

    private static void AddActiveAuthority(brownstone_hub_api.Data.DataContext context) =>
        context.OrganizationMembers.Add(new OrganizationMember
        {
            UserId = 42, OrganizationId = 2, Role = "Owner", IsActive = true
        });

    private sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }
}
