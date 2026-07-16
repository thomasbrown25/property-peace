namespace brownstone_hub_api.Dtos.LeaseGeneration
{
    /// <summary>
    /// Response from AI when generating professional lease section content from lease data.
    /// </summary>
    public class AiLeasePreviewResponse
    {
        public List<AiLeaseSectionDto> Sections { get; set; } = [];
    }

    public class AiLeaseSectionDto
    {
        public string Title { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
    }
}
