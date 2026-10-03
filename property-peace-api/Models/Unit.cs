

using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Models
{
    public class Unit
    {
        public long Id { get; set; }
        public string Name { get; set; } = "";
        public string Bedrooms { get; set; } = "";
        public string Baths { get; set; } = "";
        public string Type { get; set; } = "";
        public int SquareFeet { get; set; }
        public bool IsOccupied { get; set; } = false;

        public long PropertyId { get; set; }
        public Property Property { get; set; } = null!;

        // Organization ownership (also available via Property, but direct link for easier queries)
        public long? OrganizationId { get; set; }
        public Organization? Organization { get; set; }

        public List<Amenity>? Amenities { get; set; } = [];
        public List<IncludedUtility>? IncludedUtility { get; set; } = [];
        public ICollection<Lease> Leases { get; set; } = [];
        // Compatibility for loaded entity consumers; never use this inside an EF query.
        [System.ComponentModel.DataAnnotations.Schema.NotMapped]
        public Lease? Lease => Leases.Where(l => !l.IsDeleted && l.IsActive && l.StartDate?.Date <= DateTime.Today)
            .OrderBy(l => l.EndDate?.Date == DateTime.Today ? 0 : 1)
            .ThenByDescending(l => l.StartDate)
            .FirstOrDefault(l => !l.EndDate.HasValue || l.EndDate.Value.Date >= DateTime.Today);
        public ICollection<Tenant>? Tenants { get; set; }
        public ICollection<MaintenanceRequest>? MaintenanceRequests { get; set; } = [];
        public Unit()
        {
            Amenities = [];
            IncludedUtility = [];

            Tenants = [];
            MaintenanceRequests = [];
        }
    }

}