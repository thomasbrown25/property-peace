using brownstone_hub_api.Services.StripeRentPayments;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Stripe;
using System.Reflection;
using Xunit;

namespace brownstone_hub_api.Tests.Services.StripeRentPayments;

public sealed class StripeRentPaymentMethodPolicyTests
{
    [Fact]
    public void ConfigurationConstructor_BindsExplicitStripeClientBeforeWorkerRequests()
    {
        const string apiKey = "sk_test_rent_gateway_constructor";
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Stripe:SecretKey"] = apiKey })
            .Build();
        var method = typeof(StripeRentGateway).GetMethod(
            "BuildStripeClient", BindingFlags.NonPublic | BindingFlags.Static);

        Assert.NotNull(method);
        var client = Assert.IsAssignableFrom<IStripeClient>(method.Invoke(null, new object[] { configuration }));
        Assert.Equal(apiKey, client.ApiKey);

        using var provider = new ServiceCollection()
            .AddSingleton<IConfiguration>(configuration)
            .AddScoped<StripeRentGateway>()
            .BuildServiceProvider();
        Assert.NotNull(provider.GetRequiredService<StripeRentGateway>());
    }

    [Fact]
    public void SupportedTypes_IncludeOnlyCardAndUsBankAccount()
    {
        var policyType = typeof(StripeRentGateway).Assembly.GetType(
            "brownstone_hub_api.Services.StripeRentPayments.StripeRentPaymentMethodPolicy");

        Assert.NotNull(policyType);
        var property = policyType.GetProperty("SupportedTypes");
        Assert.NotNull(property);
        var supportedTypes = Assert.IsAssignableFrom<IReadOnlyList<string>>(property.GetValue(null));
        Assert.Equal(new[] { "card", "us_bank_account" }, supportedTypes);
    }

    [Fact]
    public void CreateOptions_UseSupportedTypesWithoutAutomaticPaymentMethods()
    {
        var method = typeof(StripeRentGateway).GetMethod(
            "BuildPaymentIntentCreateOptions", BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(method);
        var request = new StripeRentIntentRequest(100, "usd", "rent", "rent:1", "rent:op",
            new Dictionary<string, string> { ["leaseId"] = "1" });

        var options = Assert.IsType<PaymentIntentCreateOptions>(method.Invoke(null, new object[] { request }));

        Assert.Equal(new[] { "card", "us_bank_account" }, options.PaymentMethodTypes);
        Assert.Null(options.AutomaticPaymentMethods);
        Assert.Null(options.TransferData);
        Assert.Null(options.ApplicationFeeAmount);
    }

    [Fact]
    public void TransferFailureClassification_PausesCachedParameterMismatchAndKeepsInFlightKeyUseAmbiguous()
    {
        var definitiveMethod = typeof(StripeRentGateway).GetMethod(
            "IsDefinitiveTransferFailure", BindingFlags.NonPublic | BindingFlags.Static);
        var reviewMethod = typeof(StripeRentGateway).GetMethod(
            "RequiresTransferOperatorReview", BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(definitiveMethod);
        Assert.NotNull(reviewMethod);
        bool Definitive(StripeError error) => Assert.IsType<bool>(definitiveMethod.Invoke(null, new object?[] { error }));
        bool Review(StripeError error) => Assert.IsType<bool>(reviewMethod.Invoke(null, new object?[] { error }));

        Assert.True(Review(new StripeError { Type = "idempotency_error" }));
        Assert.False(Definitive(new StripeError { Type = "idempotency_error" }));
        Assert.True(Definitive(new StripeError { Code = "balance_insufficient", Type = "invalid_request_error" }));
        Assert.False(Review(new StripeError { Code = "idempotency_key_in_use", Type = "idempotency_error" }));
        Assert.False(Definitive(new StripeError { Code = "idempotency_key_in_use", Type = "idempotency_error" }));
        Assert.False(Review(new StripeError { Type = "api_error" }));
    }

    [Fact]
    public void TransferOptions_WithSourceTransaction_DoNotRepeatTransferGroup()
    {
        var method = typeof(StripeRentGateway).GetMethod(
            "BuildTransferCreateOptions", BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(method);
        var request = new StripeRentTransferRequest(100, "usd", "acct_test", "ch_test", "rent:1", "transfer:1",
            new Dictionary<string, string> { ["leaseId"] = "1" });

        var options = Assert.IsType<TransferCreateOptions>(method.Invoke(null, new object[] { request }));

        Assert.Equal("ch_test", options.SourceTransaction);
        Assert.Null(options.TransferGroup);
        Assert.Equal("acct_test", options.Destination);
    }
}
