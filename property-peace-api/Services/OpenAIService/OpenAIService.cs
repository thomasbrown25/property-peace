using brownstone_hub_api.Config;
using Microsoft.Extensions.Options;
using System.Text.Json;
using System.Net.Http.Json;
using System.Net.Http.Headers;

namespace brownstone_hub_api.Services.OpenAIService
{
    public class OpenAIService : IOpenAIService
    {
        private readonly OpenAISettings _settings;
        private readonly ILogger<OpenAIService> _logger;
        private readonly HttpClient _httpClient;
        private readonly Uri _completionEndpoint;

        public OpenAIService(IOptions<OpenAISettings> settings, ILogger<OpenAIService> logger, IHttpClientFactory httpClientFactory)
        {
            _settings = settings.Value;
            _logger = logger;
            _httpClient = httpClientFactory.CreateClient();
            var (endpoint, usesAzure) = GetCompletionEndpoint(_settings);
            _completionEndpoint = endpoint;
            
            if (!string.IsNullOrEmpty(_settings.ApiKey))
            {
                // Azure OpenAI uses "api-key" header, OpenAI direct API uses "Authorization: Bearer"
                if (usesAzure)
                {
                    _httpClient.DefaultRequestHeaders.Add("api-key", _settings.ApiKey);
                }
                else
                {
                    _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", _settings.ApiKey);
                }
            }
            else
            {
                _logger.LogWarning("OpenAI API key not configured. AI features will be disabled.");
            }
        }

        public async Task<ServiceResponse<string>> GenerateTextAsync(string prompt, int maxTokens = 1000)
        {
            try
            {
                if (string.IsNullOrEmpty(_settings.ApiKey))
                {
                    return ServiceResponse<string>.CreateError("OpenAI not configured", "OpenAI API key is not configured. Please configure it in appsettings.json.");
                }

                var requestBody = CreateChatRequest("You are a helpful assistant that formats lease policy text professionally.", prompt, maxTokens);
                var response = await _httpClient.PostAsJsonAsync(_completionEndpoint, requestBody);
                
                if (!response.IsSuccessStatusCode)
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    _logger.LogError("OpenAI API error - Status: {StatusCode}, Response: {ErrorContent}", response.StatusCode, errorContent);
                    
                    if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
                    {
                        return ServiceResponse<string>.CreateError(
                            "Unauthorized",
                            "OpenAI API key is invalid or expired. Please check the configured OpenAI API key.",
                            statusCode: StatusCodes.Status401Unauthorized,
                            suppressDetailedErrors: true);
                    }
                    
                    return ServiceResponse<string>.CreateError(
                        "OpenAI API error",
                        $"Status: {response.StatusCode}, Error: {errorContent}",
                        statusCode: (int)response.StatusCode,
                        suppressDetailedErrors: true);
                }

                var result = await response.Content.ReadFromJsonAsync<OpenAIResponse>();
                var content = result?.choices?.FirstOrDefault()?.message?.content;

                if (string.IsNullOrEmpty(content))
                {
                    return ServiceResponse<string>.CreateError("No response", "OpenAI did not return any content.");
                }

                return ServiceResponse<string>.CreateSuccess(content);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error calling OpenAI API");
                return ServiceResponse<string>.CreateError("Error calling OpenAI", ex.Message);
            }
        }

