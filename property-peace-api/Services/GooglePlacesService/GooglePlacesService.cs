using System.Net.Http.Json;
using System.Text.Json;
using brownstone_hub_api.Config;
using brownstone_hub_api.Dtos.GooglePlaces;
using Microsoft.Extensions.Options;

namespace brownstone_hub_api.Services.GooglePlacesService;

public sealed class GooglePlacesService(
    HttpClient httpClient,
    IOptions<GooglePlacesSettings> settings,
    ILogger<GooglePlacesService> logger) : IGooglePlacesService
{
    private const string AutocompleteFieldMask =
        "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text";
    private const string DetailsFieldMask = "formattedAddress,addressComponents,location";
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    private readonly HttpClient _httpClient = httpClient;
    private readonly GooglePlacesSettings _settings = settings.Value;
    private readonly ILogger<GooglePlacesService> _logger = logger;

    public async Task<IReadOnlyList<GooglePlaceSuggestionDto>> AutocompleteAsync(
        string input, Guid sessionToken, CancellationToken cancellationToken)
    {
        EnsureConfigured();

        using var request = new HttpRequestMessage(HttpMethod.Post, BuildUri("v1/places:autocomplete"));
        AddHeaders(request, AutocompleteFieldMask);
        request.Content = JsonContent.Create(new
        {
            input = input.Trim(),
            regionCode = "US",
            includedRegionCodes = new[] { "us" },
            languageCode = "en",
            sessionToken = sessionToken.ToString(),
            includedPrimaryTypes = new[] { "street_address", "premise", "subpremise" }
        }, options: JsonOptions);

        var response = await SendAsync(request, cancellationToken);
        var payload = await DeserializeAsync<GoogleAutocompleteResponse>(response, cancellationToken);

        return (payload.Suggestions ?? [])
            .Select(suggestion => suggestion.PlacePrediction)
            .Where(prediction => !string.IsNullOrWhiteSpace(prediction?.PlaceId)
                && !string.IsNullOrWhiteSpace(prediction.Text?.Text))
            .Select(prediction => new GooglePlaceSuggestionDto(prediction!.PlaceId!, prediction.Text!.Text!))
            .Take(5)
            .ToList();
    }

    public async Task<GooglePlaceDetailsDto> GetDetailsAsync(
        string placeId, Guid sessionToken, CancellationToken cancellationToken)
    {
        EnsureConfigured();

        var uri = BuildUri($"v1/places/{Uri.EscapeDataString(placeId)}?languageCode=en&regionCode=US&sessionToken={sessionToken}");
        using var request = new HttpRequestMessage(HttpMethod.Get, uri);
        AddHeaders(request, DetailsFieldMask);

        var response = await SendAsync(request, cancellationToken);
        var payload = await DeserializeAsync<GoogleDetailsResponse>(response, cancellationToken);
        return NormalizeDetails(placeId, payload);
    }

    private void EnsureConfigured()
    {
        if (string.IsNullOrWhiteSpace(_settings.ApiKey))
            throw new GooglePlacesException(GooglePlacesFailureKind.NotConfigured,
                "Google Places is not configured.");
    }

    private async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(_settings.TimeoutSeconds));
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, timeout.Token);

        try
        {
            var response = await _httpClient.SendAsync(request, linked.Token);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Google Places request failed with failure kind {FailureKind} and status {StatusCode}.",
                    GooglePlacesFailureKind.Upstream, (int)response.StatusCode);
                response.Dispose();
                throw new GooglePlacesException(GooglePlacesFailureKind.Upstream,
                    "Google Places is temporarily unavailable.");
            }

            return response;
        }
        catch (OperationCanceledException exception) when (!cancellationToken.IsCancellationRequested)
        {
            _logger.LogWarning("Google Places request failed with failure kind {FailureKind}.",
                GooglePlacesFailureKind.Timeout);
            throw new GooglePlacesException(GooglePlacesFailureKind.Timeout,
                "Google Places request timed out.", exception);
        }
        catch (HttpRequestException exception)
        {
            _logger.LogWarning("Google Places request failed with failure kind {FailureKind}.",
                GooglePlacesFailureKind.Upstream);
            throw new GooglePlacesException(GooglePlacesFailureKind.Upstream,
                "Google Places is temporarily unavailable.", exception);
        }
    }

    private async Task<T> DeserializeAsync<T>(HttpResponseMessage response, CancellationToken cancellationToken)
    {
        using (response)
        {
            try
            {
                var payload = await response.Content.ReadFromJsonAsync<T>(JsonOptions, cancellationToken);
                return payload ?? throw InvalidResponse();
            }
            catch (JsonException exception)
            {
                throw InvalidResponse(exception);
            }
        }
    }

    private GooglePlacesException InvalidResponse(Exception? inner = null)
    {
        _logger.LogWarning("Google Places request failed with failure kind {FailureKind}.",
            GooglePlacesFailureKind.InvalidResponse);
        return new GooglePlacesException(GooglePlacesFailureKind.InvalidResponse,
            "Google Places returned an invalid response.", inner);
    }

    private Uri BuildUri(string pathAndQuery) => new(new Uri(_settings.BaseUrl, UriKind.Absolute), pathAndQuery);

    private void AddHeaders(HttpRequestMessage request, string fieldMask)
    {
        request.Headers.Add("X-Goog-Api-Key", _settings.ApiKey);
        request.Headers.Add("X-Goog-FieldMask", fieldMask);
    }

    private static GooglePlaceDetailsDto NormalizeDetails(string placeId, GoogleDetailsResponse response)
    {
        var components = response.AddressComponents ?? [];
        var streetNumber = LongText(components, "street_number");
        var route = LongText(components, "route");
        var street = string.Join(' ', new[] { streetNumber, route }
            .Where(value => !string.IsNullOrWhiteSpace(value)));
        var city = FirstLongText(components, "locality", "postal_town", "sublocality", "sublocality_level_1", "administrative_area_level_2");
        var zip = LongText(components, "postal_code");
        var suffix = LongText(components, "postal_code_suffix");
        if (zip.Length > 0 && suffix.Length > 0) zip += "-" + suffix;

        return new GooglePlaceDetailsDto(placeId, response.FormattedAddress ?? string.Empty, street, city,
            ShortText(components, "administrative_area_level_1"), zip,
            response.Location?.Latitude, response.Location?.Longitude);
    }

    private static string LongText(IEnumerable<GoogleAddressComponent> components, string type) =>
        components.FirstOrDefault(component => component.Types?.Contains(type) == true)?.LongText ?? string.Empty;

    private static string ShortText(IEnumerable<GoogleAddressComponent> components, string type) =>
        components.FirstOrDefault(component => component.Types?.Contains(type) == true)?.ShortText ?? string.Empty;

    private static string FirstLongText(IEnumerable<GoogleAddressComponent> components, params string[] types) =>
        types.Select(type => LongText(components, type)).FirstOrDefault(value => value.Length > 0) ?? string.Empty;

    private sealed record GoogleAutocompleteResponse(List<GoogleSuggestion>? Suggestions);
    private sealed record GoogleSuggestion(GooglePlacePrediction? PlacePrediction);
    private sealed record GooglePlacePrediction(string? PlaceId, GoogleText? Text);
    private sealed record GoogleText(string? Text);
    private sealed record GoogleDetailsResponse(
        string? FormattedAddress,
        List<GoogleAddressComponent>? AddressComponents,
        GoogleLocation? Location);
    private sealed record GoogleAddressComponent(string? LongText, string? ShortText, List<string>? Types);
    private sealed record GoogleLocation(double? Latitude, double? Longitude);
}
