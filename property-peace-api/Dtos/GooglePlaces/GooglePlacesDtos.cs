namespace brownstone_hub_api.Dtos.GooglePlaces;

public sealed record GooglePlacesAutocompleteRequest(string Input, Guid SessionToken);
public sealed record GooglePlaceSuggestionDto(string PlaceId, string Text);
public sealed record GooglePlacesAutocompleteResponse(
    IReadOnlyList<GooglePlaceSuggestionDto> Suggestions);
public sealed record GooglePlaceDetailsDto(
    string PlaceId,
    string FormattedAddress,
    string StreetAddress,
    string City,
    string State,
    string ZipCode,
    double? Latitude,
    double? Longitude);
