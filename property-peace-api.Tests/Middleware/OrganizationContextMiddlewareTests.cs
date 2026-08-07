using System.Security.Claims;
using brownstone_hub_api.Middleware;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Organizations;
using brownstone_hub_api.Repositories.Users;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Middleware;

public sealed class OrganizationContextMiddlewareTests
{
    private const long UserId = 42;
    private const long PersistedOrganizationId = 101;
    private const long RequestedOrganizationId = 202;

    [Fact]
    public async Task InvokeAsync_WithoutHeader_UsesPersistedCurrentOrganizationAndContinuesPipeline()
    {
        var fixture = CreateFixture();

        await fixture.InvokeAsync();

        fixture.NextWasCalled.Should().BeTrue();
        fixture.Context.Response.StatusCode.Should().Be(StatusCodes.Status200OK);
        fixture.Context.Items["OrganizationId"].Should().Be(PersistedOrganizationId);
        fixture.Context.Items["UserId"].Should().Be(UserId);
        fixture.Users.Verify(repository => repository.GetUser(UserId), Times.Once);
        fixture.Members.Verify(
            repository => repository.IsUserMemberOfOrganizationAsync(It.IsAny<long>(), It.IsAny<long>()),
            Times.Never);
    }

    [Fact]
    public async Task InvokeAsync_WithAuthorizedHeader_UsesRequestedOrganizationAndContinuesPipeline()
    {
        var fixture = CreateFixture(RequestedOrganizationId.ToString(), isMember: true);

        await fixture.InvokeAsync();

        fixture.NextWasCalled.Should().BeTrue();
        fixture.Context.Response.StatusCode.Should().Be(StatusCodes.Status200OK);
        fixture.Context.Items["OrganizationId"].Should().Be(RequestedOrganizationId);
        fixture.Context.Items["UserId"].Should().Be(UserId);
        fixture.Members.Verify(
            repository => repository.IsUserMemberOfOrganizationAsync(UserId, RequestedOrganizationId),
            Times.Once);
        fixture.Users.Verify(repository => repository.GetUser(It.IsAny<long>()), Times.Never);
    }

    [Theory]
    [InlineData("not-an-id")]
    [InlineData("0")]
    [InlineData("-1")]
    public async Task InvokeAsync_WithMalformedOrNonPositiveHeader_ReturnsBadRequestWithoutFallback(string header)
    {
        var fixture = CreateFixture(header);

        await fixture.InvokeAsync();

        fixture.Context.Response.StatusCode.Should().Be(StatusCodes.Status400BadRequest);
        fixture.NextWasCalled.Should().BeFalse();
        fixture.Context.Items.Should().NotContainKey("OrganizationId");
        fixture.Context.Items.Should().NotContainKey("UserId");
        fixture.Users.Verify(repository => repository.GetUser(It.IsAny<long>()), Times.Never);
        fixture.Members.Verify(
            repository => repository.IsUserMemberOfOrganizationAsync(It.IsAny<long>(), It.IsAny<long>()),
            Times.Never);
    }

    [Fact]
    public async Task InvokeAsync_WithUnauthorizedHeader_ReturnsForbiddenWithoutFallback()
    {
        var fixture = CreateFixture(RequestedOrganizationId.ToString(), isMember: false);

        await fixture.InvokeAsync();

        fixture.Context.Response.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
        fixture.NextWasCalled.Should().BeFalse();
        fixture.Context.Items.Should().NotContainKey("OrganizationId");
        fixture.Context.Items.Should().NotContainKey("UserId");
        fixture.Members.Verify(
            repository => repository.IsUserMemberOfOrganizationAsync(UserId, RequestedOrganizationId),
            Times.Once);
        fixture.Users.Verify(repository => repository.GetUser(It.IsAny<long>()), Times.Never);
    }

    private static Fixture CreateFixture(string? organizationHeader = null, bool isMember = false)
    {
        var context = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity(
                [new Claim(ClaimTypes.NameIdentifier, UserId.ToString())],
                authenticationType: "Test")),
        };

        if (organizationHeader is not null)
            context.Request.Headers["X-Organization-Id"] = organizationHeader;

        var users = new Mock<IUserRepository>();
        users.Setup(repository => repository.GetUser(UserId))
            .ReturnsAsync(new User
            {
                Id = UserId,
                CurrentOrganizationId = PersistedOrganizationId,
            });

        var members = new Mock<IOrganizationMemberRepository>();
        members.Setup(repository => repository.IsUserMemberOfOrganizationAsync(UserId, RequestedOrganizationId))
            .ReturnsAsync(isMember);

        var fixture = new Fixture(context, users, members);
        fixture.Middleware = new OrganizationContextMiddleware(
            _ =>
            {
                fixture.NextWasCalled = true;
                return Task.CompletedTask;
            },
            NullLogger<OrganizationContextMiddleware>.Instance);

        return fixture;
    }

    private sealed class Fixture(
        DefaultHttpContext context,
        Mock<IUserRepository> users,
        Mock<IOrganizationMemberRepository> members)
    {
        public DefaultHttpContext Context { get; } = context;
        public Mock<IUserRepository> Users { get; } = users;
        public Mock<IOrganizationMemberRepository> Members { get; } = members;
        public OrganizationContextMiddleware Middleware { get; set; } = null!;
        public bool NextWasCalled { get; set; }

        public Task InvokeAsync() => Middleware.InvokeAsync(Context, Users.Object, Members.Object);
    }
}
