using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.AICopilot;
using brownstone_hub_api.Dtos.Lease;
using brownstone_hub_api.Dtos.Payment;
using brownstone_hub_api.Dtos.Tenant;
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
using Xunit;

namespace brownstone_hub_api.Tests.Services.PercyActions;

public sealed class PercyOverdueTenantFollowUpTests
{
    private const long OrganizationId = 401;
    private const long UserId = 402;

    [Fact]
    public async Task Chat_OverdueLeaseTenantFollowUp_ReturnsEveryTenantAndContactDetailWithoutModelInference()
    {
        await using var db = Db();
        SeedAuthority(db);

        var today = DateTime.Today;
        var lease = new LoadLeaseDto
        {
            Id = 77,
            OrganizationId = OrganizationId,
            PropertyName = "10 Maple Street",
            UnitName = "Unit 1",
            IsActive = true,
            StartDate = new DateTime(today.Year, today.Month, 1).AddMonths(-2),
            EndDate = new DateTime(today.Year, today.Month, 1).AddYears(1),
            RentAmount = 2500m,
            RentFrequency = "Monthly",
            RentDueDay = 1,
            Tenants =
            [
                new LoadTenantDto
                {
                    Id = 501,
                    Firstname = "Jordan",
                    Lastname = "Lee",
                    Email = "jordan.lee@example.test",
                    PhoneNumber = "312-555-0198",
                    IsActive = true
                },
                new LoadTenantDto
                {
                    Id = 502,
                    Firstname = "Casey",
                    Lastname = "Morgan",
                    Email = "casey.morgan@example.test",
                    PhoneNumber = null,
                    IsActive = true
                }
            ]
        };
        var currentLease = new LoadLeaseDto
        {
            Id = 78,
            OrganizationId = OrganizationId,
            PropertyName = "20 Oak Avenue",
            UnitName = "Unit 2",
            IsActive = true,
            StartDate = new DateTime(today.Year, today.Month, 1).AddMonths(1),
            EndDate = new DateTime(today.Year, today.Month, 1).AddYears(1),
            RentAmount = 1800m,
            RentFrequency = "Monthly",
            RentDueDay = 1,
            Tenants =
            [
                new LoadTenantDto
                {
                    Id = 503,
                    Firstname = "Unrelated",
                    Lastname = "Tenant",
                    Email = "unrelated@example.test",
                    PhoneNumber = "312-555-0100",
                    IsActive = true
                }
            ]
        };

        var leases = new Mock<ILeaseRepository>(MockBehavior.Strict);
        leases.Setup(repository => repository.GetLeasesByOrganizationId(OrganizationId, false))
            .ReturnsAsync([lease, currentLease]);
        var payments = new Mock<IPaymentRepository>(MockBehavior.Strict);
        payments.Setup(repository => repository.GetLifetimeRentPaymentsByOrganizationId(OrganizationId))
            .ReturnsAsync(new List<LoadPaymentDto>());
        var model = new Mock<IOpenAIService>(MockBehavior.Strict);
        model.Setup(service => service.GenerateJsonAsync<AICopilotService.PercyReadPlan>(It.IsAny<string>(), 300))
            .ReturnsAsync(ServiceResponse<AICopilotService.PercyReadPlan>.CreateSuccess(new()
            {
                Scopes = ["rent-payments"]
            }));
        model.Setup(service => service.GenerateJsonAsync<PercyChatResponseDto>(It.IsAny<string>(), 1800))
            .ReturnsAsync(ServiceResponse<PercyChatResponseDto>.CreateSuccess(new()
            {
                Content = "I can't provide the tenant's name based on the available data.",
                ActivityLabel = "Tenant inquiry"
            }));
        var service = Service(db, leases.Object, payments.Object, model.Object);

        var overdue = await service.ChatAsync(OrganizationId, UserId, new()
        {
            ClientRequestId = "overdue-tenant-context-001",
            Message = "Which tenants are behind on rent?"
        });
        var tenant = await service.ChatAsync(OrganizationId, UserId, new()
        {
            ClientRequestId = "overdue-tenant-followup-001",
            ConversationId = overdue.Data!.ConversationId,
            Message = "who is the tenant for this lease"
        });

        tenant.Success.Should().BeTrue();
        tenant.Data!.Content.Should().ContainAll(
            "Jordan Lee", "jordan.lee@example.test", "312-555-0198",
            "Casey Morgan", "casey.morgan@example.test");
        tenant.Data.Content.Should().NotContain("[PERSON]").And.NotContain("[EMAIL]").And.NotContain("[PHONE]");
        tenant.Data.Content.Should().NotContain("Unrelated Tenant").And.NotContain("unrelated@example.test");
        tenant.Data.Items.Should().HaveCount(2);
        tenant.Data.Items.Should().NotContain(item => item.Title.Contains("Unrelated", StringComparison.OrdinalIgnoreCase));
        tenant.Data.Sources.Should().ContainSingle(source => source.Kind == "rent-payments");
        leases.Verify(repository => repository.GetLeasesByOrganizationId(OrganizationId, false), Times.Exactly(2));
        model.Verify(service => service.GenerateJsonAsync<AICopilotService.PercyReadPlan>(It.IsAny<string>(), 300), Times.Never);
        model.Verify(service => service.GenerateJsonAsync<PercyChatResponseDto>(It.IsAny<string>(), 1800), Times.Never);
    }

