namespace brownstone_hub_api.Dtos.Lease
{
    /// <summary>
    /// Minimal lease info for DocuSign Connect webhook: resolve lease by envelope ID and notify landlord.
    /// </summary>
    public class LeaseConnectInfoDto
    {
        public long LeaseId { get; set; }
        public long OrganizationId { get; set; }
        public long LandlordId { get; set; }
    }
}
