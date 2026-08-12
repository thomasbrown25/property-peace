using AutoMapper;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Organization;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Organizations;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.LeaseTemplateService;
using brownstone_hub_api.Services.OrganizationInviteService;
using brownstone_hub_api.Services.OrganizationMemberService;
using brownstone_hub_api.Services.OrganizationService;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using System.Security.Claims;
using Xunit;

namespace brownstone_hub_api.Tests.Controllers;

public sealed class OrganizationControllerSecurityTests
{
    [Fact]
    public async Task GetOrganization_AA_UsesOnlyMiddlewareSelectedOrganization()
    {
        var organizations = new Mock<IOrganizationService>(MockBehavior.Strict);
        organizations.Setup(x => x.GetOrganizationByIdAsync(10, 10, 42)).ReturnsAsync(
            ServiceResponse<LoadOrganizationDto>.CreateSuccess(new LoadOrganizationDto { Id = 10 }));
        var controller = Controller(organizations, organizationId: 10, userId: 42);

        (await controller.GetOrganizationById(10)).Should().BeOfType<OkObjectResult>();

        organizations.VerifyAll();
    }

    [Theory]
    [InlineData(null)]
    [InlineData((long)10)]
    public async Task GetOrganization_MissingScopeOrAB_IsForbiddenWithoutReadingTarget(long? selectedOrganizationId)
    {
        var organizations = new Mock<IOrganizationService>(MockBehavior.Strict);
        var controller = Controller(organizations, selectedOrganizationId);

        var result = await controller.GetOrganizationById(20);

        result.Should().BeOfType<ObjectResult>().Which.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
        organizations.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task DeleteOrganization_AA_PassesSelectedOrganizationAndAuthenticatedUser()
    {
        var organizations = new Mock<IOrganizationService>(MockBehavior.Strict);
        organizations.Setup(x => x.DeleteOrganizationAsync(10, 10, 42)).ReturnsAsync(
            ServiceResponse<bool>.CreateSuccess(true));
        var controller = Controller(organizations, organizationId: 10, userId: 42);

        (await controller.DeleteOrganization(10)).Should().BeOfType<OkObjectResult>();

        organizations.VerifyAll();
    }

    [Theory]
    [InlineData(null)]
    [InlineData((long)10)]
    public async Task DeleteOrganization_MissingScopeOrAB_IsForbiddenWithoutCallingService(long? selectedOrganizationId)
    {
        var organizations = new Mock<IOrganizationService>(MockBehavior.Strict);
        var controller = Controller(organizations, selectedOrganizationId, userId: 42);

        var result = await controller.DeleteOrganization(20);

        result.Should().BeOfType<ObjectResult>().Which.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
        organizations.VerifyNoOtherCalls();
    }

    private static OrganizationController Controller(
        Mock<IOrganizationService> organizations,
        long? organizationId,
        long? userId = null)
    {
        var httpContext = new DefaultHttpContext();
        if (organizationId.HasValue)
            httpContext.Items["OrganizationId"] = organizationId.Value;
        if (userId.HasValue)
        {
            httpContext.User = new ClaimsPrincipal(new ClaimsIdentity(
                [new Claim(ClaimTypes.NameIdentifier, userId.Value.ToString())], "test"));
        }

        return new OrganizationController(
            organizations.Object,
            Mock.Of<IOrganizationMemberService>(),
            Mock.Of<IOrganizationInviteService>(),
            Mock.Of<IUserRepository>(),
            Mock.Of<ILogger<OrganizationController>>())
        {
            ControllerContext = new ControllerContext { HttpContext = httpContext }
        };
    }
}

public sealed class OrganizationServiceSecurityTests
{
    [Fact]
    public async Task GetOrganization_AA_ReturnsSelectedOrganization()
    {
        var fixture = Fixture();
        fixture.Organizations.Setup(x => x.GetOrganizationByIdWithMembersAsync(10)).ReturnsAsync(
            new Organization { Id = 10, Name = "A", IsActive = true });
        fixture.Members.Setup(x => x.GetMemberAsync(10, 42)).ReturnsAsync(new OrganizationMember
        {
            OrganizationId = 10, UserId = 42, Role = "Manager", IsActive = true
        });

        var response = await fixture.Service.GetOrganizationByIdAsync(10, 10, 42);

        response.Success.Should().BeTrue();
        response.Data!.Id.Should().Be(10);
    }

