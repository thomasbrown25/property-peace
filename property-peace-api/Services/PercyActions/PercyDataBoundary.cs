using brownstone_hub_api.Dtos.AICopilot;
using System.Text.RegularExpressions;

namespace brownstone_hub_api.Services.PercyActions;

public enum PercyRedactionProfile
{
    UserInput,
    PersistedHistory,
    TrustedContext,
    GeneratedOutput,
    Audit
}

public sealed record PercyRedactionResult(
    string Text,
    int RedactionCount,
    string Profile,
    bool WasTruncated)
{
    public string ToAuditMetadata() =>
        $"profile={Profile};redactions={RedactionCount};truncated={WasTruncated.ToString().ToLowerInvariant()}";
}

/// <summary>
/// The single sensitive-data boundary for Percy. It is deliberately deterministic: callers receive
/// safe text plus counts/profile metadata, never the values that were removed.
/// </summary>
public static class PercyDataBoundary
{
    public const int MaxInputLength = 8_000;
    public const int MaxHistoryLength = 1_500;
    public const int MaxContextLength = 24_000;
    public const int MaxContentLength = 4_000;
    public const int MaxLabelLength = 100;
    public const int MaxStatusLength = 240;
    public const int MaxMetrics = 4;
    public const int MaxMetricLabelLength = 80;
    public const int MaxMetricValueLength = 120;
    public const int MaxItems = 8;
    public const int MaxItemTitleLength = 140;
    public const int MaxItemDetailLength = 500;
    public const int MaxItemValueLength = 120;
    public const int MaxSources = 3;
    public const int MaxSourceKindLength = 40;
    public const int MaxSourceLabelLength = 80;
    public const int MaxSourceRouteLength = 160;
    public const int MaxSourceReferenceLength = 100;
    public const int MaxExactSensitiveValues = 512;
    public const int MaxExactSensitiveValueLength = 256;

