namespace brownstone_hub_api.Config
{
    public class AnthropicSettings
    {
        public string ApiKey { get; set; } = string.Empty;
        public string Model { get; set; } = "claude-sonnet-4-6";
        public string FastModel { get; set; } = "claude-haiku-4-5";
        public string AgentModel { get; set; } = "claude-sonnet-4-6";
    }
}
