
namespace brownstone_hub_api.Dtos.Lease
{
    public class AddLeaseDto
    {
        public long PropertyId { get; set; } = 0;
        public long UnitId { get; set; } = 0;
        public string? Name { get; set; } // Lease name/nickname
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public decimal? RentAmount { get; set; }
        public decimal? DepositAmount { get; set; }
        public int? LeaseLength { get; set; }
        public bool? CustomDateSelected { get; set; }
        public string? RentFrequency { get; set; }
        public int? RentDueDay { get; set; }
        public decimal? OverdueAmount { get; set; }
        public bool IsActive { get; set; } = true;
        public bool MarkPastPaymentsAsPaid { get; set; } = false;
    }
}