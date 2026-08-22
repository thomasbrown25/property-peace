# Mobile Google Places Address Autocomplete Design

## Context

The main web app uses Google Places while adding a property. It presents US street-address suggestions, resolves the selected place, and fills the address components. The mobile Add Property screen currently uses independent free-text fields for property name, street address, city, state, and ZIP.

The mobile client must provide the same address-selection experience without embedding a reusable Google Places web-service key in its JavaScript bundle. Google recommends a secure proxy for client-side web-service calls when a suitable protected client SDK is not being used.

## Goals

- Offer Google Places address suggestions while a landlord types a US street address on mobile.
- Fill street address, city, state, and ZIP from the selected place.
- Match the web flow by setting property name to the selected street address only when the property name is still empty.
- Keep every populated field editable and preserve manual property entry when Google is unavailable.
- Keep the Google Places key on the API server and never return it to the mobile app.
- Use Google session tokens and required attribution correctly.

## Non-goals

- Adding a map, geolocation, nearby search, property photos, or Street View to the mobile form.
- Replacing the existing web Places integration.
- Persisting suggestion lists or other Google Places content.
- Refactoring unrelated property creation fields or expanding the mobile property form.
- Using a Google OAuth client ID as a Maps Platform API key; these credentials remain separate.

## Considered Approaches

### Chosen: authenticated API proxy

The Property Peace API owns the Google Places web-service key and exposes two narrow authenticated endpoints: one for address suggestions and one for selected-place details. The mobile app calls those endpoints through its existing authenticated API client.

This avoids placing a web-service key in the mobile bundle, gives the server control over request shape and returned fields, and lets client-side failures fall back to manual entry.

### Rejected: direct REST calls from Expo JavaScript

This is the smallest code change, but an `EXPO_PUBLIC_*` key is included in the application bundle and can be extracted. Google recommends a secure proxy or protected native SDK for this use case. A direct implementation would also require separate Android and iOS restrictions and verification that Places REST honors the relevant application-identification headers.

### Rejected for this iteration: native Places SDKs

The native Android and iOS SDKs provide stronger platform key restrictions, but require platform-specific native modules, separate configuration, and development builds instead of the current Expo JavaScript-only flow. That is unnecessary for one bounded address field and would increase release risk.

## API Contract

Both endpoints require authentication and the `Landlord` or `Admin` role. They return the repository's standard API response envelope and accept cancellation tokens.

### Address suggestions

`POST /api/google-places/autocomplete`

Request:

```json
{
  "input": "1600 Penn",
  "sessionToken": "0c5cccf3-2ac7-41d9-9fe0-975958808b17"
}
```

Response data:

```json
{
  "suggestions": [
    {
      "placeId": "google-place-id",
      "text": "1600 Pennsylvania Avenue NW, Washington, DC, USA"
    }
  ]
}
```

Rules:

- Trim input and return an empty suggestion collection below three characters.
- Reject input longer than 200 characters and invalid non-UUID session tokens.
- Call Places API (New) Autocomplete with `regionCode: "US"`, `languageCode: "en"`, the caller's session token, and address-oriented primary types.
- Ask Google only for place ID and display text, ignore query predictions, and return at most five place predictions.
- Do not accept caller-provided Google endpoints, field masks, regions, or arbitrary request payloads.

### Place details

`GET /api/google-places/details/{placeId}?sessionToken=<uuid>`

Response data:

```json
{
  "placeId": "google-place-id",
  "formattedAddress": "1600 Pennsylvania Avenue NW, Washington, DC 20500, USA",
  "streetAddress": "1600 Pennsylvania Avenue NW",
  "city": "Washington",
  "state": "DC",
  "zipCode": "20500",
  "latitude": 38.8977,
  "longitude": -77.0365
}
```

Rules:

- Validate and URL-encode the place ID rather than accepting an arbitrary URL.
- Reuse the autocomplete session token so the details request terminates the billing session correctly.
- Request only `formattedAddress`, `addressComponents`, and `location` through an explicit field mask.
- Parse both expected Google component names and practical US fallbacks: city prefers `locality`, then `postal_town`, then `sublocality` or `administrative_area_level_2`; state uses the short text for `administrative_area_level_1`; street combines `street_number` and `route`; ZIP combines `postal_code` and `postal_code_suffix` when present.
- Return only the normalized fields the mobile form needs.

## Backend Structure

Keep the integration isolated behind a typed service:

- `GooglePlacesController` owns validation-facing HTTP contracts and standard response mapping.
- `IGooglePlacesService` exposes autocomplete and normalized details operations.
- `GooglePlacesService` owns fixed Google URLs, request headers, field masks, response parsing, and safe error translation.
- `GooglePlacesSettings` binds `GooglePlaces:ApiKey`; production supplies it from secret configuration such as `GooglePlaces__ApiKey`, never source control.
- `Program.cs` registers settings and a named or typed `HttpClient` with the Google Places base URL and a short timeout.
- Focused request/response DTOs prevent the API from becoming an arbitrary Google proxy.

