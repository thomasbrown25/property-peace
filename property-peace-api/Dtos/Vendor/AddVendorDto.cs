using System.ComponentModel.DataAnnotations;

namespace brownstone_hub_api.Dtos.Vendor
{
    public class AddVendorDto
    {
        [Required]
        public long LandlordId { get; set; }

        [Required]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(200)]
        public string? BusinessName { get; set; }

        [MaxLength(1000)]
        public string? Description { get; set; }

        [MaxLength(200)]
        [EmailAddress]
        public string? Email { get; set; }

        [MaxLength(50)]
        public string? Phone { get; set; }

        [MaxLength(50)]
        public string? AlternatePhone { get; set; }

        [MaxLength(500)]
        public string? Address { get; set; }

        [MaxLength(100)]
        public string? City { get; set; }

        [MaxLength(50)]
        public string? State { get; set; }

        [MaxLength(20)]
        public string? ZipCode { get; set; }

        [MaxLength(50)]
        public string? TaxId { get; set; }

        [MaxLength(100)]
        public string? LicenseNumber { get; set; }

        public bool Requires1099 { get; set; } = false;

        [MaxLength(100)]
        public string? Category { get; set; }

        [MaxLength(500)]
        public string? Specialties { get; set; }

        [MaxLength(2000)]
        public string? Notes { get; set; }
    }
}

