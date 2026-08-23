using brownstone_hub_api.Dtos.GooglePlaces;

namespace brownstone_hub_api.Services.GooglePlacesService;

public interface IGooglePlacesService
{
    Task<IReadOnlyList<GooglePlaceSuggestionDto>> AutocompleteAsync(
        string input, Guid sessionToken, CancellationToken cancellationToken);

    Task<GooglePlaceDetailsDto> GetDetailsAsync(
        string placeId, Guid sessionToken, CancellationToken cancellationToken);
}

public enum GooglePlacesFailureKind { NotConfigured, Upstream, Timeout, InvalidResponse }

public sealed class GooglePlacesException : Exception
{
    public GooglePlacesException(
        GooglePlacesFailureKind kind, string message, Exception? inner = null)
        : base(message, inner) => Kind = kind;

    public GooglePlacesFailureKind Kind { get; }
}
