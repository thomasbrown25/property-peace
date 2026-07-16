namespace brownstone_hub_api.Config
{
    public class RentcastSettings
    {
        public string ApiKey { get; set; } = string.Empty;
        public string BaseUrl { get; set; } = "https://api.rentcast.io/v1";
        public bool IsEnabled { get; set; } = true;
        public int CacheDurationDays { get; set; } = 90;
        public int ErrorCacheDurationDays { get; set; } = 3;
    }
}
