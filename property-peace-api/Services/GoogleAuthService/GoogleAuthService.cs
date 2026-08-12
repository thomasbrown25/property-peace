using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace brownstone_hub_api.Services.GoogleAuthService
{
    public class GoogleAuthService : IGoogleAuthService
    {
        private readonly HttpClient _httpClient;
        private readonly IConfiguration _configuration;
        private readonly ILogger<GoogleAuthService> _logger;

        public GoogleAuthService(
            HttpClient httpClient,
            IConfiguration configuration,
            ILogger<GoogleAuthService> logger)
        {
            _httpClient = httpClient;
            _configuration = configuration;
            _logger = logger;
        }

        public async Task<GoogleUserInfo?> VerifyGoogleTokenAsync(string idToken)
        {
            try
            {
                // Verify the token with Google
                var requestUri = $"https://oauth2.googleapis.com/tokeninfo?id_token={idToken}";
                var response = await _httpClient.GetAsync(requestUri);

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("Google token verification failed: {StatusCode}", response.StatusCode);
                    return null;
                }

                var content = await response.Content.ReadAsStringAsync();
                var tokenInfo = JsonSerializer.Deserialize<GoogleTokenInfo>(content, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });

                if (tokenInfo == null || string.IsNullOrEmpty(tokenInfo.Sub))
                {
                    _logger.LogWarning("Invalid Google token response");
                    return null;
                }

                // Verify the audience (client ID) matches
                var clientId = _configuration["GoogleOAuth:ClientId"];
                if (!string.IsNullOrEmpty(clientId) && tokenInfo.Audience != clientId)
                {
                    _logger.LogWarning("Google token audience mismatch. Expected: {Expected}, Got: {Actual}", clientId, tokenInfo.Audience);
                    return null;
                }

                return new GoogleUserInfo
                {
                    Id = tokenInfo.Sub,
                    Email = tokenInfo.Email ?? string.Empty,
                    FirstName = tokenInfo.GivenName ?? string.Empty,
                    LastName = tokenInfo.FamilyName ?? string.Empty,
                    Picture = tokenInfo.Picture,
                    EmailVerified = tokenInfo.EmailVerified == "true"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error verifying Google token");
                return null;
            }
        }

        public async Task<GoogleUserInfo?> VerifyGoogleAccessTokenAsync(string accessToken)
        {
            try
            {
                // Get user info from Google using access token
                var requestUri = "https://www.googleapis.com/oauth2/v2/userinfo";
                var request = new HttpRequestMessage(HttpMethod.Get, requestUri);
                request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);
                
                var response = await _httpClient.SendAsync(request);

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("Google access token verification failed: {StatusCode}", response.StatusCode);
                    return null;
                }

                var content = await response.Content.ReadAsStringAsync();
                var userInfo = JsonSerializer.Deserialize<GoogleUserInfoResponse>(content, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });

                if (userInfo == null || string.IsNullOrEmpty(userInfo.Id))
                {
                    _logger.LogWarning("Invalid Google user info response");
                    return null;
                }

                return new GoogleUserInfo
                {
                    Id = userInfo.Id,
                    Email = userInfo.Email ?? string.Empty,
                    FirstName = userInfo.GivenName ?? string.Empty,
                    LastName = userInfo.FamilyName ?? string.Empty,
                    Picture = userInfo.Picture,
                    EmailVerified = userInfo.VerifiedEmail == true
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error verifying Google access token");
                return null;
            }
        }

        private class GoogleUserInfoResponse
        {
            public string? Id { get; set; }
            public string? Email { get; set; }
            [JsonPropertyName("given_name")]
            public string? GivenName { get; set; }
            [JsonPropertyName("family_name")]
            public string? FamilyName { get; set; }
            public string? Picture { get; set; }
            [JsonPropertyName("verified_email")]
            public bool? VerifiedEmail { get; set; }
        }

        private class GoogleTokenInfo
        {
            public string? Sub { get; set; }
            public string? Email { get; set; }
            [JsonPropertyName("given_name")]
            public string? GivenName { get; set; }
            [JsonPropertyName("family_name")]
            public string? FamilyName { get; set; }
            public string? Picture { get; set; }
            [JsonPropertyName("email_verified")]
            public string? EmailVerified { get; set; }
            [JsonPropertyName("aud")]
            public string? Audience { get; set; }
        }
    }
}

