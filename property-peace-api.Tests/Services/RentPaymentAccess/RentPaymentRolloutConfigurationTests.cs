using brownstone_hub_api.Config;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace brownstone_hub_api.Tests.Services.RentPaymentAccess;

public sealed class RentPaymentRolloutConfigurationTests
{
    [Fact]
    public void ProductionDefaults_EnableApprovedFreePlanRentCollection()
    {
        var apiProject = Path.GetFullPath(Path.Combine(
            AppContext.BaseDirectory,
            "..", "..", "..", "..",
            "property-peace-api"));
        var configuration = new ConfigurationBuilder()
            .SetBasePath(apiProject)
            .AddJsonFile("appsettings.json", optional: false)
            .Build();

        configuration.GetValue<bool>("Stripe:RentPaymentsEnabled").Should().BeTrue();
        configuration.GetValue<bool>("Stripe:TransfersEnabled").Should().BeTrue();
        configuration.GetValue<FeatureReadinessState>(
            $"FeatureReadiness:Features:{FeatureKeys.OnlineRentCollection}")
            .Should().Be(FeatureReadinessState.Available);
    }
}
