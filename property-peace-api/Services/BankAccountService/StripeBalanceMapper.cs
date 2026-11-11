using brownstone_hub_api.Dtos.BankAccount;
using Stripe;

namespace brownstone_hub_api.Services.BankAccountService;

public static class StripeBalanceMapper
{
    private static readonly HashSet<string> ZeroDecimalCurrencies = new(StringComparer.OrdinalIgnoreCase)
    {
        "bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf", "vnd", "vuv", "xaf", "xof", "xpf"
    };
    private static readonly HashSet<string> ThreeDecimalCurrencies = new(StringComparer.OrdinalIgnoreCase)
    {
        "bhd", "jod", "kwd", "omr", "tnd"
    };

    public static decimal ToMajorUnits(long amount, string currency)
    {
        if (string.IsNullOrWhiteSpace(currency))
            throw new ArgumentException("Stripe balance currency is required.", nameof(currency));

        // ISK/UGX retain Stripe's two-decimal API representation. HUF/TWD payout
        // restrictions do not change the units used by the Balance API.
        var divisor = ZeroDecimalCurrencies.Contains(currency) ? 1m
            : ThreeDecimalCurrencies.Contains(currency) ? 1000m : 100m;
        return amount / divisor;
    }

    public static BankAccountBalanceDto Map(Balance balance)
    {
        ArgumentNullException.ThrowIfNull(balance);
        var currencies = new Dictionary<string, StripeCurrencyBalanceDto>(StringComparer.OrdinalIgnoreCase);
        foreach (var amount in balance.Available ?? new List<BalanceAmount>())
        {
            var row = GetRow(amount.Currency);
            row.Available += ToMajorUnits(amount.Amount, amount.Currency);
        }
        foreach (var amount in balance.Pending ?? new List<BalanceAmount>())
        {
            var row = GetRow(amount.Currency);
            row.Pending += ToMajorUnits(amount.Amount, amount.Currency);
        }
        return new BankAccountBalanceDto { Balances = currencies.Values.OrderBy(x => x.Currency, StringComparer.Ordinal).ToList() };

        StripeCurrencyBalanceDto GetRow(string currency)
        {
            if (string.IsNullOrWhiteSpace(currency))
                throw new InvalidOperationException("Stripe balance currency is required.");
            var normalized = currency.ToLowerInvariant();
            if (!currencies.TryGetValue(normalized, out var row))
                currencies[normalized] = row = new StripeCurrencyBalanceDto { Currency = normalized };
            return row;
        }
    }
}
