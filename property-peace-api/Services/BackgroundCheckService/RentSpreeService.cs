using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using brownstone_hub_api.Config;
using brownstone_hub_api.Dtos.BackgroundCheck;
using Microsoft.Extensions.Options;

namespace brownstone_hub_api.Services.BackgroundCheckService
{
    public interface IRentSpreeService
    {
        Task<RentSpreeResponseDto> RequestBackgroundCheckAsync(RentSpreeRequestDto request);
        Task<RentSpreeResponseDto> GetBackgroundCheckStatusAsync(string requestId);
    }

    public class RentSpreeService : IRentSpreeService
    {
        private readonly RentSpreeSettings _settings;
        private readonly HttpClient _httpClient;
        private readonly ILogger<RentSpreeService> _logger;

        public RentSpreeService(
            IOptions<RentSpreeSettings> settings,
            IHttpClientFactory httpClientFactory,
            ILogger<RentSpreeService> logger)
        {
            _settings = settings.Value;
            _httpClient = httpClientFactory.CreateClient();
            _logger = logger;

            // Validate configuration
            ValidateConfiguration();

            // Set base URL
            if (string.IsNullOrWhiteSpace(_settings.BaseUrl))
            {
                _logger.LogWarning("RentSpree BaseUrl is not configured. Using default: https://api.rentspree.com/v1");
                _settings.BaseUrl = "https://api.rentspree.com/v1";
            }
            
            try
            {
                _httpClient.BaseAddress = new Uri(_settings.BaseUrl);
            }
            catch (UriFormatException ex)
            {
                _logger.LogError(ex, "Invalid RentSpree BaseUrl: {BaseUrl}", _settings.BaseUrl);
                throw new InvalidOperationException($"Invalid RentSpree BaseUrl: {_settings.BaseUrl}", ex);
            }
            
            // Set authentication headers
            if (!string.IsNullOrEmpty(_settings.ApiKey) && !string.IsNullOrEmpty(_settings.ApiSecret))
            {
                var authValue = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{_settings.ApiKey}:{_settings.ApiSecret}"));
                _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", authValue);
            }
            else
            {
                _logger.LogWarning("RentSpree API credentials are not configured. API calls will fail.");
            }

            _httpClient.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        }

        private void ValidateConfiguration()
        {
            var errors = new List<string>();

            if (string.IsNullOrWhiteSpace(_settings.ApiKey))
            {
                errors.Add("RentSpree ApiKey is not configured");
            }

            if (string.IsNullOrWhiteSpace(_settings.ApiSecret))
            {
                errors.Add("RentSpree ApiSecret is not configured");
            }

            if (errors.Any())
            {
                _logger.LogWarning("RentSpree configuration issues: {Errors}. Background checks will not work until configured.", string.Join("; ", errors));
            }
        }

        public async Task<RentSpreeResponseDto> RequestBackgroundCheckAsync(RentSpreeRequestDto request)
        {
            // Validate API credentials before making request
            if (string.IsNullOrWhiteSpace(_settings.ApiKey) || string.IsNullOrWhiteSpace(_settings.ApiSecret))
            {
                _logger.LogError("Cannot request background check: RentSpree API credentials are not configured");
                return new RentSpreeResponseDto
                {
                    Status = "failed",
                    Error = "RentSpree API credentials are not configured. Please configure ApiKey and ApiSecret in appsettings.json or Azure App Configuration."
                };
            }

            try
            {
                var json = JsonSerializer.Serialize(request, new JsonSerializerOptions
                {
                    PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                    DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
                });

                var content = new StringContent(json, Encoding.UTF8, "application/json");
                
                _logger.LogInformation("Requesting background check from RentSpree for {Email} (Application: {FirstName} {LastName})", 
                    request.Email, request.FirstName, request.LastName);

                var response = await _httpClient.PostAsync("/screening/request", content);
                var responseContent = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogError("RentSpree API error: {StatusCode} - {Content}", response.StatusCode, responseContent);
                    return new RentSpreeResponseDto
                    {
                        Status = "failed",
                        Error = $"API Error: {response.StatusCode} - {responseContent}"
                    };
                }

                var result = JsonSerializer.Deserialize<RentSpreeResponseDto>(responseContent, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });

                _logger.LogInformation("Background check requested successfully. RequestId: {RequestId}", result?.RequestId);
                return result ?? new RentSpreeResponseDto { Status = "failed", Error = "Failed to parse response" };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error requesting background check from RentSpree");
                return new RentSpreeResponseDto
                {
                    Status = "failed",
                    Error = ex.Message
                };
            }
        }

        public async Task<RentSpreeResponseDto> GetBackgroundCheckStatusAsync(string requestId)
        {
            // Validate API credentials before making request
            if (string.IsNullOrWhiteSpace(_settings.ApiKey) || string.IsNullOrWhiteSpace(_settings.ApiSecret))
            {
                _logger.LogError("Cannot get background check status: RentSpree API credentials are not configured");
                return new RentSpreeResponseDto
                {
                    Status = "failed",
                    Error = "RentSpree API credentials are not configured. Please configure ApiKey and ApiSecret in appsettings.json or Azure App Configuration."
                };
            }

            if (string.IsNullOrWhiteSpace(requestId))
            {
                _logger.LogError("Cannot get background check status: RequestId is required");
                return new RentSpreeResponseDto
                {
                    Status = "failed",
                    Error = "RequestId is required to check background check status"
                };
            }

            try
            {
                _logger.LogInformation("Checking background check status for RequestId: {RequestId}", requestId);

                var response = await _httpClient.GetAsync($"/screening/status/{requestId}");
                var responseContent = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogError("RentSpree API error: {StatusCode} - {Content}", response.StatusCode, responseContent);
                    return new RentSpreeResponseDto
                    {
                        Status = "failed",
                        Error = $"API Error: {response.StatusCode} - {responseContent}"
                    };
                }

                var result = JsonSerializer.Deserialize<RentSpreeResponseDto>(responseContent, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });

                return result ?? new RentSpreeResponseDto { Status = "failed", Error = "Failed to parse response" };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting background check status from RentSpree");
                return new RentSpreeResponseDto
                {
                    Status = "failed",
                    Error = ex.Message
                };
            }
        }
    }
}

