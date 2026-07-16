namespace brownstone_hub_api.Services.StateLawSourceService
{
    public class CuratedStateLawUrlsConfig
    {
        public string? Comment { get; set; }
        public Dictionary<string, StateLawUrls>? Sources { get; set; }
    }

    public class StateLawUrls
    {
        public string? LateFeeUrl { get; set; }
        public string? SecurityDepositUrl { get; set; }
    }
}
