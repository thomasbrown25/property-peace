using brownstone_hub_api.Dtos.Maintenance;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.ActivationFunnel;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.Maintenance;

public sealed partial class MaintenanceRequestApiService
{
    private const string NotFoundMessage = "Maintenance request not found.";

    public async Task<MaintenanceApiResult<MaintenanceAssignmentDto>> AssignAsync(long id, AssignMaintenanceCommandDto command, CancellationToken cancellationToken = default)
    {
        var actor = await actors.GetCurrentAsync(cancellationToken);
        if (actor is null) return Unauthorized<MaintenanceAssignmentDto>();
        var request = await ManagerRequest(id, actor.UserId, cancellationToken);
        if (request is null) return NotFound<MaintenanceAssignmentDto>();
        if (request.Status is EMaintenanceStatus.Resolved or EMaintenanceStatus.Cancelled or EMaintenanceStatus.InProgress)
            return Conflict<MaintenanceAssignmentDto>("maintenance.assignment_invalid_state", "This request cannot be assigned in its current state.");
        if (!Enum.IsDefined(command.AssignedToType) || command.AssignedToType is EAssignedToType.Unassigned or EAssignedToType.OneTimeContact)
            return BadRequest<MaintenanceAssignmentDto>("A supported assignee type is required.");

        long? assignedUserId;
        long? vendorId = null;
        if (command.AssignedToType == EAssignedToType.Vendor)
        {
            if (command.VendorId is null or <= 0 || request.OrganizationId is null)
                return BadRequest<MaintenanceAssignmentDto>("A valid vendor is required.");
            var vendor = await db.Vendors.SingleOrDefaultAsync(x => x.Id == command.VendorId &&
                x.OrganizationId == request.OrganizationId && x.IsActive && !x.IsDeleted, cancellationToken);
            if (vendor is null || vendor.PortalUserId is null ||
                command.AssignedToUserId.HasValue && command.AssignedToUserId != vendor.PortalUserId)
                return MaintenanceApiResult<MaintenanceAssignmentDto>.Error(
                    MaintenanceApiResultCode.BadRequest,
                    "The vendor must be active, belong to this organization, and have an active portal binding.",
                    "maintenance.vendor_not_ready");
            vendorId = vendor.Id;
            assignedUserId = vendor.PortalUserId;
        }
        else if (command.AssignedToType == EAssignedToType.OrganizationMember)
        {
            if (command.AssignedToUserId is null or <= 0 || command.VendorId is not null || request.OrganizationId is null ||
                !await db.OrganizationMembers.AnyAsync(x => x.OrganizationId == request.OrganizationId &&
                    x.UserId == command.AssignedToUserId && x.IsActive, cancellationToken))
                return BadRequest<MaintenanceAssignmentDto>("The assignee must be an active member of this organization.");
            assignedUserId = command.AssignedToUserId;
        }
        else
        {
            if (command.VendorId is not null || command.AssignedToUserId.HasValue && command.AssignedToUserId != actor.UserId)
                return BadRequest<MaintenanceAssignmentDto>("Self assignment cannot specify another user or vendor.");
            assignedUserId = actor.UserId;
        }

        var now = timeProvider.GetUtcNow();
        request.AssignedToType = command.AssignedToType;
        request.AssignedToUserId = assignedUserId;
        request.VendorId = vendorId;
        request.EstimateRequired = command.EstimateRequired;
        request.AssignedByUserId = actor.UserId;
        request.AssignedAt = now.UtcDateTime;
        request.Status = command.EstimateRequired ? EMaintenanceStatus.AwaitingApproval : EMaintenanceStatus.Assigned;
        await db.SaveChangesAsync(cancellationToken);
        await RecordActivity(request, actor.UserId, "assignment.changed", "maintenanceRequest", request.Id,
            "Maintenance assignment updated", MaintenanceActivityVisibility.Participants, request.Status.ToString(), cancellationToken: cancellationToken);
        return MaintenanceApiResult<MaintenanceAssignmentDto>.Success(new(command.AssignedToType, assignedUserId, vendorId, command.EstimateRequired, actor.UserId, now));
    }

