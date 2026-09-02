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
        var factory = new Mock<IHttpClientFactory>();
        factory.Setup(x => x.CreateClient(It.IsAny<string>())).Returns(new HttpClient(handler));
        var service = new OpenAIService(
            Options.Create(settings),
            NullLogger<OpenAIService>.Instance,
            factory.Object);

        var result = await service.GenerateTextAsync("hello");

        result.Success.Should().BeTrue();
        handler.RequestBody.Should().NotBeNull();
        using var request = JsonDocument.Parse(handler.RequestBody!);
        request.RootElement.GetProperty("model").GetString().Should().Be("configured-model");
    }

    private sealed class RecordingHandler : HttpMessageHandler
    {
        public string? RequestBody { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            RequestBody = await request.Content!.ReadAsStringAsync(cancellationToken);
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(
                    "{\"choices\":[{\"message\":{\"content\":\"ok\"}}]}",
                    Encoding.UTF8,
                    "application/json")
            };
        }
    }
}