    [Fact]
    public async Task GetOrganization_AB_FailsBeforeRepositoryAndDoesNotExposeMetadata()
    {
        var fixture = Fixture();

        var response = await fixture.Service.GetOrganizationByIdAsync(20, 10, 42);

        response.Success.Should().BeFalse();
        response.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
        response.Data.Should().BeNull();
        fixture.Organizations.VerifyNoOtherCalls();
        fixture.Users.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task GetOrganization_MissingSelectedScope_FailsBeforeRepository()
    {
        var fixture = Fixture();

        var response = await fixture.Service.GetOrganizationByIdAsync(20, 0, 42);

        response.Success.Should().BeFalse();
        response.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
        fixture.Organizations.VerifyNoOtherCalls();
        fixture.Users.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task GetOrganization_ViewerMembership_IsDeniedByServiceBoundary()
    {
        var fixture = Fixture();
        fixture.Members.Setup(x => x.GetMemberAsync(10, 42)).ReturnsAsync(new OrganizationMember
        {
            OrganizationId = 10, UserId = 42, Role = "Viewer", IsActive = true
        });

        var response = await fixture.Service.GetOrganizationByIdAsync(10, 10, 42);

        response.Success.Should().BeFalse();
        response.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
        response.Data.Should().BeNull();
        fixture.Organizations.VerifyNoOtherCalls();
        fixture.Users.VerifyNoOtherCalls();
    }

    [Theory]
    [InlineData(0L)]
    [InlineData(10L)]
    public async Task DeleteOrganization_MissingSelectedScopeOrAB_FailsBeforeRepository(long selectedOrganizationId)
    {
        var fixture = Fixture();

        var response = await fixture.Service.DeleteOrganizationAsync(20, selectedOrganizationId, 42);

        response.Success.Should().BeFalse();
        response.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
        fixture.Organizations.VerifyNoOtherCalls();
        fixture.Members.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task DeleteOrganization_OwnerlessOrganization_FailsClosed()
    {
        var fixture = Fixture();
        fixture.Organizations.Setup(x => x.GetOrganizationByIdAsync(10)).ReturnsAsync(ActiveOrganization(ownerId: null));
        fixture.Members.Setup(x => x.GetMemberAsync(10, 42)).ReturnsAsync((OrganizationMember?)null);

        var response = await fixture.Service.DeleteOrganizationAsync(10, 10, 42);

        response.Success.Should().BeFalse();
        response.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
    }

    [Theory]
    [InlineData("Manager")]
    [InlineData("Admin")]
    public async Task DeleteOrganization_ManagerOrAdminWithoutOwnerMembership_IsDenied(string role)
    {
        var fixture = Fixture();
        fixture.Organizations.Setup(x => x.GetOrganizationByIdAsync(10)).ReturnsAsync(ActiveOrganization(ownerId: 42));
        fixture.Members.Setup(x => x.GetMemberAsync(10, 42)).ReturnsAsync(new OrganizationMember
        {
            OrganizationId = 10,
            UserId = 42,
            Role = role,
            IsActive = true,
            CanManageMembers = true,
            CanManageBilling = true
        });

        var response = await fixture.Service.DeleteOrganizationAsync(10, 10, 42);

        response.Success.Should().BeFalse();
        response.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
    }

    [Theory]
    [InlineData(false, false, true)]
    [InlineData(true, true, true)]
    [InlineData(true, false, false)]
    public async Task DeleteOrganization_InactiveOrDeletedOrganizationOrInactiveOwner_IsDenied(
        bool organizationActive,
        bool organizationDeleted,
        bool membershipActive)
    {
        var fixture = Fixture();
        var organization = ActiveOrganization(ownerId: 42);
        organization.IsActive = organizationActive;
        organization.IsDeleted = organizationDeleted;
        fixture.Organizations.Setup(x => x.GetOrganizationByIdAsync(10)).ReturnsAsync(organization);
        fixture.Members.Setup(x => x.GetMemberAsync(10, 42)).ReturnsAsync(new OrganizationMember
        {
            OrganizationId = 10, UserId = 42, Role = "Owner", IsActive = membershipActive
        });

        var response = await fixture.Service.DeleteOrganizationAsync(10, 10, 42);

        response.Success.Should().BeFalse();
        response.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
    }

    [Fact]
    public async Task DeleteOrganization_ExplicitActiveOwnerMembership_SucceedsEvenWithLegacyOwnerIdNull()
    {
        var fixture = Fixture();
        fixture.Organizations.Setup(x => x.GetOrganizationByIdAsync(10)).ReturnsAsync(ActiveOrganization(ownerId: null));
        fixture.Members.Setup(x => x.GetMemberAsync(10, 42)).ReturnsAsync(new OrganizationMember
        {
            OrganizationId = 10, UserId = 42, Role = "Owner", IsActive = true
        });
        fixture.Context.Organizations.Add(ActiveOrganization(ownerId: null));
        fixture.Context.OrganizationMembers.Add(new OrganizationMember
        {
            Id = 1, OrganizationId = 10, UserId = 42, Role = "Owner", IsActive = true
        });
        await fixture.Context.SaveChangesAsync();

        var response = await fixture.Service.DeleteOrganizationAsync(10, 10, 42);

        response.Success.Should().BeTrue();
        response.Data.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteOrganization_SharedSubscription_IsPreservedAndReparented()
    {
        var fixture = Fixture();
        fixture.Organizations.Setup(x => x.GetOrganizationByIdAsync(10)).ReturnsAsync(ActiveOrganization(ownerId: 42));
        fixture.Members.Setup(x => x.GetMemberAsync(10, 42)).ReturnsAsync(new OrganizationMember
        {
            OrganizationId = 10, UserId = 42, Role = "Owner", IsActive = true
        });
        var target = ActiveOrganization(ownerId: 42);
        target.SubscriptionId = 50;
        var survivor = new Organization
        {
            Id = 11, Name = "B", IsActive = true, IsDeleted = false, SubscriptionId = 50
        };
        fixture.Context.Organizations.AddRange(target, survivor);
        fixture.Context.OrganizationMembers.Add(new OrganizationMember
        {
            Id = 1, OrganizationId = 10, UserId = 42, Role = "Owner", IsActive = true
        });
        fixture.Context.Subscriptions.Add(new Subscription
        {
            Id = 50,
            OrganizationId = 10,
            SubscriptionPlanId = 1,
            StripeSubscriptionId = "sub_shared",
            Status = "Active",
            BillingCycle = "Monthly"
        });
        await fixture.Context.SaveChangesAsync();

        var response = await fixture.Service.DeleteOrganizationAsync(10, 10, 42);

        response.Success.Should().BeTrue();
        (await fixture.Context.Organizations.FindAsync(10L)).Should().BeNull();
        var subscription = await fixture.Context.Subscriptions.FindAsync(50L);
        subscription.Should().NotBeNull();
        subscription!.OrganizationId.Should().Be(11);
        (await fixture.Context.Organizations.FindAsync(11L))!.SubscriptionId.Should().Be(50);
    }

    [Fact]
    public async Task DeleteOrganization_UnsharedStripeSubscription_ReturnsConflictWithoutDeletingData()
    {
        var fixture = Fixture();
        fixture.Organizations.Setup(x => x.GetOrganizationByIdAsync(10)).ReturnsAsync(ActiveOrganization(ownerId: 42));
        fixture.Members.Setup(x => x.GetMemberAsync(10, 42)).ReturnsAsync(new OrganizationMember
        {
            OrganizationId = 10, UserId = 42, Role = "Owner", IsActive = true
        });
        var target = ActiveOrganization(ownerId: 42);
        target.SubscriptionId = 50;
        fixture.Context.Organizations.Add(target);
        fixture.Context.OrganizationMembers.Add(new OrganizationMember
        {
            Id = 1, OrganizationId = 10, UserId = 42, Role = "Owner", IsActive = true
        });
        fixture.Context.Subscriptions.Add(new Subscription
        {
            Id = 50,
            OrganizationId = 10,
            SubscriptionPlanId = 1,
            StripeSubscriptionId = "sub_paid",
            Status = "Active",
            BillingCycle = "Monthly"
        });
        await fixture.Context.SaveChangesAsync();

        var response = await fixture.Service.DeleteOrganizationAsync(10, 10, 42);

        response.Success.Should().BeFalse();
        response.StatusCode.Should().Be(StatusCodes.Status409Conflict);
        (await fixture.Context.Organizations.FindAsync(10L)).Should().NotBeNull();
        (await fixture.Context.Subscriptions.FindAsync(50L)).Should().NotBeNull();
        (await fixture.Context.OrganizationMembers.FindAsync(1L)).Should().NotBeNull();
    }

    [Fact]
    public async Task DeleteOrganization_UnsharedFreeSubscription_ReturnsConflictWithoutDeletingData()
    {
        var fixture = Fixture();
        fixture.Organizations.Setup(x => x.GetOrganizationByIdAsync(10)).ReturnsAsync(ActiveOrganization(ownerId: 42));
        fixture.Members.Setup(x => x.GetMemberAsync(10, 42)).ReturnsAsync(new OrganizationMember
        {
            OrganizationId = 10, UserId = 42, Role = "Owner", IsActive = true
        });
        var target = ActiveOrganization(ownerId: 42);
        target.SubscriptionId = 50;
        fixture.Context.Organizations.Add(target);
        fixture.Context.OrganizationMembers.Add(new OrganizationMember
        {
            Id = 1, OrganizationId = 10, UserId = 42, Role = "Owner", IsActive = true
        });
        fixture.Context.Subscriptions.Add(new Subscription
        {
            Id = 50,
            OrganizationId = 10,
            SubscriptionPlanId = 1,
            StripeSubscriptionId = null,
            Status = "Active",
            BillingCycle = "Monthly"
        });
        await fixture.Context.SaveChangesAsync();

        var response = await fixture.Service.DeleteOrganizationAsync(10, 10, 42);

        response.Success.Should().BeFalse();
        response.StatusCode.Should().Be(StatusCodes.Status409Conflict);
        (await fixture.Context.Organizations.FindAsync(10L)).Should().NotBeNull();
        (await fixture.Context.Subscriptions.FindAsync(50L)).Should().NotBeNull();
        (await fixture.Context.OrganizationMembers.FindAsync(1L)).Should().NotBeNull();
    }

    [Theory]
    [InlineData(false, false)]
    [InlineData(true, true)]
    public async Task DeleteOrganization_OnlyInactiveOrDeletedSharedSubscriptionSurvivor_ReturnsConflictWithoutMutation(
        bool survivorActive,
        bool survivorDeleted)
    {
        var fixture = Fixture();
        fixture.Organizations.Setup(x => x.GetOrganizationByIdAsync(10)).ReturnsAsync(ActiveOrganization(ownerId: 42));
        fixture.Members.Setup(x => x.GetMemberAsync(10, 42)).ReturnsAsync(new OrganizationMember
        {
            OrganizationId = 10, UserId = 42, Role = "Owner", IsActive = true
        });
        var target = ActiveOrganization(ownerId: 42);
        target.SubscriptionId = 50;
        var invalidSurvivor = new Organization
        {
            Id = 11, Name = "Invalid", IsActive = survivorActive, IsDeleted = survivorDeleted, SubscriptionId = 50
        };
        fixture.Context.Organizations.AddRange(target, invalidSurvivor);
        fixture.Context.OrganizationMembers.Add(new OrganizationMember
        {
            Id = 1, OrganizationId = 10, UserId = 42, Role = "Owner", IsActive = true
        });
        fixture.Context.Subscriptions.Add(new Subscription
        {
            Id = 50, OrganizationId = 10, SubscriptionPlanId = 1,
            StripeSubscriptionId = "sub_shared", Status = "Active", BillingCycle = "Monthly"
        });
        await fixture.Context.SaveChangesAsync();

        var response = await fixture.Service.DeleteOrganizationAsync(10, 10, 42);

        response.Success.Should().BeFalse();
        response.StatusCode.Should().Be(StatusCodes.Status409Conflict);
        (await fixture.Context.Organizations.FindAsync(10L)).Should().NotBeNull();
        (await fixture.Context.Organizations.FindAsync(11L)).Should().NotBeNull();
        (await fixture.Context.Subscriptions.FindAsync(50L))!.OrganizationId.Should().Be(10);
        (await fixture.Context.OrganizationMembers.FindAsync(1L)).Should().NotBeNull();
    }

    [Fact]
    public async Task GetCurrentUserOrganization_StaleCurrentOrganizationWithoutMembership_IsDenied()
    {
        var fixture = Fixture();
        fixture.Organizations.Setup(x => x.GetCurrentUserOrganizationAsync(42)).ReturnsAsync(ActiveOrganization(ownerId: 42));
        fixture.Members.Setup(x => x.GetMemberAsync(10, 42)).ReturnsAsync((OrganizationMember?)null);

        var response = await fixture.Service.GetCurrentUserOrganizationAsync(42);

        response.Success.Should().BeFalse();
        response.Data.Should().BeNull();
        fixture.Users.VerifyNoOtherCalls();
    }

    [Theory]
    [InlineData(false, false, true)]
    [InlineData(true, true, true)]
    [InlineData(true, false, false)]
    public async Task GetCurrentUserOrganization_InactiveOrDeletedOrganizationOrMembership_IsDenied(
        bool organizationActive,
        bool organizationDeleted,
        bool membershipActive)
    {
        var fixture = Fixture();
        var organization = ActiveOrganization(ownerId: 42);
        organization.IsActive = organizationActive;
        organization.IsDeleted = organizationDeleted;
        fixture.Organizations.Setup(x => x.GetCurrentUserOrganizationAsync(42)).ReturnsAsync(organization);
        fixture.Members.Setup(x => x.GetMemberAsync(10, 42)).ReturnsAsync(new OrganizationMember
        {
            OrganizationId = 10, UserId = 42, Role = "Viewer", IsActive = membershipActive
        });

        var response = await fixture.Service.GetCurrentUserOrganizationAsync(42);

        response.Success.Should().BeFalse();
        response.Data.Should().BeNull();
    }

    [Fact]
    public async Task GetUserOrganizations_ReturnsOnlyExactActiveMembershipsInActiveOrganizations()
    {
        var fixture = Fixture();
        var active = ActiveOrganization(ownerId: 7);
        var inactive = new Organization { Id = 11, Name = "Inactive", IsActive = false, IsDeleted = false };
        var deleted = new Organization { Id = 12, Name = "Deleted", IsActive = true, IsDeleted = true };
        var noMembership = new Organization { Id = 13, Name = "Stale", IsActive = true, IsDeleted = false };
        fixture.Organizations.Setup(x => x.GetOrganizationsByUserIdAsync(42)).ReturnsAsync(
            [active, inactive, deleted, noMembership]);
        fixture.Members.Setup(x => x.GetMemberAsync(10, 42)).ReturnsAsync(new OrganizationMember
        {
            OrganizationId = 10, UserId = 42, Role = "Viewer", IsActive = true
        });
        fixture.Members.Setup(x => x.GetMemberAsync(13, 42)).ReturnsAsync((OrganizationMember?)null);

        var response = await fixture.Service.GetUserOrganizationsAsync(42);

        response.Success.Should().BeTrue();
        response.Data!.Select(x => x.Id).Should().Equal(10);
        fixture.Members.Verify(x => x.GetMemberAsync(11, 42), Times.Never);
        fixture.Members.Verify(x => x.GetMemberAsync(12, 42), Times.Never);
    }

    [Fact]
    public async Task GetUserOrganizations_ViewerDoesNotReceiveSensitiveMetadata()
    {
        var fixture = Fixture();
        fixture.Organizations.Setup(x => x.GetOrganizationsByUserIdAsync(42)).ReturnsAsync(
            [new Organization
            {
                Id = 10,
                Name = "A",
                IsActive = true,
                OwnerId = 7,
                SubscriptionId = 50,
                StripeCustomerId = "cus_secret"
            }]);
        fixture.Members.Setup(x => x.GetMemberAsync(10, 42)).ReturnsAsync(new OrganizationMember
        {
            OrganizationId = 10, UserId = 42, Role = "Viewer", IsActive = true
        });

        var response = await fixture.Service.GetUserOrganizationsAsync(42);

        response.Success.Should().BeTrue();
        response.Data!.Single().SubscriptionId.Should().BeNull();
        response.Data.Single().StripeCustomerId.Should().BeNull();
        response.Data.Single().OwnerEmail.Should().BeEmpty();
        fixture.Users.VerifyNoOtherCalls();
    }

    private static Organization ActiveOrganization(long? ownerId) => new()
    {
        Id = 10,
        Name = "A",
        OwnerId = ownerId,
        IsActive = true,
        IsDeleted = false
    };

    private static ServiceFixture Fixture()
    {
        var options = new DbContextOptionsBuilder<DataContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var context = new DataContext(options);
        var organizations = new Mock<IOrganizationRepository>(MockBehavior.Strict);
        var members = new Mock<IOrganizationMemberRepository>(MockBehavior.Strict);
        var users = new Mock<IUserRepository>(MockBehavior.Strict);
        var service = new OrganizationService(
            organizations.Object,
            members.Object,
            users.Object,
            context,
            Mock.Of<IMapper>(),
            Mock.Of<ILogger<OrganizationService>>(),
            Mock.Of<ILeaseTemplateService>());
        return new ServiceFixture(service, organizations, members, users, context);
    }

    private sealed record ServiceFixture(
        OrganizationService Service,
        Mock<IOrganizationRepository> Organizations,
        Mock<IOrganizationMemberRepository> Members,
        Mock<IUserRepository> Users,
        DataContext Context);
}
