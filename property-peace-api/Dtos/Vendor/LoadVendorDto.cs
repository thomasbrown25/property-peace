using System.Text.Json.Serialization;

namespace brownstone_hub_api.Dtos.Vendor
{
    public class LoadVendorDto
    {
        public long Id { get; set; }
        public long LandlordId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? BusinessName { get; set; }
        public string? Description { get; set; }
        public string? Email { get; set; }
        public string? Phone { get; set; }
        public string? AlternatePhone { get; set; }
        public string? Address { get; set; }
        public string? City { get; set; }
        public string? State { get; set; }
        public string? ZipCode { get; set; }
        // Kept for internal tax workflows, but never emitted by broad vendor APIs.
        [JsonIgnore]
        public string? TaxId { get; set; }
        public string? LicenseNumber { get; set; }
        public bool Requires1099 { get; set; }
        public string? Category { get; set; }
        public string? Specialties { get; set; }
        public bool IsActive { get; set; }
        public bool IsReadyForAssignment { get; set; }
        public string? Notes { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }

        // Statistics (calculated)
        public int ExpenseCount { get; set; }
        public int MaintenanceRequestCount { get; set; }
        public decimal TotalExpenseAmount { get; set; }
    }
}

