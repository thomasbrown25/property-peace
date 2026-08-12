using AutoMapper;
using brownstone_hub_api.Dtos.OrganizationInvite;
using brownstone_hub_api.Dtos.OrganizationMember;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Organizations;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.EmailService;
using brownstone_hub_api.Services.OrganizationInviteService;
using brownstone_hub_api.Services.OrganizationMemberService;
using FluentAssertions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services;

public sealed class OrganizationMemberRoleGrantSecurityTests
{
    [Fact]
    public async Task AddMember_ManagerWithManageMembers_CannotMintOwner()
    {
        var members = new Mock<IOrganizationMemberRepository>(MockBehavior.Strict);
        var organizations = new Mock<IOrganizationRepository>(MockBehavior.Strict);
        organizations.Setup(x => x.GetOrganizationByIdAsync(10)).ReturnsAsync(
            new Organization { Id = 10, IsActive = true, IsDeleted = false });
        members.Setup(x => x.GetMemberAsync(10, 42)).ReturnsAsync(new OrganizationMember
        {
            OrganizationId = 10,
            UserId = 42,
            Role = "Manager",
            IsActive = true,
            CanManageMembers = true
        });
        var service = MemberService(members, organizations);

        var response = await service.AddMemberAsync(new AddOrganizationMemberDto
        {
            OrganizationId = 10,
            UserId = 99,
            Role = "Owner"
        }, 10, 42);

        response.Success.Should().BeFalse();
        response.StatusCode.Should().Be(403);
        members.Verify(x => x.AddMemberAsync(It.IsAny<OrganizationMember>()), Times.Never);
    }

    [Fact]
    public async Task UpdateMember_InactiveOwnerCannotMintOwner()
    {
        var members = new Mock<IOrganizationMemberRepository>(MockBehavior.Strict);
        var organizations = new Mock<IOrganizationRepository>(MockBehavior.Strict);
        members.Setup(x => x.GetMemberByIdAsync(7)).ReturnsAsync(new OrganizationMember
        {
            Id = 7, OrganizationId = 10, UserId = 99, Role = "Viewer", IsActive = true
        });
        organizations.Setup(x => x.GetOrganizationByIdAsync(10)).ReturnsAsync(
            new Organization { Id = 10, IsActive = true, IsDeleted = false });
        members.Setup(x => x.GetMemberAsync(10, 42)).ReturnsAsync(new OrganizationMember
        {
            OrganizationId = 10, UserId = 42, Role = "Owner", IsActive = false, CanManageMembers = true
        });
        var service = MemberService(members, organizations);

        var response = await service.UpdateMemberAsync(new UpdateOrganizationMemberDto
        {
            Id = 7,
            Role = "Owner"
        }, 10, 42);

        response.Success.Should().BeFalse();
        response.StatusCode.Should().Be(403);
        members.Verify(x => x.UpdateMemberAsync(It.IsAny<OrganizationMember>()), Times.Never);
    }

    [Fact]
    public async Task UpdateMember_ManagerWithManageMembers_CannotMintOwner()
    {
        var members = new Mock<IOrganizationMemberRepository>(MockBehavior.Strict);
        var organizations = new Mock<IOrganizationRepository>(MockBehavior.Strict);
        members.Setup(x => x.GetMemberByIdAsync(7)).ReturnsAsync(new OrganizationMember
        {
            Id = 7, OrganizationId = 10, UserId = 99, Role = "Viewer", IsActive = true
        });
        organizations.Setup(x => x.GetOrganizationByIdAsync(10)).ReturnsAsync(
            new Organization { Id = 10, IsActive = true, IsDeleted = false });
        members.Setup(x => x.GetMemberAsync(10, 42)).ReturnsAsync(new OrganizationMember
        {
            OrganizationId = 10, UserId = 42, Role = "Manager", IsActive = true, CanManageMembers = true
        });
        var service = MemberService(members, organizations);

        var response = await service.UpdateMemberAsync(new UpdateOrganizationMemberDto
        {
            Id = 7,
            Role = "Owner"
        }, 10, 42);

        response.Success.Should().BeFalse();
        response.StatusCode.Should().Be(403);
        members.Verify(x => x.UpdateMemberAsync(It.IsAny<OrganizationMember>()), Times.Never);
    }

