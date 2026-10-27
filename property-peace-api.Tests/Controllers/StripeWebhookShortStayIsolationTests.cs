using brownstone_hub_api.Controllers;
using Microsoft.AspNetCore.Mvc;
using Stripe;
using Xunit;

namespace brownstone_hub_api.Tests.Controllers;

public sealed class StripeWebhookShortStayIsolationTests
{
    [Fact]
    public void IsolationClassifier_IsNotAnMvcAction()
    {
        var method = typeof(StripeWebhookController).GetMethod(nameof(StripeWebhookController.IsNonRentMoneyEvent));
        Assert.NotNull(method);
        Assert.True(Attribute.IsDefined(method!, typeof(NonActionAttribute)));
    }

    [Theory]
    [InlineData("payment_intent.succeeded")]
    [InlineData("payment_intent.processing")]
    [InlineData("payment_intent.payment_failed")]
    [InlineData("payment_intent.canceled")]
    [InlineData("charge.dispute.created")]
    [InlineData("charge.refunded")]
    [InlineData("refund.created")]
    public void ConnectedAccountMoneyEvent_NeverEntersRentWebhookInbox(string type)
    {
        var evt = new Event { Account = "acct_1234567890123456", Type = type };
        Assert.True(StripeWebhookController.IsNonRentMoneyEvent(evt));
    }

    [Fact]
    public void ShortStayTaggedPlatformIntent_NeverEntersRentWebhookInbox()
    {
        var evt = new Event
        {
            Type = "payment_intent.succeeded",
            Data = new EventData { Object = new PaymentIntent
            {
                Metadata = new Dictionary<string, string> { ["reservation_code"] = "ABC123", ["version"] = "1" }
            } }
        };
        Assert.True(StripeWebhookController.IsNonRentMoneyEvent(evt));
    }

    [Fact]
    public void PlatformRentIntent_RemainsRoutable()
    {
        var evt = new Event { Type = "payment_intent.succeeded", Data = new EventData { Object = new PaymentIntent() } };
        Assert.False(StripeWebhookController.IsNonRentMoneyEvent(evt));
    }
}
