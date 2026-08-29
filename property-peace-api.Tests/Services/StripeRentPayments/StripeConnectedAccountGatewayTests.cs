using System.Net;
using brownstone_hub_api.Services.StripeRentPayments;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Stripe;
using Xunit;

namespace brownstone_hub_api.Tests.Services.StripeRentPayments;

public sealed class StripeConnectedAccountGatewayTests
{
    private static readonly DateTimeOffset Now = new(2026, 8, 2, 18, 30, 0, TimeSpan.Zero);

    [Fact]
    public void ConfigurationConstructor_BindsExplicitStripeClientBeforeFirstRequest()
    {
        const string apiKey = "sk_test_gateway_constructor";
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Stripe:SecretKey"] = apiKey })
            .Build();

        var method = typeof(StripeConnectedAccountGateway).GetMethod(
            "BuildStripeClient", System.Reflection.BindingFlags.Static | System.Reflection.BindingFlags.NonPublic);
        method.Should().NotBeNull();
        var client = method!.Invoke(null, new object[] { configuration }).Should().BeAssignableTo<IStripeClient>().Subject;

        client.ApiKey.Should().Be(apiKey);

        using var provider = new ServiceCollection()
            .AddSingleton<TimeProvider>(new FixedTimeProvider(Now))
            .AddSingleton<IConfiguration>(configuration)
            .AddScoped<StripeConnectedAccountGateway>()
            .BuildServiceProvider();
        provider.GetRequiredService<StripeConnectedAccountGateway>().Should().NotBeNull();
    }

    [Fact]
    public async Task GetSnapshotAsync_PaginatesCompleteExternalAccountSet_AndIncludesDebitCardInstantPayouts()
    {
        var httpClient = new StubStripeHttpClient(request =>
        {
            var path = request.Uri.PathAndQuery;
            if (path == "/v1/accounts/acct_complete")
            {
                return Json(HttpStatusCode.OK, AccountJson("acct_complete"));
            }

            if (path == "/v1/accounts/acct_complete/external_accounts?limit=100")
            {
                return Json(HttpStatusCode.OK, """
                    {
                      "object": "list",
                      "url": "/v1/accounts/acct_complete/external_accounts",
                      "has_more": true,
                      "data": [
                        {
                          "id": "ba_first_page",
                          "object": "bank_account",
                          "currency": "usd",
                          "default_for_currency": true,
                          "fingerprint": "bank-fingerprint",
                          "status": "verified",
                          "available_payout_methods": ["standard"]
                        }
                      ]
                    }
                    """);
            }

            if (path == "/v1/accounts/acct_complete/external_accounts?limit=100&starting_after=ba_first_page")
            {
                return Json(HttpStatusCode.OK, """
                    {
                      "object": "list",
                      "url": "/v1/accounts/acct_complete/external_accounts",
                      "has_more": false,
                      "data": [
                        {
                          "id": "card_second_page",
                          "object": "card",
                          "currency": "usd",
                          "default_for_currency": false,
                          "fingerprint": "card-fingerprint",
                          "funding": "debit",
                          "status": "active",
                          "available_payout_methods": ["standard", "instant"]
                        }
                      ]
                    }
                    """);
            }

            throw new Xunit.Sdk.XunitException($"Unexpected Stripe request: {path}");
        });
        var gateway = Gateway(httpClient);

        var snapshot = await gateway.GetSnapshotAsync("acct_complete");

        snapshot.StripeAccountId.Should().Be("acct_complete");
        snapshot.RetrievedAt.Should().Be(Now);
        snapshot.InstantPayoutMethodsAvailable.Should().BeTrue();
        snapshot.ExternalAccountFingerprint.Should().NotBeNull();
        httpClient.Requests.Select(x => x.Uri.PathAndQuery).Should().Equal(
            "/v1/accounts/acct_complete",
            "/v1/accounts/acct_complete/external_accounts?limit=100",
            "/v1/accounts/acct_complete/external_accounts?limit=100&starting_after=ba_first_page");

        var bankOnly = StripeConnectedAccountGateway.FromAccount(
            CreateAccount("acct_complete"),
            Now,
            [CreateBankAccount()]);
        snapshot.ExternalAccountFingerprint.Should().NotBe(bankOnly.ExternalAccountFingerprint,
            "the debit card on the second page must be part of the external-account-set digest");
    }

