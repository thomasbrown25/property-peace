namespace brownstone_hub_api.Dtos.Lease
{
    /// <summary>
    /// DTO for sending a lease for e-signature
    /// </summary>
    public class SendLeaseForSignatureDto
    {
        public long LeaseId { get; set; }
        public long? LeaseTemplateId { get; set; } // Optional: template to use for generating lease document
        
        // Landlord signer info
        public string LandlordEmail { get; set; } = string.Empty;
        public string LandlordName { get; set; } = string.Empty;
        
        // Tenant signer info (can have multiple tenants)
        public List<TenantSignerDto> TenantSigners { get; set; } = [];
        
        // Signature request settings
        public string? EmailSubject { get; set; } // Custom email subject
        public string? EmailMessage { get; set; } // Custom email message
        public int ExpirationDays { get; set; } = 30; // Days until signature request expires
        public bool RequireAllSigners { get; set; } = true; // Whether all signers must sign
        public bool UseEmbeddedSigning { get; set; } = false; // Whether to use embedded signing (no email sent)
    }
    
    public class TenantSignerDto
    {
        public long TenantId { get; set; }
        public string Email { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public int SigningOrder { get; set; } = 1; // Order in which tenant should sign (1 = first, 2 = second, etc.)
    }
}

