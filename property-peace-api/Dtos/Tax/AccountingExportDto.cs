namespace brownstone_hub_api.Dtos.Tax
{
    public class AccountingExportDto
    {
        public string Format { get; set; } = string.Empty; // "quickbooks", "xero", "csv", etc.
        public int Year { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public string FileContent { get; set; } = string.Empty;
        public string FileName { get; set; } = string.Empty;
        public string MimeType { get; set; } = "text/csv";
    }
}

