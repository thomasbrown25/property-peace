using System.Net;
using System.Text.RegularExpressions;

namespace brownstone_hub_api.Services.ShortStay;

// Only the explicit owner-curated fields may pass through this plain-text boundary.
// UI consumers render these strings as text, never as HTML.
internal static partial class ShortStayPublicCopy
{
    [GeneratedRegex(@"<\s*(script|style)\b[^>]*>.*?<\s*/\s*\1\s*>", RegexOptions.IgnoreCase | RegexOptions.Singleline)]
    private static partial Regex ExecutableBlocks();
    [GeneratedRegex(@"<[^>]*>", RegexOptions.Singleline)]
    private static partial Regex Markup();

    public static string? PlainText(string? input)
    {
        if (string.IsNullOrWhiteSpace(input)) return null;
        var value = WebUtility.HtmlDecode(input);
        value = ExecutableBlocks().Replace(value, " ");
        value = Markup().Replace(value, " ");
        value = value.Replace('<', ' ').Replace('>', ' ');
        value = new string(value.Where(c => !char.IsControl(c) || c is '\n' or '\t').ToArray());
        value = Regex.Replace(value, @"\s+", " ").Trim();
        return value.Length == 0 ? null : value;
    }
}
