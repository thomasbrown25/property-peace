using System.Net;
using System.Net.Http;
using brownstone_hub_api.Services.ShortStayStripe;
using Stripe;
using Xunit;

namespace brownstone_hub_api.Tests.Services.ShortStay.Stripe;

public class ShortStayDirectChargeGatewayTests
{
    private const string Account = "acct_1234567890123456";
    private const string Intent = "pi_1234567890123456";
    private const string Key = "shortstay:operation123:create:v1";

    [Fact]
    public async Task Search_is_exact_connected_account_scoped_bounded_and_secret_free()
    {
        var handler = new StubHandler();
        using var client = new HttpClient(handler);
        var results = await Gateway(handler, client).SearchByReservationCodeAsync(Account, "ABCDEF123456");
        Assert.Single(results);
        Assert.Null(results[0].ClientSecret);
        var request = Assert.Single(handler.Requests);
        Assert.Equal("GET", request.Method);
        Assert.Equal("/v1/payment_intents/search", request.Path);
        Assert.Equal(Account, request.Account);
        Assert.Contains("metadata['reservation_code']:'ABCDEF123456'", Uri.UnescapeDataString(handler.Queries.Single()));
        Assert.Contains("limit=2", handler.Queries.Single());
    }

    [Fact]
    public async Task Create_Uses_connected_account_header_card_only_minimal_metadata_and_key()
    {
        var handler = new StubHandler();
        using var client = new HttpClient(handler);
        var gateway = Gateway(handler, client);
        var result = await gateway.CreatePaymentIntentAsync(Account, 12345, "usd", "ABCDEF123456", Key);
        Assert.Equal("ABCDEF123456", result.ReservationCode);
        Assert.Equal(Intent, result.PaymentIntentId);
        Assert.Equal("secret-for-guest-only", result.ClientSecret);
        Assert.Equal(Account, result.AccountId);
        Assert.Equal(12345, result.AmountCents);
        Assert.Equal("requires_payment_method", result.Status);
        var req = Assert.Single(handler.Requests);
        Assert.Equal("POST", req.Method);
        Assert.Equal("/v1/payment_intents", req.Path);
        Assert.Equal(Account, req.Account);
        Assert.Equal(Key, req.Idempotency);
        Assert.Contains("amount=12345", req.Body);
        Assert.Contains("currency=usd", req.Body);
        Assert.Contains("payment_method_types[0]=card", Uri.UnescapeDataString(req.Body));
        Assert.Contains("metadata[reservation_code]=ABCDEF123456", Uri.UnescapeDataString(req.Body));
        Assert.Contains("metadata[version]=1", Uri.UnescapeDataString(req.Body));
        Assert.DoesNotContain("transfer_data", req.Body);
        Assert.DoesNotContain("application_fee", req.Body);
        Assert.DoesNotContain("automatic_payment_methods", req.Body);
        Assert.DoesNotContain("guest", req.Body);
    }

