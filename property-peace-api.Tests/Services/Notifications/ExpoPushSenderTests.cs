using System.Net;
using System.Text;
using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.PushNotifications;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Notifications;

public sealed class ExpoPushSenderTests
{
    [Fact]
    public async Task SendsGenericContentOnlyToPersistedNotificationOwnerTokens()
    {
        var options = new DbContextOptionsBuilder<DataContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
        await using var db = new DataContext(options);
        db.Notifications.Add(new Notification { Id = 50, UserId = 7, Title = "Secret account code", Message = "Private details" });
        db.ExpoPushTokens.AddRange(
            new ExpoPushToken { Id = 1, UserId = 7, Token = "ExpoPushToken[owner]" },
            new ExpoPushToken { Id = 2, UserId = 8, Token = "ExpoPushToken[other]" });
        await db.SaveChangesAsync();
        var handler = new CapturingHandler();
        var sender = new ExpoPushSender(db, new HttpClient(handler), NullLogger<ExpoPushSender>.Instance);

        await sender.SendAsync(8, 50);
        handler.Payload.Should().BeNull();
        await sender.SendAsync(7, 50);
        handler.Payload.Should().Contain("ExpoPushToken[owner]")
            .And.NotContain("ExpoPushToken[other]")
            .And.NotContain("Secret account code")
            .And.NotContain("Private details")
            .And.NotContain("notificationId");
    }

    private sealed class CapturingHandler : HttpMessageHandler
    {
        public string? Payload { get; private set; }
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            request.RequestUri!.ToString().Should().Be("https://exp.host/--/api/v2/push/send");
            Payload = await request.Content!.ReadAsStringAsync(cancellationToken);
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("{\"data\":[{\"status\":\"ok\"}]}", Encoding.UTF8, "application/json")
            };
        }
    }
}
