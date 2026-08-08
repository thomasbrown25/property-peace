using brownstone_hub_api.Services.Leads;
using FluentAssertions;
using Microsoft.AspNetCore.DataProtection;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Leads;

public sealed class PublicLeadSessionServiceTests
{
    [Fact]
    public void Sessions_are_opaque_equal_shaped_and_listing_bound()
    {
        var service = new PublicLeadSessionService(new EphemeralDataProtectionProvider(), TimeProvider.System);

        var valid = service.Issue(10, 42);
        var decoy = service.Issue(10, null);

        valid.Should().HaveLength(decoy.Length);
        valid.Should().NotBe("42", "the browser session must not expose the plaintext lead ID");
        service.Resolve(valid, 10).Should().Be(42);
        service.Resolve(valid, 11).Should().BeNull();
        service.Resolve("not-a-session", 10).Should().BeNull();
        service.Resolve(decoy, 10).Should().NotBe(42);
    }
}