    public async Task<MaintenanceApiResult<MaintenanceEstimateDto>> SubmitEstimateAsync(long id, SubmitMaintenanceEstimateDto command, CancellationToken cancellationToken = default)
    {
        var access = await AssignedOrManagerRequest(id, cancellationToken);
        if (access.Actor is null) return Unauthorized<MaintenanceEstimateDto>();
        if (access.Request is null) return NotFound<MaintenanceEstimateDto>();
        var request = access.Request;
        if (request.AssignedToType == EAssignedToType.Unassigned || request.Status is EMaintenanceStatus.Resolved or EMaintenanceStatus.Cancelled)
            return Conflict<MaintenanceEstimateDto>("maintenance.estimate_invalid_state", "An active assignment is required before submitting an estimate.");
        if (command.Amount <= 0 || string.IsNullOrWhiteSpace(command.Scope) || string.IsNullOrWhiteSpace(command.Currency) || command.Currency.Trim().Length != 3)
            return BadRequest<MaintenanceEstimateDto>("Amount, three-letter currency, and scope are required.");
        var now = timeProvider.GetUtcNow();
        var estimate = new MaintenanceEstimate
        {
            MaintenanceRequestId = id, VendorId = request.VendorId, Version = request.Estimates.Count == 0 ? 1 : request.Estimates.Max(x => x.Version) + 1,
            Status = MaintenanceEstimateStatus.Submitted, Amount = command.Amount, Currency = command.Currency.Trim().ToUpperInvariant(), Scope = command.Scope.Trim(),
            ValidUntilUtc = command.ValidUntilUtc, CreatedAtUtc = now, UpdatedAtUtc = now, SubmittedByUserId = access.Actor.UserId
        };
        request.Estimates.Add(estimate);
        request.Status = EMaintenanceStatus.AwaitingApproval;
        await db.SaveChangesAsync(cancellationToken);
        await RecordActivity(request, access.Actor.UserId, "estimate.submitted", "estimate", estimate.Id,
            "Maintenance estimate submitted", MaintenanceActivityVisibility.StaffOnly, estimate.Status.ToString(), cancellationToken: cancellationToken);
        return MaintenanceApiResult<MaintenanceEstimateDto>.Success(MapEstimate(estimate));
    }

    public Task<MaintenanceApiResult<MaintenanceEstimateDto>> ApproveEstimateAsync(long id, long estimateId, EstimateVersionCommandDto command, CancellationToken cancellationToken = default) =>
        DecideEstimate(id, estimateId, command.ExpectedVersion, true, null, cancellationToken);

    public Task<MaintenanceApiResult<MaintenanceEstimateDto>> RejectEstimateAsync(long id, long estimateId, RejectEstimateCommandDto command, CancellationToken cancellationToken = default) =>
        DecideEstimate(id, estimateId, command.ExpectedVersion, false, command.Reason, cancellationToken);

    private async Task<MaintenanceApiResult<MaintenanceEstimateDto>> DecideEstimate(long id, long estimateId, int expectedVersion, bool approve, string? reason, CancellationToken cancellationToken)
    {
        var actor = await actors.GetCurrentAsync(cancellationToken);
        if (actor is null) return Unauthorized<MaintenanceEstimateDto>();
        var request = await ManagerRequest(id, actor.UserId, cancellationToken);
        if (request is null) return NotFound<MaintenanceEstimateDto>();
        var estimate = request.Estimates.SingleOrDefault(x => x.Id == estimateId);
        if (estimate is null) return NotFound<MaintenanceEstimateDto>();
        if (estimate.Version != expectedVersion) return Conflict<MaintenanceEstimateDto>("maintenance.version_conflict", "The estimate version is stale.");
        if (estimate.Status != MaintenanceEstimateStatus.Submitted)
            return Conflict<MaintenanceEstimateDto>("maintenance.estimate_invalid_state", "Only a submitted estimate can be decided.");
        if (estimate.ValidUntilUtc.HasValue && estimate.ValidUntilUtc.Value <= timeProvider.GetUtcNow())
        {
            estimate.Status = MaintenanceEstimateStatus.Expired;
            estimate.UpdatedAtUtc = timeProvider.GetUtcNow();
            await db.SaveChangesAsync(cancellationToken);
            return Conflict<MaintenanceEstimateDto>("maintenance.estimate_expired", "The estimate has expired.");
        }
        if (estimate.VendorId != request.VendorId)
            return Conflict<MaintenanceEstimateDto>("maintenance.estimate_vendor_mismatch", "The estimate does not belong to the current assignee.");
        if (!approve && string.IsNullOrWhiteSpace(reason)) return BadRequest<MaintenanceEstimateDto>("A rejection reason is required.");
        var now = timeProvider.GetUtcNow();
        estimate.Status = approve ? MaintenanceEstimateStatus.Approved : MaintenanceEstimateStatus.Rejected;
        estimate.ApprovedByUserId = approve ? actor.UserId : null;
        estimate.DecidedByUserId = actor.UserId;
        estimate.DecidedAtUtc = now;
        estimate.DecisionReason = approve ? null : reason!.Trim();
        estimate.UpdatedAtUtc = now;
        request.Status = approve ? EMaintenanceStatus.Assigned : EMaintenanceStatus.AwaitingApproval;
        await db.SaveChangesAsync(cancellationToken);
        await RecordActivity(request, actor.UserId, approve ? "estimate.approved" : "estimate.rejected", "estimate", estimate.Id,
            approve ? "Maintenance estimate approved" : "Maintenance estimate rejected", MaintenanceActivityVisibility.StaffOnly,
            estimate.Status.ToString(), estimate.DecisionReason, cancellationToken);
        return MaintenanceApiResult<MaintenanceEstimateDto>.Success(MapEstimate(estimate));
    }