    [Fact]
    public async Task Chat_TenantQuestionAfterUnmarkedOverdueMetadata_DoesNotRevealTenantData()
    {
        await using var db = Db();
        SeedAuthority(db);
        var conversation = new PercyConversation
        {
            OrganizationId = OrganizationId,
            UserId = UserId,
            Title = "General rent question",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Messages =
            [
                new PercyMessage
                {
                    Role = "user",
                    Content = "I was reading about overdue rent.",
                    CreatedAt = DateTime.UtcNow.AddSeconds(-1)
                },
                new PercyMessage
                {
                    Role = "assistant",
                    Content = "1 lease has overdue rent.",
                    ResponseJson = System.Text.Json.JsonSerializer.Serialize(new PercyChatResponseDto
                    {
                        Content = "1 lease has overdue rent.",
                        ActivityLabel = "Rent status",
                        ActivityStatus = "1 overdue lease",
                        Sources = [new PercySourceDto { Kind = "rent-payments", Label = "Rent payments" }]
                    }),
                    CreatedAt = DateTime.UtcNow
                }
            ]
        };
        db.PercyConversations.Add(conversation);
        db.SaveChanges();

        var leases = new Mock<ILeaseRepository>(MockBehavior.Strict);
        var payments = new Mock<IPaymentRepository>(MockBehavior.Strict);
        var model = new Mock<IOpenAIService>(MockBehavior.Strict);
        model.Setup(service => service.GenerateJsonAsync<AICopilotService.PercyReadPlan>(It.IsAny<string>(), 300))
            .ReturnsAsync(ServiceResponse<AICopilotService.PercyReadPlan>.CreateSuccess(new()
            {
                AnswerWithoutOrganizationData = true
            }));
        model.Setup(service => service.GenerateJsonAsync<PercyChatResponseDto>(It.IsAny<string>(), 1800))
            .ReturnsAsync(ServiceResponse<PercyChatResponseDto>.CreateSuccess(new()
            {
                Content = "Which tenant or lease do you mean?",
                ActivityLabel = "Tenant inquiry"
            }));
        var service = Service(db, leases.Object, payments.Object, model.Object);

        var result = await service.ChatAsync(OrganizationId, UserId, new()
        {
            ClientRequestId = "tenant-no-authoritative-overdue-001",
            ConversationId = conversation.Id,
            Message = "who is the tenant"
        });

        result.Success.Should().BeTrue();
        result.Data!.Content.Should().Be("Which tenant or lease do you mean?");
        leases.VerifyNoOtherCalls();
        payments.VerifyNoOtherCalls();
    }

    private static void SeedAuthority(DataContext db)
    {
        db.Organizations.Add(new Organization { Id = OrganizationId, Name = "Org", IsActive = true });
        db.Users.Add(new User { Id = UserId, FirstName = "Percy", Email = "percy@example.test" });
        db.OrganizationMembers.Add(new OrganizationMember
        {
            OrganizationId = OrganizationId,
            UserId = UserId,
            Role = "Viewer",
            IsActive = true
        });
        db.SaveChanges();
    }

    private static DataContext Db() => new(new DbContextOptionsBuilder<DataContext>()
        .UseInMemoryDatabase($"percy-overdue-tenant-{Guid.NewGuid()}", options => options.EnableNullChecks(false)).Options);

    private static AICopilotService Service(
        DataContext db,
        ILeaseRepository leases,
        IPaymentRepository payments,
        IOpenAIService model)
    {
        return new AICopilotService(
            Mock.Of<IPropertyRepository>(),
            Mock.Of<ITenantRepository>(),
            leases,
            payments,
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
}
