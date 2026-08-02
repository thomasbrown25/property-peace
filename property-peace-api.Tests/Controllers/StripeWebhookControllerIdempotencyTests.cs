using System.Security.Cryptography;
using System.Text;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.StripeService;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Moq;
using Stripe;
using Xunit;

namespace brownstone_hub_api.Tests.Controllers;

public sealed class StripeWebhookControllerIdempotencyTests
{
    private const string Secret = "whsec_exclusive_claim_test_secret";

    [Fact]
    public async Task ConcurrentDeliveries_OnlyClaimAndDispatchEventOnce()
    {
        var databaseName = Guid.NewGuid().ToString();
        var root = new InMemoryDatabaseRoot();
        await using var firstContext = CreateContext(databaseName, root);
        await using var secondContext = CreateContext(databaseName, root);
        var handlerStarted = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var releaseHandler = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var service = new Mock<IStripeWebhookService>();
        service.Setup(x => x.HandlePaymentIntentSucceededAsync(It.IsAny<Event>()))
            .Returns(async () =>
            {
                handlerStarted.TrySetResult();
                await releaseHandler.Task;
            });

        var payload = CreatePayload("evt_concurrent_claim");
        var firstRequest = CreateController(service.Object, firstContext, payload);
        var secondRequest = CreateController(service.Object, secondContext, payload);

        var firstResultTask = firstRequest.HandleWebhook();
        await handlerStarted.Task.WaitAsync(TimeSpan.FromSeconds(5));
        var secondResult = await secondRequest.HandleWebhook();

        secondResult.Should().BeOfType<ObjectResult>()
            .Which.StatusCode.Should().Be(StatusCodes.Status409Conflict);
        service.Verify(x => x.HandlePaymentIntentSucceededAsync(It.IsAny<Event>()), Times.Once);

        releaseHandler.TrySetResult();
        (await firstResultTask).Should().BeOfType<OkObjectResult>();

        await using var verificationContext = CreateContext(databaseName, root);
        var inboxEvent = await verificationContext.StripeWebhookEvents.SingleAsync();
        inboxEvent.Status.Should().Be("Processed");
        inboxEvent.ProcessingAttempts.Should().Be(1);
        inboxEvent.ProcessingLeaseId.Should().BeNull();
        service.Verify(x => x.HandlePaymentIntentSucceededAsync(It.IsAny<Event>()), Times.Once);
    }

    [Fact]
    public async Task ExpiredProcessingLease_IsAtomicallyReclaimedAndRetried()
    {
        var databaseName = Guid.NewGuid().ToString();
        var root = new InMemoryDatabaseRoot();
        await using (var seedContext = CreateContext(databaseName, root))
        {
            seedContext.StripeWebhookEvents.Add(new StripeWebhookEvent
            {
                StripeEventId = "evt_expired_lease",
                EventType = "payment_intent.succeeded",
                Status = "Processing",
                ProcessingAttempts = 1,
                ProcessingLeaseId = Guid.NewGuid(),
                ProcessingLeaseExpiresAt = DateTime.UtcNow.AddMinutes(-1),
                ReceivedAt = DateTime.UtcNow.AddMinutes(-20)
            });
            await seedContext.SaveChangesAsync();
        }

        await using var context = CreateContext(databaseName, root);
        var service = new Mock<IStripeWebhookService>();
        service.Setup(x => x.HandlePaymentIntentSucceededAsync(It.IsAny<Event>())).Returns(Task.CompletedTask);
        var controller = CreateController(service.Object, context, CreatePayload("evt_expired_lease"));

        var result = await controller.HandleWebhook();
        result.Should().BeOfType<OkObjectResult>();
        service.Verify(x => x.HandlePaymentIntentSucceededAsync(It.IsAny<Event>()), Times.Once);
        context.ChangeTracker.Clear();
        var inboxEvent = await context.StripeWebhookEvents.SingleAsync();
        inboxEvent.Status.Should().Be("Processed");
        inboxEvent.ProcessingAttempts.Should().Be(2);
        inboxEvent.ProcessedAt.Should().NotBeNull();
        inboxEvent.ProcessingLeaseId.Should().BeNull();
        inboxEvent.ProcessingLeaseExpiresAt.Should().BeNull();
    }

