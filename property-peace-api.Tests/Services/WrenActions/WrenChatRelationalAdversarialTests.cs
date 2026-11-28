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
using brownstone_hub_api.Services.WrenActions;
using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.WrenActions;

public sealed class WrenChatRelationalAdversarialTests
{
    [Theory]
    [InlineData(false, "processing")]
    [InlineData(true, "payload_mismatch")]
    public async Task SimultaneousSeparateContexts_DuplicateOrConflictingRequest_HasSingleDurableWinner(
        bool differentPayload, string expectedConflictOutcome)
    {
        await using var database = await RelationalDatabase.CreateAsync();
        var releaseModel = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        var modelEntered = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        var model = BlockingModel(modelEntered, releaseModel);
        await using var winnerDb = database.Context();
        await using var contenderDb = database.Context();
        var winner = Service(winnerDb, model.Object);
        var contender = Service(contenderDb, model.Object);
        var firstRequest = new WrenChatRequestDto
        {
            ClientRequestId = "relational-race-key-001", Message = "portfolio overview"
        };

        var firstTask = winner.ChatAsync(101, 201, firstRequest);
        await modelEntered.Task.WaitAsync(TimeSpan.FromSeconds(10));
        var second = await contender.ChatAsync(101, 201, new WrenChatRequestDto
        {
            ClientRequestId = firstRequest.ClientRequestId,
            Message = differentPayload ? "maintenance overview" : firstRequest.Message
        });
        releaseModel.SetResult(true);
        var first = await firstTask;

        first.Success.Should().BeTrue();
        second.StatusCode.Should().Be(409);
        await using var observer = database.Context();
        (await observer.WrenChatOperations.CountAsync()).Should().Be(1);
        (await observer.WrenMessages.CountAsync()).Should().Be(2);
        (await observer.WrenAuditRecords.CountAsync(x => x.EventType == "chat_completed")).Should().Be(1);
        (await observer.WrenAuditRecords.SingleAsync(x => x.EventType == "chat_conflict"))
            .Outcome.Should().Be(expectedConflictOutcome);
        model.Verify(x => x.GenerateJsonAsync<WrenChatResponseDto>(It.IsAny<string>(), 1800), Times.Once);
    }

    [Fact]
    public async Task ScopedReplay_UsesOrganizationAndUserBoundaryAcrossSeparateContexts()
    {
        await using var database = await RelationalDatabase.CreateAsync();
        var model = CompletedModel();
        var request = new WrenChatRequestDto { ClientRequestId = "scoped-replay-key-001", Message = "portfolio overview" };

        await using (var db = database.Context())
            (await Service(db, model.Object).ChatAsync(101, 201, request)).Success.Should().BeTrue();
        await using (var db = database.Context())
            (await Service(db, model.Object).ChatAsync(101, 201, request)).Success.Should().BeTrue();
        await using (var db = database.Context())
            (await Service(db, model.Object).ChatAsync(101, 202, request)).Success.Should().BeTrue();
        await using (var db = database.Context())
            (await Service(db, model.Object).ChatAsync(102, 201, request)).Success.Should().BeTrue();

        await using var observer = database.Context();
        (await observer.WrenChatOperations.CountAsync()).Should().Be(3);
        (await observer.WrenMessages.CountAsync()).Should().Be(6);
        (await observer.WrenAuditRecords.CountAsync(x => x.EventType == "chat_replay")).Should().Be(1);
        model.Verify(x => x.GenerateJsonAsync<WrenChatResponseDto>(It.IsAny<string>(), 1800), Times.Exactly(3));
    }

