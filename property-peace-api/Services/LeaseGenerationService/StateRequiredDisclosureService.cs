using System.Net;
using System.Net.Sockets;
using System.Text.Json;
using System.Text.RegularExpressions;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.LeaseShield;
using brownstone_hub_api.Services.OpenAIService;

namespace brownstone_hub_api.Services.LeaseGenerationService;

public sealed class StateRequiredDisclosureService : IStateRequiredDisclosureService
{
    private const int MaxSectionCharacters = 30_000;
    private static readonly IReadOnlyDictionary<string, string> StateCodes = BuildStateCodes();
    private readonly ILeaseShieldStateLawSectionRepository _sections;
    private readonly ILeaseShieldStateLawSourceRepository _sources;
    private readonly IOpenAIService _openAi;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<StateRequiredDisclosureService> _logger;

    public StateRequiredDisclosureService(
        ILeaseShieldStateLawSectionRepository sections,
        ILeaseShieldStateLawSourceRepository sources,
        IOpenAIService openAi,
        IHttpClientFactory httpClientFactory,
        ILogger<StateRequiredDisclosureService> logger)
    {
        _sections = sections;
        _sources = sources;
        _openAi = openAi;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task<ServiceResponse<StateRequiredDisclosureResult>> GenerateAsync(
        string state,
        CancellationToken cancellationToken = default)
    {
        if (!TryNormalizeState(state, out var stateCode))
            return Fail("Invalid property state", "A valid US state name or two-letter code is required.");

        try
        {
            var rows = await _sections.GetByStateAsync(stateCode, cancellationToken);
            if (rows.Count == 0)
                return Fail("State disclosure corpus unavailable", $"No state-law section rows are available for {stateCode}.");

            // This is the only non-section table consulted, and it is queried with the normalized state.
            var source = await _sources.GetByStateAsync(stateCode, cancellationToken);
            var supplied = new List<SuppliedSection>(rows.Count);
            foreach (var row in rows)
            {
                var content = row.ContentText;
                var contentUrl = row.SourceUrl?.Trim();
                if (string.IsNullOrWhiteSpace(content))
                {
                    contentUrl = FirstUrl(row.SourceUrl, source?.ContentUrl, source?.BaseUrl);
                    if (contentUrl == null)
                        return Fail("State disclosure corpus unavailable", $"Section {row.Id}/{row.SectionCode} has no stored content or table-provided URL.");

                    var fetched = await FetchTableUrlAsync(contentUrl, cancellationToken);
                    if (!fetched.Success)
                        return Fail("State disclosure source fetch failed", $"Could not retrieve table-provided source for section {row.Id}/{row.SectionCode}: {fetched.Error}");
                    content = fetched.Content;
                }

                if (string.IsNullOrWhiteSpace(content))
                    return Fail("State disclosure corpus unavailable", $"Section {row.Id}/{row.SectionCode} has no usable source content.");

                // A citation URL must itself come from one of the state tables.
                var citationUrl = FirstUrl(row.SourceUrl, contentUrl, source?.ContentUrl, source?.BaseUrl);
                if (citationUrl == null)
                    return Fail("State disclosure corpus unavailable", $"Section {row.Id}/{row.SectionCode} has no table-provided citation URL.");

                supplied.Add(new SuppliedSection(row.Id, row.SectionCode.Trim(), row.SectionTitle?.Trim(), citationUrl,
                    content.Length > MaxSectionCharacters ? content[..MaxSectionCharacters] : content));
            }

            var prompt = BuildPrompt(stateCode, supplied);
            var ai = await _openAi.GenerateJsonAsync<StateDisclosureAiResult>(prompt, maxTokens: 2000);
            if (!ai.Success || ai.Data == null)
                return Fail("State disclosure analysis failed", ai.Errors?.Details ?? ai.Message ?? "AI returned no structured result.");

            return ValidateResult(stateCode, supplied, ai.Data);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Grounded state disclosure generation failed for {State}", stateCode);
            return Fail("State disclosure generation failed", ex.Message);
        }
    }

    private static ServiceResponse<StateRequiredDisclosureResult> ValidateResult(
        string stateCode,
        IReadOnlyList<SuppliedSection> supplied,
        StateDisclosureAiResult result)
    {
        if (!result.DeterminationComplete || result.Disclosures == null)
            return Fail("Invalid state disclosure determination", "AI did not return a complete structured determination.");

        var known = supplied.ToDictionary(x => x.Id);
        var validated = new Dictionary<long, StateRequiredDisclosureCitation>();
        var lines = new List<string>();

        foreach (var disclosure in result.Disclosures)
        {
            if (string.IsNullOrWhiteSpace(disclosure.Quote) || disclosure.Citation == null)
                return Fail("Invalid state disclosure evidence", "Every disclosure must contain an extractive quote and one supplied-section citation.");
            if (!TryValidateCitation(disclosure.Citation, known, out var valid))
                return Fail("Invalid state disclosure citation", $"AI cited an unknown or mismatched section ({disclosure.Citation.SectionId}/{disclosure.Citation.SectionCode}).");
            if (!TryExtractExactQuote(known[valid.SectionId].Content, disclosure.Quote, out var exactQuote))
                return Fail("Non-extractive state disclosure", "Disclosure text was not an exact ordinal substring of its cited authoritative section.");
            validated[valid.SectionId] = valid;
            lines.Add($"• {exactQuote}");
        }

        if (lines.Count == 0)
        {
            if (result.Evidence == null || result.Evidence.Count == 0)
                return Fail("Untrustworthy state disclosure determination", "A no-disclosure determination must cite supplied state-law evidence.");
            foreach (var evidence in result.Evidence)
            {
                if (string.IsNullOrWhiteSpace(evidence.Quote) || evidence.Citation == null ||
                    !TryValidateCitation(evidence.Citation, known, out var valid))
                    return Fail("Invalid state disclosure evidence", "No-disclosure evidence must contain a quote and matching supplied citation.");
                if (!TryExtractExactQuote(known[valid.SectionId].Content, evidence.Quote, out _))
                    return Fail("Non-extractive state disclosure evidence", "Evidence was not an exact ordinal substring of its cited authoritative section.");
                validated[valid.SectionId] = valid;
            }
        }

        return ServiceResponse<StateRequiredDisclosureResult>.CreateSuccess(new StateRequiredDisclosureResult
        {
            StateCode = stateCode,
            PlainText = string.Join(Environment.NewLine, lines),
            SnapshotUtc = DateTime.UtcNow,
            Citations = validated.Values.OrderBy(x => x.SectionCode, StringComparer.Ordinal).ToList()
        });
    }

    private static bool TryValidateCitation(
        StateDisclosureAiCitation citation,
        IReadOnlyDictionary<long, SuppliedSection> known,
        out StateRequiredDisclosureCitation valid)
    {
        valid = null!;
        if (!known.TryGetValue(citation.SectionId, out var row) ||
            !string.Equals(citation.SectionCode?.Trim(), row.Code, StringComparison.OrdinalIgnoreCase) ||
            !UrlsEqual(citation.Url, row.Url))
            return false;

        valid = new StateRequiredDisclosureCitation
        {
            SectionId = row.Id, SectionCode = row.Code, SectionTitle = row.Title, Url = row.Url
        };
        return true;
    }

    private static bool TryExtractExactQuote(string source, string quote, out string exactQuote)
    {
        exactQuote = string.Empty;
        var index = source.IndexOf(quote, StringComparison.Ordinal);
        if (index < 0) return false;
        exactQuote = source.Substring(index, quote.Length);
        return true;
    }

    private async Task<(bool Success, string Content, string Error)> FetchTableUrlAsync(string url, CancellationToken cancellationToken)
    {
        try
        {
            if (!Uri.TryCreate(url, UriKind.Absolute, out var uri))
                return (false, string.Empty, "URL is not absolute.");
            var client = _httpClientFactory.CreateClient("StateLawSources");
            HttpResponseMessage? response = null;
            for (var redirect = 0; redirect <= 5; redirect++)
            {
                var safetyError = await ValidateSourceUriAsync(uri, cancellationToken);
                if (safetyError != null) return (false, string.Empty, safetyError);
                response?.Dispose();
                response = await client.SendAsync(new HttpRequestMessage(HttpMethod.Get, uri), HttpCompletionOption.ResponseHeadersRead, cancellationToken);
                if ((int)response.StatusCode is >= 300 and < 400)
                {
                    if (redirect == 5 || response.Headers.Location == null)
                        return (false, string.Empty, "Unsafe or excessive redirect response.");
                    uri = response.Headers.Location.IsAbsoluteUri ? response.Headers.Location : new Uri(uri, response.Headers.Location);
                    continue;
                }
                break;
            }
            using (response)
            {
                if (response == null) return (false, string.Empty, "Source returned no response.");
                if (!response.IsSuccessStatusCode) return (false, string.Empty, $"HTTP {(int)response.StatusCode}.");
                var raw = await response.Content.ReadAsStringAsync(cancellationToken);
                var text = WebUtility.HtmlDecode(Regex.Replace(Regex.Replace(raw, "<script[\\s\\S]*?</script>|<style[\\s\\S]*?</style>", " ", RegexOptions.IgnoreCase), "<[^>]+>", " "));
                text = Regex.Replace(text, "\\s+", " ").Trim();
                return string.IsNullOrWhiteSpace(text) ? (false, string.Empty, "Response contained no usable text.") : (true, text, string.Empty);
            }
        }
        catch (Exception ex)
        {
            return (false, string.Empty, ex.Message);
        }
    }

    public static async Task<string?> ValidateSourceUriAsync(Uri uri, CancellationToken cancellationToken = default)
    {
        if (!uri.IsAbsoluteUri || (uri.Scheme != Uri.UriSchemeHttps && uri.Scheme != Uri.UriSchemeHttp))
            return "Only absolute HTTP(S) source URLs are allowed.";
        if (!string.IsNullOrEmpty(uri.UserInfo) || string.Equals(uri.Host, "localhost", StringComparison.OrdinalIgnoreCase) ||
            uri.Host.EndsWith(".localhost", StringComparison.OrdinalIgnoreCase))
            return "Local or credential-bearing source URLs are not allowed.";
        IPAddress[] addresses;
        try { addresses = await Dns.GetHostAddressesAsync(uri.DnsSafeHost, cancellationToken); }
        catch (Exception ex) when (ex is SocketException or ArgumentException) { return "Source host could not be safely resolved."; }
        if (addresses.Length == 0 || addresses.Any(IsUnsafeAddress))
            return "Source host resolves to a private, local, or reserved address.";
        return null;
    }

    public static async ValueTask<Stream> ConnectToSafeHostAsync(
        SocketsHttpConnectionContext context,
        CancellationToken cancellationToken)
    {
        IPAddress[] addresses;
        try
        {
            addresses = await Dns.GetHostAddressesAsync(context.DnsEndPoint.Host, cancellationToken);
        }
        catch (Exception ex) when (ex is SocketException or ArgumentException)
        {
            throw new HttpRequestException("Source host could not be safely resolved.", ex);
        }

        if (addresses.Length == 0 || addresses.Any(IsUnsafeAddress))
            throw new HttpRequestException("Source host resolves to a private, local, or reserved address.");

        var socket = new Socket(SocketType.Stream, ProtocolType.Tcp) { NoDelay = true };
        try
        {
            await socket.ConnectAsync(addresses, context.DnsEndPoint.Port, cancellationToken);
            return new NetworkStream(socket, ownsSocket: true);
        }
        catch
        {
            socket.Dispose();
            throw;
        }
    }

    private static bool IsUnsafeAddress(IPAddress address)
    {
        if (address.IsIPv4MappedToIPv6) address = address.MapToIPv4();
        if (IPAddress.IsLoopback(address) || address.Equals(IPAddress.Any) || address.Equals(IPAddress.IPv6Any) ||
            address.Equals(IPAddress.None) || address.Equals(IPAddress.IPv6None) || address.IsIPv6LinkLocal ||
            address.IsIPv6SiteLocal || address.IsIPv6Multicast) return true;
        if (address.AddressFamily == AddressFamily.InterNetworkV6)
        {
            var v6 = address.GetAddressBytes();
            return v6[0] is 0xfc or 0xfd ||
                   (v6[0] == 0x20 && v6[1] == 0x01 && v6[2] == 0x0d && v6[3] == 0xb8);
        }
        var b = address.GetAddressBytes();
        return b[0] is 0 or 10 or 127 || b[0] >= 224 ||
               (b[0] == 100 && b[1] is >= 64 and <= 127) ||
               (b[0] == 169 && b[1] == 254) ||
               (b[0] == 172 && b[1] is >= 16 and <= 31) ||
               (b[0] == 192 && b[1] == 168) ||
               (b[0] == 192 && b[1] == 0) ||
               (b[0] == 198 && (b[1] == 18 || b[1] == 19 || (b[1] == 51 && b[2] == 100))) ||
               (b[0] == 203 && b[1] == 0 && b[2] == 113);
    }

    private static string BuildPrompt(string stateCode, IReadOnlyList<SuppliedSection> supplied)
    {
        var sourceJson = JsonSerializer.Serialize(supplied.Select(x => new
        {
            sectionId = x.Id,
            sectionCode = x.Code,
            sectionTitle = x.Title,
            url = x.Url,
            content = x.Content
        }));
        return $$"""
            Determine only the residential-lease disclosures expressly required by the supplied {{stateCode}} state-law corpus.
            You must not use outside knowledge, web search, assumptions, or uncited law. If the supplied text cannot support a trustworthy determination, set determinationComplete=false.
            Every disclosure quote and every evidence quote must be copied byte-for-byte as an exact case- and whitespace-sensitive substring from the content of its cited supplied section. Never normalize, paraphrase, or write lease-ready text.
            Each item must cite its source using the exact sectionId, sectionCode, and url. If no required disclosure is found, return an empty disclosures array and evidence containing at least one extractive quote and citation supporting the determination.
            Return JSON only with determinationComplete, disclosures (each containing quote and citation), and evidence fields.
            SUPPLIED_STATE_LAW_CORPUS:
            {{sourceJson}}
            """;
    }

    private static string? FirstUrl(params string?[] values) => values
        .Select(x => x?.Trim()).FirstOrDefault(x => !string.IsNullOrWhiteSpace(x) && Uri.TryCreate(x, UriKind.Absolute, out var uri) && (uri.Scheme == "http" || uri.Scheme == "https"));

    private static bool UrlsEqual(string? left, string right) =>
        Uri.TryCreate(left?.Trim(), UriKind.Absolute, out var a) && Uri.TryCreate(right, UriKind.Absolute, out var b) &&
        Uri.Compare(a, b, UriComponents.AbsoluteUri, UriFormat.SafeUnescaped, StringComparison.OrdinalIgnoreCase) == 0;

    private static bool TryNormalizeState(string? state, out string code)
    {
        code = string.Empty;
        if (string.IsNullOrWhiteSpace(state)) return false;
        return StateCodes.TryGetValue(state.Trim(), out code!);
    }

    private static IReadOnlyDictionary<string, string> BuildStateCodes()
    {
        var names = new[] { "AL:Alabama", "AK:Alaska", "AZ:Arizona", "AR:Arkansas", "CA:California", "CO:Colorado", "CT:Connecticut", "DE:Delaware", "FL:Florida", "GA:Georgia", "HI:Hawaii", "ID:Idaho", "IL:Illinois", "IN:Indiana", "IA:Iowa", "KS:Kansas", "KY:Kentucky", "LA:Louisiana", "ME:Maine", "MD:Maryland", "MA:Massachusetts", "MI:Michigan", "MN:Minnesota", "MS:Mississippi", "MO:Missouri", "MT:Montana", "NE:Nebraska", "NV:Nevada", "NH:New Hampshire", "NJ:New Jersey", "NM:New Mexico", "NY:New York", "NC:North Carolina", "ND:North Dakota", "OH:Ohio", "OK:Oklahoma", "OR:Oregon", "PA:Pennsylvania", "RI:Rhode Island", "SC:South Carolina", "SD:South Dakota", "TN:Tennessee", "TX:Texas", "UT:Utah", "VT:Vermont", "VA:Virginia", "WA:Washington", "WV:West Virginia", "WI:Wisconsin", "WY:Wyoming" };
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var value in names)
        {
            var parts = value.Split(':'); result[parts[0]] = parts[0]; result[parts[1]] = parts[0];
        }
        return result;
    }

    private static ServiceResponse<StateRequiredDisclosureResult> Fail(string message, string details) =>
        ServiceResponse<StateRequiredDisclosureResult>.CreateError(message, details, statusCode: 422);

    private sealed record SuppliedSection(long Id, string Code, string? Title, string Url, string Content);
}
