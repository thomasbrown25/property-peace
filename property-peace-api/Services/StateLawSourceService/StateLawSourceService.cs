using System.Text.RegularExpressions;
using brownstone_hub_api.Repositories.StateLawSources;

namespace brownstone_hub_api.Services.StateLawSourceService
{
    public class StateLawSourceService : IStateLawSourceService
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IStateLawSourceRepository _repository;
        private readonly ILogger<StateLawSourceService> _logger;

        public StateLawSourceService(
            IHttpClientFactory httpClientFactory,
            IStateLawSourceRepository repository,
            ILogger<StateLawSourceService> logger)
        {
            _httpClientFactory = httpClientFactory;
            _repository = repository;
            _logger = logger;
        }

        public async Task<string?> GetLateFeeUrlAsync(string state, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(state)) return null;
            var row = await _repository.GetByStateAsync(state);
            return row?.LateFeeUrl;
        }

        public async Task<string?> GetSecurityDepositUrlAsync(string state, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(state)) return null;
            var row = await _repository.GetByStateAsync(state);
            return row?.SecurityDepositUrl;
        }

        public async Task<string?> FetchPageTextAsync(string url, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(url)) return null;
            try
            {
                var client = _httpClientFactory.CreateClient();
                client.Timeout = TimeSpan.FromSeconds(30);
                client.DefaultRequestHeaders.TryAddWithoutValidation("User-Agent", "Mozilla/5.0 (compatible; PropertyPeace/1.0; +https://brownstone-hub.com)");
                var response = await client.GetAsync(url, cancellationToken);
                response.EnsureSuccessStatusCode();
                var html = await response.Content.ReadAsStringAsync(cancellationToken);
                var text = StripHtmlToText(html);
                return string.IsNullOrWhiteSpace(text) ? null : text.Length > 50000 ? text.Substring(0, 50000) : text;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to fetch URL {Url}", url);
                return null;
            }
        }

        private static string StripHtmlToText(string html)
        {
            if (string.IsNullOrEmpty(html)) return string.Empty;
            var s = html;
            s = Regex.Replace(s, @"<script[^>]*>[\s\S]*?</script>", " ", RegexOptions.IgnoreCase);
            s = Regex.Replace(s, @"<style[^>]*>[\s\S]*?</style>", " ", RegexOptions.IgnoreCase);
            s = Regex.Replace(s, @"<nav[^>]*>[\s\S]*?</nav>", " ", RegexOptions.IgnoreCase);
            s = Regex.Replace(s, @"<header[^>]*>[\s\S]*?</header>", " ", RegexOptions.IgnoreCase);
            s = Regex.Replace(s, @"<footer[^>]*>[\s\S]*?</footer>", " ", RegexOptions.IgnoreCase);
            s = Regex.Replace(s, @"<[^>]+>", " ", RegexOptions.IgnoreCase);
            s = System.Net.WebUtility.HtmlDecode(s);
            s = Regex.Replace(s, @"\s+", " ");
            return s.Trim();
        }
    }
}
