namespace brownstone_hub_api.Dtos.AgentFollowUp
{
    public class SuppressedLeaseDto
    {
        public long LeaseId { get; set; }
        public string TenantNames { get; set; } = string.Empty;
        public string PropertyName { get; set; } = string.Empty;
    }
}
