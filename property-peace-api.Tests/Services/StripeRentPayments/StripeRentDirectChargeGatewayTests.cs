using System.Net;
using brownstone_hub_api.Services.StripeRentPayments;
using FluentAssertions;
using Stripe;
using Xunit;

namespace brownstone_hub_api.Tests.Services.StripeRentPayments;

public sealed class StripeRentDirectChargeGatewayTests
{
    [Fact]
    public async Task IntentCreateAndUpdate_UseConnectedHeaderCustomerAndNoPlatformTransfer()
    {
        var transport = new Transport();
        var gateway = new StripeRentGateway(new StripeClient("sk_test_transport_only", httpClient: transport));
        var request = new StripeRentIntentRequest(10000, "usd", "Rent", "legacy-group", "rent-direct-op",
            new Dictionary<string, string> { ["paymentFlow"] = "direct_charge" }, "acct_landlord", "cus_local");
        await gateway.CreatePaymentIntentAsync(request);
        await gateway.UpdatePaymentIntentAsync("pi_direct", request with { AmountCents = 20000 });
        transport.Requests.Should().HaveCount(2);
        transport.Requests.Should().OnlyContain(r => r.StripeHeaders["Stripe-Account"] == "acct_landlord");
        transport.Requests[0].StripeHeaders["Idempotency-Key"].Should().Be("rent-direct-op");
        var body = Uri.UnescapeDataString(await transport.Requests[0].Content.ReadAsStringAsync());
        body.Should().Contain("customer=cus_local").And.Contain("payment_method_types[0]=card")
            .And.Contain("payment_method_types[1]=us_bank_account")
            .And.NotContain("transfer_data").And.NotContain("transfer_group").And.NotContain("application_fee");
        transport.Requests[1].Uri.AbsolutePath.Should().Be("/v1/payment_intents/pi_direct");
    }

    [Fact]
    public async Task CustomerSetupAndProviderReads_NeverUsePlatformScope()
    {
        var transport = new Transport();
        var gateway = new StripeRentGateway(new StripeClient("sk_test_transport_only", httpClient: transport));
        await gateway.CreateCustomerAsync(7, "acct_landlord", "tenant@example.test", "Tenant");
        await gateway.CreateSetupIntentAsync("cus_local", "acct_landlord", 7, 44);
        await gateway.GetPaymentIntentStateAsync("pi_direct", "acct_landlord");
        await gateway.GetPaymentMethodTypeAsync("pi_direct", "acct_landlord");
        await gateway.GetTransactionAsync("pi_direct", "acct_landlord");
        await gateway.GetSourceStateAsync("ch_direct", "acct_landlord");
        transport.Requests.Should().HaveCount(6);
        transport.Requests.Should().OnlyContain(r => r.StripeHeaders["Stripe-Account"] == "acct_landlord");
        var setup = Uri.UnescapeDataString(await transport.Requests[1].Content.ReadAsStringAsync());
        setup.Should().Contain("customer=cus_local").And.Contain("usage=off_session");
        transport.Requests.Should().NotContain(r => r.Uri.AbsolutePath.Contains("transfers"));
    }

    private sealed class Transport : IHttpClient
    {
        public List<StripeRequest> Requests { get; } = [];
        public Task<StripeResponse> MakeRequestAsync(StripeRequest request, CancellationToken cancellationToken = default)
        {
            Requests.Add(request);
            var path = request.Uri.AbsolutePath;
            var json = path.EndsWith("/customers")
                ? """{"id":"cus_local","object":"customer"}"""
                : path.EndsWith("/setup_intents")
                    ? """{"id":"seti_direct","object":"setup_intent","client_secret":"seti_secret"}"""
                    : path.Contains("/charges/")
                        ? """{"id":"ch_direct","object":"charge","paid":true,"amount":10000,"currency":"usd","payment_intent":"pi_direct"}"""
                        : """{"id":"pi_direct","object":"payment_intent","client_secret":"pi_secret","status":"succeeded","amount":10000,"currency":"usd","latest_charge":{"id":"ch_direct","object":"charge","payment_method_details":{"type":"card"}}}""";
            return Task.FromResult(new StripeResponse(HttpStatusCode.OK, null, json));
        }
        public Task<StripeStreamedResponse> MakeStreamingRequestAsync(StripeRequest request, CancellationToken cancellationToken = default) => throw new NotSupportedException();
    }
}
