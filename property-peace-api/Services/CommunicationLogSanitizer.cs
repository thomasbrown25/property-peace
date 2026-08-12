namespace brownstone_hub_api.Services;

/// <summary>Produces log-safe labels for communication destinations without changing provider inputs.</summary>
public static class CommunicationLogSanitizer
{
    public static string MaskDestination(string? destination)
    {
        if (string.IsNullOrWhiteSpace(destination)) return "[not-set]";

        var value = destination.Trim();
        var open = value.LastIndexOf('<');
        var close = open >= 0 ? value.IndexOf('>', open + 1) : -1;
        if (open >= 0 && close > open)
            value = value[(open + 1)..close].Trim();

        var at = value.LastIndexOf('@');
        if (at > 0 && at < value.Length - 1)
            return $"{value[0]}***@{value[(at + 1)..]}";

        var digits = new string(value.Where(char.IsDigit).ToArray());
        if (digits.Length > 0)
            return digits.Length <= 4 ? "***" : $"***{digits[^4..]}";

        return "[redacted]";
    }
}
