using System.Net;
using System.Text;
using System.Text.Json;
using brownstone_hub_api.Config;
using brownstone_hub_api.Services.OpenAIService;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.OpenAI;

public class OpenAIServiceTests
{
    [Fact]
    public async Task GenerateTextAsync_UsesModel_WhenStaleDeploymentNameConfigurationExists()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["OpenAI:ApiKey"] = "test-key",
                ["OpenAI:Model"] = "configured-model",
                ["OpenAI:DeploymentName"] = "stale-deployment-name"
            })
            .Build();
        var settings = configuration.GetSection("OpenAI").Get<OpenAISettings>()!;
        var handler = new RecordingHandler();
        var service = CreateService(settings, handler);

        var result = await service.GenerateTextAsync("hello");

        result.Success.Should().BeTrue();
        handler.RequestBody.Should().NotBeNull();
        using var request = JsonDocument.Parse(handler.RequestBody!);
        request.RootElement.GetProperty("model").GetString().Should().Be("configured-model");
        request.RootElement.GetProperty("max_tokens").GetInt32().Should().Be(1000);
    }

    [Theory]
    [InlineData(null, "https://api.openai.com/v1/chat/completions", false)]
    [InlineData("https://api.openai.com/v1/chat/completions", "https://api.openai.com/v1/chat/completions", false)]
    [InlineData("https://example.openai.azure.com/", "https://example.openai.azure.com/openai/v1/chat/completions", true)]
    [InlineData("https://example.openai.azure.com/openai/v1/", "https://example.openai.azure.com/openai/v1/chat/completions", true)]
    [InlineData("https://example.openai.azure.com/openai/v1/chat/completions", "https://example.openai.azure.com/openai/v1/chat/completions", true)]
    public async Task GenerateJsonAsync_Luna_UsesV1EndpointAndModernCompletionParameters(
        string? configuredEndpoint, string expectedEndpoint, bool usesAzure)
    {
        var handler = new RecordingHandler("{\"content\":\"ok\"}");
        var service = CreateService(new OpenAISettings { ApiKey = "test-key", Endpoint = configuredEndpoint }, handler);

        var result = await service.GenerateJsonAsync<Dictionary<string, string>>("Return a short answer", maxTokens: 300);

        result.Success.Should().BeTrue();
        result.Data!["content"].Should().Be("ok");
        handler.RequestUri.Should().Be(new Uri(expectedEndpoint));
        handler.HasAzureKeyHeader.Should().Be(usesAzure);
        handler.AuthorizationScheme.Should().Be(usesAzure ? null : "Bearer");
        using var request = JsonDocument.Parse(handler.RequestBody!);
        var body = request.RootElement;
        body.GetProperty("model").GetString().Should().Be("gpt-6-luna");
        body.GetProperty("max_completion_tokens").GetInt32().Should().Be(300);
        body.GetProperty("reasoning_effort").GetString().Should().Be("none");
        body.GetProperty("response_format").GetProperty("type").GetString().Should().Be("json_object");
        body.TryGetProperty("max_tokens", out _).Should().BeFalse();
        body.TryGetProperty("temperature", out _).Should().BeFalse();
    }

    [Fact]
    public async Task GenerateTextAsync_PreservesExplicitDatedAzureEndpoint()
    {
        var handler = new RecordingHandler();
        var service = CreateService(new OpenAISettings
        {
            ApiKey = "test-key",
            Endpoint = "https://example.openai.azure.com/",
            Model = "existing-deployment",
            ApiVersion = "2024-10-21"
        }, handler);

        var result = await service.GenerateTextAsync("hello");

        result.Success.Should().BeTrue();
        handler.RequestUri.Should().Be(new Uri("https://example.openai.azure.com/openai/deployments/existing-deployment/chat/completions?api-version=2024-10-21"));
        handler.HasAzureKeyHeader.Should().BeTrue();
    }

    private static OpenAIService CreateService(OpenAISettings settings, RecordingHandler handler)
    {
        var factory = new Mock<IHttpClientFactory>();
        factory.Setup(x => x.CreateClient(It.IsAny<string>())).Returns(new HttpClient(handler));
        return new OpenAIService(Options.Create(settings), NullLogger<OpenAIService>.Instance, factory.Object);
    }

    private sealed class RecordingHandler(string content = "ok") : HttpMessageHandler
    {
        public string? RequestBody { get; private set; }
        public Uri? RequestUri { get; private set; }
        public bool HasAzureKeyHeader { get; private set; }
        public string? AuthorizationScheme { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            RequestBody = await request.Content!.ReadAsStringAsync(cancellationToken);
            RequestUri = request.RequestUri;
            HasAzureKeyHeader = request.Headers.Contains("api-key");
            AuthorizationScheme = request.Headers.Authorization?.Scheme;
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(
                    JsonSerializer.Serialize(new { choices = new[] { new { message = new { content } } } }),
                    Encoding.UTF8,
                    "application/json")
            };
        }
    }
}
