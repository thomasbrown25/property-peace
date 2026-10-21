namespace brownstone_hub_api.Services.ShortStay;

// Published legal terms apply only to the optional PP application workflow, never Stripe Connect.
internal static class ShortStayCollectionPolicy
{
    internal static bool Required(IConfiguration configuration, string key) =>
        string.Equals(configuration[$"ShortStayCollection:{key}"], "true", StringComparison.OrdinalIgnoreCase);

    internal static (string Version, string Url)? Available(IConfiguration configuration) => Configured(configuration);

    internal static (string Version, string Url)? Configured(IConfiguration configuration)
    {
        var version = configuration["ShortStayCollection:FeePolicyConsentVersion"];
        var url = configuration["ShortStayCollection:FeePolicyUrl"];
        if (string.IsNullOrWhiteSpace(version) || version.Length > 64 || version != version.Trim() || !ApprovedUrl(url))
            return null;
        return (version, url!);
    }

    // Publisher-configured canonical HTTPS document on the approved origin only.
    // The publisher must verify that the configured legal document actually exists.
    private static bool ApprovedUrl(string? url)
    {
        const string prefix = "https://app.propertypeace.io/legal/";
        if (url is null || url.Length > 512 || !url.StartsWith(prefix, StringComparison.Ordinal) ||
            !Uri.TryCreate(url, UriKind.Absolute, out var uri) ||
            uri.AbsoluteUri != url || uri.Host != "app.propertypeace.io" ||
            uri.Scheme != Uri.UriSchemeHttps || !uri.IsDefaultPort || uri.UserInfo.Length != 0 ||
            uri.Query.Length != 0 || uri.Fragment.Length != 0) return false;
        var path = url[prefix.Length..];
        return path.Length > 0 && path.Split('/').All(segment => segment.Length > 0 &&
            segment.All(c => c is >= 'a' and <= 'z' or >= '0' and <= '9' or '-'));
    }
}
