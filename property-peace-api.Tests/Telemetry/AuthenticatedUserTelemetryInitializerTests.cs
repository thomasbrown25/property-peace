using System.Security.Claims;
using brownstone_hub_api.Telemetry;
using Microsoft.ApplicationInsights.DataContracts;
using Microsoft.AspNetCore.Http;
using Xunit;

namespace brownstone_hub_api.Tests.Telemetry;

public class AuthenticatedUserTelemetryInitializerTests
{
    [Fact]
    public void Initialize_sets_stable_numeric_user_id_for_authenticated_request()
    {
        var context = AuthenticatedContext(
            new Claim(ClaimTypes.NameIdentifier, "386"),
            new Claim("userId", "999"));
        var telemetry = new RequestTelemetry();

        new AuthenticatedUserTelemetryInitializer(new HttpContextAccessor { HttpContext = context })
            .Initialize(telemetry);

        Assert.Equal("386", telemetry.Context.User.AuthenticatedUserId);
    }

    [Fact]
    public void Initialize_uses_numeric_userId_claim_when_name_identifier_is_missing()
    {
        var context = AuthenticatedContext(new Claim("userId", "386"));
        var telemetry = new RequestTelemetry();

        new AuthenticatedUserTelemetryInitializer(new HttpContextAccessor { HttpContext = context })
            .Initialize(telemetry);

        Assert.Equal("386", telemetry.Context.User.AuthenticatedUserId);
    }

    [Fact]
    public void Initialize_never_uses_email_claim_as_authenticated_user_id()
    {
        var context = AuthenticatedContext(new Claim(ClaimTypes.NameIdentifier, "person@example.com"));
        var telemetry = new RequestTelemetry();

        new AuthenticatedUserTelemetryInitializer(new HttpContextAccessor { HttpContext = context })
            .Initialize(telemetry);

        Assert.Null(telemetry.Context.User.AuthenticatedUserId);
    }

    [Fact]
    public void Initialize_leaves_anonymous_telemetry_unattributed()
    {
        var context = new DefaultHttpContext();
        var telemetry = new RequestTelemetry();

        new AuthenticatedUserTelemetryInitializer(new HttpContextAccessor { HttpContext = context })
            .Initialize(telemetry);

        Assert.Null(telemetry.Context.User.AuthenticatedUserId);
    }

    [Fact]
    public void Initialize_adds_validated_organization_context_without_overwriting_existing_value()
    {
        var context = AuthenticatedContext(new Claim(ClaimTypes.NameIdentifier, "386"));
        context.Items["OrganizationId"] = 42L;
        var telemetry = new RequestTelemetry();
        telemetry.Properties["organizationId"] = "already-set";
        var initializer = new AuthenticatedUserTelemetryInitializer(new HttpContextAccessor { HttpContext = context });

        initializer.Initialize(telemetry);

        Assert.Equal("already-set", telemetry.Properties["organizationId"]);

        var freshTelemetry = new RequestTelemetry();
        initializer.Initialize(freshTelemetry);
        Assert.Equal("42", freshTelemetry.Properties["organizationId"]);
    }

    private static DefaultHttpContext AuthenticatedContext(params Claim[] claims)
    {
        return new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity(claims, "test"))
        };
    }
}