    [Fact]
    public async Task SimultaneousConfirmationResolution_HasOneTerminalAuditAndOneReplay()
    {
        await using var database = await RelationalDatabase.CreateAsync();
        long confirmationId;
        await using (var seed = database.Context())
        {
            var conversation = new WrenConversation
            {
                OrganizationId = 101, UserId = 201, Title = "confirmation race"
            };
            var confirmation = new WrenActionConfirmation
            {
                OrganizationId = 101,
                UserId = 201,
                Conversation = conversation,
                ActionType = WrenActionTypes.ReadPortfolio,
                ActionPayloadJson = "{}",
                FriendlyLabel = "generic action",
                Status = "pending",
                ExpiresAt = DateTime.UtcNow.AddMinutes(10)
            };
            seed.WrenActionConfirmations.Add(confirmation);
            await seed.SaveChangesAsync();
            confirmationId = confirmation.Id;
        }

        await using var firstDb = database.Context();
        await using var secondDb = database.Context();
        var results = await Task.WhenAll(
            Service(firstDb, Mock.Of<IOpenAIService>()).ConfirmActionAsync(101, 201, confirmationId),
            Service(secondDb, Mock.Of<IOpenAIService>()).ConfirmActionAsync(101, 201, confirmationId));

        results.Should().OnlyContain(x => x.Success);
        await using var observer = database.Context();
        (await observer.WrenActionConfirmations.SingleAsync()).Status.Should().NotBe("pending");
        (await observer.WrenAuditRecords.CountAsync(x => x.EventType == "confirmation_confirmed")).Should().Be(1);
        (await observer.WrenAuditRecords.CountAsync(x => x.EventType == "confirmation_replay")).Should().Be(1);
    }

    [Fact]
    public async Task DeleteConversation_RemovesAllConversationData_AndKeepsOtherScopesIntact()
    {
        await using var database = await RelationalDatabase.CreateAsync();
        await using var db = database.Context();

        var deletedConversation = new WrenConversation
        {
            OrganizationId = 101,
            UserId = 201,
            Title = "delete me",
            Messages =
            [
                new WrenMessage { Role = "user", Content = "question" },
                new WrenMessage { Role = "assistant", Content = "answer" }
            ]
        };
        var retainedConversation = new WrenConversation
        {
            OrganizationId = 101,
            UserId = 202,
            PropertyId = 301,
            Title = "keep me",
            Messages = [new WrenMessage { Role = "user", Content = "retained" }]
        };
        db.WrenConversations.AddRange(deletedConversation, retainedConversation);
        await db.SaveChangesAsync();

        var confirmation = new WrenActionConfirmation
        {
            OrganizationId = 101,
            UserId = 201,
            ConversationId = deletedConversation.Id,
            ActionType = WrenActionTypes.ReadPortfolio,
            FriendlyLabel = "delete confirmation",
            ExpiresAt = DateTime.UtcNow.AddMinutes(10)
        };
        db.WrenActionConfirmations.Add(confirmation);
        await db.SaveChangesAsync();

        db.WrenChatOperations.Add(new WrenChatOperation
        {
            OrganizationId = 101,
            UserId = 201,
            ClientRequestId = "delete-operation",
            RequestHash = "hash",
            Status = "completed",
            ConversationId = deletedConversation.Id,
            UserMessageId = deletedConversation.Messages.ElementAt(0).Id,
            AssistantMessageId = deletedConversation.Messages.ElementAt(1).Id,
            LeaseExpiresAt = DateTime.UtcNow.AddMinutes(5)
        });
        db.WrenAuditRecords.AddRange(
            new WrenAuditRecord
            {
                OrganizationId = 101,
                UserId = 201,
                ConversationId = deletedConversation.Id,
                EventKey = "delete-conversation-audit",
                EventType = "chat_completed",
                Outcome = "completed",
                Detail = "delete"
            },
            new WrenAuditRecord
            {
                OrganizationId = 101,
                UserId = 201,
                ConfirmationId = confirmation.Id,
                EventKey = "delete-confirmation-audit",
                EventType = "confirmation_confirmed",
                Outcome = "failed",
                Detail = "delete"
            },
            new WrenAuditRecord
            {
                OrganizationId = 101,
                UserId = 202,
                ConversationId = retainedConversation.Id,
                EventKey = "retain-audit",
                EventType = "chat_completed",
                Outcome = "completed",
                Detail = "keep"
            });
        await db.SaveChangesAsync();

        var result = await Service(db, Mock.Of<IOpenAIService>())
            .DeleteConversationAsync(101, 201, deletedConversation.Id);

        result.Success.Should().BeTrue();
        result.Message.Should().Be("Conversation deleted.");
        (await db.WrenConversations.AsNoTracking().Select(x => x.Id).ToListAsync()).Should().Equal(retainedConversation.Id);
        (await db.WrenMessages.AsNoTracking().Select(x => x.Content).ToListAsync()).Should().Equal("retained");
        db.WrenActionConfirmations.Should().BeEmpty();
        db.WrenChatOperations.Should().BeEmpty();
        (await db.WrenAuditRecords.AsNoTracking().Select(x => x.EventKey).ToListAsync()).Should().Equal("retain-audit");
        var retainedHistory = await Service(db, Mock.Of<IOpenAIService>()).ListConversationsAsync(101, 202);
        retainedHistory.Data.Should().ContainSingle(chat => chat.Id == retainedConversation.Id && chat.PropertyId == 301);
    }

