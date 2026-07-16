using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace brownstone_hub_api.Models
{
    public class Vendor
    {
        [Key]
        public long Id { get; set; }

        [Required]
        public long LandlordId { get; set; }

        [ForeignKey(nameof(LandlordId))]
        public User Landlord { get; set; } = null!;
        
        // Organization ownership
        public long? OrganizationId { get; set; }
        
        [ForeignKey(nameof(OrganizationId))]
        public Organization? Organization { get; set; }

        // Basic Information
        [Required]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(200)]
        public string? BusinessName { get; set; }

        [MaxLength(1000)]
        public string? Description { get; set; }

        // Contact Information
        [MaxLength(200)]
        public string? Email { get; set; }

        [MaxLength(50)]
        public string? Phone { get; set; }

        [MaxLength(50)]
        public string? AlternatePhone { get; set; }

        // Address
        [MaxLength(500)]
        public string? Address { get; set; }

        [MaxLength(100)]
        public string? City { get; set; }

        [MaxLength(50)]
        public string? State { get; set; }

        [MaxLength(20)]
        public string? ZipCode { get; set; }

        // Business Information
        [MaxLength(50)]
        public string? TaxId { get; set; } // EIN/SSN for 1099 reporting

        [MaxLength(100)]
        public string? LicenseNumber { get; set; }

        public bool Requires1099 { get; set; } = false;

        // Vendor Categories/Specialties
        [MaxLength(100)]
        public string? Category { get; set; } // Plumber, Electrician, HVAC, etc.

        [MaxLength(500)]
        public string? Specialties { get; set; } // Comma-separated specialties

        // Status
        public bool IsActive { get; set; } = true;

        public bool IsDeleted { get; set; } = false;

        // Notes
        [MaxLength(2000)]
        public string? Notes { get; set; }

        // Timestamps
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation Properties
        public ICollection<Expense> Expenses { get; set; } = [];
        public ICollection<MaintenanceRequest> MaintenanceRequests { get; set; } = [];
    }
}

