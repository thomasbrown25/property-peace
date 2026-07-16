using System.Text.Json;
using brownstone_hub_api.Config;
using brownstone_hub_api.Dtos.Property;
using Microsoft.Extensions.Options;

namespace brownstone_hub_api.Services.PropertyRecordService
{
    public class PropertyRecordLookupRequest
    {
        public string StreetAddress { get; set; } = string.Empty;
        public string City { get; set; } = string.Empty;
        public string State { get; set; } = string.Empty;
        public string ZipCode { get; set; } = string.Empty;
        public string? PropertyType { get; set; }
    }

    public interface IPropertyRecordService
    {
        Task<PropertyRecordPrefillDto?> GetPropertyDetailsAsync(PropertyRecordLookupRequest request, CancellationToken cancellationToken = default);
    }

    public class PropertyRecordService(
        IHttpClientFactory httpClientFactory,
        IOptions<RentcastSettings> settings,
        ILogger<PropertyRecordService> logger) : IPropertyRecordService
    {
        private readonly IHttpClientFactory _httpClientFactory = httpClientFactory;
        private readonly RentcastSettings _settings = settings.Value;
        private readonly ILogger<PropertyRecordService> _logger = logger;

        public async Task<PropertyRecordPrefillDto?> GetPropertyDetailsAsync(PropertyRecordLookupRequest request, CancellationToken cancellationToken = default)
        {
            if (!_settings.IsEnabled || string.IsNullOrWhiteSpace(_settings.ApiKey))
            {
                _logger.LogWarning("Rentcast is disabled or ApiKey is not configured.");
                return null;
            }

            var address = BuildAddress(request.StreetAddress, request.City, request.State, request.ZipCode);
            if (string.IsNullOrWhiteSpace(address)) return null;

            try
            {
                var client = _httpClientFactory.CreateClient("Rentcast");
                var query = $"address={Uri.EscapeDataString(address)}";
                var response = await client.GetAsync($"properties?{query}", cancellationToken);

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("Rentcast property records returned {StatusCode} for {Address}", response.StatusCode, address);
                    return null;
                }

                var json = await response.Content.ReadAsStringAsync(cancellationToken);
                using var document = JsonDocument.Parse(json);
                var record = GetFirstRecord(document.RootElement);
                if (record == null) return null;

                return MapRecord(record.Value);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error calling Rentcast property records for {Address}", address);
                return null;
            }
        }

        private static string BuildAddress(string street, string city, string state, string zip)
        {
            var parts = new[] { street, city, state, zip }
                .Where(p => !string.IsNullOrWhiteSpace(p))
                .Select(p => p.Trim());

            return string.Join(", ", parts);
        }

        private static JsonElement? GetFirstRecord(JsonElement root)
        {
            if (root.ValueKind == JsonValueKind.Array)
                return root.GetArrayLength() > 0 ? root[0] : null;

            if (root.ValueKind == JsonValueKind.Object)
            {
                if (root.TryGetProperty("data", out var data) && data.ValueKind == JsonValueKind.Array && data.GetArrayLength() > 0)
                    return data[0];

                if (root.TryGetProperty("properties", out var properties) && properties.ValueKind == JsonValueKind.Array && properties.GetArrayLength() > 0)
                    return properties[0];

                return root;
            }

            return null;
        }

        private static PropertyRecordPrefillDto MapRecord(JsonElement record)
        {
            return new PropertyRecordPrefillDto
            {
                Bedrooms = GetInt(record, "bedrooms") ?? GetInt(record, "beds"),
                Bathrooms = GetDecimal(record, "bathrooms") ?? GetDecimal(record, "baths"),
                SquareFootage = GetInt(record, "squareFootage") ?? GetInt(record, "squareFeet"),
                YearBuilt = GetInt(record, "yearBuilt"),
                PropertyType = GetString(record, "propertyType"),
                FormattedAddress = GetString(record, "formattedAddress") ?? GetString(record, "addressLine1")
            };
        }

        private static string? GetString(JsonElement element, string propertyName)
        {
            if (!element.TryGetProperty(propertyName, out var value)) return null;
            return value.ValueKind == JsonValueKind.String ? value.GetString() : value.ToString();
        }

        private static int? GetInt(JsonElement element, string propertyName)
        {
            if (!element.TryGetProperty(propertyName, out var value)) return null;
            if (value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out var number)) return number;
            if (value.ValueKind == JsonValueKind.String && int.TryParse(value.GetString(), out var parsed)) return parsed;
            return null;
        }

        private static decimal? GetDecimal(JsonElement element, string propertyName)
        {
            if (!element.TryGetProperty(propertyName, out var value)) return null;
            if (value.ValueKind == JsonValueKind.Number && value.TryGetDecimal(out var number)) return number;
            if (value.ValueKind == JsonValueKind.String && decimal.TryParse(value.GetString(), out var parsed)) return parsed;
            return null;
        }
    }
}
