using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.AICopilot;
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

    private static AICopilotService Service(DataContext db, IPropertyRepository properties, IOpenAIService model) => new(
        properties,
        Mock.Of<ITenantRepository>(),
        Mock.Of<ILeaseRepository>(),
        Mock.Of<IPaymentRepository>(),
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
