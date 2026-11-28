namespace brownstone_hub_api.Config
{
    public class OpenAISettings
    {
        public string ApiKey { get; set; } = string.Empty;
        internal const string LunaModel = "gpt-6-luna";

        public string Model { get; set; } = LunaModel;
        public string? OrganizationId { get; set; }
        public string? Endpoint { get; set; } // Direct OpenAI by default, or an Azure OpenAI resource endpoint.
        public string? ApiVersion { get; set; } = "v1"; // Azure API version. Direct OpenAI uses its fixed v1 route.
    }
}
