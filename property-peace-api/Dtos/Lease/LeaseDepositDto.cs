namespace brownstone_hub_api.Dtos.Lease
{
    public class LeaseDepositDto
    {
        public long Id { get; set; }
        public long LeaseId { get; set; }
        public long? OrganizationId { get; set; }
        public string Name { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public DateTime DueDate { get; set; }
        public int SortOrder { get; set; }
    }
}
