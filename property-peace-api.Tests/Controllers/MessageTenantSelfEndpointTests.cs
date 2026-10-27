using brownstone_hub_api.Controllers;
using brownstone_hub_api.Middleware;
using FluentAssertions;
using Xunit;

namespace brownstone_hub_api.Tests.Controllers;

public sealed class MessageTenantSelfEndpointTests
{
    [Theory]
    [InlineData(nameof(MessageController.AddMessage))]
    [InlineData(nameof(MessageController.GetMessage))]
    [InlineData(nameof(MessageController.GetMessages))]
    [InlineData(nameof(MessageController.MarkMessageAsRead))]
    [InlineData(nameof(MessageController.MarkConversationAsRead))]
    public void TenantMessageActions_RequireLeaseScopedOrganization(string action) =>
        typeof(MessageController).GetMethod(action)!
            .GetCustomAttributes(typeof(TenantSelfOrganizationAttribute), true)
            .Cast<TenantSelfOrganizationAttribute>().Should().ContainSingle()
            .Which.AllowWithoutOrganization.Should().BeFalse();

    [Theory]
    [InlineData(nameof(MessageController.UpdateMessage))]
    [InlineData(nameof(MessageController.DeleteMessage))]
    public void OtherMutations_DoNotInheritTenantSelfAuthority(string action) =>
        typeof(MessageController).GetMethod(action)!
            .GetCustomAttributes(typeof(TenantSelfOrganizationAttribute), true).Should().BeEmpty();
}