    public async Task<MaintenanceApiResult<MaintenanceWorkOrderDto>> IssueWorkOrderAsync(long id, IssueMaintenanceWorkOrderDto command, CancellationToken cancellationToken = default)
    {
        var actor = await actors.GetCurrentAsync(cancellationToken);
        if (actor is null) return Unauthorized<MaintenanceWorkOrderDto>();
        var request = await ManagerRequest(id, actor.UserId, cancellationToken);
        if (request is null) return NotFound<MaintenanceWorkOrderDto>();
        if (request.Status is EMaintenanceStatus.Resolved or EMaintenanceStatus.Cancelled)
            return Conflict<MaintenanceWorkOrderDto>("maintenance.work_order_invalid_state", "A resolved or cancelled request cannot receive a work order.");
        if (request.AssignedToType == EAssignedToType.Unassigned || request.AssignedToUserId is null)
            return Conflict<MaintenanceWorkOrderDto>("maintenance.assignment_required", "Assignment is required before issuing a work order.");
        if (string.IsNullOrWhiteSpace(command.Scope) || command.AuthorizedAmount < 0) return BadRequest<MaintenanceWorkOrderDto>("Scope and a non-negative authorized amount are required.");
        var estimate = command.EstimateId is null ? null : request.Estimates.SingleOrDefault(x => x.Id == command.EstimateId);
        if (estimate is not null && estimate.VendorId != request.VendorId)
            return Conflict<MaintenanceWorkOrderDto>("maintenance.estimate_vendor_mismatch", "The estimate does not belong to the current assignee.");
        if (estimate?.ValidUntilUtc is { } validUntil && validUntil <= timeProvider.GetUtcNow())
        {
            if (estimate.Status == MaintenanceEstimateStatus.Submitted) estimate.Status = MaintenanceEstimateStatus.Expired;
            await db.SaveChangesAsync(cancellationToken);
            return Conflict<MaintenanceWorkOrderDto>("maintenance.estimate_expired", "The estimate has expired.");
        }
        if (command.EstimateId is not null && estimate?.Status != MaintenanceEstimateStatus.Approved || request.EstimateRequired && estimate?.Status != MaintenanceEstimateStatus.Approved)
            return Conflict<MaintenanceWorkOrderDto>("maintenance.estimate_approval_required", "An approved estimate is required.");
        if (request.WorkOrders.Any(x => x.Status is MaintenanceWorkOrderStatus.Issued or MaintenanceWorkOrderStatus.InProgress))
            return Conflict<MaintenanceWorkOrderDto>("maintenance.work_order_active", "An active work order already exists.");
        var now = timeProvider.GetUtcNow();
        var workOrder = new MaintenanceWorkOrder
        {
            MaintenanceRequestId = id, MaintenanceEstimateId = estimate?.Id, VendorId = request.VendorId,
            Version = request.WorkOrders.Count == 0 ? 1 : request.WorkOrders.Max(x => x.Version) + 1, Status = MaintenanceWorkOrderStatus.Issued,
            Scope = command.Scope.Trim(), AuthorizedAmount = command.AuthorizedAmount, IssuedAtUtc = now, DueAtUtc = command.DueAtUtc,
            CreatedAtUtc = now, UpdatedAtUtc = now, IssuedByUserId = actor.UserId
        };
        request.WorkOrders.Add(workOrder);
        request.Status = EMaintenanceStatus.Assigned;
        await db.SaveChangesAsync(cancellationToken);
        await RecordActivity(request, actor.UserId, "workOrder.issued", "workOrder", workOrder.Id,
            "Maintenance work order issued", MaintenanceActivityVisibility.Participants, workOrder.Status.ToString(), cancellationToken: cancellationToken);
        return MaintenanceApiResult<MaintenanceWorkOrderDto>.Success(MapWorkOrder(workOrder));
    }

