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
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.WrenActions;

public sealed class WrenChatIdempotencyTests
{
    private const long OrganizationId = 901;
    private const long UserId = 902;

    [Fact]
    public async Task Chat_RequiresStableBoundedClientRequestId()
    {
        await using var db = Db();
        SeedAuthority(db);
        var service = Service(db, Mock.Of<IOpenAIService>());

        var missing = await service.ChatAsync(OrganizationId, UserId, new() { Message = "portfolio" });
        var malformed = await service.ChatAsync(OrganizationId, UserId,
            new() { ClientRequestId = "spaces are unsafe", Message = "portfolio" });

        missing.Success.Should().BeFalse();
        missing.StatusCode.Should().Be(400);
        malformed.Success.Should().BeFalse();
        malformed.StatusCode.Should().Be(400);
        db.WrenChatOperations.Should().BeEmpty();
    }

    [Fact]
    public async Task Chat_SameScopedKeyAndCanonicalPayload_ReplaysGeneratedTitleWithoutMessagesOrModelWork()
    {
        await using var db = Db();
        SeedAuthority(db);
        var model = Model();
        var service = Service(db, model.Object);
        var request = new WrenChatRequestDto { ClientRequestId = "stable-chat-key-001", Message = "Could you give me a quick portfolio overview?" };

        var first = await service.ChatAsync(OrganizationId, UserId, request);
        var second = await service.ChatAsync(OrganizationId, UserId,
            new() { ClientRequestId = request.ClientRequestId, Message = $"  {request.Message}  " });

        first.Success.Should().BeTrue();
        first.Data!.ConversationTitle.Should().Be("Portfolio overview");
        second.Data.Should().BeEquivalentTo(first.Data);
        (await db.WrenMessages.CountAsync()).Should().Be(2);
        var operation = await db.WrenChatOperations.AsNoTracking().SingleAsync();
        operation.Status.Should().Be("completed");
        operation.ConversationId.Should().Be(first.Data!.ConversationId);
        operation.UserMessageId.Should().Be(first.Data.UserMessageId);
        operation.AssistantMessageId.Should().Be(first.Data.AssistantMessageId);
        operation.CompletedResponseJson.Should().NotBeNullOrWhiteSpace();
        model.Verify(x => x.GenerateJsonAsync<AICopilotService.WrenReadPlan>(It.IsAny<string>(), 300), Times.Once);
        model.Verify(x => x.GenerateJsonAsync<WrenChatResponseDto>(
            It.Is<string>(prompt => prompt.Contains("Summarize the user's request")), 1800), Times.Once);

        model.Setup(x => x.GenerateJsonAsync<WrenChatResponseDto>(It.IsAny<string>(), 1800))
            .ReturnsAsync(ServiceResponse<WrenChatResponseDto>.CreateSuccess(new()
            {
                Content = "More portfolio details", ConversationTitle = "Changed title"
            }));
        var followUp = await service.ChatAsync(OrganizationId, UserId, new()
        {
            ClientRequestId = "stable-chat-follow-up-001",
            ConversationId = first.Data.ConversationId,
            Message = "Include more detail"
        });

        followUp.Data!.ConversationTitle.Should().Be("Portfolio overview");
        (await service.GetConversationAsync(OrganizationId, UserId, first.Data.ConversationId)).Data!.Title.Should().Be("Portfolio overview");
        (await service.ListConversationsAsync(OrganizationId, UserId)).Data!.Should().ContainSingle()
            .Which.Title.Should().Be("Portfolio overview");
    }

    [Fact]
    public async Task Chat_SameScopedKeyWithDifferentPayload_Conflicts_AndScopeIsUniqueContract()
    {
        await using var db = Db();
        SeedAuthority(db);
        var service = Service(db, Model().Object);
        await service.ChatAsync(OrganizationId, UserId,
            new() { ClientRequestId = "stable-chat-key-002", Message = "portfolio overview" });

        var conflict = await service.ChatAsync(OrganizationId, UserId,
            new() { ClientRequestId = "stable-chat-key-002", Message = "maintenance overview" });

        conflict.Success.Should().BeFalse();
        conflict.StatusCode.Should().Be(409);
        (await db.WrenMessages.CountAsync()).Should().Be(2);
        var entity = db.Model.FindEntityType(typeof(WrenChatOperation))!;
        entity.GetIndexes().Should().Contain(index => index.IsUnique &&
            index.Properties.Select(x => x.Name).SequenceEqual(new[] { "OrganizationId", "UserId", "ClientRequestId" }));
    }

