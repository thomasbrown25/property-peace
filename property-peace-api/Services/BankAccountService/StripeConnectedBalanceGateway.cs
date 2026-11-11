using Stripe;

namespace brownstone_hub_api.Services.BankAccountService;

public interface IStripeConnectedBalanceGateway
{
    Task<Balance> GetAsync(string stripeAccountId);
}

public sealed class StripeConnectedBalanceGateway : IStripeConnectedBalanceGateway
{
    private readonly BalanceService _balances;

    public StripeConnectedBalanceGateway() : this(new BalanceService()) { }

    public StripeConnectedBalanceGateway(BalanceService balances) => _balances = balances;

    public Task<Balance> GetAsync(string stripeAccountId)
    {
        // Never fall back to the platform balance when no connected account is supplied.
        if (string.IsNullOrWhiteSpace(stripeAccountId) || !stripeAccountId.StartsWith("acct_", StringComparison.Ordinal))
            throw new ArgumentException("A connected Stripe account is required.", nameof(stripeAccountId));

        return _balances.GetAsync(new BalanceGetOptions(), new RequestOptions { StripeAccount = stripeAccountId });
    }
}
