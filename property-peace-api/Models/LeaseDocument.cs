namespace brownstone_hub_api.Models
{
    /// <summary>
    /// Generated document (PDF or DOCX) for a lease instance
    /// </summary>
    public class LeaseDocument
    {
        public long Id { get; set; }
        public long LeaseInstanceId { get; set; }
        public LeaseInstance LeaseInstance { get; set; } = null!;
        
        public string DocumentType { get; set; } = string.Empty; // PDF, DOCX, Draft
        
        // Azure Blob Storage
        public string BlobName { get; set; } = string.Empty;
        public string BlobUrl { get; set; } = string.Empty;
        
        // Integrity
        public string? FileHash { get; set; } // SHA256 hash for integrity verification
        
        // Audit fields
        public DateTime GeneratedAt { get; set; } = DateTime.Now;
        public long GeneratedBy { get; set; } // UserId
        public User? GeneratedByUser { get; set; }
    }
}
