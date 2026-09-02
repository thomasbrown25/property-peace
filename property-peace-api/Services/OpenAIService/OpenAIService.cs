using brownstone_hub_api.Config;
using Microsoft.Extensions.Options;
using System.Text.Json;
using System.Net.Http.Json;
using System.Text;

namespace brownstone_hub_api.Services.OpenAIService
{
    public class OpenAIService : IOpenAIService
    {
        private readonly OpenAISettings _settings;
        private readonly ILogger<OpenAIService> _logger;
        private readonly HttpClient _httpClient;

        public OpenAIService(IOptions<OpenAISettings> settings, ILogger<OpenAIService> logger, IHttpClientFactory httpClientFactory)
        {
            _settings = settings.Value;
            _logger = logger;
            _httpClient = httpClientFactory.CreateClient();
            
            if (!string.IsNullOrEmpty(_settings.ApiKey))
            {
                // Azure OpenAI uses "api-key" header, OpenAI direct API uses "Authorization: Bearer"
                if (!string.IsNullOrEmpty(_settings.Endpoint))
                {
                    // Azure OpenAI Service
                    _httpClient.DefaultRequestHeaders.Add("api-key", _settings.ApiKey);
                    _httpClient.BaseAddress = new Uri(_settings.Endpoint);
                }
                else
                {
                    // OpenAI direct API
                    _httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {_settings.ApiKey}");
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

                // Determine endpoint and model name
                var endpoint = GetEndpoint();
                var modelName = _settings.Model;
                
                var requestBody = new
                {
                    model = modelName,
                    messages = new[]
                    {
                        new { role = "system", content = "You are a helpful assistant that formats lease policy text professionally." },
                        new { role = "user", content = prompt }
                    },
                    max_tokens = maxTokens,
                    temperature = 0.7
                };

                var response = await _httpClient.PostAsJsonAsync(endpoint, requestBody);
                
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

                // Add JSON format instruction to prompt
                var systemPrompt = "You are a helpful assistant that returns only valid JSON responses. Do not include markdown code blocks or any additional text.";
                var jsonPrompt = $"{systemPrompt}\n\n{prompt}\n\nPlease respond with valid JSON only.";

                // Determine endpoint and model name
                var endpoint = GetEndpoint();
                var modelName = _settings.Model;
                
                var requestBody = new
                {
                    model = modelName,
                    messages = new[]
                    {
                        new { role = "system", content = systemPrompt },
                        new { role = "user", content = prompt + "\n\nPlease respond with valid JSON only." }
                    },
                    max_tokens = maxTokens,
                    temperature = 0.7,
                    response_format = new { type = "json_object" }
                };

                var response = await _httpClient.PostAsJsonAsync(endpoint, requestBody);
                
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

        private string GetEndpoint()
        {
            // Azure OpenAI Service
            if (!string.IsNullOrEmpty(_settings.Endpoint))
            {
                var baseUrl = _settings.Endpoint.TrimEnd('/');
                var apiVersion = _settings.ApiVersion ?? "2024-02-15-preview";
                return $"{baseUrl}/openai/deployments/{_settings.Model}/chat/completions?api-version={apiVersion}";
            }
            
            // OpenAI direct API
            return "https://api.openai.com/v1/chat/completions";
        }
    }
}
