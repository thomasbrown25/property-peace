namespace brownstone_hub_api.Models
{
    /// <summary>
    /// Landlord or property manager listed on a lease (for lease agreement generation).
    /// Supports multiple landlords per lease.
    /// </summary>
    public class LeaseLandlord
    {
        public long Id { get; set; }
        public long LeaseId { get; set; }
        public Lease Lease { get; set; } = null!;

        /// <summary>Individual or Company</summary>
        public string EntityType { get; set; } = "Individual";

        public string? FirstName { get; set; }
        public string? LastName { get; set; }
        /// <summary>Company name when EntityType is Company</summary>
        public string? CompanyName { get; set; }
        public string? Email { get; set; }
        public string? Phone { get; set; }

        // Mailing address (required for lease - tenant may need to send notices)
        public string? StreetAddress { get; set; }
        public string? Unit { get; set; }
        public string? City { get; set; }
        public string? State { get; set; }
        public string? ZipCode { get; set; }

        public int SortOrder { get; set; }
    }
}
