using FluentAssertions;
using Xunit;

namespace brownstone_hub_api.Tests.ActivationFunnel;

public sealed class ActivationFunnelOccurrenceWiringTests
{
    private static string ApiFile(params string[] parts)
    {
        var root = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../property-peace-api"));
        return File.ReadAllText(Path.Combine(new[] { root }.Concat(parts).ToArray()));
    }

    [Fact]
    public void PropertyCreation_RecordsInsideExistingMutationBoundary_AfterPersistence()
    {
        var source = ApiFile("Services", "PropertyService", "PropertyService.cs");
        source.Should().Contain("ActivationMilestones.PropertyAdded");
        source.IndexOf("await _propertyRepository.AddProperty", StringComparison.Ordinal)
            .Should().BeLessThan(source.IndexOf("ActivationMilestones.PropertyAdded", StringComparison.Ordinal));
        source.IndexOf("ActivationMilestones.PropertyAdded", StringComparison.Ordinal)
            .Should().BeLessThan(source.IndexOf("EntitlementMutationOutcome<ServiceResponse<LoadPropertyDto>>.Commit", StringComparison.Ordinal));
    }

    [Fact]
    public void ListingPublication_IsReplayRepairable_WithoutFalselyFailingPersistedPublication()
    {
        var source = ApiFile("Services", "ListingService", "ListingService.cs");
        source.Split("TryRecordListingPublishedAsync").Length.Should().BeGreaterThanOrEqualTo(4);
        source.Should().Contain("listing.Status == EListingStatus.Active");
        source.Should().Contain("catch (Exception ex)");
        source.Should().Contain("persisted but activation recording failed");
        source.Should().Contain("listing.PublishedAt");
        source.Should().Contain("IsTimestampEstimated: !listing.PublishedAt.HasValue");
        source.Should().Contain("ActorUserId: actorUserId");
    }

    [Fact]
    public void LeadAndShowingOccurrences_AreInsideTheirAuthoritativeTransactions()
    {
        var source = ApiFile("Services", "Leads", "LeadService.cs");
        source.Should().Contain("ActivationMilestones.LeadReceived");
        source.Should().Contain("ActivationMilestones.ShowingBooked");
        source.Should().Contain("$\"lead:{lead.Id}\"");
        source.Should().Contain("$\"showing:{showing.Id}\"");
        source.IndexOf("ActivationMilestones.ShowingBooked", StringComparison.Ordinal)
            .Should().BeLessThan(source.IndexOf("await CommitAsync(transaction, ct);", source.IndexOf("ActivationMilestones.ShowingBooked", StringComparison.Ordinal), StringComparison.Ordinal));
    }

    [Fact]
    public void ApplicationOccurrence_UsesPersistedOrganization_AndIsReplayRepairable()
    {
        var source = ApiFile("Services", "ApplicationService", "ApplicationService.cs");
        source.Split("TryRecordApplicationCompletedAsync").Length.Should().BeGreaterThanOrEqualTo(3);
        source.Should().Contain("result.Status == EApplicationStatus.Submitted");
        source.Should().Contain("result.OrganizationId.Value");
        source.Should().Contain("$\"application:{result.Id}\"");
        source.Should().Contain("persisted but activation recording failed");
        source.Should().Contain("result.SubmittedAt");
        source.Should().Contain("IsTimestampEstimated: !result.SubmittedAt.HasValue");
        var repositorySource = ApiFile("Repositories", "Applications", "ApplicationRepository.cs");
        repositorySource.Should().Contain("entity.SubmittedAt = DateTime.UtcNow;");
        repositorySource.Should().NotContain("entity.SubmittedAt = DateTime.Now;");
        source.Should().Contain("ActorUserId: actorUserId");
    }

    [Fact]
    public void MaintenanceClose_IsAtomicWithActivation_AndAttributesTheActor()
    {
        var source = ApiFile("Services", "Maintenance", "MaintenanceRequestWorkflowApiService.cs");
        source.Should().Contain("BeginTransactionAsync(cancellationToken)");
        source.Should().Contain("await transaction.CommitAsync(cancellationToken)");
        source.Should().Contain("ActorUserId: actorUserId");
        source.Should().Contain("RecordMaintenanceClosedAsync(request, completion, now, actor.UserId, cancellationToken)");
    }
}
