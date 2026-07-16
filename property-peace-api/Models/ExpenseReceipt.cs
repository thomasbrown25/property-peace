using brownstone_hub_api.Shared;

namespace brownstone_hub_api.Models
{
    public class ExpenseReceipt : IImageEntity
    {
        public long Id { get; set; }
        public string BlobName { get; set; }
        public string BlobUrl { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.Now;

        public long RefId { get; set; } // ExpenseId
        public Expense Expense { get; set; }
    }
}

