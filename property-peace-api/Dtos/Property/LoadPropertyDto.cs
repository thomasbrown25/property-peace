

using brownstone_hub_api.Dtos.Image;
using brownstone_hub_api.Dtos.MaintenanceRequest;
using brownstone_hub_api.Dtos.Unit;
using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Dtos.Property
{
    public class LoadPropertyDto
    {
        public long Id { get; set; }
        public string? Name { get; set; } // Nullable - can be set later in property settings
        public string Description { get; set; } = "";
        public EPropertyType PropertyType { get; set; }
        public bool IsSingleUnitPortfolio { get; set; } = true;

        //Address Information
        public string StreetAddress { get; set; } = "";
        public string City { get; set; } = "";
        public string State { get; set; } = "";
        public string ZipCode { get; set; } = "";

        //Property Details
        public int? YearBuilt { get; set; } = null;
        public double LotSize { get; set; } = 0.0;
        public decimal TargetRent { get; set; } = 0.0m;
        public decimal TargetDeposit { get; set; } = 0.0m;

        //Owner/Landlord Information
        public long LandlordId { get; set; }
        public long? OrganizationId { get; set; } // Organization that owns this property
        public long? PrimaryManagerId { get; set; } // Primary manager (team member) for this property
        public string? PrimaryManagerName { get; set; } // Primary manager's name for display
        public long? OperatingAccountId { get; set; } // Operating bank account (Stripe Connect) for this property
        public long? ClientId { get; set; } // Client (the actual owner of the property)
        public string? ClientName { get; set; } // Client's name for display
        public string ContactEmail { get; set; } = "";
        public string ContactPhone { get; set; } = "";

        public ICollection<LoadUnitDto> Units { get; set; } = [];
        public ICollection<LoadMaintenanceRequestDto> MaintenanceRequests { get; set; } = [];
        public List<LoadImageDto> Images { get; set; } = [];

        //Images and Media
        public string MainImageUrl { get; set; } = "";

        //Additional Information
        public DateTime DateListed { get; set; } = DateTime.Now;
        public bool IsActive { get; set; } = true;
        public bool IsOccupied { get; set; } = false;
        public bool IsDeleted { get; set; } = false;
    }
}