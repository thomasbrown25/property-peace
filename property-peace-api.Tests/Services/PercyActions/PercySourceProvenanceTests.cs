using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.AICopilot;
using brownstone_hub_api.Dtos.Lease;
using brownstone_hub_api.Dtos.Payment;
using brownstone_hub_api.Dtos.Property;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Applications;
using brownstone_hub_api.Repositories.Checklists;
using brownstone_hub_api.Repositories.Conversations;
using brownstone_hub_api.Repositories.Leases;
using brownstone_hub_api.Repositories.MaintenanceRequests;
using brownstone_hub_api.Repositories.Payments;
using brownstone_hub_api.Repositories.Properties;
using brownstone_hub_api.Repositories.Tenants;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.ActionSuppressionService;
using brownstone_hub_api.Services.AICopilotService;
using brownstone_hub_api.Services.OpenAIService;
using brownstone_hub_api.Services.PercyActions;
using brownstone_hub_api.Utils;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using System.Text.Json;
using Xunit;

namespace brownstone_hub_api.Tests.Services.PercyActions;

public sealed class PercySourceProvenanceTests
{
    private const long OrganizationId = 810;
    private const long UserId = 820;

    [Fact]
    public async Task Chat_OverdueRentStatusRequest_UsesCanonicalRentBalanceInsteadOfModelInference()
    {
        await using var db = Db();
        SeedAuthority(db);
        db.Properties.Add(new Property
        {
            Id = 101,
            OrganizationId = OrganizationId,
            LandlordId = UserId,
            Name = "2325 W Arbors Dr",
            StreetAddress = "2325 W Arbors Dr"
        });
        db.UserSettings.Add(new UserSettings
        {
            UserId = UserId,
            Timezone = "America/Chicago"
        });
        db.SaveChanges();

        var properties = new Mock<IPropertyRepository>(MockBehavior.Strict);
        var lease = new LoadLeaseDto
        {
            Id = 501,
            OrganizationId = OrganizationId,
            PropertyId = 101,
            PropertyName = "2325 W Arbors Dr",
            UnitId = 601,
            UnitName = "Unit 1",
            IsActive = true,
            StartDate = DateTime.Today.AddMonths(-2),
            EndDate = DateTime.Today.AddMonths(10),
            RentAmount = 1_500m,
            RentDueDay = 1
        };
        var leases = new Mock<ILeaseRepository>(MockBehavior.Strict);
        leases.Setup(x => x.GetLeasesByOrganizationId(OrganizationId, false)).ReturnsAsync([lease]);
        var payments = new Mock<IPaymentRepository>(MockBehavior.Strict);
        payments.Setup(x => x.GetLifetimeRentPaymentsByOrganizationId(OrganizationId))
            .ReturnsAsync([]);
        var model = new Mock<IOpenAIService>(MockBehavior.Strict);
        var service = Service(db, properties.Object, model.Object, leases.Object, payments.Object);

        var result = await service.ChatAsync(OrganizationId, UserId,
            new PercyChatRequestDto { ClientRequestId = "overdue-rent-status-001", Message = "any of them have overdue rent?" });
        var expectedOverdue = RentCalculator.CalculateOverdueForLease(lease, [], "America/Chicago");
        var expectedMetric = expectedOverdue.ToString("0.00", System.Globalization.CultureInfo.InvariantCulture);
        var expectedDisplay = "$" + expectedOverdue.ToString("N0", System.Globalization.CultureInfo.InvariantCulture);

        result.Success.Should().BeTrue();
        result.Data!.Content.Should().Contain("Yes").And.Contain("2325 W Arbors Dr").And.NotContain("no overdue rent");
        result.Data.Metrics.Should().ContainEquivalentOf(new PercyMetricDto { Label = "Overdue leases", Value = "1" });
        result.Data.Metrics.Should().ContainEquivalentOf(new PercyMetricDto { Label = "Total overdue", Value = expectedMetric, Money = true });
        result.Data.Items.Should().ContainSingle(item => item.Title == "2325 W Arbors Dr" && item.Value == expectedDisplay);
        result.Data.Sources.Should().ContainSingle(source => source.Kind == "rent-payments");
        model.Verify(x => x.GenerateJsonAsync<AICopilotService.PercyReadPlan>(It.IsAny<string>(), It.IsAny<int>()), Times.Never);
        model.Verify(x => x.GenerateJsonAsync<PercyChatResponseDto>(It.IsAny<string>(), It.IsAny<int>()), Times.Never);
        leases.VerifyAll();
        payments.VerifyAll();
        properties.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Chat_GeneralLateRentQuestion_RemainsConversationalInsteadOfReadingPortfolioStatus()
    {
        await using var db = Db();
        SeedAuthority(db);
        var properties = new Mock<IPropertyRepository>(MockBehavior.Strict);
        var model = new Mock<IOpenAIService>(MockBehavior.Strict);
        model.Setup(x => x.GenerateJsonAsync<AICopilotService.PercyReadPlan>(It.IsAny<string>(), 300))
            .ReturnsAsync(ServiceResponse<AICopilotService.PercyReadPlan>.CreateSuccess(new()
            {
                AnswerWithoutOrganizationData = true
            }));
        model.Setup(x => x.GenerateJsonAsync<PercyChatResponseDto>(It.IsAny<string>(), 1800))
            .ReturnsAsync(ServiceResponse<PercyChatResponseDto>.CreateSuccess(new()
            {
                Content = "Late-rent tax treatment depends on the type of payment and your jurisdiction."
            }));
        var service = Service(db, properties.Object, model.Object);

        var result = await service.ChatAsync(OrganizationId, UserId,
            new PercyChatRequestDto { ClientRequestId = "late-rent-guidance-001", Message = "Is late rent taxable income?" });

        result.Success.Should().BeTrue();
        result.Data!.Content.Should().Contain("tax treatment");
        result.Data.Sources.Should().BeEmpty();
        model.Verify(x => x.GenerateJsonAsync<AICopilotService.PercyReadPlan>(It.IsAny<string>(), 300), Times.Once);
        model.Verify(x => x.GenerateJsonAsync<PercyChatResponseDto>(It.IsAny<string>(), 1800), Times.Once);
        properties.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Chat_CasualGreeting_AnswersNaturallyWithoutLoadingOrganizationAnswerScopes()
    {
        await using var db = Db();
        SeedAuthority(db);
        var properties = new Mock<IPropertyRepository>(MockBehavior.Strict);
        var model = new Mock<IOpenAIService>(MockBehavior.Strict);
        model.Setup(x => x.GenerateJsonAsync<PercyChatResponseDto>(
                It.Is<string>(prompt => prompt.Contains("Match the user's conversational energy") &&
                    prompt.Contains("Trusted data (bounded and role-authorized): {}")), 1800))
            .ReturnsAsync(ServiceResponse<PercyChatResponseDto>.CreateSuccess(new()
            {
                Content = "Hey, what's up? How can I help you today?"
            }));
        var service = Service(db, properties.Object, model.Object);

        var result = await service.ChatAsync(OrganizationId, UserId,
            new PercyChatRequestDto { ClientRequestId = "casual-greeting-001", Message = "yo" });

        result.Success.Should().BeTrue();
        result.Data!.Content.Should().Be("Hey, what's up? How can I help you today?");
        result.Data.Sources.Should().BeEmpty();
        result.Data.Metrics.Should().BeEmpty();
        result.Data.Items.Should().BeEmpty();
        properties.VerifyNoOtherCalls();
        model.VerifyAll();
    }

    [Fact]
    public async Task Chat_LargePropertyList_BoundsDisplayedNamesButKeepsCompleteTotals()
    {
        await using var db = Db();
        SeedAuthority(db);
        var propertyRows = Enumerable.Range(1, PercyDataBoundary.MaxItems + 2)
            .Select(index => new LoadPropertyDto
            {
                Id = index,
                OrganizationId = OrganizationId,
                Name = $"Property {index}",
                Units = [new()]
            }).ToList();
        var properties = new Mock<IPropertyRepository>(MockBehavior.Strict);
        properties.Setup(x => x.GetPropertiesByOrganizationId(OrganizationId)).ReturnsAsync(propertyRows);
        var model = new Mock<IOpenAIService>(MockBehavior.Strict);
        model.Setup(x => x.GenerateJsonAsync<AICopilotService.PercyReadPlan>(It.IsAny<string>(), 300))
            .ReturnsAsync(ServiceResponse<AICopilotService.PercyReadPlan>.CreateSuccess(new()
            {
                Scopes = ["portfolio"]
            }));
        var service = Service(db, properties.Object, model.Object);

        var result = await service.ChatAsync(OrganizationId, UserId,
            new PercyChatRequestDto { ClientRequestId = "property-list-bounded-001", Message = "List my properties" });

        result.Success.Should().BeTrue();
        result.Data!.Content.Should().Contain("You have 10 properties").And.Contain("first 8");
        result.Data.Content.Should().Contain("Property 8").And.NotContain("Property 9");
        result.Data.Items.Should().HaveCount(PercyDataBoundary.MaxItems);
        result.Data.Metrics.Should().ContainEquivalentOf(new PercyMetricDto { Label = "Total Properties", Value = "10" });
        result.Data.Metrics.Should().ContainEquivalentOf(new PercyMetricDto { Label = "Total Units", Value = "10" });
        model.Verify(x => x.GenerateJsonAsync<PercyChatResponseDto>(It.IsAny<string>(), It.IsAny<int>()), Times.Never);
    }

    [Theory]
    [InlineData("Generate an image of my building")]
    [InlineData("Produce a picture of the lobby")]
    [InlineData("Can you design an illustration for this listing?")]
    [InlineData("I need an image generated for Property 1")]
    [InlineData("Generate a photo of the lobby")]
    [InlineData("Create a graphic for this listing")]
    [InlineData("Render a thumbnail")]
    [InlineData("Draw a sketch of the building")]
    [InlineData("Make a logo for my organization")]
    [InlineData("Design a floor plan for Unit 2")]
    public async Task Chat_ImageGenerationRequest_ReturnsFriendlyUnavailableResponseWithoutCallingModelOrRepositories(string message)
    {
        await using var db = Db();
        SeedAuthority(db);
        var properties = new Mock<IPropertyRepository>(MockBehavior.Strict);
        var model = new Mock<IOpenAIService>(MockBehavior.Strict);
        var service = Service(db, properties.Object, model.Object);

        var result = await service.ChatAsync(OrganizationId, UserId,
            new PercyChatRequestDto { ClientRequestId = "image-generation-001", Message = message });

        result.Success.Should().BeTrue();
        result.Data!.Content.Should().Contain("can't generate images yet");
        properties.VerifyNoOtherCalls();
        model.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Chat_UnavailableImageRequest_RedactsOrganizationSubjectNameBeforePersistence()
    {
        await using var db = Db();
        SeedAuthority(db);
        db.Tenants.Add(new Tenant
        {
            OrganizationId = OrganizationId,
            Firstname = "Jane",
            Lastname = "Doe"
        });
        db.SaveChanges();
        var properties = new Mock<IPropertyRepository>(MockBehavior.Strict);
        var model = new Mock<IOpenAIService>(MockBehavior.Strict);
        var service = Service(db, properties.Object, model.Object);

        var result = await service.ChatAsync(OrganizationId, UserId,
            new PercyChatRequestDto
            {
                ClientRequestId = "image-generation-pii-001",
                Message = "Generate an image of Jane Doe"
            });

        result.Success.Should().BeTrue();
        var persistedUserMessage = await db.PercyMessages.SingleAsync(message => message.Role == "user");
        persistedUserMessage.Content.Should().Contain("[PERSON]").And.NotContain("Jane Doe");
        model.VerifyNoOtherCalls();
        properties.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Chat_PropertyListRequest_ReturnsAuthorizedPropertyNamesAndConsistentUnitCounts()
    {
        await using var db = Db();
        SeedAuthority(db);
        var properties = new Mock<IPropertyRepository>(MockBehavior.Strict);
        properties.Setup(x => x.GetPropertiesByOrganizationId(OrganizationId)).ReturnsAsync(
        [
            new LoadPropertyDto
            {
                Id = 101,
                OrganizationId = OrganizationId,
                Name = "10 Maple Street",
                StreetAddress = "10 Private Road",
                Units = [new(), new()]
            },
            new LoadPropertyDto
            {
                Id = 102,
                OrganizationId = OrganizationId,
                Name = "Riverside Flats",
                StreetAddress = "20 Private Road",
                Units = [new(), new(), new()]
            }
        ]);
        var model = new Mock<IOpenAIService>(MockBehavior.Strict);
        model.Setup(x => x.GenerateJsonAsync<AICopilotService.PercyReadPlan>(It.IsAny<string>(), 300))
            .ReturnsAsync(ServiceResponse<AICopilotService.PercyReadPlan>.CreateSuccess(new()
            {
                Scopes = ["portfolio"]
            }));
        var service = Service(db, properties.Object, model.Object);

        var result = await service.ChatAsync(OrganizationId, UserId,
            new PercyChatRequestDto { ClientRequestId = "property-list-names-001", Message = "Give me the list of properties I have" });

        result.Success.Should().BeTrue();
        result.Data!.Content.Should().Be("You have 2 properties: 10 Maple Street and Riverside Flats.");
        result.Data.Metrics.Should().ContainEquivalentOf(new PercyMetricDto { Label = "Total Properties", Value = "2" });
        result.Data.Metrics.Should().ContainEquivalentOf(new PercyMetricDto { Label = "Total Units", Value = "5" });
        result.Data.Items.Should().BeEquivalentTo(
        [
            new PercyResultItemDto { Title = "10 Maple Street", Detail = "2 units" },
            new PercyResultItemDto { Title = "Riverside Flats", Detail = "3 units" }
        ], options => options.WithStrictOrdering());
        result.Data.Sources.Should().ContainSingle(source => source.Kind == "portfolio");
        model.Verify(x => x.GenerateJsonAsync<PercyChatResponseDto>(It.IsAny<string>(), It.IsAny<int>()), Times.Never);
        properties.Verify(x => x.GetPropertiesByOrganizationId(OrganizationId), Times.Once);
        properties.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Chat_SourcesAreDerivedFromActualScopedRead_NotModelOutput_AndPersistInMetadata()
    {
        await using var db = Db();
        SeedAuthority(db);
        var properties = new Mock<IPropertyRepository>(MockBehavior.Strict);
        properties.Setup(x => x.GetPropertiesByOrganizationId(OrganizationId)).ReturnsAsync(
        [
            new LoadPropertyDto
            {
                Id = 987654321,
                OrganizationId = OrganizationId,
                Name = "Private Property Name",
                StreetAddress = "742 Evergreen Terrace"
            }
        ]);
        var model = new Mock<IOpenAIService>(MockBehavior.Strict);
        model.Setup(x => x.GenerateJsonAsync<AICopilotService.PercyReadPlan>(It.IsAny<string>(), 300))
            .ReturnsAsync(ServiceResponse<AICopilotService.PercyReadPlan>.CreateSuccess(new()
            {
                Scopes = ["portfolio"]
            }));
        model.Setup(x => x.GenerateJsonAsync<PercyChatResponseDto>(It.IsAny<string>(), 1800))
            .ReturnsAsync(ServiceResponse<PercyChatResponseDto>.CreateSuccess(new()
            {
                Content = "There is one property record.",
                Sources =
                [
                    new()
                    {
                        Kind = "urgent-messages",
                        Label = "Other Org Applicant Jane Doe at 1600 Pennsylvania Avenue",
                        WorkflowRoute = "javascript:alert(1)",
                        RecordReference = "987654321",
                        RetrievedAtUtc = DateTime.UnixEpoch
                    }
                ]
            }));
        var service = Service(db, properties.Object, model.Object);
        var before = DateTime.UtcNow;

        var result = await service.ChatAsync(OrganizationId, UserId,
            new PercyChatRequestDto { ClientRequestId = "source-provenance-001", Message = "Give me a portfolio summary" });

        result.Success.Should().BeTrue();
        result.Data!.Sources.Should().ContainSingle();
        var source = result.Data.Sources.Single();
        source.Kind.Should().Be("portfolio");
        source.Label.Should().Be("Portfolio");
        source.WorkflowRoute.Should().Be("/landlord/properties");
        source.RecordReference.Should().BeNull();
        source.RetrievedAtUtc.Kind.Should().Be(DateTimeKind.Utc);
        source.RetrievedAtUtc.Should().BeOnOrAfter(before);
        JsonSerializer.Serialize(source).Should().NotContainAny("987654321", "Jane Doe", "Pennsylvania", "Evergreen", "Private Property");

        var loaded = await service.GetConversationAsync(OrganizationId, UserId, result.Data.ConversationId);
        loaded.Success.Should().BeTrue();
        loaded.Data!.Messages.Single(x => x.Role == "assistant").Sources.Should().BeEquivalentTo(result.Data.Sources);
        properties.Verify(x => x.GetPropertiesByOrganizationId(OrganizationId), Times.Once);
        properties.VerifyNoOtherCalls();
    }

    private static void SeedAuthority(DataContext db)
    {
        db.Organizations.Add(new Organization { Id = OrganizationId, Name = "Current Org", IsActive = true });
        db.Organizations.Add(new Organization { Id = 999, Name = "Other Org", IsActive = true });
        db.Users.Add(new User { Id = UserId, FirstName = "Percy", Email = "percy-source@example.test" });
        db.OrganizationMembers.Add(new OrganizationMember
        {
            OrganizationId = OrganizationId,
            UserId = UserId,
            Role = "Viewer",
            IsActive = true
        });
        db.Properties.Add(new Property
        {
            OrganizationId = 999,
            LandlordId = UserId,
            Name = "Cross Org Secret Property",
            StreetAddress = "1600 Pennsylvania Avenue"
        });
        db.SaveChanges();
    }

    private static DataContext Db() => new(new DbContextOptionsBuilder<DataContext>()
        .UseInMemoryDatabase($"percy-sources-{Guid.NewGuid()}", options => options.EnableNullChecks(false))
        .Options);

    private static AICopilotService Service(DataContext db, IPropertyRepository properties, IOpenAIService model,
        ILeaseRepository? leases = null, IPaymentRepository? payments = null) => new(
        properties,
        Mock.Of<ITenantRepository>(),
        leases ?? Mock.Of<ILeaseRepository>(),
        payments ?? Mock.Of<IPaymentRepository>(),
        Mock.Of<IMaintenanceRequestRepository>(),
        Mock.Of<IApplicationRepository>(),
        Mock.Of<IChecklistRepository>(),
        Mock.Of<IConversationRepository>(),
        Mock.Of<IActionSuppressionService>(),
        Mock.Of<IUserRepository>(),
        db,
        model,
        NullLogger<AICopilotService>.Instance);
}
