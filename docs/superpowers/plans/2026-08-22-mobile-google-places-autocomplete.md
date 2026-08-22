# Mobile Google Places Address Autocomplete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add secure Google Places street-address autocomplete to the mobile Add Property form and populate street, city, state, and ZIP from the selected result.

**Architecture:** The ASP.NET Core API exposes two authenticated, bounded proxy endpoints backed by a typed Google Places service and a server-only key. The Expo app calls them through its existing authenticated Axios client, keeps concurrency/session behavior in tested framework-independent helpers, and renders suggestions directly beneath the street field while preserving manual entry.

**Tech Stack:** ASP.NET Core 9, `HttpClient`, `System.Text.Json`, xUnit, Moq, FluentAssertions, Expo SDK 54, React Native 0.81, TypeScript 5.9, Axios, `expo-crypto`, Node's built-in test runner.

**Spec:** `docs/superpowers/specs/2026-08-22-mobile-google-places-autocomplete-design.md`

## Global Constraints

- Keep the Google Places key server-side under `GooglePlaces:ApiKey`; never return, log, or commit it.
- Require `Landlord` or `Admin` on both proxy endpoints.
- Use Places API (New), US region, English language, address predictions, explicit field masks, and UUID v4 session tokens.
- Return at most five suggestions and only normalized fields needed by mobile.
- Do not cache or persist suggestions.
- Keep manual entry and property creation functional when Google fails.
- Populate property name only when it is empty.
- Display `Google Maps` attribution in the suggestion container.
- Add no native Google SDK or new mobile test framework.
- Preserve unrelated dirty-worktree changes; stage exact task files only.

## File Map

Backend:

- Create `property-peace-api/Config/GooglePlacesSettings.cs` for server configuration.
- Create `property-peace-api/Dtos/GooglePlaces/GooglePlacesDtos.cs` for narrow contracts.
- Create `property-peace-api/Services/GooglePlacesService/IGooglePlacesService.cs` for the service interface and safe failures.
- Create `property-peace-api/Services/GooglePlacesService/GooglePlacesService.cs` for fixed Google calls and normalization.
- Create `property-peace-api/Controllers/GooglePlacesController.cs` for authenticated routes.
- Modify `property-peace-api/Program.cs` for settings, typed client, and rate limits.
- Create focused service and controller tests under `property-peace-api.Tests`.

Mobile:

- Create `property-peace-mobile/src/features/properties/addressAutocomplete.ts` for tested form/session/concurrency behavior.
- Create `property-peace-mobile/src/api/googlePlacesAPI.ts` for typed proxy calls.
- Create `property-peace-mobile/src/components/properties/AddressAutocompleteInput.tsx` for the UI.
- Modify `property-peace-mobile/src/screens/landlord/AddPropertyScreen.tsx` for form integration.
- Create `property-peace-mobile/scripts/address-autocomplete.test.mjs` and register it in `package.json`.

---

### Task 1: Typed Google Places service and normalized address details

**Files:**

- Create: `property-peace-api/Config/GooglePlacesSettings.cs`
- Create: `property-peace-api/Dtos/GooglePlaces/GooglePlacesDtos.cs`
- Create: `property-peace-api/Services/GooglePlacesService/IGooglePlacesService.cs`
- Create: `property-peace-api/Services/GooglePlacesService/GooglePlacesService.cs`
- Test: `property-peace-api.Tests/Services/GooglePlaces/GooglePlacesServiceTests.cs`

**Interfaces:**

- Consumes: `HttpClient`, `IOptions<GooglePlacesSettings>`, `ILogger<GooglePlacesService>`.
- Produces:

```csharp
Task<IReadOnlyList<GooglePlaceSuggestionDto>> AutocompleteAsync(
    string input, Guid sessionToken, CancellationToken cancellationToken);

Task<GooglePlaceDetailsDto> GetDetailsAsync(
    string placeId, Guid sessionToken, CancellationToken cancellationToken);
```

- Throws `GooglePlacesException` with `NotConfigured`, `Upstream`, `Timeout`, or `InvalidResponse`. Messages contain no key, typed address, place ID, session token, or Google body.

- [ ] **Step 1: Write failing boundary tests**

Create `GooglePlacesServiceTests.cs` with a recording `HttpMessageHandler`. These tests catch wrong Google endpoints, headers, payloads, field masks, prediction filtering, component precedence, or leaked upstream content.

