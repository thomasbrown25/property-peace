using System.Net;
using System.Text;
using brownstone_hub_api.Config;
using brownstone_hub_api.Services.GooglePlacesService;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;

namespace brownstone_hub_api.Tests.Services.GooglePlaces;

public class GooglePlacesServiceTests
{
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

        result.Should().BeEquivalentTo(new
        {
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

    private static GooglePlacesService CreateService(RecordingHandler handler, string apiKey = "test-key") =>
        new(new HttpClient(handler),
            Options.Create(new GooglePlacesSettings { ApiKey = apiKey }),
            NullLogger<GooglePlacesService>.Instance);

    private static HttpResponseMessage Json(HttpStatusCode statusCode, string json) =>
        new(statusCode) { Content = new StringContent(json, Encoding.UTF8, "application/json") };

    private sealed class RecordingHandler(Func<HttpRequestMessage, HttpResponseMessage> response) : HttpMessageHandler
    {
        public int CallCount { get; private set; }
        public HttpMethod? Method { get; private set; }
        public string? Uri { get; private set; }
        public string? Body { get; private set; }
        public string? ApiKey { get; private set; }
        public string? FieldMask { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            CallCount++;
            Method = request.Method;
            Uri = request.RequestUri?.ToString();
            Body = request.Content is null ? string.Empty : await request.Content.ReadAsStringAsync(cancellationToken);
            ApiKey = request.Headers.TryGetValues("X-Goog-Api-Key", out var apiKey) ? apiKey.Single() : null;
            FieldMask = request.Headers.TryGetValues("X-Goog-FieldMask", out var fieldMask) ? fieldMask.Single() : null;
            return response(request);
        }
    }
}
