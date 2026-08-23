using brownstone_hub_api.Controllers;
using FluentAssertions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace brownstone_hub_api.Tests.Controllers;

public sealed class UserSettingsControllerContractTests
{
    [Fact]
    public void GetSettings_RequiresAuthorizationAtExpectedRoute()
    {
        var method = typeof(UserController).GetMethod(nameof(UserController.GetSettings));

        method.Should().NotBeNull();
        method!.GetCustomAttributes(typeof(AuthorizeAttribute), inherit: true)
            .Should().ContainSingle();
        method.GetCustomAttributes(typeof(AllowAnonymousAttribute), inherit: true)
            .Should().BeEmpty();
        method.GetCustomAttributes(typeof(HttpGetAttribute), inherit: true)
            .Should().ContainSingle()
            .Which.As<HttpGetAttribute>()
            .Template.Should().Be("settings");
    }
}