```csharp
[Fact]
public async Task AutocompleteAsync_SendsBoundedUsRequest_AndReturnsFivePlacePredictions()
{
    const string json = """
    {"suggestions":[
      {"placePrediction":{"placeId":"p1","text":{"text":"1 Main St, Raleigh, NC"}}},
      {"queryPrediction":{"text":{"text":"main street restaurants"}}},
      {"placePrediction":{"placeId":"p2","text":{"text":"2 Main St, Raleigh, NC"}}},
      {"placePrediction":{"placeId":"p3","text":{"text":"3 Main St, Raleigh, NC"}}},
      {"placePrediction":{"placeId":"p4","text":{"text":"4 Main St, Raleigh, NC"}}},
      {"placePrediction":{"placeId":"p5","text":{"text":"5 Main St, Raleigh, NC"}}},
      {"placePrediction":{"placeId":"p6","text":{"text":"6 Main St, Raleigh, NC"}}}
    ]}
    """;
    var handler = new RecordingHandler(_ => Json(HttpStatusCode.OK, json));
    var service = CreateService(handler);

    var result = await service.AutocompleteAsync(
        "  1 Main  ",
        Guid.Parse("0c5cccf3-2ac7-41d9-9fe0-975958808b17"),
        CancellationToken.None);

    result.Select(item => item.PlaceId).Should().Equal("p1", "p2", "p3", "p4", "p5");
    handler.Method.Should().Be(HttpMethod.Post);
    handler.Uri.Should().Be("https://places.googleapis.com/v1/places:autocomplete");
    handler.ApiKey.Should().Be("test-key");
    handler.FieldMask.Should().Be(
        "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text");
    handler.Body.Should().Contain("\"input\":\"1 Main\"")
        .And.Contain("\"regionCode\":\"US\"")
        .And.Contain("\"includedRegionCodes\":[\"us\"]")
        .And.Contain("\"languageCode\":\"en\"")
        .And.Contain("\"sessionToken\":\"0c5cccf3-2ac7-41d9-9fe0-975958808b17\"");
}
```

```csharp
[Fact]
public async Task GetDetailsAsync_ParsesStreetCityFallbackStateAndZipSuffix()
{
    const string json = """
    {
      "formattedAddress":"12 Oak Ave, Cary, NC 27513-1234, USA",
      "location":{"latitude":35.7915,"longitude":-78.7811},
      "addressComponents":[
        {"longText":"12","shortText":"12","types":["street_number"]},
        {"longText":"Oak Avenue","shortText":"Oak Ave","types":["route"]},
        {"longText":"Cary","shortText":"Cary","types":["postal_town"]},
        {"longText":"North Carolina","shortText":"NC","types":["administrative_area_level_1"]},
        {"longText":"27513","shortText":"27513","types":["postal_code"]},
        {"longText":"1234","shortText":"1234","types":["postal_code_suffix"]}
      ]
    }
    """;
    var handler = new RecordingHandler(_ => Json(HttpStatusCode.OK, json));
    var service = CreateService(handler);
    var token = Guid.Parse("0c5cccf3-2ac7-41d9-9fe0-975958808b17");

    var result = await service.GetDetailsAsync("place-123", token, CancellationToken.None);

    result.Should().BeEquivalentTo(new {
        PlaceId = "place-123",
        FormattedAddress = "12 Oak Ave, Cary, NC 27513-1234, USA",
        StreetAddress = "12 Oak Avenue",
        City = "Cary",
        State = "NC",
        ZipCode = "27513-1234",
        Latitude = 35.7915,
        Longitude = -78.7811
    });
    handler.Uri.Should().Contain("/v1/places/place-123")
        .And.Contain("sessionToken=0c5cccf3-2ac7-41d9-9fe0-975958808b17");
    handler.FieldMask.Should().Be("formattedAddress,addressComponents,location");
}
```

Add two more tests:

```csharp
[Fact]
public async Task AutocompleteAsync_MissingKeyFailsClosedWithoutSending()
{
    var handler = new RecordingHandler(_ => throw new InvalidOperationException("must not send"));
    var service = CreateService(handler, apiKey: "");
    var act = () => service.AutocompleteAsync("123 Main", Guid.NewGuid(), CancellationToken.None);
    await act.Should().ThrowAsync<GooglePlacesException>()
        .Where(error => error.Kind == GooglePlacesFailureKind.NotConfigured);
    handler.CallCount.Should().Be(0);
}

[Fact]
public async Task GetDetailsAsync_DoesNotExposeUpstreamBody()
{
    var handler = new RecordingHandler(_ =>
        Json(HttpStatusCode.Forbidden, "{\"error\":\"secret upstream detail\"}"));
    var service = CreateService(handler);
    var act = () => service.GetDetailsAsync("place-123", Guid.NewGuid(), CancellationToken.None);
    var thrown = await act.Should().ThrowAsync<GooglePlacesException>();
    thrown.Which.Kind.Should().Be(GooglePlacesFailureKind.Upstream);
    thrown.Which.Message.Should().NotContain("secret upstream detail").And.NotContain("test-key");
}
```

