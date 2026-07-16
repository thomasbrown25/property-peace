namespace brownstone_hub_api.Dtos.LeaseGeneration
{
    public class LoadLeaseInstanceDto
    {
        public long Id { get; set; }
        public long LeaseId { get; set; }
        public long LeaseTemplateId { get; set; }
        public string TemplateVersion { get; set; } = string.Empty;
        public bool IsDraft { get; set; }
        public bool IsFinalized { get; set; }
        public DateTime? FinalizedAt { get; set; }
        public List<string>? Warnings { get; set; }
        public List<LoadLeaseVariableDto> Variables { get; set; } = [];
        public List<LoadLeaseDocumentDto> Documents { get; set; } = [];
        public LoadLeasePolicySectionDto? PolicySection { get; set; }
        public DateTime GeneratedAt { get; set; }
        public long GeneratedBy { get; set; }
    }

    public class LoadLeaseVariableDto
    {
        public long Id { get; set; }
        public string VariableKey { get; set; } = string.Empty;
        public string VariableValue { get; set; } = string.Empty;
        public string VariableType { get; set; } = "String";
    }

    public class LoadLeaseDocumentDto
    {
        public long Id { get; set; }
        public string DocumentType { get; set; } = string.Empty;
        public string BlobName { get; set; } = string.Empty;
        public string BlobUrl { get; set; } = string.Empty;
        public DateTime GeneratedAt { get; set; }
    }

    public class LoadLeasePolicySectionDto
    {
        public long Id { get; set; }
        public List<string>? OriginalPolicies { get; set; }
        public string? AiFormattedMarkdown { get; set; }
        public string Tone { get; set; } = "Neutral";
        public DateTime? AiModifiedAt { get; set; }
    }
}
