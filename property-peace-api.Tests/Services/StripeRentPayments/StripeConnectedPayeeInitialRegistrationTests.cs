using brownstone_hub_api.Models;
using brownstone_hub_api.Services.StripeRentPayments;
using FluentAssertions;
using Xunit;

namespace brownstone_hub_api.Tests.Services.StripeRentPayments;

public sealed class StripeConnectedPayeeInitialRegistrationTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 27, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task RegisterInitialAccountAsync_CreatesTheFirstBindingForAnUnboundUser()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        context.Users.Add(new User { Id = 42, Email = "owner@example.test" });
        await context.SaveChangesAsync();

        var result = await new StripeConnectedPayeeService(context, new FixedTimeProvider(Now))
            .RegisterInitialAccountAsync(42, "acct_first", detailsSubmitted: true);

        result.UserId.Should().Be(42);
        result.StripeAccountId.Should().Be("acct_first");
        result.Status.Should().Be(StripePayeeReviewStatus.StripeVerified);
        context.Users.Single().StripeAccountId.Should().Be("acct_first");
        context.Users.Single().StripeAccountEnabled.Should().BeFalse();
    }

    [Fact]
    public async Task RegisterInitialAccountAsync_RefusesToReplaceUsersExistingReview()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        context.Users.Add(new User { Id = 42, Email = "owner@example.test", StripeAccountId = "acct_approved" });
        context.StripeConnectedPayeeReviews.Add(new StripeConnectedPayeeReview
        {
            UserId = 42,
            StripeAccountId = "acct_approved",
            Status = StripePayeeReviewStatus.PayoutApproved,
            ApprovedAt = Now.AddDays(-1),
            ApprovedByUserId = 7,
            ApprovalEvidence = "case-42",
            ApprovalNotes = "approved destination",
            PropertyAuthorityAttested = true,
            ApprovedOrganizationId = 9,
            CreatedAt = Now.AddDays(-10),
            UpdatedAt = Now.AddDays(-1)
        });
        await context.SaveChangesAsync();

        var service = new StripeConnectedPayeeService(context, new FixedTimeProvider(Now));
        var act = () => service.RegisterInitialAccountAsync(42, "acct_replacement", detailsSubmitted: false);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*already has a different Stripe connected account*");
        var review = context.StripeConnectedPayeeReviews.Single();
        review.StripeAccountId.Should().Be("acct_approved");
        review.Status.Should().Be(StripePayeeReviewStatus.PayoutApproved);
        review.ApprovalEvidence.Should().Be("case-42");
    }

    [Fact]
    public async Task RegisterInitialAccountAsync_RefusesABindingCreatedByNormalRegistration()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        context.Users.Add(new User { Id = 42, Email = "owner@example.test" });
        await context.SaveChangesAsync();
        var service = new StripeConnectedPayeeService(context, new FixedTimeProvider(Now));

        await service.RegisterAsync(42, "acct_created_normally", detailsSubmitted: false);
        var act = () => service.RegisterInitialAccountAsync(42, "acct_from_concurrent_first_flow", detailsSubmitted: false);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*already has a different Stripe connected account*");
        context.StripeConnectedPayeeReviews.Should().ContainSingle();
        context.StripeConnectedPayeeReviews.Single().StripeAccountId.Should().Be("acct_created_normally");
    }

    [Fact]
    public async Task RegisterInitialAccountAsync_RefusesAnAccountOwnedByAnotherUser()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        context.Users.AddRange(
            new User { Id = 42, Email = "first@example.test" },
            new User { Id = 43, Email = "owner@example.test", StripeAccountId = "acct_owned" });
        context.StripeConnectedPayeeReviews.Add(new StripeConnectedPayeeReview
        {
            UserId = 43,
            StripeAccountId = "acct_owned",
            Status = StripePayeeReviewStatus.PayoutApproved,
            ApprovedAt = Now.AddDays(-1),
            PropertyAuthorityAttested = true,
            CreatedAt = Now.AddDays(-10),
            UpdatedAt = Now.AddDays(-1)
        });
        await context.SaveChangesAsync();

        var service = new StripeConnectedPayeeService(context, new FixedTimeProvider(Now));
        var act = () => service.RegisterInitialAccountAsync(42, "acct_owned", detailsSubmitted: false);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*already assigned to another user*");
        context.Users.Single(x => x.Id == 42).StripeAccountId.Should().BeNull();
        context.StripeConnectedPayeeReviews.Single().UserId.Should().Be(43);
    }

    [Fact]
    public async Task RegisterInitialAccountAsync_RefusesLegacyAccountOwnershipWithoutAPayeeReview()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        context.Users.AddRange(
            new User { Id = 42, Email = "first@example.test" },
            new User { Id = 43, Email = "legacy@example.test", StripeAccountId = "acct_legacy" });
        await context.SaveChangesAsync();

        var service = new StripeConnectedPayeeService(context, new FixedTimeProvider(Now));
        var act = () => service.RegisterInitialAccountAsync(42, "acct_legacy", detailsSubmitted: false);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*already assigned to another user*");
        context.StripeConnectedPayeeReviews.Should().BeEmpty();
        context.Users.Single(x => x.Id == 42).StripeAccountId.Should().BeNull();
    }

    [Fact]
    public async Task RegisterInitialAccountAsync_SameAccountIsIdempotentWithoutResettingApproval()
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        context.Users.Add(new User
        {
            Id = 42,
            Email = "owner@example.test",
            StripeAccountId = "acct_approved",
            StripeAccountEnabled = true,
            StripeAccountStatus = "payout_approved"
        });
        context.StripeConnectedPayeeReviews.Add(new StripeConnectedPayeeReview
        {
            UserId = 42,
            StripeAccountId = "acct_approved",
            Status = StripePayeeReviewStatus.PayoutApproved,
            StripeDetailsSubmitted = true,
            ApprovedAt = Now.AddDays(-1),
            ApprovedByUserId = 7,
            ApprovalEvidence = "case-42",
            ApprovalNotes = "approved destination",
            PropertyAuthorityAttested = true,
            ApprovedOrganizationId = 9,
            CreatedAt = Now.AddDays(-10),
            UpdatedAt = Now.AddDays(-1)
        });
        await context.SaveChangesAsync();

        var result = await new StripeConnectedPayeeService(context, new FixedTimeProvider(Now))
            .RegisterInitialAccountAsync(42, "acct_approved", detailsSubmitted: false);

        result.Status.Should().Be(StripePayeeReviewStatus.PayoutApproved);
        result.StripeDetailsSubmitted.Should().BeTrue();
        result.ApprovalEvidence.Should().Be("case-42");
        result.ApprovedOrganizationId.Should().Be(9);
        context.Users.Single().StripeAccountEnabled.Should().BeTrue();
    }

    private sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }
}
