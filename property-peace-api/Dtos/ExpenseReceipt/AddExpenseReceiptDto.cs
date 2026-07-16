namespace brownstone_hub_api.Dtos.ExpenseReceipt
{
    public class AddExpenseReceiptDto
    {
        public long ExpenseId { get; set; }
        public string BlobName { get; set; }
        public string BlobUrl { get; set; }
    }
}

