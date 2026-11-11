using System.Collections.Concurrent;
using System.Data;
using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.StripeRentPayments;

public static class StripeRentCustomerAccounts
{
    private static readonly ConcurrentDictionary<string, SemaphoreSlim> Gates = new();

    public static async Task<string> GetOrCreateAsync(DataContext context, IStripeRentGateway gateway,
        long tenantUserId, string stripeAccountId, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(stripeAccountId);
        var resource = $"rent-customer:{stripeAccountId}:{tenantUserId}";
        var gate = Gates.GetOrAdd(resource, _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync(cancellationToken);
        try
        {
            await using var transaction = context.Database.IsRelational() && context.Database.CurrentTransaction == null
                ? await context.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken) : null;
            if (context.Database.IsSqlServer())
                await context.Database.ExecuteSqlInterpolatedAsync($@"
DECLARE @result int;
EXEC @result = sys.sp_getapplock @Resource={resource}, @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=15000;
IF @result < 0 THROW 51000, 'Could not lock connected rent customer.', 1;", cancellationToken);
            var existing = await context.Set<StripeRentCustomer>().SingleOrDefaultAsync(x =>
                x.TenantUserId == tenantUserId && x.StripeAccountId == stripeAccountId, cancellationToken);
            if (existing != null)
            {
                if (transaction != null) await transaction.CommitAsync(cancellationToken);
                return existing.CustomerId;
            }
            var user = await context.Users.AsNoTracking().SingleOrDefaultAsync(x => x.Id == tenantUserId, cancellationToken);
            var name = user == null ? null : $"{user.FirstName} {user.LastName}".Trim();
            var customerId = await gateway.CreateCustomerAsync(tenantUserId, stripeAccountId, user?.Email, name, cancellationToken);
            if (string.IsNullOrWhiteSpace(customerId)) throw new InvalidOperationException("Stripe did not return a connected rent customer.");
            context.Set<StripeRentCustomer>().Add(new() { TenantUserId = tenantUserId, StripeAccountId = stripeAccountId, CustomerId = customerId });
            await context.SaveChangesAsync(cancellationToken);
            if (transaction != null) await transaction.CommitAsync(cancellationToken);
            return customerId;
        }
        finally { gate.Release(); }
    }
}
