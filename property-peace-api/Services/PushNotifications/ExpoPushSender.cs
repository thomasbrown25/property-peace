using System.Net.Http.Json;
using System.Text.Json;
using brownstone_hub_api.Data;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.PushNotifications;

public interface IExpoPushSender
{
    Task SendAsync(long userId, long notificationId);
}

public sealed class ExpoPushSender(DataContext db, HttpClient http, ILogger<ExpoPushSender> logger) : IExpoPushSender
{
    public async Task SendAsync(long userId, long notificationId)
    {
        // Only use a persisted, server-created notification as the source of recipient and payload.
        // Never transmit title/message: lock screens and Expo infrastructure are not private.
        using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(5));
        var notification = await db.Notifications.AsNoTracking()
            .Where(x => x.Id == notificationId && x.UserId == userId)
            .Select(x => new { x.Id, x.UserId }).SingleOrDefaultAsync(deadline.Token);
        if (notification is null) return;
        var tokens = await db.ExpoPushTokens.AsNoTracking().Where(x => x.UserId == userId)
            .OrderBy(x => x.Id).Take(200).Select(x => x.Token).ToListAsync(deadline.Token);
        foreach (var batch in tokens.Chunk(100))
        {
            var payload = batch.Select(token => new
            {
                to = token,
                title = "Property Peace",
                body = "You have a new notification. Open the app to view it.",
                sound = "default"
            }).ToArray();
            using var response = await http.PostAsJsonAsync("https://exp.host/--/api/v2/push/send", payload, deadline.Token);
            response.EnsureSuccessStatusCode();
            using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(deadline.Token), cancellationToken: deadline.Token);
            if (!document.RootElement.TryGetProperty("data", out var tickets) || tickets.ValueKind != JsonValueKind.Array) continue;
            var index = 0;
            foreach (var ticket in tickets.EnumerateArray())
            {
                if (index >= batch.Length) break;
                var token = batch[index++];
                if (ticket.TryGetProperty("status", out var status) && status.GetString() == "error" &&
                    ticket.TryGetProperty("details", out var details) && details.ValueKind == JsonValueKind.Object &&
                    details.TryGetProperty("error", out var error) && error.GetString() == "DeviceNotRegistered")
                {
                    // Conditional delete cannot revoke a token reassigned to a different user meanwhile.
                    await db.ExpoPushTokens.Where(x => x.UserId == userId && x.Token == token).ExecuteDeleteAsync(deadline.Token);
                    logger.LogInformation("Removed unregistered Expo push token for user {UserId}", userId);
                }
            }
        }
    }
}
