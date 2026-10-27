using brownstone_hub_api.Config;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace brownstone_hub_api.Tests.Services.RentPaymentAccess;

public sealed class RentPaymentRolloutConfigurationTests
{
    [Fact]
    public void CheckedInDefaults_KeepStripeRentPaymentsAndTransfersDisabled()
    {
        var apiProject = Path.GetFullPath(Path.Combine(
            AppContext.BaseDirectory,
            "..", "..", "..", "..",
            "property-peace-api"));
        var configuration = new ConfigurationBuilder()
            .SetBasePath(apiProject)
            .AddJsonFile("appsettings.json", optional: false)
            .Build();

        configuration.GetValue<bool?>("Stripe:RentPaymentsEnabled").Should().BeFalse();
        configuration.GetValue<bool?>("Stripe:TransfersEnabled").Should().BeFalse();
        configuration.GetValue<FeatureReadinessState>(
            $"FeatureReadiness:Features:{FeatureKeys.OnlineRentCollection}")
            .Should().Be(FeatureReadinessState.Available);
    }

    [Fact]
    public void DevelopmentSettings_DoNotEnableStripeRentPaymentsOrTransfers()
    {
        var apiProject = Path.GetFullPath(Path.Combine(
            AppContext.BaseDirectory,
            "..", "..", "..", "..",
            "property-peace-api"));
        var configuration = new ConfigurationBuilder()
            .SetBasePath(apiProject)
            .AddJsonFile("appsettings.json", optional: false)
            .AddJsonFile("appsettings.Development.json", optional: true) // Gitignored local override; CI checks base defaults without it.
            .Build();

        configuration.GetValue<bool?>("Stripe:RentPaymentsEnabled").Should().BeFalse();
        configuration.GetValue<bool?>("Stripe:TransfersEnabled").Should().BeFalse();
    }
}
