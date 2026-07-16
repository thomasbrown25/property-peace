
using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Models
{
    public class Property
    {
        //Basic Information
        public long Id { get; set; }
        public string? Name { get; set; } // Nullable - can be set later in property settings
        public string Description { get; set; } = "";
        public EPropertyType PropertyType { get; set; }

        //Owner/Landlord Information
        public long LandlordId { get; set; }
        public User Landlord { get; set; }
        public string ContactEmail { get; set; } = "";
        public string ContactPhone { get; set; } = "";

        // Organization ownership
        public long? OrganizationId { get; set; } // FK to Organization (nullable for backward compatibility)
        public Organization? Organization { get; set; }

        // Primary Manager (team member who manages this property)
        public long? PrimaryManagerId { get; set; } // FK to User (nullable)
        public User? PrimaryManager { get; set; }

        // Operating Bank Account (Stripe Connect account for this property)
        public long? OperatingAccountId { get; set; } // FK to BankAccount (nullable)
        public BankAccount? OperatingAccount { get; set; }

        // Client (the actual owner of the property, separate from PM company)
        public long? ClientId { get; set; } // FK to Client (nullable for backward compatibility)
        public Client? Client { get; set; }

        //Address Information
        public string StreetAddress { get; set; } = "";
        public string City { get; set; } = "";
        public string State { get; set; } = "";
        public string ZipCode { get; set; } = "";

        //Property Details
        public int YearBuilt { get; set; } = 0;
        public double LotSize { get; set; } = 0.0;
        public decimal TargetRent { get; set; } = 0.0m;
        public decimal TargetDeposit { get; set; } = 0.0m;

        public ICollection<Unit> Units { get; set; } = [];
        public ICollection<MaintenanceRequest> MaintenanceRequests { get; set; } = [];
        public ICollection<PropertyImage> Images { get; set; } = [];

        //Images and Media
        public string MainImageUrl { get; set; } = "";

        //Additional Information
        public DateTime DateListed { get; set; } = DateTime.Now;
        public bool IsDeleted { get; set; } = false;
        public DateTime? DeletedAt { get; set; }
        public bool IsOccupied { get; set; } = false;
    }
}