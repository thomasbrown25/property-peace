using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Maintenance;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.Maintenance;
using brownstone_hub_api.Services.MaintenanceTriage;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Maintenance;

public sealed class MaintenanceWorkflowApiServiceTests
{
    private static readonly DateTimeOffset Now = new(2026, 8, 9, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task Assign_IsManagerOnly_AndPersistsEstimateRequiredAndActor()
    {
        await using var db = CreateDb();
        Seed(db);
        AddVendor(db, 700, 70);
        await db.SaveChangesAsync();
        var result = await Service(db, Manager).AssignAsync(100, new(EAssignedToType.Vendor, null, 700, true));

        result.Code.Should().Be(MaintenanceApiResultCode.Success);
        var request = await db.MaintenanceRequests.FindAsync(100L);
        request!.Status.Should().Be(EMaintenanceStatus.AwaitingApproval);
        request.EstimateRequired.Should().BeTrue();
        request.AssignedByUserId.Should().Be(61);
        request.AssignedToUserId.Should().Be(70);

        (await Service(db, Vendor).AssignAsync(100, new(EAssignedToType.Vendor, 70, 700, false))).Code
            .Should().Be(MaintenanceApiResultCode.NotFound);
    }

    [Fact]
    public async Task Assign_RejectsInactiveCrossOrganizationVendor_AndInactiveOrCrossOrganizationMember()
    {
        await using var db = CreateDb();
        Seed(db);
        AddVendor(db, 700, 70, organizationId: 999);
        AddVendor(db, 701, 71, active: false);
        db.OrganizationMembers.AddRange(
            new OrganizationMember { Id = 1, OrganizationId = 60, UserId = 80, IsActive = false },
            new OrganizationMember { Id = 2, OrganizationId = 999, UserId = 81, IsActive = true });
        await db.SaveChangesAsync();
        var service = Service(db, Manager);

        (await service.AssignAsync(100, new(EAssignedToType.Vendor, null, 700, false))).Code.Should().Be(MaintenanceApiResultCode.BadRequest);
        (await service.AssignAsync(100, new(EAssignedToType.Vendor, null, 701, false))).Code.Should().Be(MaintenanceApiResultCode.BadRequest);
        (await service.AssignAsync(100, new(EAssignedToType.OrganizationMember, 80, null, false))).Code.Should().Be(MaintenanceApiResultCode.BadRequest);
        (await service.AssignAsync(100, new(EAssignedToType.OrganizationMember, 81, null, false))).Code.Should().Be(MaintenanceApiResultCode.BadRequest);
        (await service.AssignAsync(100, new(EAssignedToType.Self, 999, 700, false))).Code.Should().Be(MaintenanceApiResultCode.BadRequest);
    }

    [Fact]
    public async Task Assign_RejectsActiveSameOrganizationVendorWithoutPortalBinding()
    {
        await using var db = CreateDb();
        Seed(db);
        AddVendor(db, 700, null);
        await db.SaveChangesAsync();

        var result = await Service(db, Manager).AssignAsync(100, new(EAssignedToType.Vendor, null, 700, false));

        result.Code.Should().Be(MaintenanceApiResultCode.BadRequest);
        result.ErrorCode.Should().Be("maintenance.vendor_not_ready");
        (await db.MaintenanceRequests.FindAsync(100L))!.AssignedToType.Should().Be(EAssignedToType.Unassigned);
    }

    [Fact]
    public async Task VendorAccess_UsesActiveSameOrganizationPortalAssociation_NotVendorPrimaryKeyOrClientAssignee()
    {
        await using var db = CreateDb();
        Seed(db, assigned: true);
        var request = await db.MaintenanceRequests.FindAsync(100L);
        request!.AssignedToUserId = 999;
        await db.SaveChangesAsync();

        (await Service(db, Vendor).GetAsync(100)).Code.Should().Be(MaintenanceApiResultCode.Success);
        (await Service(db, new MaintenanceActor(700, false, false)).GetAsync(100)).Code.Should().Be(MaintenanceApiResultCode.NotFound);
        db.Vendors.Single().IsActive = false;
        await db.SaveChangesAsync();
        (await Service(db, Vendor).GetAsync(100)).Code.Should().Be(MaintenanceApiResultCode.NotFound);
    }

    [Fact]
    public async Task DetailAndList_ProjectReconnectableWorkflowAggregate()
    {
        await using var db = CreateDb();
        Seed(db, assigned: true);
        db.MaintenanceEstimates.Add(new MaintenanceEstimate { Id = 800, MaintenanceRequestId = 100, Version = 3, Status = MaintenanceEstimateStatus.Submitted, Amount = 10, Scope = "Scope", SubmittedByUserId = 70 });
        db.MaintenanceWorkOrders.Add(new MaintenanceWorkOrder { Id = 900, MaintenanceRequestId = 100, Version = 4, Status = MaintenanceWorkOrderStatus.Issued, Scope = "Scope", IssuedByUserId = 61 });
        db.MaintenanceAppointments.Add(new MaintenanceAppointment { Id = 1000, MaintenanceRequestId = 100, MaintenanceWorkOrderId = 900, Version = 2, Status = MaintenanceAppointmentStatus.Proposed, StartsAtUtc = Now, EndsAtUtc = Now.AddHours(1), ProposedByUserId = 70 });
        db.MaintenanceCompletions.Add(new MaintenanceCompletion { Id = 1100, MaintenanceRequestId = 100, MaintenanceWorkOrderId = 900, Version = 5, Status = MaintenanceCompletionStatus.Submitted, ResolutionNotes = "Done", CompletionEvidenceReference = "attachments:1200", TenantConfirmationDueAtUtc = Now.AddDays(3) });
        var attachment = CompletionEvidence(); attachment.Id = 1200; db.MaintenanceAttachments.Add(attachment);
        db.MaintenanceActivityEvents.Add(new MaintenanceActivityEvent { Id = 1300, MaintenanceRequestId = 100, ActorUserId = 61, EventType = "work.issued", SubjectType = "workOrder", SubjectId = 900, Visibility = MaintenanceActivityVisibility.Participants, Summary = "Issued", OccurredAtUtc = Now });
        await db.SaveChangesAsync();
        var service = Service(db, Manager);

        var detail = (await service.GetAsync(100)).Value!;
        var list = (await service.ListAsync()).Value!;

        detail.Assignment!.VendorId.Should().Be(700);
        detail.Estimates.Single().Should().Match<MaintenanceEstimateDto>(x => x.Id == 800 && x.Version == 3);
        detail.WorkOrders.Single().Should().Match<MaintenanceWorkOrderDto>(x => x.Id == 900 && x.Version == 4);
        detail.Appointments.Single().Should().Match<MaintenanceAppointmentDto>(x => x.Id == 1000 && x.Version == 2);
        detail.Completions.Single().Should().Match<MaintenanceCompletionDto>(x => x.Id == 1100 && x.Version == 5);
        detail.Attachments.Single().Id.Should().Be(1200);
        detail.Activities.Single().Id.Should().Be(1300);
        list.Should().ContainSingle(x => x.Id == 100 && x.WorkOrders.Single().Version == 4);
    }

    [Fact]
    public async Task DetailAndList_ProjectServerCalculatedAgingAndSlaState()
    {
        await using var db = CreateDb();
        Seed(db);
        var request = await db.MaintenanceRequests.FindAsync(100L);
        request!.CreatedAt = Now.AddHours(-30).UtcDateTime;
        request.UpdatedAt = Now.AddHours(-2).UtcDateTime;
        request.AcknowledgeByUtc = Now.AddHours(-26);
        request.ActionByUtc = Now.AddHours(6);
        await db.SaveChangesAsync();

        var detail = (await Service(db, Manager).GetAsync(100)).Value!;
        var listed = (await Service(db, Manager).ListAsync()).Value!.Single();

        detail.CreatedAtUtc.Should().Be(Now.AddHours(-30));
        detail.UpdatedAtUtc.Should().Be(new DateTimeOffset(DateTime.SpecifyKind(request.UpdatedAt, DateTimeKind.Utc)));
        detail.AgeHours.Should().Be(30);
        detail.Sla.IsAcknowledgeOverdue.Should().BeTrue();
        detail.Sla.IsActionOverdue.Should().BeFalse();
        detail.Sla.ServerEvaluatedAtUtc.Should().Be(Now);
        listed.Sla.Should().Be(detail.Sla);
    }

    [Fact]
    public async Task Estimate_IsRevisioned_VendorCanSubmit_ButOnlyControllerCanApproveOrReject()
    {
        await using var db = CreateDb();
        Seed(db, assigned: true, estimateRequired: true);
        var vendor = Service(db, Vendor);

        var first = await vendor.SubmitEstimateAsync(100, new(125m, "usd", "Replace valve", null));
        var second = await vendor.SubmitEstimateAsync(100, new(150m, "USD", "Replace valve and line", null));
        first.Value!.Version.Should().Be(1);
        second.Value!.Version.Should().Be(2);
        (await vendor.ApproveEstimateAsync(100, second.Value.Id, new(2))).Code.Should().Be(MaintenanceApiResultCode.NotFound);

        var approved = await Service(db, Manager).ApproveEstimateAsync(100, second.Value.Id, new(2));
        approved.Value!.Status.Should().Be(MaintenanceEstimateStatus.Approved);
        (await Service(db, Manager).RejectEstimateAsync(100, first.Value.Id, new(1, "Superseded"))).Value!.Status
            .Should().Be(MaintenanceEstimateStatus.Rejected);
    }

    [Fact]
    public async Task Reassignment_HidesPriorVendorCommercialData_AndRejectsMismatchedEstimateAndWorkOrder()
    {
        await using var db = CreateDb();
        Seed(db, assigned: true, estimateRequired: true);
        AddVendor(db, 701, 71);
        await db.SaveChangesAsync();
        var oldEstimate = (await Service(db, Vendor).SubmitEstimateAsync(100, new(125m, "USD", "Old vendor scope", Now.AddDays(1)))).Value!;
        await Service(db, Manager).ApproveEstimateAsync(100, oldEstimate.Id, new(oldEstimate.Version));
        var oldWorkOrder = (await Service(db, Manager).IssueWorkOrderAsync(100, new(oldEstimate.Id, "Old vendor work", 125m, Now.AddDays(2)))).Value!;
        await Service(db, Manager).CancelWorkOrderAsync(100, oldWorkOrder.Id, new(oldWorkOrder.Version, "Reassign"));
        await Service(db, Manager).AssignAsync(100, new(EAssignedToType.Vendor, null, 701, true));
        var newVendor = new MaintenanceActor(71, false, false, true);

        var detail = (await Service(db, newVendor).GetAsync(100)).Value!;
        detail.Estimates.Should().BeEmpty();
        detail.WorkOrders.Should().BeEmpty();
        (await Service(db, Manager).IssueWorkOrderAsync(100, new(oldEstimate.Id, "Wrong vendor", 125m, null))).ErrorCode
            .Should().Be("maintenance.estimate_vendor_mismatch");
        (await Service(db, newVendor).StartWorkAsync(100, oldWorkOrder.Id, new(oldWorkOrder.Version + 1))).Code
            .Should().Be(MaintenanceApiResultCode.NotFound);
    }

    [Fact]
    public async Task Estimate_CannotBeApprovedAfterExpiry()
    {
        await using var db = CreateDb();
        Seed(db, assigned: true, estimateRequired: true);
        var estimate = (await Service(db, Vendor).SubmitEstimateAsync(100, new(125m, "USD", "Repair", Now.AddMinutes(-1)))).Value!;

        var approval = await Service(db, Manager).ApproveEstimateAsync(100, estimate.Id, new(estimate.Version));

        approval.Code.Should().Be(MaintenanceApiResultCode.Conflict);
        approval.ErrorCode.Should().Be("maintenance.estimate_expired");
        (await db.MaintenanceEstimates.FindAsync(estimate.Id))!.Status.Should().Be(MaintenanceEstimateStatus.Expired);
    }

    [Fact]
    public async Task EveryInvalidTransitionReturnsStableConflictCode()
    {
        await using var db = CreateDb();
        Seed(db, assigned: true, estimateRequired: true);
        var result = await Service(db, Manager).IssueWorkOrderAsync(100, new(null, "Repair", 100m, Now.AddDays(2)));
        result.Code.Should().Be(MaintenanceApiResultCode.Conflict);
        result.ErrorCode.Should().Be("maintenance.estimate_approval_required");
    }

    [Fact]
    public async Task WorkOrder_IsLandlordControlled_Versioned_RequiresAssignmentAndApprovedReferencedEstimate()
    {
        await using var db = CreateDb();
        Seed(db, assigned: true, estimateRequired: true);
        var estimate = (await Service(db, Vendor).SubmitEstimateAsync(100, new(125m, "USD", "Repair", null))).Value!;
        await Service(db, Manager).ApproveEstimateAsync(100, estimate.Id, new(estimate.Version));

        var issued = await Service(db, Manager).IssueWorkOrderAsync(100, new(estimate.Id, "Repair", 125m, Now.AddDays(2)));
        issued.Value!.Version.Should().Be(1);
        issued.Value.Status.Should().Be(MaintenanceWorkOrderStatus.Issued);
        issued.Value.IssuedByUserId.Should().Be(61);
        (await Service(db, Vendor).CancelWorkOrderAsync(100, issued.Value.Id, new(1, "Cannot attend"))).Code
            .Should().Be(MaintenanceApiResultCode.NotFound);
        (await Service(db, Manager).CancelWorkOrderAsync(100, issued.Value.Id, new(1, "Scope changed"))).Value!.Status
            .Should().Be(MaintenanceWorkOrderStatus.Cancelled);
    }

    [Fact]
    public async Task Appointment_ProposeConfirmCancel_AndStartRequireIssuedWorkOrder()
    {
        await using var db = CreateDb();
        Seed(db, assigned: true);
        var workOrder = (await Service(db, Manager).IssueWorkOrderAsync(100, new(null, "Repair", 100m, Now.AddDays(2)))).Value!;
        var proposed = (await Service(db, Vendor).ProposeAppointmentAsync(100,
            new(workOrder.Id, Now.AddHours(4), Now.AddHours(6), "Call first"))).Value!;

        (await Service(db, Tenant).ConfirmAppointmentAsync(100, proposed.Id, new(proposed.Version))).Value!.Status
            .Should().Be(MaintenanceAppointmentStatus.Confirmed);
        (await Service(db, Vendor).StartWorkAsync(100, workOrder.Id, new(workOrder.Version))).Code
            .Should().Be(MaintenanceApiResultCode.Success);
        (await Service(db, Tenant).CancelAppointmentAsync(100, proposed.Id, new(2, "Not available"))).Value!.Status
            .Should().Be(MaintenanceAppointmentStatus.Cancelled);
    }

    [Fact]
    public async Task Completion_RequiresEvidence_TenantCanConfirmOrReopen_AndReopenIncrementsCycle()
    {
        await using var db = CreateDb();
        Seed(db, assigned: true);
        var wo = (await Service(db, Manager).IssueWorkOrderAsync(100, new(null, "Repair", 100m, Now.AddDays(2)))).Value!;
        await Service(db, Vendor).StartWorkAsync(100, wo.Id, new(wo.Version));

        var missing = await Service(db, Vendor).SubmitCompletionAsync(100, new(wo.Id, "Fixed", "caller-controlled-proof", 100m));
        missing.Code.Should().Be(MaintenanceApiResultCode.BadRequest);
        db.MaintenanceAttachments.Add(CompletionEvidence());
        await db.SaveChangesAsync();
        var completion = (await Service(db, Vendor).SubmitCompletionAsync(100, new(wo.Id, "Fixed valve", "file:proof-1", 100m))).Value!;
        completion.CompletionEvidenceReference.Should().StartWith("attachments:");
        completion.CompletionEvidenceReference.Should().NotContain("file:proof-1");
        completion.CompletedByUserId.Should().Be(70);
        completion.TenantConfirmationDueAtUtc.Should().Be(Now.AddDays(3));

        var reopened = await Service(db, Tenant).ReopenCompletionAsync(100, completion.Id, new(completion.Version, "Still leaking"));
        reopened.Value!.Status.Should().Be(MaintenanceCompletionStatus.Disputed);
        (await db.MaintenanceRequests.FindAsync(100L))!.ResolutionCycle.Should().Be(2);
    }

    [Fact]
    public async Task StaffClose_RequiresDueTimeAndReason_WhileTenantConfirmResolvesImmediately()
    {
        await using var db = CreateDb();
        Seed(db, assigned: true);
        var wo = (await Service(db, Manager).IssueWorkOrderAsync(100, new(null, "Repair", 100m, Now.AddDays(2)))).Value!;
        await Service(db, Vendor).StartWorkAsync(100, wo.Id, new(wo.Version));
        db.MaintenanceAttachments.Add(CompletionEvidence());
        await db.SaveChangesAsync();
        var completion = (await Service(db, Vendor).SubmitCompletionAsync(100, new(wo.Id, "Fixed", "file:proof", 100m))).Value!;

        var early = await Service(db, Manager).StaffCloseCompletionAsync(100, completion.Id, new(completion.Version, "No tenant response"));
        early.Code.Should().Be(MaintenanceApiResultCode.Conflict);
        early.ErrorCode.Should().Be("maintenance.confirmation_due_not_reached");
        var confirmed = await Service(db, Tenant).ConfirmCompletionAsync(100, completion.Id, new(completion.Version));
        confirmed.Value!.Status.Should().Be(MaintenanceCompletionStatus.Accepted);
        (await db.MaintenanceRequests.FindAsync(100L))!.Status.Should().Be(EMaintenanceStatus.Resolved);
    }

    [Fact]
    public async Task CostProjection_IsManagerOnly_UsesApprovedEstimateAndLinkedExpenses()
    {
        await using var db = CreateDb();
        Seed(db, assigned: true);
        db.MaintenanceEstimates.Add(new MaintenanceEstimate { Id = 800, MaintenanceRequestId = 100, Version = 1, Status = MaintenanceEstimateStatus.Approved, Amount = 125m, Scope = "Repair", CreatedAtUtc = Now, UpdatedAtUtc = Now, ApprovedByUserId = 61 });
        db.Expenses.AddRange(
            new Expense { Id = 1, LandlordId = 61, PropertyId = 40, MaintenanceRequestId = 100, Name = "Parts", Category = "Repairs", Amount = 80m },
            new Expense { Id = 2, LandlordId = 61, PropertyId = 40, MaintenanceRequestId = 100, Name = "Labor", Category = "Repairs", Amount = 70m });
        await db.SaveChangesAsync();

        var projection = await Service(db, Manager).GetCostProjectionAsync(100);
        projection.Value!.ApprovedEstimate.Should().Be(125m);
        projection.Value.ActualTotal.Should().Be(150m);
        projection.Value.Variance.Should().Be(25m);
        (await Service(db, Tenant).GetCostProjectionAsync(100)).Code.Should().Be(MaintenanceApiResultCode.NotFound);
    }

    private static readonly MaintenanceActor Manager = new(61, false, true);
    private static readonly MaintenanceActor Vendor = new(70, false, false, true);
    private static readonly MaintenanceActor Tenant = new(10, true, false);

    private static MaintenanceAttachment CompletionEvidence() => new()
    {
        MaintenanceRequestId = 100, Purpose = MaintenanceAttachmentPurpose.Completion, ResolutionCycle = 1,
        MediaType = MaintenanceAttachmentMediaType.Photo, FileName = "proof.jpg", ContentType = "image/jpeg",
        SizeBytes = 100, BlobName = $"test/{Guid.NewGuid():N}.jpg", UploadedByUserId = 70,
        LifecycleState = MaintenanceAttachmentLifecycleState.Active, CreatedAtUtc = Now
    };

    private static void AddVendor(DataContext db, long id, long? portalUserId, long organizationId = 60, bool active = true) =>
        db.Vendors.Add(new Vendor { Id = id, LandlordId = 61, OrganizationId = organizationId, PortalUserId = portalUserId, Name = "Vendor", IsActive = active, IsDeleted = false });

    private static MaintenanceRequestApiService Service(DataContext db, MaintenanceActor actor) =>
        new(db, new StubActor(actor), new MaintenanceTriagePolicyV1(new FixedTime(Now)), new FixedTime(Now));

    private static DataContext CreateDb() => new(new DbContextOptionsBuilder<DataContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private static void Seed(DataContext db, bool assigned = false, bool estimateRequired = false)
    {
        db.Properties.Add(new Property { Id = 40, LandlordId = 61, OrganizationId = 60, Name = "Home" });
        db.Units.Add(new Unit { Id = 50, PropertyId = 40, Name = "1A" });
        db.Tenants.Add(new Tenant { Id = 20, UserId = 10, Firstname = "T", Lastname = "User", OrganizationId = 60 });
        db.Leases.Add(new Lease { Id = 30, UnitId = 50, OrganizationId = 60, IsActive = true, IsDeleted = false });
        db.TenantLeases.Add(new TenantLease { TenantId = 20, LeaseId = 30 });
        db.MaintenanceRequests.Add(new MaintenanceRequest
        {
            Id = 100, PropertyId = 40, UnitId = 50, OrganizationId = 60, SubmittedByUserId = 10, SubmittedByTenantId = 20, SubmittedUnderLeaseId = 30, UnitName = "1A", Title = "Leak", Description = "Leak",
            Status = assigned ? (estimateRequired ? EMaintenanceStatus.AwaitingApproval : EMaintenanceStatus.Assigned) : EMaintenanceStatus.Acknowledged,
            AssignedToType = assigned ? EAssignedToType.Vendor : EAssignedToType.Unassigned,
            AssignedToUserId = assigned ? 70 : null, VendorId = assigned ? 700 : null, EstimateRequired = estimateRequired,
            ResolutionCycle = 1
        });
        if (assigned) AddVendor(db, 700, 70);
        db.SaveChanges();
    }

    private sealed class StubActor(MaintenanceActor actor) : IMaintenanceActorAccessor
    {
        public Task<MaintenanceActor?> GetCurrentAsync(CancellationToken cancellationToken = default) => Task.FromResult<MaintenanceActor?>(actor);
    }
    private sealed class FixedTime(DateTimeOffset now) : TimeProvider { public override DateTimeOffset GetUtcNow() => now; }
}
