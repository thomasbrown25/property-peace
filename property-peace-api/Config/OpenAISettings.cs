namespace brownstone_hub_api.Config
{
    public class OpenAISettings
    {
        public string ApiKey { get; set; } = string.Empty;
        public string Model { get; set; } = "gpt-4";
        public string? OrganizationId { get; set; }
        public string? Endpoint { get; set; } // For Azure OpenAI: https://[resource-name].openai.azure.com/
        public string? DeploymentName { get; set; } // For Azure OpenAI: deployment name
        public string? ApiVersion { get; set; } = "2024-02-15-preview"; // For Azure OpenAI API version
    }
}