    public async Task<MaintenanceApiResult<MaintenanceWorkOrderDto>> CancelWorkOrderAsync(long id, long workOrderId, CancelMaintenanceWorkOrderDto command, CancellationToken cancellationToken = default)
    {
        var actor = await actors.GetCurrentAsync(cancellationToken);
        if (actor is null) return Unauthorized<MaintenanceWorkOrderDto>();
        var request = await ManagerRequest(id, actor.UserId, cancellationToken);
        if (request is null) return NotFound<MaintenanceWorkOrderDto>();
        var workOrder = request.WorkOrders.SingleOrDefault(x => x.Id == workOrderId);
        if (workOrder is null) return NotFound<MaintenanceWorkOrderDto>();
        if (workOrder.Version != command.ExpectedVersion) return Conflict<MaintenanceWorkOrderDto>("maintenance.version_conflict", "The work-order version is stale.");
        if (workOrder.Status != MaintenanceWorkOrderStatus.Issued) return Conflict<MaintenanceWorkOrderDto>("maintenance.work_order_invalid_state", "Only an issued work order can be cancelled.");
        if (string.IsNullOrWhiteSpace(command.Reason)) return BadRequest<MaintenanceWorkOrderDto>("A cancellation reason is required.");
        workOrder.Status = MaintenanceWorkOrderStatus.Cancelled; workOrder.Version++; workOrder.CancelledByUserId = actor.UserId;
        workOrder.CancellationReason = command.Reason.Trim(); workOrder.UpdatedAtUtc = timeProvider.GetUtcNow();
        await db.SaveChangesAsync(cancellationToken);
        await RecordActivity(request, actor.UserId, "workOrder.cancelled", "workOrder", workOrder.Id,
            "Maintenance work order cancelled", MaintenanceActivityVisibility.Participants, workOrder.Status.ToString(), workOrder.CancellationReason, cancellationToken);
        return MaintenanceApiResult<MaintenanceWorkOrderDto>.Success(MapWorkOrder(workOrder));
    }

    public async Task<MaintenanceApiResult<MaintenanceAppointmentDto>> ProposeAppointmentAsync(long id, ProposeMaintenanceAppointmentDto command, CancellationToken cancellationToken = default)
    {
        var access = await AssignedOrManagerRequest(id, cancellationToken);
        if (access.Actor is null) return Unauthorized<MaintenanceAppointmentDto>();
        if (access.Request is null) return NotFound<MaintenanceAppointmentDto>();
        var workOrder = access.Request.WorkOrders.SingleOrDefault(x => x.Id == command.WorkOrderId);
        if (workOrder is not null && workOrder.VendorId != access.Request.VendorId)
            return NotFound<MaintenanceAppointmentDto>();
        if (workOrder?.Status != MaintenanceWorkOrderStatus.Issued)
            return Conflict<MaintenanceAppointmentDto>("maintenance.issued_work_order_required", "An issued work order is required for scheduling.");
        if (command.EndsAtUtc <= command.StartsAtUtc) return BadRequest<MaintenanceAppointmentDto>("Appointment end must follow its start.");
        var now = timeProvider.GetUtcNow();
        var appointment = new MaintenanceAppointment { MaintenanceRequestId = id, MaintenanceWorkOrderId = workOrder.Id, Status = MaintenanceAppointmentStatus.Proposed, Version = 1, StartsAtUtc = command.StartsAtUtc, EndsAtUtc = command.EndsAtUtc, Notes = NormalizeOptional(command.Notes, 2000), CreatedAtUtc = now, UpdatedAtUtc = now, ProposedByUserId = access.Actor.UserId };
        access.Request.Appointments.Add(appointment);
        await db.SaveChangesAsync(cancellationToken);
        await RecordActivity(access.Request, access.Actor.UserId, "appointment.scheduled", "appointment", appointment.Id,
            "Maintenance appointment scheduled", MaintenanceActivityVisibility.Participants, appointment.Status.ToString(), cancellationToken: cancellationToken);
        return MaintenanceApiResult<MaintenanceAppointmentDto>.Success(MapAppointment(appointment));
    }

    public async Task<MaintenanceApiResult<MaintenanceAppointmentDto>> ConfirmAppointmentAsync(long id, long appointmentId, WorkflowVersionCommandDto command, CancellationToken cancellationToken = default)
    {
        var actor = await actors.GetCurrentAsync(cancellationToken);
        if (actor is null) return Unauthorized<MaintenanceAppointmentDto>();
        var request = await TenantRequest(id, actor.UserId, cancellationToken);
        if (request is null) return NotFound<MaintenanceAppointmentDto>();
        var appointment = request.Appointments.SingleOrDefault(x => x.Id == appointmentId);
        if (appointment is null) return NotFound<MaintenanceAppointmentDto>();
        if (appointment.Version != command.ExpectedVersion) return Conflict<MaintenanceAppointmentDto>("maintenance.version_conflict", "The appointment version is stale.");
        if (appointment.Status != MaintenanceAppointmentStatus.Proposed) return Conflict<MaintenanceAppointmentDto>("maintenance.appointment_invalid_state", "Only a proposed appointment can be confirmed.");
        appointment.Status = MaintenanceAppointmentStatus.Confirmed; appointment.Version++; appointment.ConfirmedByUserId = actor.UserId; appointment.UpdatedAtUtc = timeProvider.GetUtcNow();
        request.Status = EMaintenanceStatus.Scheduled;
        await db.SaveChangesAsync(cancellationToken);
        await RecordActivity(request, actor.UserId, "appointment.confirmed", "appointment", appointment.Id,
            "Maintenance appointment confirmed", MaintenanceActivityVisibility.Participants, appointment.Status.ToString(), cancellationToken: cancellationToken);
        return MaintenanceApiResult<MaintenanceAppointmentDto>.Success(MapAppointment(appointment));
    }

