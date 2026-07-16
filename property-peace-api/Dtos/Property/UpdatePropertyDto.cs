

using System.ComponentModel.DataAnnotations;
using brownstone_hub_api.Dtos.Unit;
using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Dtos.Property
{
    public class UpdatePropertyDto
    {
        public long Id { get; set; } = 0;
        public string? Name { get; set; } // Nullable - can be set later in property settings
        public string Description { get; set; } = "";
        public EPropertyType PropertyType { get; set; }

        //Address Information
        [StringLength(300, ErrorMessage = "Street Address  length can't exceed 300 characters.")]
        public string StreetAddress { get; set; } = "";
        [StringLength(100, ErrorMessage = "City length can't exceed 100 characters.")]
        public string City { get; set; } = "";
        [StringLength(50, ErrorMessage = "State length can't exceed 50 characters.")]
        public string State { get; set; } = "";
        [StringLength(20, ErrorMessage = "Zip Code length can't exceed 20 characters.")]
        public string ZipCode { get; set; } = "";


        //Property Details
        public int? YearBuilt { get; set; } = null;
        public double LotSize { get; set; } = 0.0;
        public decimal TargetRent { get; set; } = 0.0m;
        public decimal TargetDeposit { get; set; } = 0.0m;

        //Owner/Landlord Information
        [Range(1, int.MaxValue, ErrorMessage = "Landlord ID must be a positive integer.")]
        public long LandlordId { get; set; }
        public long? OrganizationId { get; set; } // Organization that owns this property
        public long? PrimaryManagerId { get; set; } // Primary manager (team member) for this property
        public long? OperatingAccountId { get; set; } // Operating bank account (Stripe Connect) for this property
        public long? ClientId { get; set; } // Client (the actual owner of the property)
        public string ContactEmail { get; set; } = "";
        public string ContactPhone { get; set; } = "";

        //Images and Media
        public string MainImageUrl { get; set; } = "";

        //Additional Information
        public DateTime DateListed { get; set; } = DateTime.Now;
        public bool IsActive { get; set; } = true;
        public bool IsOccupied { get; set; } = false;
        
        //Unit Count for Multi-family Properties
        public int? UnitCount { get; set; } = null;
    }
}