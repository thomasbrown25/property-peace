namespace brownstone_hub_api.Dtos.BackgroundCheck
{
    /// <summary>
    /// DTO for requesting a background check for an application
    /// </summary>
    public class RequestBackgroundCheckDto
    {
        public long ApplicationId { get; set; }
        public string ScreeningPackage { get; set; } = "full"; // "basic", "full", "premium"
        public bool AutoApproveOnPass { get; set; } = false; // Auto-approve if all checks pass
    }
}