    [Fact]
    public async Task LiveHandler_RemainsFencedWhenHeartbeatInfrastructureFailsPastLeaseExpiry()
    {
        var databaseName = Guid.NewGuid().ToString();
        var root = new InMemoryDatabaseRoot();
        await using var firstContext = CreateContext(databaseName, root);
        await using var secondContext = CreateContext(databaseName, root);
        var handlerStarted = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var releaseHandler = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var service = new Mock<IStripeWebhookService>();
        service.Setup(x => x.HandlePaymentIntentSucceededAsync(It.IsAny<Event>()))
            .Returns(async () =>
            {
                handlerStarted.TrySetResult();
                await releaseHandler.Task;
            });
        var unavailableScopes = new Mock<IServiceScopeFactory>();
        unavailableScopes.Setup(x => x.CreateScope()).Throws(new InvalidOperationException("heartbeat database unavailable"));
        var leaseOptions = new StripeWebhookLeaseOptions
        {
            LeaseDuration = TimeSpan.FromMilliseconds(180),
            HeartbeatInterval = TimeSpan.FromMilliseconds(40)
        };
        var payload = CreatePayload("evt_fenced_after_heartbeat_loss");
        var firstRequest = CreateController(service.Object, firstContext, payload, unavailableScopes.Object, leaseOptions);
        var secondRequest = CreateController(service.Object, secondContext, payload, unavailableScopes.Object, leaseOptions);

        var firstResultTask = firstRequest.HandleWebhook();
        await handlerStarted.Task.WaitAsync(TimeSpan.FromSeconds(5));
        await Task.Delay(TimeSpan.FromMilliseconds(350));

        var secondResult = await secondRequest.HandleWebhook();

        secondResult.Should().BeOfType<ObjectResult>()
            .Which.StatusCode.Should().Be(StatusCodes.Status409Conflict);
        service.Verify(x => x.HandlePaymentIntentSucceededAsync(It.IsAny<Event>()), Times.Once);

        releaseHandler.TrySetResult();
        (await firstResultTask.WaitAsync(TimeSpan.FromSeconds(5))).Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task LiveHandler_RenewsLeaseAndCannotBeReclaimedAfterInitialBoundary()
    {
        var databaseName = Guid.NewGuid().ToString();
        var root = new InMemoryDatabaseRoot();
        using var services = CreateServices(databaseName, root);
        await using var firstContext = CreateContext(databaseName, root);
        await using var secondContext = CreateContext(databaseName, root);
        var handlerStarted = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var releaseHandler = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var service = new Mock<IStripeWebhookService>();
        service.Setup(x => x.HandlePaymentIntentSucceededAsync(It.IsAny<Event>()))
            .Returns(async () =>
            {
                handlerStarted.TrySetResult();
                await releaseHandler.Task;
            });

        var payload = CreatePayload("evt_live_across_lease_boundary");
        var leaseOptions = new StripeWebhookLeaseOptions
        {
            LeaseDuration = TimeSpan.FromMilliseconds(240),
            HeartbeatInterval = TimeSpan.FromMilliseconds(50)
        };
        var firstRequest = CreateController(service.Object, firstContext, payload,
            services.GetRequiredService<IServiceScopeFactory>(), leaseOptions);
        var secondRequest = CreateController(service.Object, secondContext, payload,
            services.GetRequiredService<IServiceScopeFactory>(), leaseOptions);

        var firstResultTask = firstRequest.HandleWebhook();
        await handlerStarted.Task.WaitAsync(TimeSpan.FromSeconds(5));

        // Cross the originally-issued lease boundary while the first owner remains live.
        await Task.Delay(TimeSpan.FromMilliseconds(450));
        var secondResult = await secondRequest.HandleWebhook();

        secondResult.Should().BeOfType<ObjectResult>()
            .Which.StatusCode.Should().Be(StatusCodes.Status409Conflict);
        service.Verify(x => x.HandlePaymentIntentSucceededAsync(It.IsAny<Event>()), Times.Once);

        releaseHandler.TrySetResult();
        (await firstResultTask.WaitAsync(TimeSpan.FromSeconds(5))).Should().BeOfType<OkObjectResult>();

        await using var verificationContext = CreateContext(databaseName, root);
        var inboxEvent = await verificationContext.StripeWebhookEvents.SingleAsync();
        inboxEvent.Status.Should().Be("Processed");
        inboxEvent.ProcessingAttempts.Should().Be(1);
    }

    private static StripeWebhookController CreateController(
        IStripeWebhookService service, DataContext context, string payload,
        IServiceScopeFactory? scopeFactory = null, StripeWebhookLeaseOptions? leaseOptions = null)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Stripe:WebhookSecret"] = Secret })
            .Build();
        var controller = scopeFactory == null
            ? new StripeWebhookController(
                service, Mock.Of<ILogger<StripeWebhookController>>(), configuration, context)
            : new StripeWebhookController(
                service, Mock.Of<ILogger<StripeWebhookController>>(), configuration, context,
                scopeFactory, TimeProvider.System, leaseOptions ?? new StripeWebhookLeaseOptions());
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };
        controller.Request.Method = "POST";
        controller.Request.ContentType = "application/json";
        controller.Request.Body = new MemoryStream(Encoding.UTF8.GetBytes(payload));
        controller.Request.Headers["Stripe-Signature"] = CreateSignature(payload);
        return controller;
    }

    private static DataContext CreateContext(string databaseName, InMemoryDatabaseRoot root)
    {
        var options = new DbContextOptionsBuilder<DataContext>()
            .UseInMemoryDatabase(databaseName, root)
            .Options;
        return new DataContext(options);
    }

    private static ServiceProvider CreateServices(string databaseName, InMemoryDatabaseRoot root)
    {
        var services = new ServiceCollection();
        services.AddDbContext<DataContext>(options => options.UseInMemoryDatabase(databaseName, root));
        return services.BuildServiceProvider();
    }

    private static string CreatePayload(string eventId) => $$"""
        {
          "id": "{{eventId}}",
          "object": "event",
          "api_version": "2025-02-24.acacia",
          "created": 1750000000,
          "data": {
            "object": {
              "id": "pi_exclusive_claim",
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

    private static string CreateSignature(string payload)
    {
        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(Secret));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes($"{timestamp}.{payload}"));
        return $"t={timestamp},v1={Convert.ToHexString(hash).ToLowerInvariant()}";
    }
}