    public async Task<MaintenanceApiResult<MaintenanceAppointmentDto>> CancelAppointmentAsync(long id, long appointmentId, CancelMaintenanceAppointmentDto command, CancellationToken cancellationToken = default)
    {
        var actor = await actors.GetCurrentAsync(cancellationToken);
        if (actor is null) return Unauthorized<MaintenanceAppointmentDto>();
        var request = actor.IsTenant ? await TenantRequest(id, actor.UserId, cancellationToken) : (await AssignedOrManagerRequest(id, cancellationToken)).Request;
        if (request is null) return NotFound<MaintenanceAppointmentDto>();
        var appointment = request.Appointments.SingleOrDefault(x => x.Id == appointmentId);
        if (appointment is null) return NotFound<MaintenanceAppointmentDto>();
        if (appointment.Version != command.ExpectedVersion) return Conflict<MaintenanceAppointmentDto>("maintenance.version_conflict", "The appointment version is stale.");
        if (appointment.Status is not (MaintenanceAppointmentStatus.Proposed or MaintenanceAppointmentStatus.Confirmed)) return Conflict<MaintenanceAppointmentDto>("maintenance.appointment_invalid_state", "This appointment cannot be cancelled.");
        if (string.IsNullOrWhiteSpace(command.Reason)) return BadRequest<MaintenanceAppointmentDto>("A cancellation reason is required.");
        appointment.Status = MaintenanceAppointmentStatus.Cancelled; appointment.Version++; appointment.CancelledByUserId = actor.UserId; appointment.CancellationReason = command.Reason.Trim(); appointment.UpdatedAtUtc = timeProvider.GetUtcNow();
        await db.SaveChangesAsync(cancellationToken);
        await RecordActivity(request, actor.UserId, "appointment.cancelled", "appointment", appointment.Id,
            "Maintenance appointment cancelled", MaintenanceActivityVisibility.Participants, appointment.Status.ToString(), appointment.CancellationReason, cancellationToken);
        return MaintenanceApiResult<MaintenanceAppointmentDto>.Success(MapAppointment(appointment));
    }

    public async Task<MaintenanceApiResult<MaintenanceWorkOrderDto>> StartWorkAsync(long id, long workOrderId, WorkflowVersionCommandDto command, CancellationToken cancellationToken = default)
    {
        var access = await AssignedOrManagerRequest(id, cancellationToken);
        if (access.Actor is null) return Unauthorized<MaintenanceWorkOrderDto>();
        if (access.Request is null) return NotFound<MaintenanceWorkOrderDto>();
        var workOrder = access.Request.WorkOrders.SingleOrDefault(x => x.Id == workOrderId);
        if (workOrder is not null && workOrder.VendorId != access.Request.VendorId)
            return NotFound<MaintenanceWorkOrderDto>();
        if (workOrder is null) return NotFound<MaintenanceWorkOrderDto>();
        if (workOrder.Version != command.ExpectedVersion) return Conflict<MaintenanceWorkOrderDto>("maintenance.version_conflict", "The work-order version is stale.");
        if (workOrder.Status != MaintenanceWorkOrderStatus.Issued) return Conflict<MaintenanceWorkOrderDto>("maintenance.issued_work_order_required", "Only an issued work order can be started.");
        workOrder.Status = MaintenanceWorkOrderStatus.InProgress; workOrder.Version++; workOrder.UpdatedAtUtc = timeProvider.GetUtcNow(); access.Request.Status = EMaintenanceStatus.InProgress;
        await db.SaveChangesAsync(cancellationToken);
        await RecordActivity(access.Request, access.Actor.UserId, "work.started", "workOrder", workOrder.Id,
            "Maintenance work started", MaintenanceActivityVisibility.Participants, workOrder.Status.ToString(), cancellationToken: cancellationToken);
        return MaintenanceApiResult<MaintenanceWorkOrderDto>.Success(MapWorkOrder(workOrder));
    }