The test helper records method, URI, body, `X-Goog-Api-Key`, and `X-Goog-FieldMask` before returning a literal response. `CreateService` uses `Options.Create(new GooglePlacesSettings { ApiKey = apiKey })` and `NullLogger<GooglePlacesService>.Instance`.

- [ ] **Step 2: Run tests and verify RED**

```powershell
dotnet test property-peace-api.Tests/property-peace-api.Tests.csproj --filter FullyQualifiedName~GooglePlacesServiceTests
```

Expected: compilation fails because settings, DTOs, service, and exception types do not exist.

- [ ] **Step 3: Add settings, DTOs, interface, and safe failure types**

```csharp
namespace brownstone_hub_api.Config;

public sealed class GooglePlacesSettings
{
    public string ApiKey { get; set; } = string.Empty;
    public string BaseUrl { get; set; } = "https://places.googleapis.com/";
    public int TimeoutSeconds { get; set; } = 8;
}
```

```csharp
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
```

```csharp
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
```

- [ ] **Step 4: Implement fixed requests and response normalization**

In `GooglePlacesService.cs`:

- Add `X-Goog-Api-Key` on each request from options.
- Autocomplete: POST `v1/places:autocomplete` with trimmed input, `regionCode = "US"`, `includedRegionCodes = ["us"]`, `languageCode = "en"`, the session UUID string, and `includedPrimaryTypes = ["street_address", "premise", "subpremise"]`.
- Autocomplete field mask: `suggestions.placePrediction.placeId,suggestions.placePrediction.text.text`.
- Filter predictions missing ID/text, ignore query predictions, and `Take(5)`.
- Details: GET `v1/places/` plus `Uri.EscapeDataString(placeId)` with `languageCode=en`, `regionCode=US`, and `sessionToken` query parameters.
- Details field mask: `formattedAddress,addressComponents,location`.
- Deserialize Google transport records privately with case-insensitive `System.Text.Json`.
- City precedence: `locality`, `postal_town`, `sublocality`, `sublocality_level_1`, `administrative_area_level_2`.
- Use state short text, join street number/route long text, and join ZIP/suffix with a hyphen.
- Map internal timeout only when the caller token is not canceled; propagate caller cancellation.
- Log failure kind/status only.

Use this normalization shape:

```csharp
private static GooglePlaceDetailsDto NormalizeDetails(
    string placeId, GoogleDetailsResponse response)
{
    var components = response.AddressComponents ?? [];
    var streetNumber = LongText(components, "street_number");
    var route = LongText(components, "route");
    var street = string.Join(' ', new[] { streetNumber, route }
        .Where(value => !string.IsNullOrWhiteSpace(value)));
    var city = FirstLongText(
        components,
        "locality",
        "postal_town",
        "sublocality",
        "sublocality_level_1",
        "administrative_area_level_2");
    var zip = LongText(components, "postal_code");
    var suffix = LongText(components, "postal_code_suffix");
    if (zip.Length > 0 && suffix.Length > 0) zip = zip + "-" + suffix;

    return new(
        placeId,
        response.FormattedAddress ?? string.Empty,
        street,
        city,
        ShortText(components, "administrative_area_level_1"),
        zip,
        response.Location?.Latitude,
        response.Location?.Longitude);
}
```

- [ ] **Step 5: Verify GREEN and build**

```powershell
dotnet test property-peace-api.Tests/property-peace-api.Tests.csproj --filter FullyQualifiedName~GooglePlacesServiceTests
dotnet build property-peace-api/property-peace-api.csproj --no-restore
```

Expected: focused tests pass; API build exits 0.

- [ ] **Step 6: Commit exact service files**

```powershell
git add -- property-peace-api/Config/GooglePlacesSettings.cs property-peace-api/Dtos/GooglePlaces/GooglePlacesDtos.cs property-peace-api/Services/GooglePlacesService/IGooglePlacesService.cs property-peace-api/Services/GooglePlacesService/GooglePlacesService.cs property-peace-api.Tests/Services/GooglePlaces/GooglePlacesServiceTests.cs
git commit -m "feat: add secure Google Places service"
```

---

### Task 2: Authenticated proxy controller, registration, and rate limits

**Files:**

- Create: `property-peace-api/Controllers/GooglePlacesController.cs`
- Modify: `property-peace-api/Program.cs`
- Test: `property-peace-api.Tests/Controllers/GooglePlacesControllerTests.cs`

**Interfaces:**

- Consumes: Task 1 service and DTOs.
- Produces:
  - POST `/api/google-places/autocomplete`.
  - GET `/api/google-places/details/{placeId}?sessionToken=<uuid>`.
  - Standard `ServiceResponse<T>` envelopes.

