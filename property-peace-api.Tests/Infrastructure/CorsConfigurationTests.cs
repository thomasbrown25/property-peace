using brownstone_hub_api.Infrastructure;
using FluentAssertions;
using Xunit;

namespace brownstone_hub_api.Tests.Infrastructure;

public sealed class CorsConfigurationTests
{
    [Fact]
    public void AllowedHeaders_IncludeMaintenanceIdempotencyKey()
    {
        CorsConfiguration.AllowedHeaders.Should().Contain("Idempotency-Key");
    }
}
