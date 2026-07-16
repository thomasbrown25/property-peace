using System.Text.RegularExpressions;

namespace brownstone_hub_api.Helpers
{
    /// <summary>
    /// Builds URL slugs for published listings from address (and optional unit).
    /// Example: "1317 Shannon House Drive, Charlotte, NC 28215" -> "1317-shannon-house-drive-charlotte-nc-28215"
    /// </summary>
    public static class ListingSlugHelper
    {
        /// <summary>
        /// Produces a URL-safe slug: lowercase, spaces and commas replaced with dashes, no consecutive dashes.
        /// </summary>
        public static string ToSlug(string? address, string? unitName = null)
        {
            var parts = new List<string>();

            if (!string.IsNullOrWhiteSpace(address))
            {
                var normalized = address.Trim()
                    .ToLowerInvariant()
                    .Replace(",", "-", StringComparison.Ordinal)
                    .Replace(" ", "-", StringComparison.Ordinal);
                normalized = Regex.Replace(normalized, @"-+", "-").Trim('-');
                if (normalized.Length > 0)
                    parts.Add(normalized);
            }

            if (!string.IsNullOrWhiteSpace(unitName))
            {
                var unitSlug = unitName.Trim()
                    .ToLowerInvariant()
                    .Replace(",", "-", StringComparison.Ordinal)
                    .Replace(" ", "-", StringComparison.Ordinal);
                unitSlug = Regex.Replace(unitSlug, @"-+", "-").Trim('-');
                if (unitSlug.Length > 0)
                    parts.Add(unitSlug);
            }

            return parts.Count > 0 ? string.Join("-", parts) : "";
        }
    }
}
