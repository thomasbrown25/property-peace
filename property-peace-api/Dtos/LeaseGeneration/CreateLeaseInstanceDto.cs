namespace brownstone_hub_api.Dtos.LeaseGeneration
{
    public class CreateLeaseInstanceDto
    {
        public long LeaseId { get; set; }
        public long LeaseTemplateId { get; set; }
        public long PropertyId { get; set; }
        public long UnitId { get; set; }
        public List<long> TenantIds { get; set; } = [];
        
        // Lease terms (can override template defaults)
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public decimal? MonthlyRent { get; set; }
        public decimal? SecurityDeposit { get; set; }
        public int? RentDueDay { get; set; }
        
        // Custom policies (optional override of template policies)
        public List<string>? CustomPolicies { get; set; } // Raw policy bullets from landlord
        
        // Clause settings
        public Dictionary<string, object>? ClauseSettings { get; set; } // e.g., {"lateFee": {"enabled": true, "amount": 50}}
    }
}
