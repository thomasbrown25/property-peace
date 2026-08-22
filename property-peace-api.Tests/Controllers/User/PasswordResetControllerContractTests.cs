using brownstone_hub_api.Controllers;
using FluentAssertions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace brownstone_hub_api.Tests.Controllers.Auth;

public sealed class PasswordResetControllerContractTests
{
    [Theory]
    [InlineData("ForgotPassword", "forgot-password")]
    [InlineData("ResetPassword", "reset-password")]
    public void PasswordResetActions_AreAnonymousPostsAtExpectedRoutes(string methodName, string route)
    {
        var method = typeof(UserController).GetMethod(methodName);

        method.Should().NotBeNull();
        method!.GetCustomAttributes(typeof(AllowAnonymousAttribute), inherit: true)
            .Should().ContainSingle();
        method.GetCustomAttributes(typeof(HttpPostAttribute), inherit: true)
            .Should().ContainSingle()
            .Which.As<HttpPostAttribute>()
            .Template.Should().Be(route);
    }
}