- [ ] **Step 1: Write failing contract and status tests**

```csharp
[Fact]
public void Contract_IsLandlordAdminOnly_AndUsesNarrowRoutes()
{
    var type = typeof(GooglePlacesController);
    type.GetCustomAttribute<RouteAttribute>()!.Template.Should().Be("api/google-places");
    type.GetCustomAttribute<AuthorizeAttribute>()!.Roles.Should().Be("Landlord,Admin");
    type.GetMethod(nameof(GooglePlacesController.Autocomplete))!
        .GetCustomAttribute<HttpPostAttribute>()!.Template.Should().Be("autocomplete");
    type.GetMethod(nameof(GooglePlacesController.Details))!
        .GetCustomAttribute<HttpGetAttribute>()!.Template.Should().Be("details/{placeId}");
}

[Fact]
public async Task Autocomplete_ShortInputReturnsEmptyWithoutCallingService()
{
    var service = new Mock<IGooglePlacesService>();
    var controller = Create(service.Object);
    var result = await controller.Autocomplete(
        new GooglePlacesAutocompleteRequest("ab", Guid.NewGuid()),
        CancellationToken.None);
    result.Should().BeOfType<OkObjectResult>();
    service.VerifyNoOtherCalls();
}

[Fact]
public async Task Details_NotConfiguredMapsToSafe503()
{
    var service = new Mock<IGooglePlacesService>();
    service.Setup(value => value.GetDetailsAsync(
            "place-123", It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
        .ThrowsAsync(new GooglePlacesException(
            GooglePlacesFailureKind.NotConfigured,
            "Address suggestions are unavailable."));
    var result = await Create(service.Object).Details(
        "place-123", Guid.NewGuid(), CancellationToken.None);
    result.Should().BeOfType<ObjectResult>().Which.StatusCode.Should().Be(503);
}
```

Add a theory proving `Upstream` and `InvalidResponse` map to 502 and `Timeout` maps to 504. Construct the controller with `NullLogger<GooglePlacesController>.Instance`.

- [ ] **Step 2: Run and verify RED**

```powershell
dotnet test property-peace-api.Tests/property-peace-api.Tests.csproj --filter FullyQualifiedName~GooglePlacesControllerTests
```

Expected: compilation fails because `GooglePlacesController` does not exist.

- [ ] **Step 3: Implement controller validation and safe mapping**

Class contract:

```csharp
[ApiController]
[Route("api/google-places")]
[Authorize(Roles = "Landlord,Admin")]
public sealed class GooglePlacesController : ControllerBase
```

Autocomplete behavior:

```csharp
[HttpPost("autocomplete")]
public async Task<IActionResult> Autocomplete(
    [FromBody] GooglePlacesAutocompleteRequest request,
    CancellationToken cancellationToken)
{
    var input = request.Input?.Trim() ?? string.Empty;
    if (request.SessionToken == Guid.Empty || input.Length > 200)
        return BadRequest(new ServiceResponse<GooglePlacesAutocompleteResponse>
        {
            Success = false,
            Message = "Enter a valid address search.",
            StatusCode = 400
        });
    if (input.Length < 3)
        return Ok(ServiceResponse<GooglePlacesAutocompleteResponse>
            .CreateSuccess(new([])));

    try
    {
        var suggestions = await _service.AutocompleteAsync(
            input, request.SessionToken, cancellationToken);
        return Ok(ServiceResponse<GooglePlacesAutocompleteResponse>
            .CreateSuccess(new(suggestions)));
    }
    catch (GooglePlacesException exception)
    {
        return MapFailure<GooglePlacesAutocompleteResponse>(exception);
    }
}
```

Implement details and the typed failure mapper explicitly:

```csharp
[HttpGet("details/{placeId}")]
public async Task<IActionResult> Details(
    string placeId,
    [FromQuery] Guid sessionToken,
    CancellationToken cancellationToken)
{
    var invalidPlaceId = string.IsNullOrWhiteSpace(placeId)
        || placeId.Length > 255
        || placeId.Any(char.IsControl)
        || placeId.Contains('/')
        || placeId.Contains('\');
    if (invalidPlaceId || sessionToken == Guid.Empty)
        return BadRequest(new ServiceResponse<GooglePlaceDetailsDto>
        {
            Success = false,
            Message = "Select a valid address suggestion.",
            StatusCode = 400
        });

    try
    {
        var details = await _service.GetDetailsAsync(
            placeId, sessionToken, cancellationToken);
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
```

- [ ] **Step 4: Register service and exact rate limits**

Add these registrations to `Program.cs`:

