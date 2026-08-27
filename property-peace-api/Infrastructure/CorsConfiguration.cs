namespace brownstone_hub_api.Infrastructure;

public static class CorsConfiguration
{
    public static readonly string[] AllowedHeaders =
    [
        "Authorization",
        "Content-Type",
        "X-Requested-With",
        "Accept",
        "Origin",
        "x-signalr-user-agent",
        "x-requested-with",
        "x-organization-id",
        "Idempotency-Key"
    ];
}
