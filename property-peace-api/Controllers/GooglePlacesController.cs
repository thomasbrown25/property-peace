using brownstone_hub_api.Dtos.GooglePlaces;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.GooglePlacesService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers;

[ApiController]
[Route("api/google-places")]
[Authorize(Roles = "Landlord,Admin")]
public sealed class GooglePlacesController(
    IGooglePlacesService service,
    ILogger<GooglePlacesController> logger) : ControllerBase
{
    private readonly IGooglePlacesService _service = service;
    private readonly ILogger<GooglePlacesController> _logger = logger;

    [HttpGet("streetview")]
    public async Task<IActionResult> StreetView([FromQuery] string? address, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(address) || address.Length > 300)
            return BadRequest(new { message = "Enter a valid property address." });
        try
        {
            var image = await _service.GetStreetViewImageAsync(address.Trim(), cancellationToken);
            return image is null ? NotFound() : Ok(ServiceResponse<string>.CreateSuccess(Convert.ToBase64String(image)));
        }
        catch (GooglePlacesException exception) { return MapFailure<string>(exception); }
        catch (Exception exception) when (exception is HttpRequestException or OperationCanceledException or System.Text.Json.JsonException)
        {
            if (cancellationToken.IsCancellationRequested) throw;
            _logger.LogWarning("Google Street View lookup failed");
            return StatusCode(502, new { message = "Property image is unavailable." });
        }
    }

    public sealed record AutocompleteWireRequest(string? Input, string? SessionToken);

    [HttpPost("autocomplete")]
    public async Task<IActionResult> Autocomplete(
        [FromBody] AutocompleteWireRequest request,
        CancellationToken cancellationToken)
    {
        var input = request.Input?.Trim() ?? string.Empty;
        var validToken = Guid.TryParse(request.SessionToken, out var sessionToken)
            && sessionToken != Guid.Empty;
        if (!validToken || input.Length > 200)
        {
            return BadRequest(new ServiceResponse<GooglePlacesAutocompleteResponse>
            {
                Success = false,
                Message = "Enter a valid address search.",
                StatusCode = 400
            });
        }

        if (input.Length < 3)
            return Ok(ServiceResponse<GooglePlacesAutocompleteResponse>
                .CreateSuccess(new([])));

        try
        {
            var suggestions = await _service.AutocompleteAsync(input, sessionToken, cancellationToken);
            return Ok(ServiceResponse<GooglePlacesAutocompleteResponse>.CreateSuccess(new(suggestions)));
        }
        catch (GooglePlacesException exception)
        {
            return MapFailure<GooglePlacesAutocompleteResponse>(exception);
        }
    }

    [HttpGet("details/{placeId}")]
    public async Task<IActionResult> Details(
        string placeId,
        [FromQuery] string? sessionToken,
        CancellationToken cancellationToken)
    {
        var validToken = Guid.TryParse(sessionToken, out var parsedSessionToken)
            && parsedSessionToken != Guid.Empty;
        var invalidPlaceId = string.IsNullOrWhiteSpace(placeId)
            || placeId.Length > 255
            || placeId.Any(char.IsControl)
            || placeId.Contains('/')
            || placeId.Contains('\\');
        if (invalidPlaceId || !validToken)
        {
            return BadRequest(new ServiceResponse<GooglePlaceDetailsDto>
            {
                Success = false,
                Message = "Select a valid address suggestion.",
                StatusCode = 400
            });
        }

        try
        {
            var details = await _service.GetDetailsAsync(placeId, parsedSessionToken, cancellationToken);
            return Ok(ServiceResponse<GooglePlaceDetailsDto>.CreateSuccess(details));
        }
        catch (GooglePlacesException exception)
        {
            return MapFailure<GooglePlaceDetailsDto>(exception);
        }
    }

    private ObjectResult MapFailure<T>(GooglePlacesException exception)
    {
        var status = exception.Kind switch
        {
            GooglePlacesFailureKind.NotConfigured => 503,
            GooglePlacesFailureKind.Timeout => 504,
            _ => 502
        };
        _logger.LogWarning(
            "Google Places request failed with kind {Kind} and mapped status {Status}",
            exception.Kind,
            status);
        return StatusCode(status, new ServiceResponse<T>
        {
            Success = false,
            Message = "Address suggestions are unavailable. Continue entering it manually.",
            StatusCode = status
        });
    }
}