namespace brownstone_hub_api.Config;

public sealed class GooglePlacesSettings
{
    public string ApiKey { get; set; } = string.Empty;
    public string BaseUrl { get; set; } = "https://places.googleapis.com/";
    public int TimeoutSeconds { get; set; } = 8;
}
