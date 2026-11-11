using brownstone_hub_api.Infrastructure;
using FluentAssertions;
using Microsoft.AspNetCore.Cors.Infrastructure;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;

namespace brownstone_hub_api.Tests.Infrastructure;

public sealed class CorsConfigurationTests
{
    [Fact]
    public void AllowedHeaders_IncludeMaintenanceIdempotencyKey()
    {
        CorsConfiguration.AllowedHeaders.Should().Contain("Idempotency-Key");
    }

    [Theory]
    [InlineData("authorization,cache-control,x-organization-id")]
    [InlineData("authorization,cache-control,pragma,x-organization-id")]
    public void StatusPreflight_AllowsEveryRequestedHeader(string requestedHeaders)
    {
        var context = new DefaultHttpContext();
        context.Request.Method = "OPTIONS";
        context.Request.Headers.Origin = "http://localhost:3000";
        context.Request.Headers["Access-Control-Request-Method"] = "GET";
        context.Request.Headers["Access-Control-Request-Headers"] = requestedHeaders;
        var policy = new CorsPolicyBuilder()
            .WithOrigins("http://localhost:3000")
            .WithHeaders(CorsConfiguration.AllowedHeaders)
            .WithMethods("GET")
            .AllowCredentials()
            .Build();
        var service = new CorsService(Options.Create(new CorsOptions()), NullLoggerFactory.Instance);

        var result = service.EvaluatePolicy(context, policy);
        service.ApplyResult(result, context.Response);

        result.IsOriginAllowed.Should().BeTrue();
        result.SupportsCredentials.Should().BeTrue();
        var allowed = context.Response.Headers["Access-Control-Allow-Headers"].ToString().Split(',');
        foreach (var header in requestedHeaders.Split(','))
            allowed.Should().Contain(value => string.Equals(value, header, StringComparison.OrdinalIgnoreCase));
        allowed.Should().NotContain("*");
    }
}
