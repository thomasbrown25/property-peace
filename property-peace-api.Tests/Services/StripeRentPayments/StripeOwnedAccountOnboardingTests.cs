using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.StripeRentPayments;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace brownstone_hub_api.Tests.Services.StripeRentPayments;

public sealed class StripeOwnedAccountOnboardingTests
{
    [Fact]
    public async Task UnapprovedOwnedAccount_IsOnboardableButNeverApprovedForRent()
    {
        await using var db = Context();
        Seed(db);
        db.StripeConnectedPayeeReviews.Add(new StripeConnectedPayeeReview
            { UserId = 42, StripeAccountId = "acct_self", Status = StripePayeeReviewStatus.Onboarding });
        await db.SaveChangesAsync();
        var service = new StripeConnectedPayeeService(db, TimeProvider.System);

        (await service.ResolveOwnedAccountForOnboardingAsync(42, 77))!.StripeAccountId.Should().Be("acct_self");
        (await service.ResolveApprovedDestinationAsync(42, 77)).Should().BeNull();
        (await service.IsApprovedDestinationAsync(42, 77, "acct_self")).Should().BeFalse();
    }

    [Theory]
    [InlineData(88, true, "Owner", 42, false)]
    [InlineData(77, false, "Owner", 42, false)]
    [InlineData(77, true, "Viewer", 42, false)]
    [InlineData(77, true, "Owner", 51, false)]
    [InlineData(77, true, "Manager", 42, true)]
    public async Task OwnershipRequiresMatchingBindingAndActiveScopedMembership(
        long selectedOrg, bool active, string role, long boundUser, bool permitted)
    {
        await using var db = Context();
        Seed(db, role: role, memberActive: active);
        db.StripeConnectedPayeeReviews.Add(new StripeConnectedPayeeReview
            { UserId = boundUser, StripeAccountId = "acct_self", Status = StripePayeeReviewStatus.Onboarding });
        await db.SaveChangesAsync();
        var service = new StripeConnectedPayeeService(db, TimeProvider.System);
        (await service.ResolveOwnedAccountForOnboardingAsync(42, selectedOrg) != null).Should().Be(permitted);
    }

    [Theory]
    [InlineData(false, false, false, true)]
    [InlineData(true, true, false, true)]
    [InlineData(true, false, true, true)]
    [InlineData(true, false, false, false)]
    public async Task OwnedAccount_RejectsInactiveOrDeletedOrganizationSuspendedUserAndManagerWithoutPermission(
        bool orgActive, bool orgDeleted, bool suspended, bool managerPermission)
    {
        await using var db = Context();
        Seed(db, role: "Manager");
        db.Organizations.Local.Single().IsActive = orgActive;
        db.Organizations.Local.Single().IsDeleted = orgDeleted;
        db.Users.Local.Single().IsSuspended = suspended;
        db.OrganizationMembers.Local.Single().CanManageProperties = managerPermission;
        db.StripeConnectedPayeeReviews.Add(new StripeConnectedPayeeReview { UserId = 42, StripeAccountId = "acct_self" });
        await db.SaveChangesAsync();
        (await new StripeConnectedPayeeService(db, TimeProvider.System).ResolveOwnedAccountForOnboardingAsync(42, 77))
            .Should().BeNull();
    }

    [Fact]
    public async Task DuplicateReviewBinding_FailsClosed()
    {
        await using var db = Context();
        Seed(db);
        db.StripeConnectedPayeeReviews.AddRange(
            new StripeConnectedPayeeReview { UserId = 42, StripeAccountId = "acct_self" },
            new StripeConnectedPayeeReview { UserId = 51, StripeAccountId = "acct_self" });
        await db.SaveChangesAsync();
        (await new StripeConnectedPayeeService(db, TimeProvider.System).ResolveOwnedAccountForOnboardingAsync(42, 77))
            .Should().BeNull();
    }

    [Fact]
    public async Task AccountApprovedForDifferentOrganization_IsNotExposedInSelectedOrganization()
    {
        await using var db = Context();
        Seed(db);
        db.StripeConnectedPayeeReviews.Add(new StripeConnectedPayeeReview
            { UserId = 42, StripeAccountId = "acct_self", ApprovedOrganizationId = 88 });
        await db.SaveChangesAsync();
        (await new StripeConnectedPayeeService(db, TimeProvider.System).ResolveOwnedAccountForOnboardingAsync(42, 77))
            .Should().BeNull();
    }

    [Fact]
    public async Task FirstTimeAccount_RequiresValidOrganizationButNotReview()
    {
        await using var db = Context();
        Seed(db);
        db.Users.Local.Single().StripeAccountId = null;
        await db.SaveChangesAsync();
        (await new StripeConnectedPayeeService(db, TimeProvider.System).ResolveOwnedAccountForOnboardingAsync(42, 77))
            .Should().Be(new OwnedStripeAccount(42, null));
    }

    private static void Seed(DataContext db, string role = "Owner", bool memberActive = true)
    {
        db.Users.Add(new User { Id = 42, Email = "owner@example.test", StripeAccountId = "acct_self" });
        db.Organizations.Add(new Organization { Id = 77 });
        db.OrganizationMembers.Add(new OrganizationMember { UserId = 42, OrganizationId = 77,
            IsActive = memberActive, Role = role, CanManageProperties = true });
    }

    private static DataContext Context() => new(new DbContextOptionsBuilder<DataContext>()
        .UseInMemoryDatabase($"owned-onboarding-{Guid.NewGuid()}").Options);
}
