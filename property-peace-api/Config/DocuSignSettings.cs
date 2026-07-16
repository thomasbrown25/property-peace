namespace brownstone_hub_api.Config
{
    /// <summary>
    /// Configuration settings for DocuSign integration
    /// </summary>
    public class DocuSignSettings
    {
        public string IntegrationKey { get; set; } = string.Empty; // Client ID / Integration Key
        public string UserId { get; set; } = string.Empty; // User ID (GUID)
        public string AccountId { get; set; } = string.Empty; // Account ID (GUID)
        public string PrivateKeyPath { get; set; } = string.Empty; // Path to RSA private key file
        public string PrivateKeyContent { get; set; } = string.Empty; // RSA private key content (alternative to path)
        public string ApiBaseUrl { get; set; } = "https://demo.docusign.net/restapi"; // Demo: https://demo.docusign.net/restapi, Production: https://www.docusign.net/restapi
        public string AuthServer { get; set; } = "account-d.docusign.com"; // Demo: account-d.docusign.com, Production: account.docusign.com
        public int JwtExpirationSeconds { get; set; } = 3600; // JWT token expiration (1 hour default)
        public bool UseProduction { get; set; } = false; // Set to true for production environment
        /// <summary>Optional. HMAC secret for verifying DocuSign Connect webhook requests (X-Docusign-Signature-* headers). If not set, verification is skipped.</summary>
        public string ConnectSecret { get; set; } = string.Empty;
    }
}