        public async Task<ServiceResponse<T>> GenerateJsonAsync<T>(string prompt, int maxTokens = 2000) where T : class
        {
            try
            {
                if (string.IsNullOrEmpty(_settings.ApiKey))
                {
                    return ServiceResponse<T>.CreateError("OpenAI not configured", "OpenAI API key is not configured.");
                }

                const string systemPrompt = "You are a helpful assistant that returns only valid JSON responses. Do not include markdown code blocks or any additional text.";
                var requestBody = CreateChatRequest(systemPrompt, prompt + "\n\nPlease respond with valid JSON only.", maxTokens);
                requestBody["response_format"] = new { type = "json_object" };

                var response = await _httpClient.PostAsJsonAsync(_completionEndpoint, requestBody);
                
                if (!response.IsSuccessStatusCode)
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    _logger.LogError("OpenAI API error - Status: {StatusCode}, Response: {ErrorContent}", response.StatusCode, errorContent);
                    
                    if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
                    {
                        return ServiceResponse<T>.CreateError(
                            "Unauthorized",
                            "OpenAI API key is invalid or expired. Please check the configured OpenAI API key.",
                            statusCode: StatusCodes.Status401Unauthorized,
                            suppressDetailedErrors: true);
                    }
                    
                    return ServiceResponse<T>.CreateError(
                        "OpenAI API error",
                        $"Status: {response.StatusCode}, Error: {errorContent}",
                        statusCode: (int)response.StatusCode,
                        suppressDetailedErrors: true);
                }

                var result = await response.Content.ReadFromJsonAsync<OpenAIResponse>();
                var content = result?.choices?.FirstOrDefault()?.message?.content;

                if (string.IsNullOrEmpty(content))
                {
                    return ServiceResponse<T>.CreateError("No response", "OpenAI did not return any content.");
                }

                // Clean up the response (remove markdown code blocks if present)
                content = content.Trim();
                if (content.StartsWith("```json", StringComparison.OrdinalIgnoreCase))
                {
                    content = content.Substring(7);
                }
                if (content.StartsWith("```"))
                {
                    content = content.Substring(3);
                }
                if (content.EndsWith("```"))
                {
                    content = content.Substring(0, content.Length - 3);
                }
                content = content.Trim();

                T? parsedResult = null;
                
                // Try direct deserialization first
                try
                {
                    parsedResult = JsonSerializer.Deserialize<T>(content, new JsonSerializerOptions
                    {
                        PropertyNameCaseInsensitive = true
                    });
                }
                catch (JsonException)
                {
                    // If direct deserialization fails, check if it's a wrapped object
                    // Handle cases like {"lease_policies": [...]} or {"policies": [...]}
                    try
                    {
                        using var doc = JsonDocument.Parse(content);
                        var root = doc.RootElement;

                        // If it's an object and T is List<string>, try to extract array from common property names
                        if (root.ValueKind == JsonValueKind.Object && typeof(T) == typeof(List<string>))
                        {
                            var arrayPropertyNames = new[] { "lease_policies", "policies", "items", "data", "result", "response", "suggestions" };
                            
                            foreach (var propName in arrayPropertyNames)
                            {
                                if (root.TryGetProperty(propName, out var arrayElement) && arrayElement.ValueKind == JsonValueKind.Array)
                                {
                                    var list = new List<string>();
                                    foreach (var item in arrayElement.EnumerateArray())
                                    {
                                        if (item.ValueKind == JsonValueKind.String)
                                        {
                                            list.Add(item.GetString() ?? string.Empty);
                                        }
                                    }
                                    parsedResult = (T)(object)list;
                                    break;
                                }
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Failed to parse JSON response. Content: {Content}", content);
                        return ServiceResponse<T>.CreateError("Parse error", 
                            $"Failed to parse OpenAI response as JSON. Response: {content.Substring(0, Math.Min(500, content.Length))}");
                    }
                }

                if (parsedResult == null)
                {
                    _logger.LogError("Failed to parse JSON response. Content: {Content}", content);
                    return ServiceResponse<T>.CreateError("Parse error", 
                        $"Failed to parse OpenAI response as JSON. Response: {content.Substring(0, Math.Min(500, content.Length))}");
                }

                return ServiceResponse<T>.CreateSuccess(parsedResult);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error calling OpenAI API for JSON");
                return ServiceResponse<T>.CreateError("Error calling OpenAI", ex.Message);
            }
        }

        private class OpenAIResponse
        {
            public List<Choice>? choices { get; set; }
        }

        private class Choice
        {
            public Message? message { get; set; }
        }

        private class Message
        {
            public string? content { get; set; }
        }

        private Dictionary<string, object> CreateChatRequest(string systemPrompt, string prompt, int maxTokens)
        {
            var request = new Dictionary<string, object>
            {
                ["model"] = _settings.Model,
                ["messages"] = new[]
                {
                    new { role = "system", content = systemPrompt },
                    new { role = "user", content = prompt }
                }
            };

            if (_settings.Model.Equals(OpenAISettings.LunaModel, StringComparison.OrdinalIgnoreCase) ||
                _settings.Model.StartsWith(OpenAISettings.LunaModel + "-", StringComparison.OrdinalIgnoreCase))
            {
                request["max_completion_tokens"] = maxTokens;
                // Keep the planner's small completion budget available for its JSON output.
                request["reasoning_effort"] = "none";
            }
            else
            {
                request["max_tokens"] = maxTokens;
                request["temperature"] = 0.7;
            }

            return request;
        }

        private static (Uri Endpoint, bool UsesAzure) GetCompletionEndpoint(OpenAISettings settings)
        {
            var configuredEndpoint = string.IsNullOrWhiteSpace(settings.Endpoint) ? null : new Uri(settings.Endpoint.Trim(), UriKind.Absolute);
            if (configuredEndpoint is null || configuredEndpoint.Host.Equals("api.openai.com", StringComparison.OrdinalIgnoreCase))
                return (new Uri("https://api.openai.com/v1/chat/completions"), false);

            var endpoint = configuredEndpoint.AbsoluteUri.TrimEnd('/');
            if (endpoint.EndsWith("/openai/v1/chat/completions", StringComparison.OrdinalIgnoreCase))
                return (configuredEndpoint, true);
            if (endpoint.EndsWith("/openai/v1", StringComparison.OrdinalIgnoreCase))
                return (new Uri($"{endpoint}/chat/completions"), true);

            var version = settings.ApiVersion?.Trim();
            if (string.IsNullOrEmpty(version) || version.Equals("v1", StringComparison.OrdinalIgnoreCase))
                return (new Uri($"{endpoint}/openai/v1/chat/completions"), true);

            var deployment = Uri.EscapeDataString(settings.Model);
            return (new Uri($"{endpoint}/openai/deployments/{deployment}/chat/completions?api-version={Uri.EscapeDataString(version)}"), true);
        }
    }
}