    private static readonly TimeSpan RegexTimeout = TimeSpan.FromMilliseconds(250);
    private static readonly Regex AddressCandidatePattern = Rx(
        @"\b\d{1,6}\s+(?:[A-Za-z0-9.'-]+\s+){0,8}(?:Street|St\.?|Avenue|Ave\.?|Road|Rd\.?|Drive|Dr\.?|Lane|Ln\.?|Boulevard|Blvd\.?|Terrace|Court|Ct\.?|Parkway|Pkwy\.?|Place|Pl\.?|Highway|Hwy\.?)\b",
        RegexOptions.IgnoreCase);
    private static readonly Regex NameCandidatePattern = Rx(
        @"\b(?:Tenant|Applicant|Resident|Occupant|Name)\s*(?:name)?\s*[:=#-]?\s+(?<value>(?:[A-Z](?:[a-z'’-]+|\.)\s+){1,3}[A-Z][a-z'’-]+\.?)");
    private static readonly Regex UnlabelledNameBeforeAddressPattern = Rx(
        @"\b(?<value>[A-Z][a-z'’-]+\s+[A-Z][a-z'’-]+)\s+(?:near|at|by)\s+\d{1,6}\s+");
    private static readonly IReadOnlyDictionary<string, string> SourceRoutes =
        new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["portfolio"] = "/landlord/properties",
            ["rent-payments"] = "/landlord/payments",
            ["maintenance"] = "/landlord/maintenances",
            ["leases-applications"] = "/landlord/applications",
            ["urgent-messages"] = "/landlord/urgent-messages"
        };
    private static readonly Regex OpaqueReferencePattern = Rx(@"^(?=.*[A-Za-z_-])[A-Za-z0-9_-]{1,100}$");

    private static readonly (Regex Pattern, string Replacement)[] Patterns =
    [
        (Rx(@"-----BEGIN [A-Z0-9 ]*(?:PRIVATE KEY|CERTIFICATE)-----[\s\S]*?-----END [A-Z0-9 ]*(?:PRIVATE KEY|CERTIFICATE)-----"), "[PEM]"),
        (Rx(@"(?i)\b(?:server|data\s+source)\s*=\s*[^;\r\n]+;(?:[^;\r\n]*;){0,8}\s*(?:password|pwd)\s*=\s*[^;\r\n]+;?"), "[CONNECTION_STRING]"),
        (Rx(@"(?i)\b[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}\b"), "[EMAIL]"),
        (Rx(@"(?<!\d)(?:\+?1[ .-]?)?(?:\(\d{3}\)|\d{3})[ .-]\d{3}[ .-]\d{4}(?!\d)"), "[PHONE]"),
        (Rx(@"(?i)\b(?:ssn|social\s+security(?:\s+number)?|tax\s*id|ein)\s*[:=#-]?\s*\d{2,3}[- ]?\d{2}[- ]?\d{4,7}\b|(?<!\d)\d{3}-\d{2}-\d{4}(?!\d)"), "[TAX_ID]"),
        (Rx(@"(?i)\b(?:routing|aba|account|acct|bank)(?:\s+(?:number|no\.?|#))?\s*[:=#-]?\s*\d(?:[ -]?\d){4,17}\b"), "[BANK_ACCOUNT]"),
        (Rx(@"(?i)\b(?:bearer|basic)\s+[A-Za-z0-9._~+/=-]{8,}"), "[TOKEN]"),
        (Rx(@"\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{6,}\b"), "[JWT]"),
        (Rx(@"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b"), "[AWS_ACCESS_KEY]"),
        (Rx(@"(?i)\b(?:api[_ -]?key|secret|access[_ -]?token|refresh[_ -]?token|client[_ -]?secret|password|pwd)\s*[:=]\s*(?:'[^'\r\n]{3,}'|""[^""\r\n]{3,}""|[^\s;,]{6,})"), "[SECRET]"),
        (Rx(@"\b(?:sk|pk|rk)[-_](?:live|test)[-_][A-Za-z0-9]{6,}\b"), "[API_KEY]"),
        (Rx(@"\b\d{1,6}\s+(?:[A-Za-z0-9.'-]+\s+){0,8}(?:Street|St\.?|Avenue|Ave\.?|Road|Rd\.?|Drive|Dr\.?|Lane|Ln\.?|Boulevard|Blvd\.?|Terrace|Court|Ct\.?|Parkway|Pkwy\.?|Place|Pl\.?|Highway|Hwy\.?)\b", RegexOptions.IgnoreCase), "[ADDRESS]"),
        (Rx(@"\b(?:Tenant|Applicant|Resident|Occupant|Name)\s*(?:name)?\s*[:=#-]?\s+(?:[A-Z](?:[a-z'’-]+|\.)\s+){1,3}[A-Z][a-z'’-]+\.?"), "[PERSON]"),
        (Rx(@"(?<![\d/])(?:\d[ -]?){12,18}\d(?![\d/])"), "[CARD_OR_ACCOUNT]"),
        (Rx(@"(?<![\d/])\d{9}(?![\d/])"), "[ACCOUNT_NUMBER]")
    ];

    public static PercyRedactionResult Redact(
        string? value,
        PercyRedactionProfile profile,
        IEnumerable<string?>? exactSensitiveValues = null,
        int? maxLength = null)
    {
        var text = value ?? string.Empty;
        var count = 0;

        if (exactSensitiveValues != null)
        {
            foreach (var exact in exactSensitiveValues
                         .Where(x => !string.IsNullOrWhiteSpace(x) && x!.Trim().Length >= 3)
                         .Select(x => x!.Trim())
                         .Distinct(StringComparer.OrdinalIgnoreCase)
                         .Where(x => x.Length <= MaxExactSensitiveValueLength)
                         .Take(MaxExactSensitiveValues)
                         .OrderByDescending(x => x.Length))
            {
                var marker = LooksLikeAddress(exact) ? "[ADDRESS]" : "[PERSON]";
                text = ReplaceLiteralCounted(text, exact, marker, ref count);
            }
        }

        foreach (var (pattern, replacement) in Patterns)
            text = ReplaceCounted(text, pattern, replacement, ref count);

        var limit = maxLength ?? LimitFor(profile);
        var truncated = text.Length > limit;
        if (truncated) text = text[..limit];
        return new PercyRedactionResult(text, count, ProfileName(profile), truncated);
    }

    public static List<string?> BuildBoundedSensitiveValues(
        IEnumerable<string?>? seedValues,
        IEnumerable<string?>? boundaryTexts = null)
    {
        var values = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        void Add(string? candidate)
        {
            candidate = candidate?.Trim();
            if (!string.IsNullOrWhiteSpace(candidate) && candidate.Length >= 3 &&
                candidate.Length <= MaxExactSensitiveValueLength && values.Count < MaxExactSensitiveValues)
                values.Add(candidate);
        }

        foreach (var text in boundaryTexts ?? [])
        {
            if (string.IsNullOrWhiteSpace(text)) continue;
            foreach (Match match in AddressCandidatePattern.Matches(text)) Add(match.Value);
            foreach (Match match in NameCandidatePattern.Matches(text)) Add(match.Groups["value"].Value);
            foreach (Match match in UnlabelledNameBeforeAddressPattern.Matches(text)) Add(match.Groups["value"].Value);
        }
        foreach (var seed in seedValues ?? []) Add(seed);

        return values.Cast<string?>().ToList();
    }

    public static PercyRedactionResult SanitizeResponse(
        PercyChatResponseDto response,
        IEnumerable<string?>? exactSensitiveValues = null,
        IEnumerable<string?>? exactAllowedDisplayValues = null)
    {
        ArgumentNullException.ThrowIfNull(response);
        var total = 0;
        var truncated = false;
        var allowedDisplayValues = (exactAllowedDisplayValues ?? [])
            .Where(value => !string.IsNullOrWhiteSpace(value) && value!.Trim().Length >= 3)
            .Select(value => value!.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Where(value => value.Length <= MaxExactSensitiveValueLength)
            .Where(IsSafeAllowedDisplayValue)
            .Take(MaxExactSensitiveValues)
            .OrderByDescending(value => value.Length)
            .ToList();

        string Safe(string? value, int limit)
        {
            var protectedText = value ?? string.Empty;
            var protections = new List<(string Token, string Value)>();
            for (var index = 0; index < allowedDisplayValues.Count; index++)
            {
                var allowedValue = allowedDisplayValues[index];
                if (!protectedText.Contains(allowedValue, StringComparison.OrdinalIgnoreCase)) continue;

                var token = $"PERCYDISPLAYVALUE{index}TOKEN";
                while (protectedText.Contains(token, StringComparison.Ordinal)) token += "X";
                protectedText = ProtectAllowedDisplayValue(protectedText, allowedValue, token);
                protections.Add((token, allowedValue));
            }

            // Apply the complete output boundary before restoring only exact, trusted display values
            // supplied by a deterministic server response. Truncate after restoration so protection
            // tokens cannot change configured field limits.
            var result = Redact(protectedText, PercyRedactionProfile.GeneratedOutput, exactSensitiveValues, int.MaxValue);
            var safeText = result.Text;
            foreach (var (token, allowedValue) in protections)
                safeText = safeText.Replace(token, allowedValue, StringComparison.Ordinal);

            var fieldWasTruncated = safeText.Length > limit;
            if (fieldWasTruncated) safeText = safeText[..limit];
            total += result.RedactionCount;
            truncated |= result.WasTruncated || fieldWasTruncated;
            return safeText;
        }

        response.Content = Safe(response.Content, MaxContentLength);
        response.ConversationTitle = Safe(response.ConversationTitle, MaxLabelLength);
        response.ActivityLabel = Safe(response.ActivityLabel, MaxLabelLength);
        response.ActivityStatus = Safe(response.ActivityStatus, MaxStatusLength);
        response.Metrics = (response.Metrics ?? []).Take(MaxMetrics).Select(metric => new PercyMetricDto
        {
            Label = Safe(metric.Label, MaxMetricLabelLength),
            Value = Safe(metric.Value, MaxMetricValueLength),
            Money = metric.Money
        }).ToList();
        response.Items = (response.Items ?? []).Take(MaxItems).Select(item => new PercyResultItemDto
        {
            Title = Safe(item.Title, MaxItemTitleLength),
            Detail = Safe(item.Detail, MaxItemDetailLength),
            Value = item.Value == null ? null : Safe(item.Value, MaxItemValueLength)
        }).ToList();
        response.Sources = (response.Sources ?? [])
            .Where(source => source != null && SourceRoutes.TryGetValue(source.Kind ?? string.Empty, out var route) &&
                string.Equals(route, source.WorkflowRoute, StringComparison.Ordinal))
            .Take(MaxSources)
            .Select(source => new PercySourceDto
            {
                Kind = Safe(source.Kind, MaxSourceKindLength),
                Label = Safe(source.Label, MaxSourceLabelLength),
                WorkflowRoute = Safe(source.WorkflowRoute, MaxSourceRouteLength),
                RecordReference = string.IsNullOrWhiteSpace(source.RecordReference) ||
                    !OpaqueReferencePattern.IsMatch(source.RecordReference)
                        ? null
                        : Safe(source.RecordReference, MaxSourceReferenceLength),
                RetrievedAtUtc = source.RetrievedAtUtc.Kind == DateTimeKind.Utc
                    ? source.RetrievedAtUtc
                    : source.RetrievedAtUtc.ToUniversalTime()
            }).ToList();
        if (response.PendingConfirmation != null)
        {
            response.PendingConfirmation.ActionLabel = Safe(response.PendingConfirmation.ActionLabel, MaxLabelLength);
            response.PendingConfirmation.Status = Safe(response.PendingConfirmation.Status, MaxLabelLength);
            response.PendingConfirmation.Prompt = Safe(response.PendingConfirmation.Prompt, MaxStatusLength);
        }

        return new PercyRedactionResult(response.Content, total, ProfileName(PercyRedactionProfile.GeneratedOutput), truncated);
    }

    private static Regex Rx(string pattern, RegexOptions options = RegexOptions.None) => new(pattern,
        RegexOptions.Compiled | RegexOptions.CultureInvariant | options, RegexTimeout);

    private static string ReplaceCounted(string input, Regex regex, string replacement, ref int count)
    {
        var localCount = 0;
        var output = regex.Replace(input, _ =>
        {
            localCount++;
            return replacement;
        });
        count += localCount;
        return output;
    }

    private static string ReplaceLiteralCounted(string input, string value, string replacement, ref int count)
    {
        var start = 0;
        while (true)
        {
            var index = input.IndexOf(value, start, StringComparison.OrdinalIgnoreCase);
            if (index < 0) return input;
            input = string.Concat(input.AsSpan(0, index), replacement, input.AsSpan(index + value.Length));
            count++;
            start = index + replacement.Length;
        }
    }

    private static bool LooksLikeAddress(string value) =>
        Regex.IsMatch(value, @"^\s*\d{1,6}\s+", RegexOptions.CultureInvariant, RegexTimeout) ||
        Regex.IsMatch(value, @"(?i)\b(?:street|st\.?|avenue|ave\.?|road|rd\.?|drive|dr\.?|lane|ln\.?|boulevard|blvd\.?|terrace|court|ct\.?|highway|hwy\.?)\b",
            RegexOptions.CultureInvariant, RegexTimeout);

    private static string ProtectAllowedDisplayValue(string text, string allowedValue, string token)
    {
        var addressCandidates = AddressCandidatePattern.Matches(text).Cast<Match>().ToList();
        var exactValuePattern = $@"(?<![A-Za-z0-9]){Regex.Escape(allowedValue)}(?![A-Za-z0-9])";

        return Regex.Replace(text, exactValuePattern, match =>
        {
            var matchEnd = match.Index + match.Length;
            var masksLargerAddress = addressCandidates.Any(candidate =>
                candidate.Index <= match.Index &&
                candidate.Index + candidate.Length >= matchEnd &&
                !string.Equals(candidate.Value, allowedValue, StringComparison.OrdinalIgnoreCase));
            return masksLargerAddress ? match.Value : token;
        }, RegexOptions.IgnoreCase | RegexOptions.CultureInvariant, RegexTimeout);
    }

    private static bool IsSafeAllowedDisplayValue(string value)
    {
        // Generic road words and incomplete numeric prefixes can occur inside unrelated addresses.
        // Never let them become redaction-bypass tokens merely because a record used them as a name.
        if (Regex.IsMatch(value,
                @"^(?:street|st\.?|avenue|ave\.?|road|rd\.?|drive|dr\.?|lane|ln\.?|boulevard|blvd\.?|terrace|court|ct\.?|parkway|pkwy\.?|place|pl\.?|highway|hwy\.?)$",
                RegexOptions.IgnoreCase | RegexOptions.CultureInvariant, RegexTimeout))
            return false;

        if (LooksLikeAddress(value) && !AddressCandidatePattern.IsMatch(value))
            return false;

        return !Regex.IsMatch(value, @"^\s*\d{1,6}\s+", RegexOptions.CultureInvariant, RegexTimeout) ||
               AddressCandidatePattern.IsMatch(value);
    }

    private static int LimitFor(PercyRedactionProfile profile) => profile switch
    {
        PercyRedactionProfile.PersistedHistory => MaxHistoryLength,
        PercyRedactionProfile.TrustedContext => MaxContextLength,
        PercyRedactionProfile.GeneratedOutput => MaxContentLength,
        PercyRedactionProfile.Audit => MaxStatusLength,
        _ => MaxInputLength
    };

    private static string ProfileName(PercyRedactionProfile profile) => profile switch
    {
        PercyRedactionProfile.UserInput => "percy-user-input-v1",
        PercyRedactionProfile.PersistedHistory => "percy-history-v1",
        PercyRedactionProfile.TrustedContext => "percy-trusted-context-v1",
        PercyRedactionProfile.GeneratedOutput => "percy-output-v1",
        PercyRedactionProfile.Audit => "percy-audit-v1",
        _ => "percy-redaction-v1"
    };
}
