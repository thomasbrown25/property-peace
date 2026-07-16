namespace brownstone_hub_api.Dtos.Tax
{
    public class Form1099Dto
    {
        public int Year { get; set; }
        public long? VendorId { get; set; }
        public string VendorName { get; set; } = string.Empty;
        public string? VendorTaxId { get; set; } // EIN or SSN if available
        public string? VendorAddress { get; set; }
        public bool Requires1099 { get; set; }
        public bool MissingTaxId { get; set; }
        public bool MissingAddress { get; set; }
        public bool NeedsW9Info => MissingTaxId || MissingAddress;
        public decimal TotalAmount { get; set; }
        public int ExpenseCount { get; set; }
        public List<Form1099ExpenseDto> Expenses { get; set; } = new();
    }

    public class Form1099ExpenseDto
    {
        public long ExpenseId { get; set; }
        public string Description { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public DateTime ExpenseDate { get; set; }
        public string PropertyName { get; set; } = string.Empty;
    }
}

