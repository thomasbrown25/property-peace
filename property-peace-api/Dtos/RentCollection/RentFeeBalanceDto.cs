namespace brownstone_hub_api.Dtos.RentCollection
{
    public class RentFeeBalanceDto
    {
        public long FeeId { get; set; }
        public string Name { get; set; } = "Fee";
        public decimal AmountDue { get; set; }
        public DateTime DueDate { get; set; }
    }
}
