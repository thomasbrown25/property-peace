using System.Security.Claims;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Attributes;
using brownstone_hub_api.Dtos.Conversation;
using brownstone_hub_api.Repositories.Conversations;
using brownstone_hub_api.Repositories.Messages;
using brownstone_hub_api.Repositories.Organizations;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.ActionSuppressionService;
using brownstone_hub_api.Services.ConversationService;
using brownstone_hub_api.Services.MessageAnalysisService;
using brownstone_hub_api.Services.Timelines;
using brownstone_hub_api.Services.UserService;
using brownstone_hub_api.Middleware;
using brownstone_hub_api.Models;
using FluentAssertions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Controllers;

public sealed class ConversationOrganizationListSecurityTests
{
    [Theory]
    [InlineData(nameof(ConversationController.GetTenantConversation))]
    [InlineData(nameof(ConversationController.GetTenantConversations))]
    [InlineData(nameof(ConversationController.GetAvailableLandlordsForTenant))]
    [InlineData(nameof(ConversationController.StartTenantConversation))]
    [InlineData(nameof(ConversationController.GetConversation))]
    public void TenantConversationEndpoints_UseLeaseScopedOrganizationAuthority(string action)
    {
        var method = typeof(ConversationController).GetMethod(action)!;
        method.GetCustomAttributes(typeof(TenantSelfOrganizationAttribute), true)
            .Cast<TenantSelfOrganizationAttribute>().Should().ContainSingle()
            .Which.AllowWithoutOrganization.Should().BeFalse();
    }

    [Theory]
    [InlineData(nameof(ConversationController.GetConversations))]
    [InlineData(nameof(ConversationController.AddConversation))]
    [InlineData(nameof(ConversationController.UpdateConversation))]
    [InlineData(nameof(ConversationController.DeleteConversation))]
    public void LandlordConversationEndpoints_DoNotInheritTenantSelfAuthority(string action) =>
        typeof(ConversationController).GetMethod(action)!
            .GetCustomAttributes(typeof(TenantSelfOrganizationAttribute), true).Should().BeEmpty();

    [Fact]
    public async Task TenantThread_RequiresActiveParticipationEvenWhenInboxContainsTenantId()
    {
        var service = new Mock<IConversationService>(MockBehavior.Strict);
        service.Setup(x => x.GetTenantConversations(7, true)).ReturnsAsync(
            ServiceResponse<List<LoadConversationDto>>.CreateSuccess([
                new LoadConversationDto { Id = 22, TenantId = 7, Participants = [] }
            ]));
        var controller = Controller(service.Object, Context(7, 100, tenant: true));

        (await controller.GetConversation(22)).Should().BeOfType<NotFoundResult>();
        service.Verify(x => x.GetConversationById(It.IsAny<long>(), It.IsAny<long>()), Times.Never);
    }

    [Fact]
    public async Task TenantThread_ReturnsOnlyParticipatingThreadInSelectedOrganization()
    {
        var thread = new LoadConversationDto { Id = 22, Participants = [new() { UserId = 7, IsActive = true }] };
        var service = new Mock<IConversationService>(MockBehavior.Strict);
        service.Setup(x => x.GetTenantConversations(7, true)).ReturnsAsync(
            ServiceResponse<List<LoadConversationDto>>.CreateSuccess([thread]));
        var controller = Controller(service.Object, Context(7, 100, tenant: true));

        (await controller.GetConversation(22)).Should().BeOfType<OkObjectResult>()
            .Which.Value.Should().BeOfType<ServiceResponse<LoadConversationDto>>()
            .Which.Data.Should().BeSameAs(thread);
    }

    [Fact]
    public async Task TenantInbox_HidesTenantIdOnlyThreadsWithoutActiveParticipation()
    {
        var valid = new LoadConversationDto { Id = 23, Participants = [new() { UserId = 7, IsActive = true }] };
        var service = new Mock<IConversationService>();
        service.Setup(x => x.GetTenantConversations(7, false)).ReturnsAsync(
            ServiceResponse<List<LoadConversationDto>>.CreateSuccess([
                new LoadConversationDto { Id = 22, TenantId = 7, Participants = [] }, valid
            ]));
        var controller = Controller(service.Object, Context(7, 100, tenant: true));

        (await controller.GetTenantConversations()).Should().BeOfType<OkObjectResult>()
            .Which.Value.Should().BeOfType<ServiceResponse<List<LoadConversationDto>>>()
            .Which.Data.Should().ContainSingle().Which.Should().BeSameAs(valid);
    }

