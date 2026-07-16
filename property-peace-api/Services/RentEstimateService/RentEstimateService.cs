using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using brownstone_hub_api.Config;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.RentEstimate;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace brownstone_hub_api.Services.RentEstimateService
{
    public class RentEstimateService(
        DataContext context,
        IHttpClientFactory httpClientFactory,
        IOptions<RentcastSettings> settings,
        ILogger<RentEstimateService> logger) : IRentEstimateService
    {
        private readonly DataContext _context = context;
        private readonly IHttpClientFactory _httpClientFactory = httpClientFactory;
        private readonly RentcastSettings _settings = settings.Value;
        private readonly ILogger<RentEstimateService> _logger = logger;

        public async Task<RentEstimateDto?> GetRentEstimateAsync(long propertyId, long? unitId, bool forceRefresh = false, CancellationToken cancellationToken = default)
        {
            // If no unitId provided, fall back to the first unit for the property
            var unit = unitId.HasValue && unitId.Value > 0
                ? await _context.Units
                    .Include(u => u.Property)
                    .FirstOrDefaultAsync(u => u.Id == unitId.Value && u.PropertyId == propertyId, cancellationToken)
                : await _context.Units
                    .Include(u => u.Property)
                    .FirstOrDefaultAsync(u => u.PropertyId == propertyId, cancellationToken);

            if (unit?.Property == null)
                return null;

            var property = unit.Property;

            if (string.IsNullOrWhiteSpace(property.StreetAddress) || string.IsNullOrWhiteSpace(property.State))
                return null;

            var cacheKey = BuildCacheKey(property.StreetAddress, property.City, property.State, property.ZipCode,
                unit.Bedrooms, unit.Baths, unit.SquareFeet, property.PropertyType.ToString());

            // Check cache
            var cached = await _context.RentEstimateCache
                .FirstOrDefaultAsync(c => c.CacheKey == cacheKey, cancellationToken);

            if (!forceRefresh && cached != null && cached.ExpiresAt > DateTime.UtcNow)
            {
                if (cached.IsError)
                    return null;

                return MapFromCache(cached);
            }

            if (!_settings.IsEnabled || string.IsNullOrWhiteSpace(_settings.ApiKey))
            {
                _logger.LogWarning("Rentcast is disabled or ApiKey is not configured.");
                return null;
            }

            // Call Rentcast API
            try
            {
                var client = _httpClientFactory.CreateClient("Rentcast");
                var address = BuildAddress(property.StreetAddress, property.City, property.State, property.ZipCode);
                var query = BuildQueryString(address, unit.Bedrooms, unit.Baths, unit.SquareFeet, property.PropertyType.ToString());

                var response = await client.GetAsync($"avm/rent/long-term?{query}", cancellationToken);

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("Rentcast API returned {StatusCode} for unit {UnitId}", response.StatusCode, unitId);
                    // Don't cache 429 (rate limit); cache other errors briefly
                    if ((int)response.StatusCode != 429)
                        await UpsertCacheAsync(cached, cacheKey, property, unit, null, true, $"HTTP {(int)response.StatusCode}", cancellationToken);
                    return null;
                }

                var json = await response.Content.ReadAsStringAsync(cancellationToken);
                var apiResult = JsonSerializer.Deserialize<RentcastApiResponseDto>(json);

                if (apiResult == null)
                    return null;

                var comparablesJson = apiResult.Comparables != null
                    ? JsonSerializer.Serialize(apiResult.Comparables)
                    : null;

                var entry = await UpsertCacheAsync(cached, cacheKey, property, unit, apiResult, false, null, cancellationToken, comparablesJson);

                return new RentEstimateDto
                {
                    RentEstimate = apiResult.Rent,
                    RentRangeLow = apiResult.RentRangeLow,
                    RentRangeHigh = apiResult.RentRangeHigh,
                    Comparables = MapComparables(apiResult.Comparables),
                    IsFromCache = false,
                    CachedAt = entry.CreatedAt
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error calling Rentcast API for unit {UnitId}", unitId);
                return null;
            }
        }

        private async Task<Models.RentEstimateCache> UpsertCacheAsync(
            Models.RentEstimateCache? existing,
            string cacheKey,
            Models.Property property,
            Models.Unit unit,
            RentcastApiResponseDto? apiResult,
            bool isError,
            string? errorMessage,
            CancellationToken cancellationToken,
            string? comparablesJson = null)
        {
            var now = DateTime.UtcNow;
            var durationDays = isError ? _settings.ErrorCacheDurationDays : _settings.CacheDurationDays;

            if (existing != null)
            {
                existing.RentEstimate = apiResult?.Rent;
                existing.RentRangeLow = apiResult?.RentRangeLow;
                existing.RentRangeHigh = apiResult?.RentRangeHigh;
                existing.ComparablesJson = comparablesJson;
                existing.CreatedAt = now;
                existing.ExpiresAt = now.AddDays(durationDays);
                existing.IsError = isError;
                existing.ErrorMessage = errorMessage;
                _context.RentEstimateCache.Update(existing);
                await _context.SaveChangesAsync(cancellationToken);
                return existing;
            }
            else
            {
                var entry = new Models.RentEstimateCache
                {
                    CacheKey = cacheKey,
                    Address = property.StreetAddress,
                    City = property.City,
                    State = property.State,
                    ZipCode = property.ZipCode,
                    Bedrooms = unit.Bedrooms,
                    Bathrooms = unit.Baths,
                    SquareFeet = unit.SquareFeet,
                    PropertyType = property.PropertyType.ToString(),
                    RentEstimate = apiResult?.Rent,
                    RentRangeLow = apiResult?.RentRangeLow,
                    RentRangeHigh = apiResult?.RentRangeHigh,
                    ComparablesJson = comparablesJson,
                    CreatedAt = now,
                    ExpiresAt = now.AddDays(durationDays),
                    IsError = isError,
                    ErrorMessage = errorMessage
                };
                _context.RentEstimateCache.Add(entry);
                await _context.SaveChangesAsync(cancellationToken);
                return entry;
            }
        }

        private static RentEstimateDto MapFromCache(Models.RentEstimateCache cached)
        {
            List<RentEstimateComparableDto> comparables = [];
            if (!string.IsNullOrEmpty(cached.ComparablesJson))
            {
                try
                {
                    var raw = JsonSerializer.Deserialize<List<RentcastComparableDto>>(cached.ComparablesJson);
                    comparables = MapComparables(raw);
                }
                catch { /* ignore deserialization errors on cached data */ }
            }

            return new RentEstimateDto
            {
                RentEstimate = cached.RentEstimate,
                RentRangeLow = cached.RentRangeLow,
                RentRangeHigh = cached.RentRangeHigh,
                Comparables = comparables,
                IsFromCache = true,
                CachedAt = cached.CreatedAt
            };
        }

        private static List<RentEstimateComparableDto> MapComparables(List<RentcastComparableDto>? raw)
        {
            if (raw == null) return [];
            return raw.Select(c => new RentEstimateComparableDto
            {
                Address = c.FormattedAddress,
                City = c.City,
                State = c.State,
                Price = c.Price,
                Bedrooms = c.Bedrooms?.ToString(),
                Bathrooms = c.Bathrooms?.ToString("G29"),
                SquareFeet = c.SquareFootage,
                DistanceMiles = c.Distance,
                ListedDate = c.ListedDate
            }).ToList();
        }

        private static string BuildCacheKey(string address, string city, string state, string zip,
            string? bedrooms, string? baths, int squareFeet, string? propertyType)
        {
            var normalized = $"{address.Trim().ToLowerInvariant()}|{city.Trim().ToLowerInvariant()}|{state.Trim().ToLowerInvariant()}|{zip.Trim()}|{bedrooms?.Trim() ?? ""}|{baths?.Trim() ?? ""}|{squareFeet}|{propertyType?.ToLowerInvariant() ?? ""}";
            var hash = SHA256.HashData(Encoding.UTF8.GetBytes(normalized));
            return Convert.ToHexString(hash).ToLowerInvariant();
        }

        private static string BuildAddress(string street, string city, string state, string zip)
        {
            var parts = new List<string> { street.Trim() };
            if (!string.IsNullOrWhiteSpace(city)) parts.Add(city.Trim());
            if (!string.IsNullOrWhiteSpace(state)) parts.Add(state.Trim());
            if (!string.IsNullOrWhiteSpace(zip)) parts.Add(zip.Trim());
            return string.Join(", ", parts);
        }

        private static string BuildQueryString(string address, string? bedrooms, string? baths, int squareFeet, string? propertyType)
        {
            var pairs = new List<string>
            {
                $"address={Uri.EscapeDataString(address)}"
            };

            if (!string.IsNullOrWhiteSpace(bedrooms) && decimal.TryParse(bedrooms, out var beds))
                pairs.Add($"bedrooms={beds}");

            if (!string.IsNullOrWhiteSpace(baths) && decimal.TryParse(baths, out var bathsVal))
                pairs.Add($"bathrooms={bathsVal}");

            if (squareFeet > 0)
                pairs.Add($"squareFootage={squareFeet}");

            if (!string.IsNullOrWhiteSpace(propertyType))
                pairs.Add($"propertyType={Uri.EscapeDataString(propertyType)}");

            return string.Join("&", pairs);
        }
    }
}
