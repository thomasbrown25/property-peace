using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace brownstone_hub_api.Dtos.LeaseGeneration
{
    // Lease-owned data must be saved through the lease API, never copied into an agreement request.
    [JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
    public class CreateLeaseInstanceDto
    {
        [Range(1, long.MaxValue)]
        public long LeaseId { get; set; }
        [Range(1, long.MaxValue)]
        public long LeaseTemplateId { get; set; }
        public List<string>? CustomPolicies { get; set; }
    }
}
