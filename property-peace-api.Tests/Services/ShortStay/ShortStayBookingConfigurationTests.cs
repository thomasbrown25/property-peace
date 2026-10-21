using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace brownstone_hub_api.Tests.Services.ShortStay;

public sealed class ShortStayBookingConfigurationTests
{
    private static readonly string[] OptionalSwitches =
    [
        "ShortStayCollection:RequireIdentityBeforeConnect",
        "ShortStayCollection:RequireApplicationApproval",
        "ShortStayCollection:RequireIdentityForApplicationApproval",
        "Stripe:IdentityEnabled",
        "ShortStayBooking:Enabled"
    ];

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void CheckedInSettings_ExplicitlyDisableOptionalSwitches(bool includeDevelopmentOverride)
    {
        var apiProject = Path.GetFullPath(Path.Combine(
            AppContext.BaseDirectory, "..", "..", "..", "..", "property-peace-api"));
        var builder = new ConfigurationBuilder()
            .SetBasePath(apiProject)
            .AddJsonFile("appsettings.json", optional: false);
        if (includeDevelopmentOverride)
            builder.AddJsonFile("appsettings.Development.json", optional: false);
        var configuration = builder.Build();

        foreach (var key in OptionalSwitches)
        {
            configuration.GetValue<bool?>(key).Should().BeFalse($"{key} must be explicitly off");
            configuration.GetValue<bool>(key).Should().BeFalse();
        }

        configuration.GetValue<bool?>("Stripe:RentPaymentsEnabled").Should().BeFalse();
        configuration.GetValue<bool?>("Stripe:TransfersEnabled").Should().BeFalse();
    }

    [Fact]
    public void MissingOptionalSwitches_BindAsFalse()
    {
        var configuration = new ConfigurationBuilder().Build();
        foreach (var key in OptionalSwitches)
        {
            configuration.GetValue<bool?>(key).Should().BeNull();
            configuration.GetValue<bool>(key).Should().BeFalse();
        }
    }
}