The API key must never appear in responses, logs, exception messages, committed settings, or mobile configuration. The service logs Google status categories and a request correlation identifier, not address input, place IDs, session tokens, or raw response bodies.

## Mobile Interaction

The Add Property screen keeps its current visual language and manual fields. The street-address input becomes the single enhanced control:

1. Typing fewer than three characters keeps the suggestion panel closed.
2. After 300 milliseconds without a change, the app requests suggestions using a UUID session token created for the current selection session.
3. The newest request wins. Late responses from earlier queries cannot replace the current suggestions.
4. While loading, a small activity indicator appears inside the street-address field.
5. Suggestions appear in a bordered white panel directly under the field and remain tappable while the form keyboard is open.
6. The panel includes official Google Maps attribution and visually separates Google-provided results from the rest of the form.
7. Selecting a suggestion requests details, closes the panel, and fills street address, city, state, and ZIP. If property name is blank, it also receives the street address.
8. A new session token is created after a selection or when the user clears the address and begins again.

Users may edit any populated field. Editing does not erase the other address fields. The chosen Google place ID and coordinates are not sent to property creation in this iteration because the current property contract does not require them.

## Error and Empty States

- Empty results close the panel without showing an error.
- A suggestion or details failure closes the panel and leaves typed/manual values intact.
- The field shows a small, actionable message such as `Address suggestions are unavailable. Continue entering it manually.` The message clears on the next edit or successful request.
- Missing server configuration returns `503 Service Unavailable` with a safe message and no credential detail.
- Invalid mobile input returns `400 Bad Request`.
- Google authentication or quota failures and upstream timeouts return a safe `502 Bad Gateway` or `504 Gateway Timeout`; raw Google bodies are not forwarded.
- Property creation remains independent of Places availability.

## Security, Cost, and Policy Controls

- Require authenticated landlord/admin access to both proxy routes.
- Use a dedicated server-side key restricted to Places API (New) and, where practical, the API's outbound IP addresses.
- Apply existing authenticated API rate limiting and add endpoint-specific bounds if the existing policy does not adequately protect type-ahead traffic.
- Reuse one UUID v4 session token across autocomplete requests and the selected Place Details request.
- Return no more than five suggestions and request the minimum fields needed.
- Do not cache or persist suggestion content. Property fields selected by the end user are stored only as part of their property-creation transaction.
- Display Google Maps attribution inside the suggestion container according to the current Places policy.
- Confirm the application's public Terms of Use and Privacy Policy continue to incorporate the required Google terms before production rollout.

## Testing

Follow red-green-refactor for all production behavior.

Backend tests will prove:

- Both endpoints require the intended roles.
- Short input returns no suggestions without calling Google.
- Invalid length, token, or place ID is rejected.
- The Google key stays in request headers and never appears in returned DTOs or safe errors.
- Autocomplete sends fixed US/language/type restrictions and the supplied session token.
- Only place predictions are returned, capped at five.
- Place details use the fixed field mask and supplied session token.
- Address components normalize street, city fallbacks, state abbreviation, ZIP, ZIP suffix, and coordinates.
- Missing configuration and upstream failures map to safe service errors.

Mobile tests will focus on framework-independent behavior extracted from the screen:

- Suggestion queries start at three characters.
- Only the newest request result is accepted.
- Selecting normalized details fills street, city, state, and ZIP.
- Property name is filled only when previously empty.
- Manual values survive failed details lookup.
- A completed or cleared selection starts a new session.

Verification will include the focused API tests, focused mobile tests, the API build, mobile TypeScript compilation, existing mobile startup/property tests, an Android Expo export, scoped whitespace checks, and a focused diff review.

## Rollout

1. Enable Places API (New) in the existing Google Cloud project or a dedicated Maps project.
2. Create a separate server-side API key and restrict it to Places API (New) plus approved server IPs where deployment networking permits.
3. Add `GooglePlaces:ApiKey` to development user secrets and the deployed secret/configuration store.
4. Deploy the API endpoints before releasing the mobile build.
5. Smoke-test suggestions, selection, manual fallback, and property creation against the target API environment.
6. Monitor upstream errors, endpoint latency, request volume, quota, and billing without logging address content.

## References

- [Google Maps Platform security guidance](https://developers.google.com/maps/api-security-best-practices)
- [Autocomplete (New)](https://developers.google.com/maps/documentation/places/web-service/place-autocomplete)
- [Place Details (New)](https://developers.google.com/maps/documentation/places/web-service/place-details)
- [Using session tokens](https://developers.google.com/maps/documentation/places/web-service/using-session-tokens)
- [Places API policies and attribution](https://developers.google.com/maps/documentation/places/web-service/policies)
