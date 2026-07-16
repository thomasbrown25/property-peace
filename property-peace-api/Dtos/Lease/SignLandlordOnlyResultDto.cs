namespace brownstone_hub_api.Dtos.Lease
{
    public class SignLandlordOnlyResultDto
    {
        public string EnvelopeId { get; set; } = string.Empty;
        public string EmbeddedSigningUrl { get; set; } = string.Empty;
        public Dictionary<string, string> SignerUrls { get; set; } = new();
        public DateTime? ExpiresAt { get; set; }
        public string Message { get; set; } = string.Empty;
    }
}