    public async Task<MaintenanceApiResult<MaintenanceCompletionDto>> SubmitCompletionAsync(long id, SubmitMaintenanceCompletionDto command, CancellationToken cancellationToken = default)
    {
        var access = await AssignedOrManagerRequest(id, cancellationToken);
        if (access.Actor is null) return Unauthorized<MaintenanceCompletionDto>();
        if (access.Request is null) return NotFound<MaintenanceCompletionDto>();
        if (string.IsNullOrWhiteSpace(command.ResolutionNotes) || command.FinalCost < 0)
            return BadRequest<MaintenanceCompletionDto>("Resolution notes and completion evidence are required.");
        var workOrder = access.Request.WorkOrders.SingleOrDefault(x => x.Id == command.WorkOrderId);
        if (workOrder is not null && workOrder.VendorId != access.Request.VendorId)
            return NotFound<MaintenanceCompletionDto>();
        if (workOrder?.Status != MaintenanceWorkOrderStatus.InProgress)
            return Conflict<MaintenanceCompletionDto>("maintenance.work_order_not_in_progress", "Work must be in progress before completion can be submitted.");
        if (access.Request.Completions.Any(x => x.Status == MaintenanceCompletionStatus.Submitted))
            return Conflict<MaintenanceCompletionDto>("maintenance.completion_pending", "Tenant confirmation is already pending.");
        var evidenceIds = await db.MaintenanceAttachments.Where(x => x.MaintenanceRequestId == id &&
                x.Purpose == MaintenanceAttachmentPurpose.Completion && x.ResolutionCycle == access.Request.ResolutionCycle &&
                x.LifecycleState == MaintenanceAttachmentLifecycleState.Active)
            .OrderBy(x => x.Id).Select(x => x.Id).ToListAsync(cancellationToken);
        if (evidenceIds.Count == 0)
            return BadRequest<MaintenanceCompletionDto>("Recorded completion photo or video evidence is required.");
        var now = timeProvider.GetUtcNow();
        var completion = new MaintenanceCompletion { MaintenanceRequestId = id, MaintenanceWorkOrderId = workOrder.Id, Status = MaintenanceCompletionStatus.Submitted, Version = 1, ResolutionNotes = command.ResolutionNotes.Trim(), CompletionEvidenceReference = $"attachments:{string.Join(',', evidenceIds)}", FinalCost = command.FinalCost, CompletedAtUtc = now, CompletedByUserId = access.Actor.UserId, TenantConfirmationDueAtUtc = now.AddDays(3), CreatedAtUtc = now };
        access.Request.Completions.Add(completion); access.Request.Status = EMaintenanceStatus.AwaitingTenant;
        workOrder.Status = MaintenanceWorkOrderStatus.Completed; workOrder.Version++; workOrder.UpdatedAtUtc = now;
        await db.SaveChangesAsync(cancellationToken);
        await RecordActivity(access.Request, access.Actor.UserId, "completion.submitted", "completion", completion.Id,
            "Maintenance completion submitted", MaintenanceActivityVisibility.Participants, completion.Status.ToString(), cancellationToken: cancellationToken);
        return MaintenanceApiResult<MaintenanceCompletionDto>.Success(MapCompletion(completion));
    }

    public Task<MaintenanceApiResult<MaintenanceCompletionDto>> ConfirmCompletionAsync(long id, long completionId, CompletionDecisionCommandDto command, CancellationToken cancellationToken = default) =>
        TenantCompletionDecision(id, completionId, command.ExpectedVersion, null, cancellationToken);

    public Task<MaintenanceApiResult<MaintenanceCompletionDto>> ReopenCompletionAsync(long id, long completionId, CompletionReasonCommandDto command, CancellationToken cancellationToken = default) =>
        TenantCompletionDecision(id, completionId, command.ExpectedVersion, command.Reason, cancellationToken);