    [Fact]
    public async Task Guest_recovery_only_returns_secret_for_exact_provider_scope()
    {
        var handler = new StubHandler();
        using var client = new HttpClient(handler);
        var gateway = Gateway(handler, client);
        var match = await gateway.RetrieveForGuestPaymentAsync(Account, Intent, 12345, "usd", "ABCDEF123456");
        Assert.Equal("secret-for-guest-only", match.ClientSecret);
        await Assert.ThrowsAsync<InvalidOperationException>(() => gateway.RetrieveForGuestPaymentAsync(Account, Intent, 12346, "usd", "ABCDEF123456"));
        await Assert.ThrowsAsync<InvalidOperationException>(() => gateway.RetrieveForGuestPaymentAsync(Account, Intent, 12345, "usd", "OTHER"));
        Assert.All(handler.Requests, x => Assert.Equal(Account, x.Account));
    }
    [Fact]
    public async Task Retrieve_cancel_and_refund_are_account_scoped()
    {
        var handler = new StubHandler();
        using var client = new HttpClient(handler);
        var gateway = Gateway(handler, client);
        var retrieved = await gateway.RetrieveAsync(Account, Intent);
        var canceled = await gateway.CancelAsync(Account, Intent, "shortstay:operation123:cancel:v1");
        var refund = await gateway.RefundAsync(Account, Intent, 1500, "shortstay:operation123:refund:v1");
        Assert.Equal("requires_payment_method", retrieved.Status);
        Assert.Null(retrieved.ClientSecret);
        Assert.Equal("canceled", canceled.Status);
        Assert.Equal("re_123", refund.RefundId);
        Assert.Equal(3, handler.Requests.Count);
        Assert.All(handler.Requests, x => Assert.Equal(Account, x.Account));
        Assert.Equal($"/v1/payment_intents/{Intent}", handler.Requests[0].Path);
        Assert.Equal($"/v1/payment_intents/{Intent}/cancel", handler.Requests[1].Path);
        Assert.Equal("shortstay:operation123:cancel:v1", handler.Requests[1].Idempotency);
        Assert.Equal("/v1/refunds", handler.Requests[2].Path);
        Assert.Equal("shortstay:operation123:refund:v1", handler.Requests[2].Idempotency);
        Assert.Contains($"payment_intent={Intent}", handler.Requests[2].Body);
        Assert.Contains("amount=1500", handler.Requests[2].Body);
    }

    [Fact]
    public async Task Refund_inventory_is_scoped_to_connected_account_and_payment_intent()
    {
        var handler = new StubHandler();
        using var client = new HttpClient(handler);
        var refunds = await Gateway(handler, client).ListRefundsAsync(Account, Intent);
        var refund = Assert.Single(refunds);
        Assert.Equal(Intent, refund.PaymentIntentId);
        Assert.Equal("succeeded", refund.Status);
        var request = Assert.Single(handler.Requests);
        Assert.Equal("GET", request.Method);
        Assert.Equal("/v1/refunds", request.Path);
        Assert.Equal(Account, request.Account);
        Assert.Equal("", request.Idempotency);
        Assert.Contains("payment_intent=" + Intent, handler.Queries.Single());
    }

    [Theory]
    [InlineData("acct_wrong", 100, "usd", "CODE", Key)]
    [InlineData(Account, 49, "usd", "CODE", Key)]
    [InlineData(Account, 200001, "usd", "CODE", Key)]
    [InlineData(Account, 100, "eur", "CODE", Key)]
    [InlineData(Account, 100, "usd", "guest@example.com", Key)]
    [InlineData(Account, 100, "usd", "CODE", "bad key")]
    public async Task Invalid_create_input_never_reaches_stripe(string account, long amount, string currency, string code, string key)
    {
        var handler = new StubHandler();
        using var client = new HttpClient(handler);
        var gateway = Gateway(handler, client);
        await Assert.ThrowsAnyAsync<ArgumentException>(() => gateway.CreatePaymentIntentAsync(account, amount, currency, code, key));
        Assert.Empty(handler.Requests);
    }

    [Fact]
    public void Mismatched_key_mode_fails_closed()
    {
        var handler = new StubHandler();
        using var client = new HttpClient(handler);
        var stripe = new StripeClient("sk_live_fake", httpClient: new SystemNetHttpClient(client, 0));
        Assert.Throws<InvalidOperationException>(() => new ShortStayDirectChargeGateway(stripe, StripeGatewayMode.Test));
        Assert.Empty(handler.Requests);
    }