    private static Mock<IOpenAIService> BlockingModel(
        TaskCompletionSource<bool> entered, TaskCompletionSource<bool> release)
    {
        var model = CompletedModel();
        model.Setup(x => x.GenerateJsonAsync<WrenChatResponseDto>(It.IsAny<string>(), 1800))
            .Returns(async () =>
            {
                entered.TrySetResult(true);
                await release.Task;
                return ServiceResponse<WrenChatResponseDto>.CreateSuccess(new()
                {
                    Content = "Relational answer", ActivityLabel = "Portfolio"
                });
            });
        return model;
    }

    private static Mock<IOpenAIService> CompletedModel()
    {
        var model = new Mock<IOpenAIService>(MockBehavior.Strict);
        model.Setup(x => x.GenerateJsonAsync<AICopilotService.WrenReadPlan>(It.IsAny<string>(), 300))
            .ReturnsAsync(ServiceResponse<AICopilotService.WrenReadPlan>.CreateSuccess(new() { Scopes = [] }));
        model.Setup(x => x.GenerateJsonAsync<WrenChatResponseDto>(It.IsAny<string>(), 1800))
            .ReturnsAsync(ServiceResponse<WrenChatResponseDto>.CreateSuccess(new()
            {
                Content = "Relational answer", ActivityLabel = "Portfolio"
            }));
        return model;
    }

    private static AICopilotService Service(DataContext db, IOpenAIService model)
    {
        var properties = new Mock<IPropertyRepository>();
        properties.Setup(x => x.GetPropertiesByOrganizationId(It.IsAny<long>()))
            .ReturnsAsync(new List<brownstone_hub_api.Dtos.Property.LoadPropertyDto>());
        return new(properties.Object, Mock.Of<ITenantRepository>(), Mock.Of<ILeaseRepository>(),
            Mock.Of<IPaymentRepository>(), Mock.Of<IMaintenanceRequestRepository>(), Mock.Of<IApplicationRepository>(),
            Mock.Of<IChecklistRepository>(), Mock.Of<IConversationRepository>(), Mock.Of<IActionSuppressionService>(),
            Mock.Of<IUserRepository>(), db, model, NullLogger<AICopilotService>.Instance);
    }

    private sealed class RelationalDatabase : IAsyncDisposable
    {
        private readonly string path;
        private readonly DbContextOptions<DataContext> options;

        private RelationalDatabase(string path)
        {
            this.path = path;
            options = new DbContextOptionsBuilder<DataContext>()
                .UseSqlite($"Data Source={path};Default Timeout=10;Foreign Keys=False")
                .Options;
        }

