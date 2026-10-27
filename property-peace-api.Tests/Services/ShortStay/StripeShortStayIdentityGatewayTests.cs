using System.Net;
using brownstone_hub_api.Services.ShortStay;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Stripe;
using Xunit;

namespace brownstone_hub_api.Tests.Services.ShortStay;

public sealed class StripeShortStayIdentityGatewayTests
{
    [Theory]
    [InlineData(null, "sk_test_identity")]
    [InlineData("false", "sk_test_identity")]
    [InlineData("TRUE", null)]
    [InlineData("other", "sk_test_identity")]
    public void Registration_IsOptIn_AndRequiresKeyWhenEnabled(string? flag, string? key)
    {
        var configuration = Config(flag, key);
        var services = new ServiceCollection();
        if (flag == "TRUE" && key is null)
        {
            var act = () => services.AddStripeShortStayIdentity(configuration);
            act.Should().Throw<InvalidOperationException>().WithMessage("*Stripe:SecretKey*");
        }
        else
        {
            services.AddStripeShortStayIdentity(configuration);
            using var provider = services.BuildServiceProvider();
            provider.GetService<IStripeShortStayIdentityGateway>().Should().BeNull();
        }
    }

    [Fact]
    public void Registration_EnabledWithKey_ResolvesGateway()
    {
        var services = new ServiceCollection();
        services.AddStripeShortStayIdentity(Config("true", "sk_test_identity"));
        using var provider = services.BuildServiceProvider();
        provider.GetRequiredService<IStripeShortStayIdentityGateway>()
            .Should().BeOfType<StripeShortStayIdentityGateway>();
    }

    [Fact]
    public async Task Create_UsesHostedDocumentAndMatchingSelfie_MinimalMetadata_StableVersionedIdempotency()
    {
        var http = new StubStripeHttpClient(request => Json(HttpStatusCode.OK,
            """{"id":"vs_123","object":"identity.verification_session","status":"requires_input","url":"https://verify.stripe.com/session"}"""));
        var gateway = new StripeShortStayIdentityGateway(new StripeClient("sk_test_identity", httpClient: http));

        var result = await gateway.CreateAsync("app_123", "user_456", 2);
        await gateway.CreateAsync("app_123", "user_456", 2);
        await gateway.CreateAsync("app_123", "user_456", 3);

        result.Should().Be(new ShortStayIdentitySession("vs_123", "https://verify.stripe.com/session", "requires_input"));
        http.Requests.Should().HaveCount(3);
        http.Requests.Should().OnlyContain(r => r.Uri.AbsolutePath == "/v1/identity/verification_sessions" && r.Method == HttpMethod.Post);
        var bodies = await Task.WhenAll(http.Requests.Select(r => r.Content!.ReadAsStringAsync()));
        bodies.Should().OnlyContain(body => body.Contains("type=document")
            && body.Contains("options[document][require_matching_selfie]=True")
            && body.Contains("metadata[application_id]=app_123")
            && body.Contains("metadata[bound_user_id]=user_456"));
        bodies[0].Should().NotContain("provided_details").And.NotContain("return_url");
        var keys = http.Requests.Select(r => r.StripeHeaders["Idempotency-Key"]).ToArray();
        keys[0].Should().NotBeNullOrWhiteSpace().And.Be(keys[1]);
        keys[2].Should().NotBe(keys[0]);
    }

    [Fact]
    public async Task Get_ReturnsOnlySessionIdUrlStatus_NoReportData()
    {
        var http = new StubStripeHttpClient(_ => Json(HttpStatusCode.OK,
            """{"id":"vs_123","object":"identity.verification_session","status":"verified","url":null,"verified_outputs":{"first_name":"SECRET"},"last_verification_report":"vr_secret"}"""));
        var gateway = new StripeShortStayIdentityGateway(new StripeClient("sk_test_identity", httpClient: http));
        var result = await gateway.GetAsync("vs_123");
        result.Should().Be(new ShortStayIdentitySession("vs_123", null, "verified"));
        http.Requests.Single().Uri.AbsolutePath.Should().Be("/v1/identity/verification_sessions/vs_123");
    }

    [Fact]
    public async Task ProviderError_IsSanitized_WithoutInnerExceptionOrProviderMessage()
    {
        var http = new StubStripeHttpClient(_ => Json(HttpStatusCode.BadRequest,
            """{"error":{"type":"invalid_request_error","message":"document https://verify.stripe.com/private"}}"""));
        var gateway = new StripeShortStayIdentityGateway(new StripeClient("sk_test_identity", httpClient: http));
        var create = () => gateway.CreateAsync("app_123", "user_456", 1);
        var get = () => gateway.GetAsync("vs_123");
        var createError = await create.Should().ThrowAsync<InvalidOperationException>();
        var getError = await get.Should().ThrowAsync<InvalidOperationException>();
        foreach (var error in new[] { createError.Which, getError.Which })
        {
            error.Message.Should().NotContain("document").And.NotContain("verify.stripe.com");
            error.InnerException.Should().BeNull();
        }
    }

    private static IConfiguration Config(string? enabled, string? key) => new ConfigurationBuilder()
        .AddInMemoryCollection(new Dictionary<string, string?> { ["Stripe:IdentityEnabled"] = enabled, ["Stripe:SecretKey"] = key })
        .Build();

    private static StripeResponse Json(HttpStatusCode status, string content) =>
        new(status, new HttpResponseMessage().Headers, content);

    private sealed class StubStripeHttpClient(Func<StripeRequest, StripeResponse> respond) : IHttpClient
    {
        public List<StripeRequest> Requests { get; } = [];
        public Task<StripeResponse> MakeRequestAsync(StripeRequest request, CancellationToken cancellationToken = default)
        {
            Requests.Add(request);
            return Task.FromResult(respond(request));
        }
        public Task<StripeStreamedResponse> MakeStreamingRequestAsync(StripeRequest request, CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();
    }
}