    private async Task<MaintenanceApiResult<MaintenanceCompletionDto>> TenantCompletionDecision(long id, long completionId, int expectedVersion, string? reopenReason, CancellationToken cancellationToken)
    {
        var actor = await actors.GetCurrentAsync(cancellationToken);
        if (actor is null) return Unauthorized<MaintenanceCompletionDto>();
        var request = await TenantRequest(id, actor.UserId, cancellationToken);
        if (request is null) return NotFound<MaintenanceCompletionDto>();
        var completion = request.Completions.SingleOrDefault(x => x.Id == completionId);
        if (completion is null) return NotFound<MaintenanceCompletionDto>();
        if (completion.Version != expectedVersion) return Conflict<MaintenanceCompletionDto>("maintenance.version_conflict", "The completion version is stale.");
        if (completion.Status != MaintenanceCompletionStatus.Submitted) return Conflict<MaintenanceCompletionDto>("maintenance.completion_invalid_state", "Only a submitted completion can be decided.");
        if (reopenReason is not null && string.IsNullOrWhiteSpace(reopenReason)) return BadRequest<MaintenanceCompletionDto>("A reopen reason is required.");
        var now = timeProvider.GetUtcNow(); completion.Version++; completion.DecidedAtUtc = now; completion.DecidedByUserId = actor.UserId;
        if (reopenReason is null) { completion.Status = MaintenanceCompletionStatus.Accepted; completion.ConfirmedByUserId = actor.UserId; request.Status = EMaintenanceStatus.Resolved; }
        else { completion.Status = MaintenanceCompletionStatus.Disputed; completion.DecisionReason = reopenReason.Trim(); request.Status = EMaintenanceStatus.Assigned; request.ResolutionCycle++; }
        await using var transaction = db.Database.IsRelational()
            ? await db.Database.BeginTransactionAsync(cancellationToken)
            : null;
        await db.SaveChangesAsync(cancellationToken);
        if (reopenReason is null)
            await RecordMaintenanceClosedAsync(request, completion, now, actor.UserId, cancellationToken);
        await RecordActivity(request, actor.UserId, reopenReason is null ? "completion.tenantConfirmed" : "completion.reopened", "completion", completion.Id,
            reopenReason is null ? "Tenant confirmed maintenance completion" : "Tenant reopened maintenance request",
            MaintenanceActivityVisibility.Participants, completion.Status.ToString(), completion.DecisionReason, cancellationToken);
        if (transaction is not null)
            await transaction.CommitAsync(cancellationToken);
        return MaintenanceApiResult<MaintenanceCompletionDto>.Success(MapCompletion(completion));
    }

    public async Task<MaintenanceApiResult<MaintenanceCompletionDto>> StaffCloseCompletionAsync(long id, long completionId, CompletionReasonCommandDto command, CancellationToken cancellationToken = default)
    {
        var actor = await actors.GetCurrentAsync(cancellationToken);
        if (actor is null) return Unauthorized<MaintenanceCompletionDto>();
        var request = await ManagerRequest(id, actor.UserId, cancellationToken);
        if (request is null) return NotFound<MaintenanceCompletionDto>();
        var completion = request.Completions.SingleOrDefault(x => x.Id == completionId);
        if (completion is null) return NotFound<MaintenanceCompletionDto>();
        if (completion.Version != command.ExpectedVersion) return Conflict<MaintenanceCompletionDto>("maintenance.version_conflict", "The completion version is stale.");
        if (completion.Status != MaintenanceCompletionStatus.Submitted) return Conflict<MaintenanceCompletionDto>("maintenance.completion_invalid_state", "Only a submitted completion can be closed.");
        if (timeProvider.GetUtcNow() < completion.TenantConfirmationDueAtUtc) return Conflict<MaintenanceCompletionDto>("maintenance.confirmation_due_not_reached", "Tenant confirmation time has not elapsed.");
        if (string.IsNullOrWhiteSpace(command.Reason)) return BadRequest<MaintenanceCompletionDto>("A staff-close reason is required.");
        completion.Status = MaintenanceCompletionStatus.Accepted; completion.Version++; completion.DecidedByUserId = actor.UserId; completion.DecidedAtUtc = timeProvider.GetUtcNow(); completion.DecisionReason = command.Reason.Trim(); request.Status = EMaintenanceStatus.Resolved;
        await using var transaction = db.Database.IsRelational()
            ? await db.Database.BeginTransactionAsync(cancellationToken)
            : null;
        await db.SaveChangesAsync(cancellationToken);
        await RecordMaintenanceClosedAsync(request, completion, completion.DecidedAtUtc.Value, actor.UserId, cancellationToken);
        await RecordActivity(request, actor.UserId, "completion.staffClosed", "completion", completion.Id,
            "Staff closed maintenance completion", MaintenanceActivityVisibility.Participants, completion.Status.ToString(), completion.DecisionReason, cancellationToken);
        if (transaction is not null)
            await transaction.CommitAsync(cancellationToken);
        return MaintenanceApiResult<MaintenanceCompletionDto>.Success(MapCompletion(completion));
    }

    private async Task RecordMaintenanceClosedAsync(MaintenanceRequest request, MaintenanceCompletion completion,
        DateTimeOffset occurredAtUtc, long actorUserId, CancellationToken cancellationToken)
    {
        if (activationRecorder is null || request.OrganizationId is not > 0 ||
            request.Property.OrganizationId != request.OrganizationId) return;
        await activationRecorder.RecordAsync(new ActivationOccurrenceRequest(
            request.OrganizationId.Value,
            ActivationMilestones.MaintenanceClosed,
            $"maintenance_request:{request.Id}",
            occurredAtUtc,
            SourceEventType: "maintenance_completion",
            SourceEventId: completion.Id.ToString(System.Globalization.CultureInfo.InvariantCulture),
            ActorUserId: actorUserId), cancellationToken);
    }

