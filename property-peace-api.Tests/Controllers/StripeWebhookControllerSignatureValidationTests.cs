using System.Security.Cryptography;
using System.Text;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Data;
using brownstone_hub_api.Services.StripeService;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Controllers;

public sealed class StripeWebhookControllerSignatureValidationTests
{
    private const string WebhookSecret = "whsec_signature_validation_test_secret";
    private const string WrongWebhookSecret = "whsec_wrong_signature_validation_secret";

    [Fact]
    public async Task HandleWebhook_MissingSignature_RejectsRequestWithoutDispatching()
    {
        await using var context = CreateContext();
        var service = new Mock<IStripeWebhookService>(MockBehavior.Strict);
        var controller = CreateController(service.Object, context, CreatePayload("evt_missing_signature"));

        var result = await controller.HandleWebhook();

        result.Should().BeOfType<BadRequestObjectResult>();
        service.VerifyNoOtherCalls();
        context.StripeWebhookEvents.Should().BeEmpty();
    }

    [Fact]
    public async Task HandleWebhook_MalformedSignature_RejectsRequestWithoutDispatching()
    {
        await using var context = CreateContext();
        var service = new Mock<IStripeWebhookService>(MockBehavior.Strict);
        var controller = CreateController(service.Object, context, CreatePayload("evt_malformed_signature"),
            "not-a-stripe-signature");

        var result = await controller.HandleWebhook();

        result.Should().BeOfType<BadRequestObjectResult>();
        service.VerifyNoOtherCalls();
        context.StripeWebhookEvents.Should().BeEmpty();
    }

    [Fact]
    public async Task HandleWebhook_SignatureFromWrongSecret_RejectsRequestWithoutDispatching()
    {
        await using var context = CreateContext();
        var service = new Mock<IStripeWebhookService>(MockBehavior.Strict);
        var payload = CreatePayload("evt_wrong_secret");
        var controller = CreateController(service.Object, context, payload,
            CreateSignature(payload, WrongWebhookSecret, DateTimeOffset.UtcNow));

        var result = await controller.HandleWebhook();

        result.Should().BeOfType<BadRequestObjectResult>();
        service.VerifyNoOtherCalls();
        context.StripeWebhookEvents.Should().BeEmpty();
    }

    [Fact]
    public async Task HandleWebhook_PayloadAlteredAfterSigning_RejectsRequestWithoutDispatching()
    {
        await using var context = CreateContext();
        var service = new Mock<IStripeWebhookService>(MockBehavior.Strict);
        var signedPayload = CreatePayload("evt_original_payload");
        var alteredPayload = CreatePayload("evt_altered_payload");
        var controller = CreateController(service.Object, context, alteredPayload,
            CreateSignature(signedPayload, WebhookSecret, DateTimeOffset.UtcNow));

        var result = await controller.HandleWebhook();

        result.Should().BeOfType<BadRequestObjectResult>();
        service.VerifyNoOtherCalls();
        context.StripeWebhookEvents.Should().BeEmpty();
    }

    [Fact]
    public async Task HandleWebhook_SignatureOutsideStripeNetTolerance_RejectsRequestWithoutDispatching()
    {
        await using var context = CreateContext();
        var service = new Mock<IStripeWebhookService>(MockBehavior.Strict);
        var payload = CreatePayload("evt_stale_signature");
        var staleTimestamp = DateTimeOffset.UtcNow.AddMinutes(-6);
        var controller = CreateController(service.Object, context, payload,
            CreateSignature(payload, WebhookSecret, staleTimestamp));

        var result = await controller.HandleWebhook();

        result.Should().BeOfType<BadRequestObjectResult>();
        service.VerifyNoOtherCalls();
        context.StripeWebhookEvents.Should().BeEmpty();
    }

    private static StripeWebhookController CreateController(
        IStripeWebhookService service,
        DataContext context,
        string payload,
        string? signature = null)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Stripe:WebhookSecret"] = WebhookSecret
            })
            .Build();
        var controller = new StripeWebhookController(
            service, Mock.Of<ILogger<StripeWebhookController>>(), configuration, context)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };
        controller.Request.Method = HttpMethods.Post;
        controller.Request.ContentType = "application/json";
        controller.Request.Body = new MemoryStream(Encoding.UTF8.GetBytes(payload));
        if (signature != null)
            controller.Request.Headers["Stripe-Signature"] = signature;

        return controller;
    }

    private static DataContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<DataContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new DataContext(options);
    }

    private static string CreateSignature(
        string payload,
        string secret,
        DateTimeOffset timestamp)
    {
        var unixTimestamp = timestamp.ToUnixTimeSeconds();
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes($"{unixTimestamp}.{payload}"));
        return $"t={unixTimestamp},v1={Convert.ToHexString(hash).ToLowerInvariant()}";
    }

    private static string CreatePayload(string eventId) => $$"""
        {
          "id": "{{eventId}}",
          "object": "event",
          "api_version": "2025-02-24.acacia",
          "created": 1750000000,
          "data": {
            "object": {
              "id": "pi_signature_validation",
              "object": "payment_intent",
              "amount": 1000,
              "currency": "usd"
            }
          },
          "livemode": false,
          "pending_webhooks": 1,
          "request": { "id": null, "idempotency_key": null },
          "type": "payment_intent.succeeded"
        }
        """;
}
