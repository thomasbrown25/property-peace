namespace brownstone_hub_api.Dtos.LeaseGeneration
{
    public class LeaseReviewResultDto
    {
        public bool HasIssues { get; set; }
        public string? Summary { get; set; }
        public List<LeaseReviewIssueDto> Issues { get; set; } = [];
    }

    public class LeaseReviewIssueDto
    {
        /// <summary>"error" | "warning" | "suggestion"</summary>
        public string Severity { get; set; } = "warning";
        /// <summary>E.g. "Missing Clause", "Unfilled Placeholder", "Risky Language", "State Compliance"</summary>
        public string Category { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        /// <summary>Which lease section this relates to (optional).</summary>
        public string? Section { get; set; }
    }

    /// <summary>Shape OpenAI must return for the review call.</summary>
    internal class AiLeaseReviewResponse
    {
        public string? Summary { get; set; }
        public List<AiLeaseReviewIssue> Issues { get; set; } = [];
    }

    internal class AiLeaseReviewIssue
    {
        public string Severity { get; set; } = "warning";
        public string Category { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public string? Section { get; set; }
    }
}