    private static OrganizationMemberService MemberService(
        Mock<IOrganizationMemberRepository> members,
        Mock<IOrganizationRepository> organizations) => new(
            members.Object,
            organizations.Object,
            Mock.Of<IUserRepository>(),
            Mock.Of<IMapper>(),
            Mock.Of<ILogger<OrganizationMemberService>>());
}

public sealed class OrganizationInviteOwnerGrantSecurityTests
{
    [Fact]
    public async Task CreateInvite_ManagerWithManageMembers_CannotInviteOwner()
    {
        var invites = new Mock<IOrganizationInviteRepository>(MockBehavior.Strict);
        var members = new Mock<IOrganizationMemberRepository>(MockBehavior.Strict);
        var organizations = new Mock<IOrganizationRepository>(MockBehavior.Strict);
        organizations.Setup(x => x.GetOrganizationByIdAsync(10)).ReturnsAsync(
            new Organization { Id = 10, Name = "A", IsActive = true, IsDeleted = false });
        members.Setup(x => x.GetMemberAsync(10, 42)).ReturnsAsync(new OrganizationMember
        {
            OrganizationId = 10, UserId = 42, Role = "Manager", IsActive = true, CanManageMembers = true
        });
        var service = InviteService(invites, members, organizations);

        var response = await service.CreateInviteAsync(new CreateOrganizationInviteDto
        {
            OrganizationId = 10,
            Email = "new-owner@example.com",
            Role = "owner"
        }, 10, 42);

        response.Success.Should().BeFalse();
        response.StatusCode.Should().Be(403);
        invites.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task AcceptOwnerInvite_GrantingOwnerNoLongerActive_DoesNotActivateMembership()
    {
        var invites = new Mock<IOrganizationInviteRepository>(MockBehavior.Strict);
        var members = new Mock<IOrganizationMemberRepository>(MockBehavior.Strict);
        var organizations = new Mock<IOrganizationRepository>(MockBehavior.Strict);
        invites.Setup(x => x.GetInviteByTokenAsync("token")).ReturnsAsync(new OrganizationInvite
        {
            Id = 1,
            OrganizationId = 10,
            Email = "new-owner@example.com",
            Role = "Owner",
            Token = "token",
            InvitedBy = 42,
            ExpiresAt = DateTime.Now.AddDays(1),
            IsAccepted = false
        });
        organizations.Setup(x => x.GetOrganizationByIdAsync(10)).ReturnsAsync(
            new Organization { Id = 10, Name = "A", IsActive = true, IsDeleted = false });
        members.Setup(x => x.GetMemberAsync(10, 42)).ReturnsAsync(new OrganizationMember
        {
            OrganizationId = 10, UserId = 42, Role = "Owner", IsActive = false
        });
        var service = InviteService(invites, members, organizations);

        var response = await service.AcceptInviteAsync(new AcceptOrganizationInviteDto { Token = "token" }, 99);

        response.Success.Should().BeFalse();
        response.StatusCode.Should().Be(403);
        members.Verify(x => x.UpdateMemberAsync(It.IsAny<OrganizationMember>()), Times.Never);
        members.Verify(x => x.AddMemberAsync(It.IsAny<OrganizationMember>()), Times.Never);
        invites.Verify(x => x.UpdateInviteAsync(It.IsAny<OrganizationInvite>()), Times.Never);
    }

    private static OrganizationInviteService InviteService(
        Mock<IOrganizationInviteRepository> invites,
        Mock<IOrganizationMemberRepository> members,
        Mock<IOrganizationRepository> organizations) => new(
            invites.Object,
            organizations.Object,
            members.Object,
            Mock.Of<IOrganizationMemberService>(),
            Mock.Of<IUserRepository>(),
            Mock.Of<IEmailService>(),
            new ConfigurationBuilder().Build(),
            Mock.Of<IWebHostEnvironment>(),
            Mock.Of<ILogger<OrganizationInviteService>>());
}
