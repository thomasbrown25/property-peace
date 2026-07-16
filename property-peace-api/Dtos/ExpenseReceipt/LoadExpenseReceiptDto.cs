namespace brownstone_hub_api.Dtos.ExpenseReceipt
{
    public class LoadExpenseReceiptDto
    {
        public long Id { get; set; }
        public long ExpenseId { get; set; }
        public string BlobName { get; set; }
        public string BlobUrl { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}

