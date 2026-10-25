namespace brownstone_hub_api.Dtos.Payment;

public sealed class LeaseChargeDto
{
    public string ChargeId { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public DateTime? DueDate { get; set; }
    public decimal Amount { get; set; }
    public decimal Paid { get; set; }
    public decimal Remaining { get; set; }
    public List<LeaseChargePaymentDto> Payments { get; set; } = [];
}

public sealed class LeaseChargePaymentDto
{
    public long Id { get; set; }
    public decimal Amount { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime PaymentDate { get; set; }
}
