namespace brownstone_hub_api.Services.BotChallenge;

public sealed class TurnstileOptions
{
    public const string SectionName = "Turnstile";

    public bool Enabled { get; set; }
    public string SecretKey { get; set; } = string.Empty;
    public string SiteVerifyUrl { get; set; } = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
    public string[] AllowedHostnames { get; set; } = [];
}
