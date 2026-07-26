using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.LeaseShield;
using brownstone_hub_api.Services.LeaseGenerationService;
using brownstone_hub_api.Services.OpenAIService;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using System.Net;
using Xunit;

namespace brownstone_hub_api.Tests.Services.LeaseGeneration;

public class StateRequiredDisclosureServiceTests
{
    [Fact]
    public async Task GenerateAsync_UsesStateTableContentAndReturnsValidatedCitations()
    {
        var sections = new Mock<ILeaseShieldStateLawSectionRepository>();
        sections.Setup(x => x.GetByStateAsync("NC", It.IsAny<CancellationToken>())).ReturnsAsync([
            new LeaseShieldStateLawSection
            {
                Id = 42, State = "NC", SectionCode = "42-46", SectionTitle = "Authorized fees",
                SourceUrl = "https://law.example/nc/42-46", ContentText = "A late fee must be disclosed in the rental agreement."
            }
        ]);
        var ai = new Mock<IOpenAIService>();
        ai.Setup(x => x.GenerateJsonAsync<StateDisclosureAiResult>(It.Is<string>(p =>
                p.Contains("A late fee must be disclosed") && p.Contains("sectionId\":42") &&
                !p.Contains("general knowledge", StringComparison.OrdinalIgnoreCase)), 2000))
            .ReturnsAsync(ServiceResponse<StateDisclosureAiResult>.CreateSuccess(new StateDisclosureAiResult
            {
                DeterminationComplete = true,
                Disclosures = [new StateDisclosureAiItem
                {
                    Quote = "A late fee must be disclosed in the rental agreement.",
                    Citation = new StateDisclosureAiCitation { SectionId = 42, SectionCode = "42-46", Url = "https://law.example/nc/42-46" }
                }]
            }));

        var service = CreateService(sections.Object, ai.Object);
        var result = await service.GenerateAsync("North Carolina");

        result.Success.Should().BeTrue();
        result.Data!.StateCode.Should().Be("NC");
        result.Data.PlainText.Should().Contain("A late fee must be disclosed");
        result.Data.Citations.Should().ContainSingle(c => c.SectionId == 42 && c.SectionCode == "42-46");
        sections.Verify(x => x.GetByStateAsync("NC", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task GenerateAsync_RejectsUnknownAiCitation()
    {
        var sections = new Mock<ILeaseShieldStateLawSectionRepository>();
        sections.Setup(x => x.GetByStateAsync("NC", It.IsAny<CancellationToken>())).ReturnsAsync([
            new LeaseShieldStateLawSection { Id = 42, State = "NC", SectionCode = "42-46", SourceUrl = "https://law.example/42-46", ContentText = "Statute text" }
        ]);
        var ai = new Mock<IOpenAIService>();
        ai.Setup(x => x.GenerateJsonAsync<StateDisclosureAiResult>(It.IsAny<string>(), 2000))
            .ReturnsAsync(ServiceResponse<StateDisclosureAiResult>.CreateSuccess(new StateDisclosureAiResult
            {
                DeterminationComplete = true,
                Disclosures = [new StateDisclosureAiItem
                {
                    Quote = "Invented requirement",
                    Citation = new StateDisclosureAiCitation { SectionId = 999, SectionCode = "made-up", Url = "https://unknown.example" }
                }]
            }));

        var result = await CreateService(sections.Object, ai.Object).GenerateAsync("NC");

        result.Success.Should().BeFalse();
        result.Message.Should().MatchRegex("(?i)citation");
    }

    [Fact]
    public async Task GenerateAsync_FailsClosedWhenStateCorpusIsMissing()
    {
        var sections = new Mock<ILeaseShieldStateLawSectionRepository>();
        sections.Setup(x => x.GetByStateAsync("TX", It.IsAny<CancellationToken>())).ReturnsAsync([]);
        var ai = new Mock<IOpenAIService>();

        var result = await CreateService(sections.Object, ai.Object).GenerateAsync("Texas");

        result.Success.Should().BeFalse();
        result.Message.Should().MatchRegex("(?i)corpus");
        ai.Verify(x => x.GenerateJsonAsync<StateDisclosureAiResult>(It.IsAny<string>(), It.IsAny<int>()), Times.Never);
    }

    [Theory]
    [InlineData("The rental agreement has to disclose late fees.")]
    [InlineData("A smoke detector disclosure is mandatory.")]
    [InlineData("a late fee must be disclosed in the rental agreement.")]
    [InlineData("A late  fee must be disclosed in the rental agreement.")]
    public async Task GenerateAsync_RejectsNonExtractiveTextEvenWithValidCitation(string ungroundedText)
    {
        var sections = new Mock<ILeaseShieldStateLawSectionRepository>();
        sections.Setup(x => x.GetByStateAsync("NC", It.IsAny<CancellationToken>())).ReturnsAsync([
            new LeaseShieldStateLawSection { Id = 42, State = "NC", SectionCode = "42-46", SourceUrl = "https://law.example/42-46", ContentText = "A late fee must be disclosed in the rental agreement." }
        ]);
        var ai = new Mock<IOpenAIService>();
        ai.Setup(x => x.GenerateJsonAsync<StateDisclosureAiResult>(It.IsAny<string>(), 2000))
            .ReturnsAsync(ServiceResponse<StateDisclosureAiResult>.CreateSuccess(new StateDisclosureAiResult
            {
                DeterminationComplete = true,
                Disclosures = [new StateDisclosureAiItem
                {
                    Quote = ungroundedText,
                    Citation = new StateDisclosureAiCitation { SectionId = 42, SectionCode = "42-46", Url = "https://law.example/42-46" }
                }]
            }));

        var result = await CreateService(sections.Object, ai.Object).GenerateAsync("NC");
        result.Success.Should().BeFalse();
        result.Message.Should().MatchRegex("(?i)extractive");
    }

    [Fact]
    public async Task GenerateAsync_DoesNotFlattenQuoteAcrossSourceRows()
    {
        var sections = new Mock<ILeaseShieldStateLawSectionRepository>();
        sections.Setup(x => x.GetByStateAsync("NC", It.IsAny<CancellationToken>())).ReturnsAsync([
            new LeaseShieldStateLawSection { Id = 41, State = "NC", SectionCode = "41", SourceUrl = "https://law.example/41", ContentText = "A late fee must be" },
            new LeaseShieldStateLawSection { Id = 42, State = "NC", SectionCode = "42", SourceUrl = "https://law.example/42", ContentText = " disclosed in the rental agreement." }
        ]);
        var ai = new Mock<IOpenAIService>();
        ai.Setup(x => x.GenerateJsonAsync<StateDisclosureAiResult>(It.IsAny<string>(), 2000))
            .ReturnsAsync(ServiceResponse<StateDisclosureAiResult>.CreateSuccess(new StateDisclosureAiResult
            {
                DeterminationComplete = true,
                Disclosures = [new StateDisclosureAiItem
                {
                    Quote = "A late fee must be disclosed in the rental agreement.",
                    Citation = new StateDisclosureAiCitation { SectionId = 41, SectionCode = "41", Url = "https://law.example/41" }
                }]
            }));

        var result = await CreateService(sections.Object, ai.Object).GenerateAsync("NC");

        result.Success.Should().BeFalse();
        result.Message.Should().MatchRegex("(?i)extractive");
    }

    [Theory]
    [InlineData("http://127.0.0.1/law")]
    [InlineData("http://10.0.0.1/law")]
    [InlineData("http://169.254.169.254/latest/meta-data")]
    [InlineData("http://192.168.1.5/law")]
    [InlineData("http://192.0.2.1/law")]
    [InlineData("ftp://8.8.8.8/law")]
    [InlineData("http://localhost/law")]
    public async Task ValidateSourceUriAsync_RejectsUnsafeUrlsWithoutHttpRequests(string url)
    {
        var error = await StateRequiredDisclosureService.ValidateSourceUriAsync(new Uri(url));
        error.Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public async Task GenerateAsync_RejectsRedirectToPrivateAddressBeforeFollowingIt()
    {
        var sections = new Mock<ILeaseShieldStateLawSectionRepository>();
        sections.Setup(x => x.GetByStateAsync("NC", It.IsAny<CancellationToken>())).ReturnsAsync([
            new LeaseShieldStateLawSection
            {
                Id = 42, State = "NC", SectionCode = "42-46",
                SourceUrl = "https://8.8.8.8/source", ContentText = null
            }
        ]);
        var handler = new RecordingRedirectHandler("http://127.0.0.1/private");
        var clientFactory = new Mock<IHttpClientFactory>();
        clientFactory.Setup(x => x.CreateClient("StateLawSources")).Returns(new HttpClient(handler));
        var ai = new Mock<IOpenAIService>();

        var result = await CreateService(sections.Object, ai.Object, clientFactory.Object).GenerateAsync("NC");

        result.Success.Should().BeFalse();
        result.Errors!.Details.Should().MatchRegex("(?i)private|local|reserved");
        handler.RequestCount.Should().Be(1, "the private redirect target must be rejected before a second request");
        ai.Verify(x => x.GenerateJsonAsync<StateDisclosureAiResult>(It.IsAny<string>(), It.IsAny<int>()), Times.Never);
    }

    private static StateRequiredDisclosureService CreateService(
        ILeaseShieldStateLawSectionRepository sections,
        IOpenAIService ai,
        IHttpClientFactory? clientFactory = null)
    {
        var sources = new Mock<ILeaseShieldStateLawSourceRepository>();
        sources.Setup(x => x.GetByStateAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((LeaseShieldStateLawSource?)null);
        return new StateRequiredDisclosureService(
            sections, sources.Object, ai, clientFactory ?? Mock.Of<IHttpClientFactory>(),
            NullLogger<StateRequiredDisclosureService>.Instance);
    }

    private sealed class RecordingRedirectHandler(string location) : HttpMessageHandler
    {
        public int RequestCount { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            RequestCount++;
            var response = new HttpResponseMessage(HttpStatusCode.Redirect);
            response.Headers.Location = new Uri(location);
            return Task.FromResult(response);
        }
    }
}