```csharp
services.Configure<GooglePlacesSettings>(
    configuration.GetSection("GooglePlaces"));
services.AddHttpClient<IGooglePlacesService, GooglePlacesService>((sp, client) =>
{
    var settings = sp.GetRequiredService<IOptions<GooglePlacesSettings>>().Value;
    client.BaseAddress = new Uri(settings.BaseUrl.TrimEnd('/') + "/");
    client.Timeout = TimeSpan.FromSeconds(
        Math.Clamp(settings.TimeoutSeconds, 2, 20));
    client.DefaultRequestHeaders.Accept.ParseAdd("application/json");
});
```

Before the general `*` rate rule add:

```csharp
new RateLimitRule
{
    Endpoint = "POST:/api/google-places/autocomplete",
    Period = "1m",
    Limit = 60
},
new RateLimitRule
{
    Endpoint = "GET:/api/google-places/details/*",
    Period = "1m",
    Limit = 20
},
```

Do not add a key to appsettings. Development uses user secrets or `GooglePlaces__ApiKey`; deployment uses its existing secret/configuration store.

- [ ] **Step 5: Verify GREEN and build**

```powershell
dotnet test property-peace-api.Tests/property-peace-api.Tests.csproj --filter "FullyQualifiedName~GooglePlacesServiceTests|FullyQualifiedName~GooglePlacesControllerTests"
dotnet build property-peace-api/property-peace-api.csproj --no-restore
```

Expected: focused tests pass; build exits 0.

- [ ] **Step 6: Commit exact proxy files**

```powershell
git add -- property-peace-api/Controllers/GooglePlacesController.cs property-peace-api/Program.cs property-peace-api.Tests/Controllers/GooglePlacesControllerTests.cs
git commit -m "feat: expose authenticated Places proxy"
```

---

### Task 3: Mobile address behavior and typed proxy client

**Files:**

- Create: `property-peace-mobile/src/features/properties/addressAutocomplete.ts`
- Create: `property-peace-mobile/src/api/googlePlacesAPI.ts`
- Create: `property-peace-mobile/scripts/address-autocomplete.test.mjs`
- Modify: `property-peace-mobile/package.json`

**Interfaces:**

```typescript
shouldFetchAddressSuggestions(input: string): boolean
createLatestRequestGate(): {
  begin(): number;
  isCurrent(requestId: number): boolean;
  invalidate(): void;
}
nextAddressSessionToken(
  previousInput: string,
  nextInput: string,
  currentToken: string | null,
  createToken: () => string,
): string | null
applyGooglePlaceDetails(
  form: PropertyDraft,
  details: GooglePlaceDetails,
): PropertyDraft
```

- [ ] **Step 1: Write failing pure behavior tests**

Create `address-autocomplete.test.mjs`:

```javascript
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyGooglePlaceDetails,
  createLatestRequestGate,
  nextAddressSessionToken,
  shouldFetchAddressSuggestions,
} from '../src/features/properties/addressAutocomplete.ts';

test('requests suggestions only after three trimmed characters', () => {
  assert.equal(shouldFetchAddressSuggestions(' 12 '), false);
  assert.equal(shouldFetchAddressSuggestions(' 123 '), true);
});

test('only the newest request may update visible suggestions', () => {
  const gate = createLatestRequestGate();
  const first = gate.begin();
  const second = gate.begin();
  assert.equal(gate.isCurrent(first), false);
  assert.equal(gate.isCurrent(second), true);
  gate.invalidate();
  assert.equal(gate.isCurrent(second), false);
});

test('selection fills address fields and an empty property name', () => {
  const result = applyGooglePlaceDetails(
    {
      name: '',
      address: '123 Ma',
      city: '',
      state: '',
      zipCode: '',
      propertyType: 'Residential',
    },
    {
      placeId: 'place-1',
      formattedAddress: '123 Main Street, Raleigh, NC 27601, USA',
      streetAddress: '123 Main Street',
      city: 'Raleigh',
      state: 'NC',
      zipCode: '27601',
      latitude: 35.77,
      longitude: -78.63,
    },
  );
  assert.deepEqual(result, {
    name: '123 Main Street',
    address: '123 Main Street',
    city: 'Raleigh',
    state: 'NC',
    zipCode: '27601',
    propertyType: 'Residential',
  });
});

test('selection preserves an entered name and manual missing values', () => {
  const result = applyGooglePlaceDetails(
    {
      name: 'Oak House',
      address: '12 O',
      city: 'Manual City',
      state: 'VA',
      zipCode: '22000',
      propertyType: 'Residential',
    },
    {
      placeId: 'place-2',
      formattedAddress: '',
      streetAddress: '12 Oak Ave',
      city: '',
      state: '',
      zipCode: '',
      latitude: null,
      longitude: null,
    },
  );
  assert.equal(result.name, 'Oak House');
  assert.equal(result.address, '12 Oak Ave');
  assert.equal(result.city, 'Manual City');
  assert.equal(result.state, 'VA');
  assert.equal(result.zipCode, '22000');
});

test('clearing a completed input starts a new session on the next entry', () => {
  const tokens = ['session-1', 'session-2'];
  const createToken = () => tokens.shift();
  const first = nextAddressSessionToken('', '123 Main', null, createToken);
  const same = nextAddressSessionToken('123 Main', '123 Main S', first, createToken);
  const cleared = nextAddressSessionToken('123 Main S', '', same, createToken);
  assert.equal(first, 'session-1');
  assert.equal(same, 'session-1');
  assert.equal(cleared, null);
  assert.equal(
    nextAddressSessionToken('', '4 Oak', cleared, createToken),
    'session-2',
  );
});
```