    [Fact]
    public async Task Chat_PersistsAssistantResponseAndCompletedReceiptTogether()
    {
        await using var db = Db();
        SeedAuthority(db);
        var service = Service(db, Model().Object);

        var result = await service.ChatAsync(OrganizationId, UserId,
            new() { ClientRequestId = "atomic-response-001", Message = "portfolio overview" });

        result.Success.Should().BeTrue();
        var assistant = await db.WrenMessages.AsNoTracking().SingleAsync(x => x.Role == "assistant");
        assistant.Content.Should().Be(result.Data!.Content);
        assistant.ResponseJson.Should().Contain("Portfolio");
        (await db.WrenChatOperations.AsNoTracking().SingleAsync()).CompletedResponseJson.Should().Be(assistant.ResponseJson);
    }

    [Fact]
    public async Task Chat_WritesRedactedStartedCompletedAndReplayAuditLifecycle()
    {
        await using var db = Db();
        SeedAuthority(db);
        var service = Service(db, Model().Object);
        const string secret = "Ada Tenant at 499 Private Road";
        var request = new WrenChatRequestDto { ClientRequestId = "audit-lifecycle-001", Message = secret };

        (await service.ChatAsync(OrganizationId, UserId, request)).Success.Should().BeTrue();
        (await service.ChatAsync(OrganizationId, UserId, request)).Success.Should().BeTrue();

        (await db.WrenChatOperations.AsNoTracking().SingleAsync()).Status.Should().Be("completed");
        var audits = await db.WrenAuditRecords.AsNoTracking().OrderBy(x => x.Id).ToListAsync();
        audits.Select(x => x.EventType).Should().Equal("chat_started", "chat_completed", "chat_replay");
        audits.Should().OnlyContain(x => x.OrganizationId == OrganizationId && x.UserId == UserId &&
            !x.Detail.Contains("Ada") && !x.Detail.Contains("Private Road") && !x.EventKey.Contains(secret));
    }

    [Fact]
    public async Task Chat_EarlyConversationRejection_TerminalizesOperationAndAuditsRejection()
    {
        await using var db = Db();
        SeedAuthority(db);
        var service = Service(db, Model().Object);

        var result = await service.ChatAsync(OrganizationId, UserId, new()
        {
            ClientRequestId = "missing-conversation-001", ConversationId = 884422, Message = "portfolio"
        });

        result.StatusCode.Should().Be(404);
        (await db.WrenChatOperations.AsNoTracking().SingleAsync()).Status.Should().Be("rejected");
        (await db.WrenAuditRecords.AsNoTracking().Select(x => x.EventType).ToListAsync())
            .Should().Equal("chat_started", "chat_rejected");
    }

    [Fact]
    public async Task Chat_Exception_TerminalizesOperationAndWritesGenericFailureAudit()
    {
        await using var db = Db();
        SeedAuthority(db);
        var model = Model();
        model.Setup(x => x.GenerateJsonAsync<WrenChatResponseDto>(It.IsAny<string>(), 1800))
            .ThrowsAsync(new InvalidOperationException("Ada Tenant secret failure"));
        var service = Service(db, model.Object);

        var result = await service.ChatAsync(OrganizationId, UserId, new()
        {
            ClientRequestId = "failed-chat-001", Message = "portfolio"
        });

        result.StatusCode.Should().Be(500);
        (await db.WrenChatOperations.AsNoTracking().SingleAsync()).Status.Should().Be("failed");
        var audits = await db.WrenAuditRecords.AsNoTracking().OrderBy(x => x.Id).ToListAsync();
        audits.Select(x => x.EventType).Should().Equal("chat_started", "chat_failed");
        audits.Should().OnlyContain(x => !x.Detail.Contains("Ada") && !x.Detail.Contains("secret"));
    }

