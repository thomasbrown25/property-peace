namespace brownstone_hub_api.Dtos.BankAccount;

/// <summary>Funds held in Stripe, not the balance of the external bank account.</summary>
public sealed class BankAccountBalanceDto
{
    public List<StripeCurrencyBalanceDto> Balances { get; set; } = new();
}

public sealed class StripeCurrencyBalanceDto
{
    public string Currency { get; set; } = string.Empty;
    public decimal Available { get; set; }
    public decimal Pending { get; set; }
}