- [ ] **Step 2: Register the test and verify RED**

Add:

```json
"test:address-autocomplete": "node --experimental-strip-types --test scripts/address-autocomplete.test.mjs"
```

Run `npm run test:address-autocomplete` from `property-peace-mobile`.

Expected: `ERR_MODULE_NOT_FOUND` for `addressAutocomplete.ts`.

- [ ] **Step 3: Implement the minimal tested behavior**

Create the exact exported types and functions:

```typescript
export type PropertyDraft = {
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  propertyType: string;
};

export type GooglePlaceSuggestion = { placeId: string; text: string };

export type GooglePlaceDetails = {
  placeId: string;
  formattedAddress: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  latitude: number | null;
  longitude: number | null;
};

export const shouldFetchAddressSuggestions = (input: string) =>
  input.trim().length >= 3;

export const createLatestRequestGate = () => {
  let current = 0;
  return {
    begin: () => ++current,
    isCurrent: (requestId: number) => requestId === current,
    invalidate: () => { current += 1; },
  };
};

export const nextAddressSessionToken = (
  previousInput: string,
  nextInput: string,
  currentToken: string | null,
  createToken: () => string,
): string | null => {
  if (!nextInput.trim()) return null;
  if (!previousInput.trim() && !currentToken) return createToken();
  return currentToken ?? createToken();
};

export const applyGooglePlaceDetails = (
  form: PropertyDraft,
  details: GooglePlaceDetails,
): PropertyDraft => {
  const street = details.streetAddress.trim();
  return {
    ...form,
    name: form.name.trim() || street || form.name,
    address: street || form.address,
    city: details.city.trim() || form.city,
    state: details.state.trim() || form.state,
    zipCode: details.zipCode.trim() || form.zipCode,
  };
};
```

- [ ] **Step 4: Add the typed API adapter**

Create `googlePlacesAPI.ts`:

```typescript
import apiClient from '../services/apiClient';
import { ApiResponse } from '../types';
import {
  GooglePlaceDetails,
  GooglePlaceSuggestion,
} from '../features/properties/addressAutocomplete';

type AutocompleteData = { suggestions: GooglePlaceSuggestion[] };

const googlePlacesAPI = {
  async autocomplete(
    input: string,
    sessionToken: string,
    signal?: AbortSignal,
  ): Promise<GooglePlaceSuggestion[]> {
    const response = await apiClient.post<ApiResponse<AutocompleteData>>(
      '/api/google-places/autocomplete',
      { input, sessionToken },
      { signal },
    );
    return response.data.suggestions;
  },

  async details(
    placeId: string,
    sessionToken: string,
    signal?: AbortSignal,
  ): Promise<GooglePlaceDetails> {
    const path = '/api/google-places/details/' + encodeURIComponent(placeId);
    const response = await apiClient.get<ApiResponse<GooglePlaceDetails>>(
      path,
      { params: { sessionToken }, signal },
    );
    return response.data;
  },
};

export default googlePlacesAPI;
```

- [ ] **Step 5: Verify GREEN and compile**

```powershell
npm run test:address-autocomplete
npx tsc --noEmit
```

Expected: five tests pass; TypeScript exits 0.

- [ ] **Step 6: Commit exact mobile behavior files**

```powershell
git add -- property-peace-mobile/src/features/properties/addressAutocomplete.ts property-peace-mobile/src/api/googlePlacesAPI.ts property-peace-mobile/scripts/address-autocomplete.test.mjs property-peace-mobile/package.json
git commit -m "feat: add mobile Places address behavior"
```

---

### Task 4: Suggestion UI and Add Property integration

**Files:**

- Create: `property-peace-mobile/src/components/properties/AddressAutocompleteInput.tsx`
- Modify: `property-peace-mobile/src/screens/landlord/AddPropertyScreen.tsx`
- Test: `property-peace-mobile/scripts/address-autocomplete.test.mjs`

