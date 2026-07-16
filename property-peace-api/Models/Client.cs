
namespace brownstone_hub_api.Models
{
    public class Client
    {
        public long Id { get; set; }
        
        // Organization (PM company managing this client)
        public long OrganizationId { get; set; }
        public Organization Organization { get; set; } = null!;
        
        // Client Information
        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string? PhoneNumber { get; set; }
        public string? CompanyName { get; set; } // Optional - for corporate clients
        
        // Portal Access (nullable - client may not have portal access initially)
        public long? UserId { get; set; }
        public User? User { get; set; }
        
        // Management Fee Settings
        public decimal? ManagementFeePercentage { get; set; } // e.g., 8.5% = 8.5
        public decimal? ManagementFeeFlat { get; set; } // Flat monthly fee
        
        // Statement Preferences
        public string StatementFrequency { get; set; } = "Monthly"; // "Monthly", "Quarterly", "Annually"
        
        // Status
        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime UpdatedAt { get; set; } = DateTime.Now;
        public bool IsDeleted { get; set; } = false;
        public DateTime? DeletedAt { get; set; }
        
        // Navigation
        public ICollection<Property> Properties { get; set; } = [];
    }
}
