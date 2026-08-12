using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.AICopilot;
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
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.PercyActions;

public sealed class PercyConfirmationPolicyTests
{
    private const long OrganizationId = 10;
    private const long UserId = 20;

    [Fact]
    public async Task Chat_DisabledCollectionsAction_ReturnsStableUnavailable_WithoutPendingConfirmation()
    {
        await using var db = Db();
        SeedAuthority(db, "Manager", active: true, canManageBilling: true);
        var service = Service(db);

        var result = await service.ChatAsync(OrganizationId, UserId,
            new PercyChatRequestDto { ClientRequestId = "collections-attempt-001", Message = "Send the overdue rent collections follow-ups" });

        result.Success.Should().BeFalse();
        result.StatusCode.Should().Be(409);
        result.Message.Should().Be("percy_action_unavailable");
        db.PercyActionConfirmations.Should().BeEmpty();
        var operation = await db.PercyChatOperations.AsNoTracking().SingleAsync();
        operation.Status.Should().Be("rejected");
        var audits = await db.PercyAuditRecords.AsNoTracking().OrderBy(x => x.Id).ToListAsync();
        audits.Select(x => x.EventType).Should().Equal("chat_started", "chat_rejected");
        audits.Last().Outcome.Should().Be("unavailable");
        audits.Should().OnlyContain(a => !a.Detail.Contains("overdue") && !a.Detail.Contains("rent") &&
            !a.Detail.Contains("follow-ups"));

        var replay = await service.ChatAsync(OrganizationId, UserId,
            new PercyChatRequestDto { ClientRequestId = "collections-attempt-001", Message = "Send the overdue rent collections follow-ups" });
        replay.StatusCode.Should().Be(409);
        (await db.PercyChatOperations.CountAsync()).Should().Be(1);
        (await db.PercyAuditRecords.CountAsync(x => x.EventType == "chat_replay")).Should().Be(1);
    }

    [Theory]
    [InlineData(PercyActionTypes.CollectionsOrganizationFollowUp, "Manager", true, true, "failed", "unavailable")]
    [InlineData("unknown.action", "Owner", true, false, "denied", "rejected")]
    [InlineData(PercyActionTypes.ReadPortfolio, "Owner", true, false, "failed", "no_executor")]
    [InlineData(PercyActionTypes.CollectionsOrganizationFollowUp, "Viewer", true, false, "denied", "denied")]
    [InlineData(PercyActionTypes.CollectionsOrganizationFollowUp, "Manager", false, true, "denied", "denied")]
    [InlineData(PercyActionTypes.CollectionsOrganizationFollowUp, "UnexpectedRole", true, true, "denied", "denied")]
    public async Task Confirm_ReevaluatesStoredActionAndCurrentAuthority_AndWritesTerminalAuditAtomically(
        string actionType, string role, bool active, bool canManageBilling, string expectedStatus, string expectedOutcome)
    {
        await using var db = Db();
        var confirmation = SeedConfirmation(db, actionType, role, active, canManageBilling);
        var service = Service(db);

        var result = await service.ConfirmActionAsync(
            OrganizationId, UserId, confirmation.Id, CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Data!.Status.Should().Be(expectedStatus);
        var stored = await db.PercyActionConfirmations.AsNoTracking().SingleAsync();
        stored.Status.Should().Be(expectedStatus);
        stored.ResolvedAt.Should().NotBeNull();
        var audit = await db.PercyAuditRecords.AsNoTracking().SingleAsync();
        audit.ConfirmationId.Should().Be(confirmation.Id);
        audit.Outcome.Should().Be(expectedOutcome);
        expectedOutcome.Should().NotBe("executed");
    }

    [Fact]
    public async Task Confirm_Replay_WritesSeparateRedactedAttemptAudit_WithoutDuplicatingTerminalTransition()
    {
        await using var db = Db();
        var confirmation = SeedConfirmation(db, PercyActionTypes.CollectionsOrganizationFollowUp,
            "Manager", active: true, canManageBilling: true);
        confirmation.ActionPayloadJson = "{\"tenant\":\"Arbitrary Fullname\",\"address\":\"99999 Private Highway\"}";
        confirmation.FriendlyLabel = "Contact Arbitrary Fullname at 99999 Private Highway";
        await db.SaveChangesAsync();
        var service = Service(db);

        await service.ConfirmActionAsync(OrganizationId, UserId, confirmation.Id);
        await service.ConfirmActionAsync(OrganizationId, UserId, confirmation.Id);

        var audits = await db.PercyAuditRecords.AsNoTracking().OrderBy(x => x.Id).ToListAsync();
        audits.Should().HaveCount(2);
        audits.Count(x => x.EventType == "confirmation_confirmed").Should().Be(1);
        audits.Count(x => x.EventType == "confirmation_replay").Should().Be(1);
        audits.Should().OnlyContain(x => !x.Detail.Contains("Arbitrary Fullname") &&
            !x.Detail.Contains("99999 Private Highway") && !x.Detail.Contains("tenant"));
        (await db.PercyActionConfirmations.AsNoTracking().SingleAsync()).Status.Should().Be("failed");
    }

    private static PercyActionConfirmation SeedConfirmation(
        DataContext db, string actionType, string role, bool active, bool canManageBilling)
    {
        SeedAuthority(db, role, active, canManageBilling);
        var conversation = new PercyConversation
        {
            OrganizationId = OrganizationId,
            UserId = UserId,
            Title = "test"
        };
        var confirmation = new PercyActionConfirmation
        {
            OrganizationId = OrganizationId,
            UserId = UserId,
            Conversation = conversation,
            ActionType = actionType,
            FriendlyLabel = "test action",
            Status = "pending",
            ExpiresAt = DateTime.UtcNow.AddMinutes(10)
        };
        db.PercyActionConfirmations.Add(confirmation);
        db.SaveChanges();
        return confirmation;
    }

    private static void SeedAuthority(DataContext db, string role, bool active, bool canManageBilling)
    {
        db.Organizations.Add(new Organization { Id = OrganizationId, Name = "Org", IsActive = true });
        db.Users.Add(new User { Id = UserId, FirstName = "Percy", Email = "percy@example.test" });
        db.OrganizationMembers.Add(new OrganizationMember
        {
            OrganizationId = OrganizationId,
            UserId = UserId,
            Role = role,
            IsActive = active,
            CanManageBilling = canManageBilling
        });
        db.SaveChanges();
    }

    private static DataContext Db() => new(new DbContextOptionsBuilder<DataContext>()
        .UseInMemoryDatabase($"percy-actions-{Guid.NewGuid()}", options => options.EnableNullChecks(false))
        .Options);

    private static AICopilotService Service(DataContext db) => new(
        Mock.Of<IPropertyRepository>(),
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
        Mock.Of<IOpenAIService>(),
        NullLogger<AICopilotService>.Instance);
}
