using System.Net;
using brownstone_hub_api.Services.ShortStay;
using Microsoft.Extensions.Configuration;
using Stripe;
using Xunit;

namespace brownstone_hub_api.Tests.Services.ShortStay;

public sealed class ShortStayStripeEligibilityTests
{
    [Theory]
    [InlineData("active", true)]
    [InlineData("inactive", false)]
    public async Task Runtime_uses_real_Stripe_gateway_and_checks_card_capability(string status, bool expected)
    {
        var http = new Stub(request => request.Uri.AbsolutePath.EndsWith("/card_payments", StringComparison.Ordinal)
            ? "{\"id\":\"card_payments\",\"object\":\"capability\",\"status\":\"" + status + "\"}"
            : """{"id":"acct_owned","object":"account","details_submitted":true,"charges_enabled":true,"payouts_enabled":true,"requirements":{"currently_due":[],"past_due":[]}}""");
        var gateway = new ShortStayStripeEligibility(Config("sk_test_fake"), new StripeClient("sk_test_fake", httpClient: http));
        Assert.Equal(expected, await gateway.IsEligibleAsync("acct_owned", default));
        Assert.Equal(2, http.Requests.Count);
        Assert.All(http.Requests, request => Assert.Equal(HttpMethod.Get, request.Method));
    }

    [Fact]
    public async Task Missing_key_fails_closed_without_request()
    {
        var http = new Stub(_ => throw new Exception("must not call"));
        Assert.False(await new ShortStayStripeEligibility(Config(null), new StripeClient("sk_test_fake", httpClient: http))
            .IsEligibleAsync("acct_owned", default));
        Assert.Empty(http.Requests);
    }

    private static IConfiguration Config(string? key) => new ConfigurationBuilder()
        .AddInMemoryCollection(new Dictionary<string, string?> { ["Stripe:SecretKey"] = key }).Build();

    private sealed class Stub(Func<StripeRequest, string> respond) : IHttpClient
    {
        public List<StripeRequest> Requests { get; } = [];
        public Task<StripeResponse> MakeRequestAsync(StripeRequest request, CancellationToken cancellationToken = default)
        {
            Requests.Add(request);
            return Task.FromResult(new StripeResponse(HttpStatusCode.OK, new HttpResponseMessage().Headers, respond(request)));
        }
        public Task<StripeStreamedResponse> MakeStreamingRequestAsync(StripeRequest request, CancellationToken cancellationToken = default) => throw new NotSupportedException();
    }
}
