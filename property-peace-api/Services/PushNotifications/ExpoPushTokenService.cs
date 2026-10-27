using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Data.SqlClient;

namespace brownstone_hub_api.Services.PushNotifications;

public interface IExpoPushTokenService
{
    Task RegisterAsync(long userId, string token);
    Task UnregisterAsync(long userId, string token);
}

public sealed class ExpoPushTokenService(DataContext db) : IExpoPushTokenService
{
    // A single conditional UPDATE handles existing tokens (including cross-account login).
    // The unique index arbitrates concurrent first-time registrations.
    public async Task RegisterAsync(long userId, string token)
    {
        if (await db.ExpoPushTokens.Where(x => x.Token == token)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.UserId, userId)
                .SetProperty(x => x.UpdatedAtUtc, DateTime.UtcNow)) != 0) return;

        var entity = new ExpoPushToken { UserId = userId, Token = token, UpdatedAtUtc = DateTime.UtcNow };
        db.ExpoPushTokens.Add(entity);
        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex.InnerException is SqlException sql && sql.Number is 2601 or 2627)
        {
            db.Entry(entity).State = EntityState.Detached;
            await db.ExpoPushTokens.Where(x => x.Token == token)
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.UserId, userId)
                    .SetProperty(x => x.UpdatedAtUtc, DateTime.UtcNow));
        }
    }

    public Task UnregisterAsync(long userId, string token) =>
        db.ExpoPushTokens.Where(x => x.UserId == userId && x.Token == token).ExecuteDeleteAsync();
}