    [Fact]
    public async Task PropertyChat_PersistsAssociation_AndArchivesOnlyForItsOwner()
    {
        await using var db = Db();
        SeedAuthority(db);
        const long propertyId = 903;
        db.Properties.Add(new Property { Id = propertyId, OrganizationId = OrganizationId, LandlordId = UserId });
        await db.SaveChangesAsync();
        var service = Service(db, Model().Object);

        var created = await service.ChatAsync(OrganizationId, UserId,
            new() { ClientRequestId = "property-chat-create", Message = "portfolio overview", PropertyId = propertyId });
        created.Success.Should().BeTrue();
        var id = created.Data!.ConversationId;

        var otherProperty = await service.ChatAsync(OrganizationId, UserId,
            new() { ClientRequestId = "property-chat-create", Message = "portfolio overview", PropertyId = propertyId + 1 });
        otherProperty.StatusCode.Should().Be(409);

        var continued = await service.ChatAsync(OrganizationId, UserId,
            new() { ClientRequestId = "property-chat-continue", Message = "portfolio overview", ConversationId = id });
        continued.Success.Should().BeTrue();
        (await service.ListConversationsAsync(OrganizationId, UserId)).Data.Should()
            .ContainSingle(chat => chat.Id == id && chat.PropertyId == propertyId);
        (await service.GetConversationAsync(OrganizationId, UserId, id)).Data!.PropertyId.Should().Be(propertyId);
        (await service.ArchiveConversationAsync(OrganizationId, UserId + 1, id)).StatusCode.Should().Be(404);
        (await service.ArchiveConversationAsync(OrganizationId, UserId, id)).Success.Should().BeTrue();
        (await service.ListConversationsAsync(OrganizationId, UserId)).Data.Should().BeEmpty();
        (await service.GetConversationAsync(OrganizationId, UserId, id)).Data!.Messages.Should().HaveCount(4);
    }

    [Fact]
    public async Task PropertyChat_RejectsPropertyOutsideCurrentOrganization()
    {
        await using var db = Db();
        SeedAuthority(db);
        const long propertyId = 903;
        db.Properties.Add(new Property { Id = propertyId, OrganizationId = OrganizationId + 1, LandlordId = UserId });
        await db.SaveChangesAsync();
        var service = Service(db, Mock.Of<IOpenAIService>());

        var result = await service.ChatAsync(OrganizationId, UserId,
            new() { ClientRequestId = "property-chat-forbidden", Message = "portfolio overview", PropertyId = propertyId });

        result.StatusCode.Should().Be(404);
        db.WrenConversations.Should().BeEmpty();
    }

    private static Mock<IOpenAIService> Model()
    {
        var model = new Mock<IOpenAIService>(MockBehavior.Strict);
        model.Setup(x => x.GenerateJsonAsync<AICopilotService.WrenReadPlan>(It.IsAny<string>(), 300))
            .ReturnsAsync(ServiceResponse<AICopilotService.WrenReadPlan>.CreateSuccess(new() { Scopes = [] }));
        model.Setup(x => x.GenerateJsonAsync<WrenChatResponseDto>(It.IsAny<string>(), 1800))
            .ReturnsAsync(ServiceResponse<WrenChatResponseDto>.CreateSuccess(new()
            {
                Content = "Portfolio answer", ActivityLabel = "Portfolio", ConversationTitle = "Portfolio overview"
            }));
        return model;
    }

    private static void SeedAuthority(DataContext db)
    {
        db.Organizations.Add(new Organization { Id = OrganizationId, Name = "Org", IsActive = true });
        db.Users.Add(new User { Id = UserId, FirstName = "Wren", Email = "idempotency@example.test" });
        db.OrganizationMembers.Add(new OrganizationMember
        {
            OrganizationId = OrganizationId, UserId = UserId, Role = "Viewer", IsActive = true
        });
        db.SaveChanges();
    }

    private static DataContext Db() => new(new DbContextOptionsBuilder<DataContext>()
        .UseInMemoryDatabase($"wren-idempotency-{Guid.NewGuid()}", options => options.EnableNullChecks(false)).Options);

    private static AICopilotService Service(DataContext db, IOpenAIService model)
    {
        var properties = new Mock<IPropertyRepository>();
        properties.Setup(x => x.GetPropertiesByOrganizationId(OrganizationId))
            .ReturnsAsync(new List<brownstone_hub_api.Dtos.Property.LoadPropertyDto>());
        return new(
            properties.Object, Mock.Of<ITenantRepository>(), Mock.Of<ILeaseRepository>(),
            Mock.Of<IPaymentRepository>(), Mock.Of<IMaintenanceRequestRepository>(), Mock.Of<IApplicationRepository>(),
            Mock.Of<IChecklistRepository>(), Mock.Of<IConversationRepository>(), Mock.Of<IActionSuppressionService>(),
            Mock.Of<IUserRepository>(), db, model, NullLogger<AICopilotService>.Instance);
    }
}
