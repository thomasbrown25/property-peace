namespace brownstone_hub_api.Models
{
    /// <summary>
    /// Resolved variable values for a lease instance (frozen when finalized)
    /// </summary>
    public class LeaseVariable
    {
        public long Id { get; set; }
        public long LeaseInstanceId { get; set; }
        public LeaseInstance LeaseInstance { get; set; } = null!;
        
        public string VariableKey { get; set; } = string.Empty; // e.g., "Tenant.FullNameList", "Property.AddressLine1"
        public string VariableValue { get; set; } = string.Empty; // Resolved value (frozen if finalized)
        
        public string VariableType { get; set; } = "String"; // String, Date, Currency, Number, List
        
        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime? UpdatedAt { get; set; }
    }
}