    [Fact]
    public async Task GetSnapshotAsync_WhenLaterPageFails_DoesNotReturnPartialSnapshot()
    {
        var httpClient = new StubStripeHttpClient(request => request.Uri.PathAndQuery switch
        {
            "/v1/accounts/acct_failure" => Json(HttpStatusCode.OK, AccountJson("acct_failure")),
            "/v1/accounts/acct_failure/external_accounts?limit=100" => Json(HttpStatusCode.OK, """
                {
                  "object": "list",
                  "url": "/v1/accounts/acct_failure/external_accounts",
                  "has_more": true,
                  "data": [{
                    "id": "ba_first_page",
                    "object": "bank_account",
                    "currency": "usd",
                    "fingerprint": "bank-fingerprint",
                    "status": "verified",
                    "available_payout_methods": ["standard"]
                  }]
                }
                """),
            "/v1/accounts/acct_failure/external_accounts?limit=100&starting_after=ba_first_page" =>
                Json(HttpStatusCode.InternalServerError, """
                    {"error":{"type":"api_error","message":"temporary Stripe failure"}}
                    """),
            _ => throw new Xunit.Sdk.XunitException($"Unexpected Stripe request: {request.Uri.PathAndQuery}")
        });
        var gateway = Gateway(httpClient);

        var act = () => gateway.GetSnapshotAsync("acct_failure");

        await act.Should().ThrowAsync<StripeException>();
        httpClient.Requests.Should().HaveCount(3);
    }

    [Fact]
    public void FromAccount_IncludesCardInFingerprintAndInstantPayoutDetection()
    {
        var account = CreateAccount("acct_card");
        var card = new Card
        {
            Id = "card_debit",
            Currency = "usd",
            DefaultForCurrency = true,
            Fingerprint = "card-fingerprint",
            Funding = "debit",
            Status = "active",
            AvailablePayoutMethods = ["INSTANT"]
        };

        var snapshot = StripeConnectedAccountGateway.FromAccount(account, Now, [card]);
        var noExternalAccounts = StripeConnectedAccountGateway.FromAccount(account, Now, []);

        snapshot.InstantPayoutMethodsAvailable.Should().BeTrue();
        snapshot.ExternalAccountFingerprint.Should().NotBeNull();
        snapshot.ExternalAccountFingerprint.Should().NotBe(noExternalAccounts.ExternalAccountFingerprint);
    }

    [Fact]
    public void FromAccount_SelectsDefaultUsdBankForSafePayoutDisplayMetadata()
    {
        var account = CreateAccount("acct_display");
        var nonDefault = new BankAccount
        {
            Id = "ba_old",
            Currency = "usd",
            DefaultForCurrency = false,
            Fingerprint = "old-fingerprint",
            Last4 = "1111",
            BankName = "Old Bank",
            AccountType = "checking",
            Status = "verified"
        };
        var defaultBank = new BankAccount
        {
            Id = "ba_current",
            Currency = "usd",
            DefaultForCurrency = true,
            Fingerprint = "current-fingerprint",
            Last4 = "4242",
            BankName = "Current Bank",
            AccountType = "savings",
            Status = "verified"
        };

        var snapshot = StripeConnectedAccountGateway.FromAccount(account, Now, [nonDefault, defaultBank]);

        snapshot.PayoutBank.Should().NotBeNull();
        snapshot.PayoutBank!.ExternalAccountId.Should().Be("ba_current");
        snapshot.PayoutBank.Last4.Should().Be("4242");
        snapshot.PayoutBank.BankName.Should().Be("Current Bank");
        snapshot.PayoutBank.AccountType.Should().Be("savings");
        snapshot.PayoutBank.Currency.Should().Be("usd");
        snapshot.PayoutBank.DefaultForCurrency.Should().BeTrue();
        snapshot.PayoutBank.Fingerprint.Should().Be("current-fingerprint");
    }

