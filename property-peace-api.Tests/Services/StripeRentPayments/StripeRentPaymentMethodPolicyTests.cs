using brownstone_hub_api.Services.StripeRentPayments;
using Stripe;
using System.Reflection;
using Xunit;

namespace brownstone_hub_api.Tests.Services.StripeRentPayments;

public sealed class StripeRentPaymentMethodPolicyTests
{
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
}