    [Fact]
    public void TenantRoutes_DoNotInheritOrganizationMemberFilter_AndRemainTenantRoleRestricted()
    {
        typeof(ConversationController)
            .GetCustomAttributes(typeof(RequireOrganizationRoleAttribute), inherit: true)
            .Cast<RequireOrganizationRoleAttribute>()
            .Should().BeEmpty();

        var tenantActions = new[]
        {
            nameof(ConversationController.GetTenantConversation),
            nameof(ConversationController.GetTenantConversations),
            nameof(ConversationController.GetAvailableLandlordsForTenant),
            nameof(ConversationController.StartTenantConversation)
        };

        foreach (var actionName in tenantActions)
        {
            var action = typeof(ConversationController).GetMethod(actionName)!;
            action.GetCustomAttributes(typeof(RequireOrganizationRoleAttribute), inherit: true)
                .Should().BeEmpty($"{actionName} authorizes a tenant by tenant relationship, not OrganizationMember");
            action.GetCustomAttributes(typeof(AuthorizeAttribute), inherit: true)
                .Cast<AuthorizeAttribute>()
                .Should().ContainSingle(attribute => attribute.Roles == "Tenant,Admin");
        }
    }

    [Fact]
    public void LandlordRoutes_ApplyOrganizationRoleFilterAtTheActionBoundary()
    {
        var landlordActions = typeof(ConversationController).GetMethods()
            .Where(method => method.GetCustomAttributes(typeof(AuthorizeAttribute), true)
                .Cast<AuthorizeAttribute>()
                .Any(attribute => attribute.Roles?.Split(',').Contains("Landlord") == true))
            .ToList();

        landlordActions.Should().NotBeEmpty();
        landlordActions.Where(method => method.Name != nameof(ConversationController.GetConversation))
            .Should().OnlyContain(method =>
                method.GetCustomAttributes(typeof(RequireOrganizationRoleAttribute), true).Any());
        // Shared detail performs its staff check inside ConversationService; the
        // member-only action filter would reject tenant participants first.
        typeof(ConversationController).GetMethod(nameof(ConversationController.GetConversation))!
            .GetCustomAttributes(typeof(RequireOrganizationRoleAttribute), true).Should().BeEmpty();
    }

    [Fact]
    public async Task LandlordList_ControllerAndService_RejectRevokedMemberWithStaleOrganizationContext()
    {
        var conversations = new Mock<IConversationRepository>(MockBehavior.Strict);
        var members = new Mock<IOrganizationMemberRepository>();
        members.Setup(x => x.GetMemberAsync(100, 7)).ReturnsAsync(new brownstone_hub_api.Models.OrganizationMember
            { OrganizationId = 100, UserId = 7, IsActive = false });
        var http = new HttpContextAccessor { HttpContext = Context(7, 100) };
        var service = new ConversationService(conversations.Object, Mock.Of<IUserRepository>(), null, http, null,
            NullLogger<ConversationService>.Instance, members.Object);
        var controller = Controller(service, http.HttpContext!);

        var result = await controller.GetConversations();

        result.Should().BeOfType<ObjectResult>().Which.StatusCode.Should().Be(StatusCodes.Status404NotFound);
        conversations.Verify(x => x.GetConversationsByOrganizationId(It.IsAny<long>(), It.IsAny<bool>(), It.IsAny<long?>()), Times.Never);
    }

    [Fact]
    public async Task LandlordList_Service_PassesActorAndReturnsOnlyRepositoryAuthorizedResults()
    {
        var expected = new List<LoadConversationDto> { new() { Id = 9 } };
        var conversations = new Mock<IConversationRepository>();
        conversations.Setup(x => x.GetConversationsByOrganizationId(100, false, 7)).ReturnsAsync(expected);
        var members = new Mock<IOrganizationMemberRepository>();
        members.Setup(x => x.GetMemberAsync(100, 7)).ReturnsAsync(new brownstone_hub_api.Models.OrganizationMember
            { OrganizationId = 100, UserId = 7, IsActive = true, Role = "Manager" });
        var http = new HttpContextAccessor { HttpContext = Context(7, 100) };
        var service = new ConversationService(conversations.Object, Mock.Of<IUserRepository>(), null, http, null,
            NullLogger<ConversationService>.Instance, members.Object);

        var response = await service.GetConversationsByLandlordId(7);

        response.Success.Should().BeTrue();
        response.Data.Should().BeEquivalentTo(expected);
        conversations.VerifyAll();
    }

    [Fact]
    public async Task TenantList_ControllerAndService_AllowsScopedTenantWithoutOrganizationMember()
    {
        var expected = new List<LoadConversationDto> { new() { Id = 12 } };
        var conversations = new Mock<IConversationRepository>();
        conversations.Setup(x => x.GetConversationsByTenantUserId(7, 100, false)).ReturnsAsync(expected);
        var members = new Mock<IOrganizationMemberRepository>(MockBehavior.Strict);
        var http = new HttpContextAccessor { HttpContext = Context(7, 100) };
        var service = new ConversationService(conversations.Object, Mock.Of<IUserRepository>(), null, http, null,
            NullLogger<ConversationService>.Instance, members.Object);
        var controller = Controller(service, http.HttpContext!);

        var result = await controller.GetTenantConversations();

        result.Should().BeOfType<OkObjectResult>();
        conversations.VerifyAll();
        members.VerifyNoOtherCalls();
    }

