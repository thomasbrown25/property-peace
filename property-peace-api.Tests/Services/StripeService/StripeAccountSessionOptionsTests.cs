using FluentAssertions;
using Xunit;

namespace brownstone_hub_api.Tests.Services.StripeService;

public sealed class StripeAccountSessionOptionsTests
{
    [Fact]
    public void BuildAccountSessionOptions_ForManagement_EnablesOnlyAccountManagement()
    {
        var options = global::brownstone_hub_api.Services.StripeService.StripeService.BuildAccountSessionOptions(
            "acct_owned", enableAccountManagement: true);

        options.Account.Should().Be("acct_owned");
        options.Components.AccountManagement.Should().NotBeNull();
        options.Components.AccountManagement.Enabled.Should().BeTrue();
        options.Components.AccountOnboarding.Should().BeNull();
    }
}
