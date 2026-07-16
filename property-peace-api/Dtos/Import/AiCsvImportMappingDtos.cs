namespace brownstone_hub_api.Dtos.Import
{
    public class AiCsvImportMappingRequest
    {
        public string EntityType { get; set; } = string.Empty;
        public List<string> SourceHeaders { get; set; } = [];
        public List<Dictionary<string, string?>> SampleRows { get; set; } = [];
        public List<AiCsvExpectedFieldDto> ExpectedFields { get; set; } = [];
    }

    public class AiCsvExpectedFieldDto
    {
        public string Key { get; set; } = string.Empty;
        public bool Required { get; set; }
        public List<string> Aliases { get; set; } = [];
    }

    public class AiCsvImportMappingResponse
    {
        public List<AiCsvFieldMappingDto> Mappings { get; set; } = [];
    }

    public class AiCsvFieldMappingDto
    {
        public string FieldKey { get; set; } = string.Empty;
        public string? SourceHeader { get; set; }
        public double Confidence { get; set; }
        public string? Transformation { get; set; }
        public string? Reason { get; set; }
    }
}
