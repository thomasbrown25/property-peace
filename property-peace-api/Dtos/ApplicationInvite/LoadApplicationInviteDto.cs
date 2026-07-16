using brownstone_hub_api.Dtos.Application;
using brownstone_hub_api.Dtos.Property;
using brownstone_hub_api.Dtos.Unit;

namespace brownstone_hub_api.Dtos.ApplicationInvite
{
    public class LoadApplicationInviteDto
    {
        public long Id { get; set; }
        public long PropertyId { get; set; }
        public long? UnitId { get; set; }
        public string InviteToken { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string? ApplicantName { get; set; }
        public DateTime ExpiresAt { get; set; }
        public bool IsUsed { get; set; }
        public DateTime? UsedAt { get; set; }
        public long? ApplicationId { get; set; }
        public long CreatedBy { get; set; }
        public DateTime CreatedAt { get; set; }
        
        // Related entities
        public LoadPropertyDto? Property { get; set; }
        public LoadRentalApplicationDto? Application { get; set; }
    }
}

