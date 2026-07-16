namespace brownstone_hub_api.Dtos.ExpenseReport
{
    public class ExpenseReportByVendorDto
    {
        public long? VendorId { get; set; }
        public string? VendorName { get; set; }
        public decimal TotalAmount { get; set; }
        public int Count { get; set; }
        public decimal Percentage { get; set; }
    }
}