    [Theory]
    [InlineData("default")]
    [InlineData("available")]
    [InlineData("start")]
    public async Task TenantConversationWorkflows_ServiceFailsClosedWithoutActiveOrganization(string operation)
    {
        var conversations = new Mock<IConversationRepository>(MockBehavior.Strict);
        var http = new HttpContextAccessor { HttpContext = Context(7) };
        var service = new ConversationService(conversations.Object, Mock.Of<IUserRepository>(), null, http, null,
            NullLogger<ConversationService>.Instance, Mock.Of<IOrganizationMemberRepository>());

        var success = operation switch
        {
            "default" => (await service.GetOrCreateTenantLandlordConversation(7)).Success,
            "available" => (await service.GetAvailableLandlordsForTenant(7)).Success,
            _ => (await service.StartTenantConversation(7, 8)).Success
        };

        success.Should().BeFalse();
        conversations.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task TenantConversationWorkflows_ServicePassesValidatedActiveOrganizationToRepository()
    {
        var expectedConversation = new LoadConversationDto { Id = 12 };
        var expectedLandlords = new List<TenantAvailableLandlordDto> { new() { LandlordUserId = 8 } };
        var conversations = new Mock<IConversationRepository>(MockBehavior.Strict);
        conversations.Setup(x => x.GetOrCreateTenantLandlordConversation(7, 100)).ReturnsAsync(expectedConversation);
        conversations.Setup(x => x.GetAvailableLandlordsForTenant(7, 100)).ReturnsAsync(expectedLandlords);
        conversations.Setup(x => x.GetOrCreateConversationForTenantLandlord(7, 8, 100)).ReturnsAsync(expectedConversation);
        var members = new Mock<IOrganizationMemberRepository>(MockBehavior.Strict);
        var http = new HttpContextAccessor { HttpContext = Context(7, 100) };
        var service = new ConversationService(conversations.Object, Mock.Of<IUserRepository>(), null, http, null,
            NullLogger<ConversationService>.Instance, members.Object);

        (await service.GetOrCreateTenantLandlordConversation(7)).Success.Should().BeTrue();
        (await service.GetAvailableLandlordsForTenant(7)).Data.Should().BeEquivalentTo(expectedLandlords);
        (await service.StartTenantConversation(7, 8)).Success.Should().BeTrue();

        conversations.VerifyAll();
    }

    [Fact]
    public async Task DirectSummary_ServiceRejectsParticipantConversationOutsideActiveOrganization()
    {
        var conversations = new Mock<IConversationRepository>(MockBehavior.Strict);
        conversations.Setup(x => x.GetConversationById(22, 7, 100)).ReturnsAsync((LoadConversationDto)null!);
        var members = new Mock<IOrganizationMemberRepository>();
        members.Setup(x => x.GetMemberAsync(100, 7)).ReturnsAsync(new brownstone_hub_api.Models.OrganizationMember
            { OrganizationId = 100, UserId = 7, IsActive = true, Role = "Manager" });
        var http = new HttpContextAccessor { HttpContext = Context(7, 100) };
        var service = new ConversationService(conversations.Object, Mock.Of<IUserRepository>(), null, http, null,
            NullLogger<ConversationService>.Instance, members.Object);

        var response = await service.GetConversationById(22, 7);

        response.Success.Should().BeFalse();
        response.StatusCode.Should().Be(StatusCodes.Status404NotFound);
        conversations.VerifyAll();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("Administrator")]
    public async Task LandlordList_ServiceRejectsActiveMemberWithUnknownStaffRole(string? role)
    {
        var conversations = new Mock<IConversationRepository>(MockBehavior.Strict);
        var members = new Mock<IOrganizationMemberRepository>();
        members.Setup(x => x.GetMemberAsync(100, 7)).ReturnsAsync(new brownstone_hub_api.Models.OrganizationMember
            { OrganizationId = 100, UserId = 7, IsActive = true, Role = role! });
        var http = new HttpContextAccessor { HttpContext = Context(7, 100) };
        var service = new ConversationService(conversations.Object, Mock.Of<IUserRepository>(), null, http, null,
            NullLogger<ConversationService>.Instance, members.Object);

        var response = await service.GetConversationsByLandlordId(7);

        response.Success.Should().BeFalse();
        response.StatusCode.Should().Be(StatusCodes.Status404NotFound);
        conversations.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task LandlordThread_RejectsRevokedMemberWithoutBroadTenantAuthority()
    {
        var conversations = new Mock<IConversationRepository>(MockBehavior.Strict);
        var members = new Mock<IOrganizationMemberRepository>();
        members.Setup(x => x.GetMemberAsync(100, 7)).ReturnsAsync(new brownstone_hub_api.Models.OrganizationMember
            { OrganizationId = 100, UserId = 7, IsActive = false, Role = "Owner" });
        var http = new HttpContextAccessor { HttpContext = Context(7, 100) };
        var service = new ConversationService(conversations.Object, Mock.Of<IUserRepository>(), null, http, null,
            NullLogger<ConversationService>.Instance, members.Object);

        (await Controller(service, http.HttpContext!).GetConversation(22)).Should().BeOfType<ObjectResult>()
            .Which.StatusCode.Should().Be(StatusCodes.Status404NotFound);
        conversations.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task DirectRead_ServiceFailsClosedWithoutValidatedOrganizationContext()
    {
        var conversations = new Mock<IConversationRepository>(MockBehavior.Strict);
        var http = new HttpContextAccessor { HttpContext = Context(7) };
        var service = new ConversationService(conversations.Object, Mock.Of<IUserRepository>(), null, http, null,
            NullLogger<ConversationService>.Instance, Mock.Of<IOrganizationMemberRepository>());

        var response = await service.GetConversationById(22, 7);

        response.Success.Should().BeFalse();
        response.StatusCode.Should().Be(StatusCodes.Status404NotFound);
        conversations.VerifyNoOtherCalls();
    }

    [Theory]
    [InlineData("update")]
    [InlineData("delete")]
    [InlineData("archive")]
    [InlineData("pin")]
    public async Task StaffMutations_ServiceRejectViewerInActiveOrganization(string operation)
    {
        var conversations = new Mock<IConversationRepository>(MockBehavior.Strict);
        var members = new Mock<IOrganizationMemberRepository>();
        members.Setup(x => x.GetMemberAsync(100, 7)).ReturnsAsync(new brownstone_hub_api.Models.OrganizationMember
            { OrganizationId = 100, UserId = 7, IsActive = true, Role = "Viewer" });
        var http = new HttpContextAccessor { HttpContext = Context(7, 100) };
        var service = new ConversationService(conversations.Object, Mock.Of<IUserRepository>(), null, http, null,
            NullLogger<ConversationService>.Instance, members.Object);

        var success = operation switch
        {
            "update" => (await service.UpdateConversation(22, new AddConversationDto(), 7)).Success,
            "delete" => (await service.DeleteConversation(22, 7)).Success,
            "archive" => (await service.ArchiveConversation(22, true, 7)).Success,
            _ => (await service.PinConversation(22, true, 7)).Success
        };

        success.Should().BeFalse();
        conversations.VerifyNoOtherCalls();
    }

    [Theory]
    [InlineData("update")]
    [InlineData("delete")]
    [InlineData("archive")]
    [InlineData("pin")]
    public async Task Mutations_ServiceFailClosedWithoutValidatedOrganizationContext(string operation)
    {
        var conversations = new Mock<IConversationRepository>(MockBehavior.Strict);
        var http = new HttpContextAccessor { HttpContext = Context(7) };
        var service = new ConversationService(conversations.Object, Mock.Of<IUserRepository>(), null, http, null,
            NullLogger<ConversationService>.Instance, Mock.Of<IOrganizationMemberRepository>());

        var success = operation switch
        {
            "update" => (await service.UpdateConversation(22, new AddConversationDto(), 7)).Success,
            "delete" => (await service.DeleteConversation(22, 7)).Success,
            "archive" => (await service.ArchiveConversation(22, true, 7)).Success,
            _ => (await service.PinConversation(22, true, 7)).Success
        };

        success.Should().BeFalse();
        conversations.VerifyNoOtherCalls();
    }

    private static DefaultHttpContext Context(long userId, long? organizationId = null, bool tenant = false)
    {
        var context = new DefaultHttpContext();
        if (organizationId.HasValue)
            context.Items["OrganizationId"] = organizationId.Value;
        context.User = new ClaimsPrincipal(new ClaimsIdentity([
            new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
            new Claim(ClaimTypes.Role, tenant ? "Tenant" : "Landlord")], "test"));
        return context;
    }

    private static ConversationController Controller(IConversationService service, HttpContext context)
    {
        var controller = new ConversationController(service, Mock.Of<IUserService>(), null,
            Mock.Of<IActionSuppressionService>(), Mock.Of<IMessageRepository>(), Mock.Of<IMilestone7ConversationService>(),
            NullLogger<ConversationController>.Instance);
        controller.ControllerContext = new ControllerContext { HttpContext = context };
        return controller;
    }
}
