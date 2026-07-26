namespace brownstone_hub_api.Models
{
    public class ImpersonationAuditRecord
    {
        public long Id { get; set; }
        public Guid? ImpersonationSessionId { get; set; }
        public long? ActorUserId { get; set; }
        public long? TargetUserId { get; set; }
        public string Action { get; set; } = string.Empty;
        public string Result { get; set; } = string.Empty;
        public string? Detail { get; set; }
        public string? IpAddress { get; set; }
        public string? UserAgent { get; set; }
        public long? OrganizationId { get; set; }
        public string? HttpMethod { get; set; }
        public string? Route { get; set; }
        public int? StatusCode { get; set; }
        public string? TraceId { get; set; }
        public string? CorrelationId { get; set; }
        public long? DurationMilliseconds { get; set; }
        public string? EntityRouteIds { get; set; }
        public DateTime OccurredAt { get; set; }
    }
}
