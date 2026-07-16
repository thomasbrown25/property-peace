namespace brownstone_hub_api.Dtos.LeaseGeneration
{
    public class FormatPoliciesDto
    {
        public List<string> RawPolicies { get; set; } = [];
        public string Tone { get; set; } = "Neutral"; // Strict, Neutral, Friendly
    }

    public class SuggestPoliciesDto
    {
        public string Tone { get; set; } = "Neutral"; // Strict, Neutral, Friendly
    }

    public class FormatPoliciesResponseDto
    {
        public List<FormattedPolicyItemDto> Policies { get; set; } = [];
        public string Markdown { get; set; } = string.Empty;
    }

    public class FormattedPolicyItemDto
    {
        public string Title { get; set; } = string.Empty;
        public string Body { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public List<string>? RiskFlags { get; set; }
    }
}
