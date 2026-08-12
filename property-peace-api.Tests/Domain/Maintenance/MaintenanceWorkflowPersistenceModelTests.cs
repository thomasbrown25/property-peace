using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Xunit;

namespace brownstone_hub_api.Tests.Domain.Maintenance;

public sealed class MaintenanceWorkflowPersistenceModelTests
{
    [Fact]
    public void WorkflowEntities_AreMappedToMaintenanceSchemaWithConcurrencyAndRequestIndexes()
    {
        using var db = CreateContext();
        var model = db.Model;

        AssertWorkflowEntity<MaintenancePreferredWindow>(model);
        AssertWorkflowEntity<MaintenanceEstimate>(model);
        AssertWorkflowEntity<MaintenanceWorkOrder>(model);
        AssertWorkflowEntity<MaintenanceAppointment>(model);
        AssertWorkflowEntity<MaintenanceCompletion>(model);
        AssertWorkflowEntity<MaintenanceTroubleshootingStep>(model);
        var step = model.FindEntityType(typeof(MaintenanceTroubleshootingStep))!;
        step.FindProperty(nameof(MaintenanceTroubleshootingStep.ResolutionCycleKey))!.GetMaxLength().Should().Be(100);
        step.FindProperty(nameof(MaintenanceTroubleshootingStep.StepKey))!.GetMaxLength().Should().Be(100);
        step.FindProperty(nameof(MaintenanceTroubleshootingStep.StepCode))!.GetMaxLength().Should().Be(100);
        step.GetIndexes().Should().Contain(index => index.IsUnique && index.Properties.Select(property => property.Name).SequenceEqual(new[]
        {
            nameof(MaintenanceTroubleshootingStep.MaintenanceRequestId),
            nameof(MaintenanceTroubleshootingStep.ResolutionCycleKey),
            nameof(MaintenanceTroubleshootingStep.StepKey)
        }));
    }

    [Fact]
    public void MaintenanceRequest_StructuredIntakeAndSlaFieldsAreMappedAdditively()
    {
        using var db = CreateContext();
        var entity = db.Model.FindEntityType(typeof(MaintenanceRequest))!;

        entity.FindProperty(nameof(MaintenanceRequest.Urgency))!.GetTypeMapping().Converter.Should().NotBeNull();
        entity.FindProperty(nameof(MaintenanceRequest.LocationDetails))!.GetMaxLength().Should().Be(500);
        entity.FindProperty(nameof(MaintenanceRequest.StructuredIntakeJson))!.GetMaxLength().Should().Be(8000);
        entity.FindProperty(nameof(MaintenanceRequest.TriagePolicyVersion))!.GetMaxLength().Should().Be(50);
        entity.FindProperty(nameof(MaintenanceRequest.LandlordSummary))!.GetMaxLength().Should().Be(2000);
        entity.FindProperty(nameof(MaintenanceRequest.MissingInformationJson))!.GetMaxLength().Should().Be(2000);
        entity.FindProperty(nameof(MaintenanceRequest.AcknowledgeByUtc)).Should().NotBeNull();
        entity.FindProperty(nameof(MaintenanceRequest.ActionByUtc)).Should().NotBeNull();
        entity.FindProperty(nameof(MaintenanceRequest.TriagedAtUtc)).Should().NotBeNull();
        entity.FindProperty(nameof(MaintenanceRequest.StopTroubleshooting)).Should().NotBeNull();
        var expectedIndex = new[] { nameof(MaintenanceRequest.OrganizationId), nameof(MaintenanceRequest.Urgency), nameof(MaintenanceRequest.ActionByUtc) };
        entity.GetIndexes().Should().Contain(i =>
            i.Properties.Select(p => p.Name).SequenceEqual(expectedIndex));
    }

    [Fact]
    public void DataContext_ExposesEveryWorkflowDbSet()
    {
        using var db = CreateContext();

        db.MaintenancePreferredWindows.Should().NotBeNull();
        db.MaintenanceEstimates.Should().NotBeNull();
        db.MaintenanceWorkOrders.Should().NotBeNull();
        db.MaintenanceAppointments.Should().NotBeNull();
        db.MaintenanceCompletions.Should().NotBeNull();
        db.MaintenanceTroubleshootingSteps.Should().NotBeNull();
        db.MaintenanceActivityEvents.Should().NotBeNull();
        db.MaintenanceAttachments.Should().NotBeNull();
    }

    [Fact]
    public void EvidenceAndVendorPortalIdentity_AreMappedForMilestoneMigration()
    {
        using var db = CreateContext();
        db.Model.FindEntityType(typeof(MaintenanceActivityEvent))!.GetSchema().Should().Be("maintenance");
        db.Model.FindEntityType(typeof(MaintenanceAttachment))!.GetSchema().Should().Be("maintenance");
        var vendor = db.Model.FindEntityType(typeof(Vendor))!;
        vendor.FindProperty(nameof(Vendor.PortalUserId)).Should().NotBeNull();
        vendor.GetIndexes().Should().Contain(i => i.IsUnique && i.Properties.Single().Name == nameof(Vendor.PortalUserId));
    }

    private static void AssertWorkflowEntity<T>(IModel model)
    {
        var entity = model.FindEntityType(typeof(T));
        entity.Should().NotBeNull();
        entity!.GetSchema().Should().Be("maintenance");
        entity.FindProperty("RowVersion")!.IsConcurrencyToken.Should().BeTrue();
        entity.GetIndexes().Should().Contain(i => i.Properties.Any(p => p.Name == "MaintenanceRequestId"));
        entity.GetForeignKeys().Should().Contain(fk =>
            fk.PrincipalEntityType.ClrType == typeof(MaintenanceRequest) && fk.DeleteBehavior == DeleteBehavior.Cascade);
    }

    private static DataContext CreateContext() => new(
        new DbContextOptionsBuilder<DataContext>()
            .UseInMemoryDatabase($"maintenance-model-{Guid.NewGuid()}")
            .Options);
}