    public async Task<MaintenanceApiResult<MaintenanceCostProjectionDto>> GetCostProjectionAsync(long id, CancellationToken cancellationToken = default)
    {
        var actor = await actors.GetCurrentAsync(cancellationToken);
        if (actor is null) return Unauthorized<MaintenanceCostProjectionDto>();
        var request = await ManagerRequest(id, actor.UserId, cancellationToken);
        if (request is null) return NotFound<MaintenanceCostProjectionDto>();
        var approved = request.Estimates.Where(x => x.Status == MaintenanceEstimateStatus.Approved).OrderByDescending(x => x.Version).Select(x => (decimal?)x.Amount).FirstOrDefault();
        var actual = await db.Expenses.Where(x => x.MaintenanceRequestId == id).SumAsync(x => x.Amount, cancellationToken);
        return MaintenanceApiResult<MaintenanceCostProjectionDto>.Success(new(approved, actual, approved.HasValue ? actual - approved.Value : null));
    }

    private async Task<(MaintenanceActor? Actor, MaintenanceRequest? Request)> AssignedOrManagerRequest(long id, CancellationToken cancellationToken)
    {
        var actor = await actors.GetCurrentAsync(cancellationToken);
        if (actor is null) return (null, null);
        var request = await DetailedRequests(true).SingleOrDefaultAsync(x => x.Id == id && (
            x.Property.LandlordId == actor.UserId ||
            x.OrganizationId != null && db.OrganizationMembers.Any(m => m.OrganizationId == x.OrganizationId && m.UserId == actor.UserId && m.IsActive && m.CanManageMaintenance) ||
            x.AssignedToType == EAssignedToType.Vendor && x.VendorId != null && x.OrganizationId != null &&
                db.Vendors.Any(v => v.Id == x.VendorId && v.PortalUserId == actor.UserId && v.OrganizationId == x.OrganizationId && v.IsActive && !v.IsDeleted) ||
            x.AssignedToType == EAssignedToType.OrganizationMember && x.AssignedToUserId == actor.UserId && x.OrganizationId != null &&
                db.OrganizationMembers.Any(m => m.OrganizationId == x.OrganizationId && m.UserId == actor.UserId && m.IsActive)), cancellationToken);
        return (actor, request);
    }

    private static MaintenanceApiResult<T> Unauthorized<T>() => MaintenanceApiResult<T>.Error(MaintenanceApiResultCode.Unauthorized, "Authentication is required.");
    private static MaintenanceApiResult<T> NotFound<T>() => MaintenanceApiResult<T>.Error(MaintenanceApiResultCode.NotFound, NotFoundMessage);
    private static MaintenanceApiResult<T> BadRequest<T>(string message) => MaintenanceApiResult<T>.Error(MaintenanceApiResultCode.BadRequest, message);
    private static MaintenanceApiResult<T> Conflict<T>(string code, string message) => MaintenanceApiResult<T>.Error(MaintenanceApiResultCode.Conflict, message, code);

    private static MaintenanceEstimateDto MapEstimate(MaintenanceEstimate x) => new(x.Id, x.Version, x.Status, x.Amount, x.Currency, x.Scope, x.ValidUntilUtc, x.SubmittedByUserId, x.ApprovedByUserId, x.DecisionReason);
    private static MaintenanceWorkOrderDto MapWorkOrder(MaintenanceWorkOrder x) => new(x.Id, x.Version, x.Status, x.MaintenanceEstimateId, x.Scope, x.AuthorizedAmount, x.DueAtUtc, x.IssuedByUserId, x.CancellationReason);
    private static MaintenanceAppointmentDto MapAppointment(MaintenanceAppointment x) => new(x.Id, x.Version, x.Status, x.MaintenanceWorkOrderId!.Value, x.StartsAtUtc, x.EndsAtUtc, x.Notes, x.ProposedByUserId, x.ConfirmedByUserId, x.CancellationReason);
    private static MaintenanceCompletionDto MapCompletion(MaintenanceCompletion x, bool hideInternalCost = false) => new(x.Id, x.Version, x.Status, x.MaintenanceWorkOrderId!.Value, x.ResolutionNotes, x.CompletionEvidenceReference, hideInternalCost ? 0 : x.FinalCost, x.CompletedByUserId, x.TenantConfirmationDueAtUtc, x.ConfirmedByUserId, x.DecisionReason);
}