**Interfaces:**

```typescript
type AddressAutocompleteInputProps = {
  value: string;
  onChangeText(value: string): void;
  onPlaceSelected(details: GooglePlaceDetails): void;
  disabled?: boolean;
};
```

- [ ] **Step 1: Add a failing reducer test for manual fallback**

Extend the test file before UI code:

```javascript
import {
  addressAutocompleteReducer,
  initialAddressAutocompleteState,
} from '../src/features/properties/addressAutocomplete.ts';

test('failed suggestions preserve typed input and expose manual fallback', () => {
  const typed = addressAutocompleteReducer(initialAddressAutocompleteState, {
    type: 'inputChanged',
    value: '123 Main',
  });
  const failed = addressAutocompleteReducer(typed, {
    type: 'requestFailed',
    message: 'Address suggestions are unavailable. Continue entering it manually.',
  });
  assert.equal(failed.input, '123 Main');
  assert.deepEqual(failed.suggestions, []);
  assert.equal(failed.open, false);
  assert.match(failed.error, /Continue entering it manually/);
});
```

Run `npm run test:address-autocomplete`.

Expected: named-export failure for the reducer and initial state.

- [ ] **Step 2: Implement the minimal UI state reducer**

Add:

```typescript
export type AddressAutocompleteState = {
  input: string;
  suggestions: GooglePlaceSuggestion[];
  loading: boolean;
  open: boolean;
  error: string;
};

export const initialAddressAutocompleteState: AddressAutocompleteState = {
  input: '',
  suggestions: [],
  loading: false,
  open: false,
  error: '',
};

export type AddressAutocompleteAction =
  | { type: 'inputChanged'; value: string }
  | { type: 'requestStarted' }
  | { type: 'requestSucceeded'; suggestions: GooglePlaceSuggestion[] }
  | { type: 'requestFailed'; message: string }
  | { type: 'closed' };

export const addressAutocompleteReducer = (
  state: AddressAutocompleteState,
  action: AddressAutocompleteAction,
): AddressAutocompleteState => {
  switch (action.type) {
    case 'inputChanged':
      return { ...state, input: action.value, error: '' };
    case 'requestStarted':
      return { ...state, loading: true, open: true, error: '' };
    case 'requestSucceeded':
      return {
        ...state,
        suggestions: action.suggestions,
        loading: false,
        open: action.suggestions.length > 0,
        error: '',
      };
    case 'requestFailed':
      return {
        ...state,
        suggestions: [],
        loading: false,
        open: false,
        error: action.message,
      };
    case 'closed':
      return { ...state, suggestions: [], loading: false, open: false };
  }
};
```

Run `npm run test:address-autocomplete`.

Expected: six tests pass.

- [ ] **Step 3: Build `AddressAutocompleteInput`**

Implement the component with:

- One controlled `TextInput` using the current Add Property border/radius/size.
- `useReducer` with the tested reducer.
- One session token ref created through `Crypto.randomUUID()` and `nextAddressSessionToken`.
- A 300ms effect that calls autocomplete only when `shouldFetchAddressSuggestions(value)`.
- One `AbortController` plus `createLatestRequestGate` per request; abort and invalidate on input change and unmount.
- Cancellation errors ignored; other errors dispatch the exact manual fallback text.
- Selection calls details with the same token, calls `onPlaceSelected` only on success, then closes and resets the session.
- An `ActivityIndicator` inside the field while fetching or resolving.
- Suggestion rows with 48dp minimum height, `location-outline` icon, full text, `accessibilityRole="button"`, and an address-specific accessibility label.
- A bordered white suggestion container placed immediately below the field.
- An unmodified single-line `Google Maps` attribution footer inside that container.
- No form field is changed by the component after a failed details request.

Core wiring:

```tsx
const handleChange = (next: string) => {
  sessionTokenRef.current = nextAddressSessionToken(
    previousValueRef.current,
    next,
    sessionTokenRef.current,
    () => Crypto.randomUUID(),
  );
  previousValueRef.current = next;
  requestGateRef.current.invalidate();
  dispatch({ type: 'inputChanged', value: next });
  onChangeText(next);
};

const selectSuggestion = async (suggestion: GooglePlaceSuggestion) => {
  const token = sessionTokenRef.current;
  if (!token) return;
  setResolving(true);
  try {
    const details = await googlePlacesAPI.details(suggestion.placeId, token);
    onPlaceSelected(details);
    dispatch({ type: 'closed' });
    sessionTokenRef.current = null;
  } catch {
    dispatch({
      type: 'requestFailed',
      message: 'Address suggestions are unavailable. Continue entering it manually.',
    });
  } finally {
    setResolving(false);
  }
};
```