    [Fact]
    public async Task Oversized_key_and_invalid_mutation_ids_are_rejected_before_transport()
    {
        var handler = new StubHandler();
        using var client = new HttpClient(handler);
        var gateway = Gateway(handler, client);
        await Assert.ThrowsAnyAsync<ArgumentException>(() => gateway.CreatePaymentIntentAsync(
            Account, 100, "usd", "CODE", "shortstay:" + new string('a', 247)));
        await Assert.ThrowsAnyAsync<ArgumentException>(() => gateway.RetrieveAsync("acct_other", Intent));
        await Assert.ThrowsAnyAsync<ArgumentException>(() => gateway.CancelAsync(Account, "pi_bad", Key));
        await Assert.ThrowsAnyAsync<ArgumentException>(() => gateway.RefundAsync(Account, Intent, 201000, Key));
        Assert.Empty(handler.Requests);
    }

    [Fact]
    public async Task Replaying_create_uses_the_same_key_and_scope()
    {
        var handler = new StubHandler();
        using var client = new HttpClient(handler);
        var gateway = Gateway(handler, client);
        await gateway.CreatePaymentIntentAsync(Account, 12345, "usd", "CODE", Key);
        await gateway.CreatePaymentIntentAsync(Account, 12345, "usd", "CODE", Key);
        Assert.Equal(2, handler.Requests.Count);
        Assert.All(handler.Requests, request => {
            Assert.Equal(Key, request.Idempotency);
            Assert.Equal(Account, request.Account);
        });
    }

    [Fact]
    public async Task Network_errors_do_not_create_successful_payment_result()
    {
        var handler = new StubHandler { Fail = true };
        using var client = new HttpClient(handler);
        var gateway = Gateway(handler, client);
        await Assert.ThrowsAnyAsync<Exception>(() => gateway.CreatePaymentIntentAsync(Account, 100, "usd", "CODE", Key));
    }

    private static ShortStayDirectChargeGateway Gateway(StubHandler handler, HttpClient client) =>
        new(new StripeClient("sk_test_fake", httpClient: new SystemNetHttpClient(client, 0)), StripeGatewayMode.Test);

    private sealed record Captured(string Method, string Path, string Account, string Idempotency, string Body);
    private sealed class StubHandler : HttpMessageHandler
    {
        public List<Captured> Requests { get; } = new();
        public List<string> Queries { get; } = new();
        public bool Fail { get; set; }
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            if (Fail) throw new HttpRequestException("network offline");
            var body = request.Content is null ? "" : await request.Content.ReadAsStringAsync(cancellationToken);
            Requests.Add(new Captured(request.Method.Method, request.RequestUri!.AbsolutePath,
                request.Headers.GetValues("Stripe-Account").Single(),
                request.Headers.TryGetValues("Idempotency-Key", out var keys) ? keys.Single() : "", body));
            var path = request.RequestUri!.AbsolutePath;
            Queries.Add(request.RequestUri.Query);
            var json = path == "/v1/payment_intents/search" ? "{\"object\":\"search_result\",\"has_more\":false,\"data\":[{\"id\":\"pi_1234567890123456\",\"object\":\"payment_intent\",\"status\":\"requires_payment_method\",\"amount\":12345,\"currency\":\"usd\",\"client_secret\":\"never-return\",\"metadata\":{\"reservation_code\":\"ABCDEF123456\"}}]}"
                : path == "/v1/refunds" && request.Method == HttpMethod.Get
                ? "{\"object\":\"list\",\"has_more\":false,\"data\":[{\"id\":\"re_123\",\"object\":\"refund\",\"status\":\"succeeded\",\"amount\":1500,\"payment_intent\":\"pi_1234567890123456\"}]}"
                : path == "/v1/refunds"
                ? "{\"id\":\"re_123\",\"object\":\"refund\",\"status\":\"succeeded\",\"amount\":1500}"
                : "{\"id\":\"pi_1234567890123456\",\"object\":\"payment_intent\",\"amount\":12345,\"currency\":\"usd\",\"status\":\"" +
                    (path.EndsWith("/cancel", StringComparison.Ordinal) ? "canceled" : "requires_payment_method") +
                    "\",\"metadata\":{\"reservation_code\":\"ABCDEF123456\",\"version\":\"1\"},\"client_secret\":\"secret-for-guest-only\"}";
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(json) };
        }
    }
}