    [Fact]
    public void FromAccount_WithoutDefaultUsdBank_DoesNotClaimAPayoutDestination()
    {
        var account = CreateAccount("acct_no_default_usd");
        var nonDefaultUsd = new BankAccount
        {
            Id = "ba_usd_not_default",
            Currency = "usd",
            DefaultForCurrency = false,
            Last4 = "1111",
            BankName = "Not Default"
        };
        var defaultCad = new BankAccount
        {
            Id = "ba_cad_default",
            Currency = "cad",
            DefaultForCurrency = true,
            Last4 = "2222",
            BankName = "Canadian Bank"
        };

        var snapshot = StripeConnectedAccountGateway.FromAccount(account, Now, [nonDefaultUsd, defaultCad]);

        snapshot.PayoutBank.Should().BeNull();
    }

    [Fact]
    public void FromAccount_WithoutExpandedExternalAccounts_FailsClosed()
    {
        var account = CreateAccount("acct_not_expanded");

        var act = () => StripeConnectedAccountGateway.FromAccount(account, Now);

        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*without an external-account list*");
    }

    [Fact]
    public void FromAccount_WithPartialExpandedExternalAccounts_FailsClosed()
    {
        var account = CreateAccount("acct_partial");
        account.ExternalAccounts = new StripeList<IExternalAccount>
        {
            HasMore = true,
            Data = [CreateBankAccount()]
        };

        var act = () => StripeConnectedAccountGateway.FromAccount(account, Now);

        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*partial external-account list*");
    }

    private static StripeConnectedAccountGateway Gateway(IHttpClient httpClient)
    {
        var stripeClient = new StripeClient(new StripeClientOptions
        {
            ApiKey = "sk_test_gateway",
            ApiBase = "https://api.stripe.test",
            HttpClient = httpClient
        });
        return new StripeConnectedAccountGateway(new FixedTimeProvider(Now), stripeClient);
    }

    private static Account CreateAccount(string id) => new()
    {
        Id = id,
        DetailsSubmitted = true,
        PayoutsEnabled = true,
        Capabilities = new AccountCapabilities { Transfers = "active" }
    };

    private static BankAccount CreateBankAccount() => new()
    {
        Id = "ba_first_page",
        Currency = "usd",
        DefaultForCurrency = true,
        Fingerprint = "bank-fingerprint",
        Status = "verified",
        AvailablePayoutMethods = ["standard"]
    };

    private static string AccountJson(string id) => """
        {
          "id": "ACCOUNT_ID",
          "object": "account",
          "details_submitted": true,
          "payouts_enabled": true,
          "capabilities": {"transfers": "active"},
          "requirements": {"currently_due": [], "past_due": []},
          "settings": {"payouts": {"schedule": {"interval": "manual"}}}
        }
        """.Replace("ACCOUNT_ID", id, StringComparison.Ordinal);

    private static StripeResponse Json(HttpStatusCode status, string content) =>
        new(status, new HttpResponseMessage().Headers, content);

    private sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }

    private sealed class StubStripeHttpClient(Func<StripeRequest, StripeResponse> respond) : IHttpClient
    {
        public List<StripeRequest> Requests { get; } = [];

        public Task<StripeResponse> MakeRequestAsync(StripeRequest request, CancellationToken cancellationToken = default)
        {
            Requests.Add(request);
            return Task.FromResult(respond(request));
        }

        public Task<StripeStreamedResponse> MakeStreamingRequestAsync(
            StripeRequest request,
            CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();
    }
}