- [ ] **Step 4: Integrate into Add Property**

Type form state as `PropertyDraft`. Replace only the plain street input:

```tsx
<AddressAutocompleteInput
  value={form.address}
  onChangeText={(value) => update('address', value)}
  onPlaceSelected={(details) =>
    setForm((current) => applyGooglePlaceDetails(current, details))
  }
  disabled={saving}
/>
```

Add `keyboardShouldPersistTaps="handled"` and `keyboardDismissMode="on-drag"` to the existing `ScrollView`. Keep city/state/ZIP editable and leave save validation and `PropertyAPI.createProperty(form)` unchanged.

- [ ] **Step 5: Verify mobile behavior and bundling**

```powershell
npm run test:address-autocomplete
npm run test:properties
npx tsc --noEmit
npx expo export --platform android --output-dir "$env:TEMP\property-peace-address-autocomplete-export"
```

Expected: six autocomplete tests and existing property tests pass; TypeScript and Android export exit 0. Resolve the exact temp path and confirm it matches before recursively removing it.

- [ ] **Step 6: Commit exact UI files**

```powershell
git add -- property-peace-mobile/src/components/properties/AddressAutocompleteInput.tsx property-peace-mobile/src/screens/landlord/AddPropertyScreen.tsx property-peace-mobile/src/features/properties/addressAutocomplete.ts property-peace-mobile/scripts/address-autocomplete.test.mjs
git commit -m "feat: autocomplete mobile property addresses"
```

---

### Task 5: Cross-stack verification and deployment handoff

**Files:**

- Verify only. Modify a task-owned file only when a fresh failure demonstrates a real defect.

**Interfaces:**

- Consumes the completed backend/mobile feature.
- Produces fresh build, test, bundle, security, and diff evidence plus the deployment prerequisite.

- [ ] **Step 1: Run focused Places tests**

```powershell
dotnet test property-peace-api.Tests/property-peace-api.Tests.csproj --filter "FullyQualifiedName~GooglePlacesServiceTests|FullyQualifiedName~GooglePlacesControllerTests"
npm --prefix property-peace-mobile run test:address-autocomplete
```

Expected: zero failed tests.

- [ ] **Step 2: Run broader regressions and builds**

```powershell
dotnet build property-peace-api/property-peace-api.csproj --no-restore
npm --prefix property-peace-mobile run test:properties
npm --prefix property-peace-mobile run test:startup
npm --prefix property-peace-mobile run test:ios-compliance
```

Then run `npx tsc --noEmit` from `property-peace-mobile`.

Expected: every command exits 0.

- [ ] **Step 3: Run and safely clean a fresh Android export**

Use a non-existing `$env:TEMP/property-peace-address-autocomplete-final` directory. In one PowerShell process:

1. Resolve the full intended path.
2. Refuse to run if it already exists.
3. Run `npx expo export --platform android --output-dir <exact path>` from `property-peace-mobile`.
4. In `finally`, resolve the created path again, compare it to the intended path, and only then call `Remove-Item -LiteralPath <resolved> -Recurse -Force`.

Expected: export exits 0 and the verified temp directory no longer exists.

- [ ] **Step 4: Inspect security and scoped diffs**

```powershell
rg -n "GooglePlaces|X-Goog-Api-Key|places.googleapis.com" property-peace-api property-peace-mobile --glob "!**/bin/**" --glob "!**/obj/**" --glob "!**/node_modules/**"
git -c core.whitespace=cr-at-eol diff --check -- property-peace-api property-peace-api.Tests property-peace-mobile
git diff --stat -- property-peace-api property-peace-api.Tests property-peace-mobile
```

Confirm from output:

- No literal key or `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` exists in source/mobile files.
- Only backend code sends `X-Goog-Api-Key`.
- Both routes require `Landlord,Admin`.
- The suggestion panel displays `Google Maps`.
- Manual address inputs remain editable.
- No unrelated dirty file was staged or reverted.
- The public Terms of Use and Privacy Policy still incorporate the Google terms required by Places policy.

- [ ] **Step 5: Report deployment prerequisite**

Report that the API deployment requires `GooglePlaces__ApiKey` from the secret/configuration store and Places API (New) enabled. Do not print or retrieve the secret. The web `VITE_APP_GOOGLE_MAPS_API_KEY` and OAuth `GoogleOAuth:ClientId` are not substitutes. Include a rollout note to monitor proxy latency, upstream status categories, request volume, quota, and billing without logging address content.

If verification required a code fix, commit only exact task-owned files with `git commit -m "fix: complete Places autocomplete verification"`. If no fix was needed, do not create an empty commit.

