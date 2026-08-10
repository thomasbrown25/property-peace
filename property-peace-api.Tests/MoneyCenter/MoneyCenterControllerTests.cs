using System.Reflection;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Services.MoneyCenter;
using FluentAssertions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.MoneyCenter;

public sealed class MoneyCenterControllerTests
{
    [Fact]
    public async Task Controller_DerivesOrganizationOnlyFromValidatedContextAndHasRoleGuards()
    {
        var service = new Mock<IMoneyCenterService>(MockBehavior.Strict);
        var controller = new MoneyCenterController(service.Object)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };

        var result = await controller.GetOverview(null, null, null, null, 30, 50, default);

        result.Should().BeOfType<ObjectResult>().Which.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
        service.VerifyNoOtherCalls();
        typeof(MoneyCenterController).GetCustomAttributes<AuthorizeAttribute>(true)
            .Should().ContainSingle(x => x.Roles == "Landlord,Admin");
        typeof(MoneyCenterController).GetCustomAttributes(true)
            .Select(x => x.GetType().Name).Should().Contain("RequireOrganizationRoleAttribute");
        typeof(MoneyCenterController).GetMethods(BindingFlags.Instance | BindingFlags.Public)
            .SelectMany(x => x.GetParameters()).Select(x => x.Name)
            .Should().NotContain(x => x == "organizationId" || x == "landlordId");
    }
}