using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Timeline;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Timelines;
using brownstone_hub_api.Services.Timelines;
using brownstone_hub_api.Tests.Helpers;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Timelines;

public sealed class WorkflowProductionTimelineTests : IDisposable
{
    private readonly DataContext _db = DbContextFactory.Create();
    private readonly WorkflowTimelineIntegration _workflow;

    public WorkflowProductionTimelineTests()
    {
        var repository = new ConversationTimelineRepository(_db, NullLogger<ConversationTimelineRepository>.Instance,
            new ConversationTimelineSequenceAllocator());
        _workflow = new WorkflowTimelineIntegration(_db, repository, null!, TimeProvider.System,
            new ConversationContextService(_db));
    }

    public void Dispose() => _db.Dispose();

    [Fact]
    public async Task ApplicationTransition_CreatesApplicationLinkAndContextualEntry_FromSingleScopedConversation()
    {
        await SeedAsync(ambiguous: false);

        await _workflow.RecordApplicationTransitionAsync(100, 50, 2, "submitted", "Application submitted", "submit-50");

        _db.ConversationContextLinks.Should().ContainSingle(x => x.ConversationId == 10 && x.RentalApplicationId == 50);
        _db.ConversationTimelineEntries.Should().ContainSingle(x => x.OrganizationId == 100 && x.ConversationId == 10 &&
            x.ContextKind == "rentalapplication" && x.ContextId == 50 && x.Kind == TimelineEntryKind.StatusChanged);
    }

    [Fact]
    public async Task ScreeningTransitions_UseApplicationContext_AndMissingAmbiguousOrCrossOrgContextFailsClosed()
    {
        await SeedAsync(ambiguous: false);
        await _workflow.RecordApplicationTransitionAsync(100, 50, null, "submitted", "Application submitted", "submit-50");
        await _workflow.RecordScreeningTransitionAsync(100, 50, 70, 2, "invited", "Screening invitation created", "invite-70");
        _db.ConversationTimelineEntries.Should().ContainSingle(x => x.Kind == TimelineEntryKind.Screening &&
            x.ContextKind == "rentalapplication" && x.ContextId == 50 && x.OrganizationId == 100);

        await _workflow.RecordScreeningTransitionAsync(200, 50, 71, 2, "processing", "wrong org", "wrong-org");
        _db.ConversationTimelineEntries.Should().NotContain(x => x.EventId == "wrong-org");

        await SeedSecondConversationLinkAsync();
        await _workflow.RecordScreeningTransitionAsync(100, 51, 72, 2, "invited", "ambiguous", "ambiguous");
        _db.ConversationTimelineEntries.Should().NotContain(x => x.EventId == "ambiguous");
    }

    private async Task SeedAsync(bool ambiguous)
    {
        _db.Users.AddRange(new User { Id = 1, SettingId = 1, Email = "tenant@test" }, new User { Id = 2, SettingId = 2, Email = "staff@test" });
        _db.Organizations.AddRange(new Organization { Id = 100, Name = "Org" }, new Organization { Id = 200, Name = "Other" });
        _db.Properties.Add(new Property { Id = 20, OrganizationId = 100, LandlordId = 2, Name = "Property" });
        _db.RentalApplications.AddRange(
            new RentalApplication { Id = 50, OrganizationId = 100, PropertyId = 20, LandlordId = 2, Email = "tenant@test" },
            new RentalApplication { Id = 51, OrganizationId = 100, PropertyId = 20, LandlordId = 2, Email = "other@test" });
        _db.Conversations.Add(new Conversation { Id = 10, OrganizationId = 100, LandlordId = 2, PropertyId = 20, Title = "Prospect" });
        _db.ConversationContextLinks.Add(new ConversationContextLink { OrganizationId = 100, ConversationId = 10, PropertyId = 20 });
        await _db.SaveChangesAsync();
        if (ambiguous) await SeedSecondConversationLinkAsync();
    }

    private async Task SeedSecondConversationLinkAsync()
    {
        if (!_db.Conversations.Any(x => x.Id == 11))
        {
            _db.Conversations.Add(new Conversation { Id = 11, OrganizationId = 100, LandlordId = 2, PropertyId = 20, Title = "Other" });
            _db.ConversationContextLinks.Add(new ConversationContextLink { OrganizationId = 100, ConversationId = 11, PropertyId = 20 });
            await _db.SaveChangesAsync();
        }
    }
}
