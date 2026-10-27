using brownstone_hub_api.Services.ShortStay;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace brownstone_hub_api.Tests.Services.ShortStay;

public sealed class ShortStayRefundRecoveryWorkerTests
{
    [Theory]
    [InlineData(null, false)]
    [InlineData("false", false)]
    [InlineData("yes", false)]
    [InlineData("true", true)]
    public void Worker_requires_explicit_true(string? setting, bool expected)
    {
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        { ["ShortStayBooking:RefundRecoveryEnabled"] = setting }).Build();
        Assert.Equal(expected, ShortStayRefundRecoveryWorker.Enabled(config));
    }
}