        public static async Task<RelationalDatabase> CreateAsync()
        {
            var database = new RelationalDatabase(Path.Combine(Path.GetTempPath(), $"wren-chat-{Guid.NewGuid():N}.db"));
            await using var db = database.Context();
            await db.Database.ExecuteSqlRawAsync("""
                CREATE TABLE Organizations (Id INTEGER PRIMARY KEY, IsActive INTEGER NOT NULL, IsDeleted INTEGER NOT NULL);
                CREATE TABLE Users (Id INTEGER PRIMARY KEY);
                CREATE TABLE OrganizationMembers (
                    Id INTEGER PRIMARY KEY AUTOINCREMENT, OrganizationId INTEGER NOT NULL, UserId INTEGER NOT NULL,
                    IsActive INTEGER NOT NULL, Role TEXT NOT NULL, CanManageProperties INTEGER NOT NULL,
                    CanManageTenants INTEGER NOT NULL, CanManageLeases INTEGER NOT NULL, CanManageMaintenance INTEGER NOT NULL,
                    CanManageBilling INTEGER NOT NULL, CanManageMembers INTEGER NOT NULL);
                CREATE TABLE Properties (Id INTEGER PRIMARY KEY, OrganizationId INTEGER NOT NULL, IsDeleted INTEGER NOT NULL,
                    Name TEXT, StreetAddress TEXT, City TEXT, State TEXT, ZipCode TEXT);
                CREATE TABLE Units (Id INTEGER PRIMARY KEY, PropertyId INTEGER NOT NULL, Name TEXT);
                CREATE TABLE Tenants (Id INTEGER PRIMARY KEY, OrganizationId INTEGER NOT NULL, IsDeleted INTEGER NOT NULL,
                    Firstname TEXT, Lastname TEXT);
                CREATE TABLE RentalApplications (Id INTEGER PRIMARY KEY, OrganizationId INTEGER NOT NULL,
                    FirstName TEXT, LastName TEXT, CurrentAddress TEXT);
                CREATE TABLE Conversations (
                    Id INTEGER PRIMARY KEY AUTOINCREMENT, OrganizationId INTEGER NOT NULL, UserId INTEGER NOT NULL,
                    PropertyId INTEGER, Title TEXT NOT NULL, IsArchived INTEGER NOT NULL,
                    CreatedAt TEXT NOT NULL, UpdatedAt TEXT NOT NULL, ArchivedAt TEXT);
                CREATE TABLE Messages (
                    Id INTEGER PRIMARY KEY AUTOINCREMENT, ConversationId INTEGER NOT NULL, Role TEXT NOT NULL,
                    Content TEXT NOT NULL, ResponseJson TEXT, CreatedAt TEXT NOT NULL);
                CREATE TABLE ChatOperations (
                    Id INTEGER PRIMARY KEY AUTOINCREMENT, OrganizationId INTEGER NOT NULL, UserId INTEGER NOT NULL,
                    ClientRequestId TEXT NOT NULL, RequestHash TEXT NOT NULL, Status TEXT NOT NULL,
                    ConversationId INTEGER, UserMessageId INTEGER, AssistantMessageId INTEGER, CompletedResponseJson TEXT,
                    CreatedAt TEXT NOT NULL, UpdatedAt TEXT NOT NULL, LeaseExpiresAt TEXT NOT NULL,
                    Version BLOB NOT NULL DEFAULT X'');
                CREATE UNIQUE INDEX IX_ChatOperations_Scope ON ChatOperations (OrganizationId, UserId, ClientRequestId);
                CREATE TABLE ActionConfirmations (
                    Id INTEGER PRIMARY KEY AUTOINCREMENT, OrganizationId INTEGER NOT NULL, UserId INTEGER NOT NULL,
                    ConversationId INTEGER NOT NULL, RequestedByMessageId INTEGER, ActionType TEXT NOT NULL,
                    ActionPayloadJson TEXT NOT NULL, FriendlyLabel TEXT NOT NULL, Status TEXT NOT NULL,
                    CreatedAt TEXT NOT NULL, ExpiresAt TEXT NOT NULL, ResolvedAt TEXT, ResolutionMessage TEXT,
                    Version BLOB NOT NULL DEFAULT X'');
                CREATE TABLE AuditRecords (
                    Id INTEGER PRIMARY KEY AUTOINCREMENT, OrganizationId INTEGER NOT NULL, UserId INTEGER NOT NULL,
                    ConversationId INTEGER, ConfirmationId INTEGER, EventKey TEXT NOT NULL, EventType TEXT NOT NULL,
                    Outcome TEXT NOT NULL, Detail TEXT NOT NULL, CreatedAt TEXT NOT NULL);
                CREATE UNIQUE INDEX IX_AuditRecords_EventKey ON AuditRecords (EventKey);
                INSERT INTO Organizations VALUES (101, 1, 0), (102, 1, 0);
                INSERT INTO Users VALUES (201), (202);
                INSERT INTO OrganizationMembers
                    (OrganizationId, UserId, IsActive, Role, CanManageProperties, CanManageTenants, CanManageLeases,
                     CanManageMaintenance, CanManageBilling, CanManageMembers)
                    VALUES (101, 201, 1, 'Viewer', 0, 0, 0, 0, 0, 0),
                           (101, 202, 1, 'Viewer', 0, 0, 0, 0, 0, 0),
                           (102, 201, 1, 'Viewer', 0, 0, 0, 0, 0, 0);
                """);
            return database;
        }

        public DataContext Context() => new(options);

        public ValueTask DisposeAsync()
        {
            SqliteConnection.ClearAllPools();
            try { System.IO.File.Delete(path); } catch (IOException) { }
            return ValueTask.CompletedTask;
        }
    }
}
