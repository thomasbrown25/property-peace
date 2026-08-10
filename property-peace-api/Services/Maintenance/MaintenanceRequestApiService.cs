using System.Text.Json;
using System.Text.Json.Serialization;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Maintenance;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.MaintenanceTriage;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.Maintenance;

public sealed record MaintenanceActor(long UserId, bool IsTenant, bool IsLandlord, bool IsVendor = false);

public interface IMaintenanceActorAccessor
{
    Task<MaintenanceActor?> GetCurrentAsync(CancellationToken cancellationToken = default);
}

public sealed class MaintenanceActorAccessor(IUserRepository users) : IMaintenanceActorAccessor
{
    public async Task<MaintenanceActor?> GetCurrentAsync(CancellationToken cancellationToken = default)
    {
        var user = await users.GetCurrentUser();
        if (user is null || user.Id <= 0) return null;
        return new MaintenanceActor(
            user.Id,
            user.Roles.Contains("Tenant", StringComparer.OrdinalIgnoreCase),
            user.Roles.Any(role => role is "Landlord" or "Admin"),
            user.Roles.Contains("Vendor", StringComparer.OrdinalIgnoreCase));
    }
}

public enum MaintenanceApiResultCode { Success, BadRequest, NotFound, Conflict, Unauthorized }

public sealed record MaintenanceApiResult<T>(MaintenanceApiResultCode Code, T? Value = default, string? Message = null, string? ErrorCode = null)
{
    public static MaintenanceApiResult<T> Success(T value) => new(MaintenanceApiResultCode.Success, value);
    public static MaintenanceApiResult<T> Error(MaintenanceApiResultCode code, string message, string? errorCode = null) => new(code, default, message, errorCode);
}

public interface IMaintenanceRequestApiService
{
    Task<MaintenanceApiResult<MaintenanceRequestDetailDto>> CreateAsync(CreateMaintenanceRequestDto dto, CancellationToken cancellationToken = default);
    Task<MaintenanceApiResult<MaintenanceRequestDetailDto>> GetAsync(long id, CancellationToken cancellationToken = default);
    Task<MaintenanceApiResult<IReadOnlyList<MaintenanceRequestDetailDto>>> ListAsync(CancellationToken cancellationToken = default);
    Task<MaintenanceApiResult<MaintenanceRequestDetailDto>> AcknowledgeAsync(long id, CancellationToken cancellationToken = default);
    Task<MaintenanceApiResult<MaintenanceTroubleshootingStepDto>> TroubleshootAsync(long id, PercyTroubleshootingCommandDto command, CancellationToken cancellationToken = default);
    Task<MaintenanceApiResult<MaintenanceTroubleshootingStepDto>> RecordTroubleshootingOutcomeAsync(long id, long stepId, PercyTroubleshootingOutcomeCommandDto command, CancellationToken cancellationToken = default);
    Task<MaintenanceApiResult<MaintenanceAssignmentDto>> AssignAsync(long id, AssignMaintenanceCommandDto command, CancellationToken cancellationToken = default);
    Task<MaintenanceApiResult<MaintenanceEstimateDto>> SubmitEstimateAsync(long id, SubmitMaintenanceEstimateDto command, CancellationToken cancellationToken = default);
    Task<MaintenanceApiResult<MaintenanceEstimateDto>> ApproveEstimateAsync(long id, long estimateId, EstimateVersionCommandDto command, CancellationToken cancellationToken = default);
    Task<MaintenanceApiResult<MaintenanceEstimateDto>> RejectEstimateAsync(long id, long estimateId, RejectEstimateCommandDto command, CancellationToken cancellationToken = default);
    Task<MaintenanceApiResult<MaintenanceWorkOrderDto>> IssueWorkOrderAsync(long id, IssueMaintenanceWorkOrderDto command, CancellationToken cancellationToken = default);
    Task<MaintenanceApiResult<MaintenanceWorkOrderDto>> CancelWorkOrderAsync(long id, long workOrderId, CancelMaintenanceWorkOrderDto command, CancellationToken cancellationToken = default);
    Task<MaintenanceApiResult<MaintenanceAppointmentDto>> ProposeAppointmentAsync(long id, ProposeMaintenanceAppointmentDto command, CancellationToken cancellationToken = default);
    Task<MaintenanceApiResult<MaintenanceAppointmentDto>> ConfirmAppointmentAsync(long id, long appointmentId, WorkflowVersionCommandDto command, CancellationToken cancellationToken = default);
    Task<MaintenanceApiResult<MaintenanceAppointmentDto>> CancelAppointmentAsync(long id, long appointmentId, CancelMaintenanceAppointmentDto command, CancellationToken cancellationToken = default);
    Task<MaintenanceApiResult<MaintenanceWorkOrderDto>> StartWorkAsync(long id, long workOrderId, WorkflowVersionCommandDto command, CancellationToken cancellationToken = default);
    Task<MaintenanceApiResult<MaintenanceCompletionDto>> SubmitCompletionAsync(long id, SubmitMaintenanceCompletionDto command, CancellationToken cancellationToken = default);
    Task<MaintenanceApiResult<MaintenanceCompletionDto>> ConfirmCompletionAsync(long id, long completionId, CompletionDecisionCommandDto command, CancellationToken cancellationToken = default);
    Task<MaintenanceApiResult<MaintenanceCompletionDto>> ReopenCompletionAsync(long id, long completionId, CompletionReasonCommandDto command, CancellationToken cancellationToken = default);
    Task<MaintenanceApiResult<MaintenanceCompletionDto>> StaffCloseCompletionAsync(long id, long completionId, CompletionReasonCommandDto command, CancellationToken cancellationToken = default);
    Task<MaintenanceApiResult<MaintenanceCostProjectionDto>> GetCostProjectionAsync(long id, CancellationToken cancellationToken = default);
}

public sealed partial class MaintenanceRequestApiService(
    DataContext db,
    IMaintenanceActorAccessor actors,
    MaintenanceTriagePolicyV1 triagePolicy,
    TimeProvider timeProvider,
    IMaintenanceActivityService? activity = null) : IMaintenanceRequestApiService
{
    private static readonly JsonSerializerOptions StoredJson = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() }
    };

    // Percy never executes or repeats arbitrary text. Only these non-invasive observation/reset steps can be stored.
    private static readonly IReadOnlyDictionary<string, string> SafeSteps = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["check-thermostat-settings"] = "Confirm the thermostat is on, set to the intended mode, and set above or below the current room temperature as appropriate.",
        ["check-gfci-reset"] = "Press the RESET button on an accessible GFCI outlet once. Stop if there is heat, smoke, sparking, a burning smell, or visible damage.",
        ["check-faucet-aerator"] = "With the faucet off, check whether the removable aerator at the spout is visibly blocked. Do not use tools or disassemble plumbing."
    };

    public async Task<MaintenanceApiResult<MaintenanceRequestDetailDto>> CreateAsync(CreateMaintenanceRequestDto dto, CancellationToken cancellationToken = default)
    {
        var actor = await actors.GetCurrentAsync(cancellationToken);
        if (actor is null) return MaintenanceApiResult<MaintenanceRequestDetailDto>.Error(MaintenanceApiResultCode.Unauthorized, "Authentication is required.");
        if (!actor.IsTenant) return MaintenanceApiResult<MaintenanceRequestDetailDto>.Error(MaintenanceApiResultCode.NotFound, "Maintenance request not found.");
        if (dto.PropertyId <= 0 || dto.UnitId <= 0 || string.IsNullOrWhiteSpace(dto.Description) ||
            dto.Description.Trim().Length > 4000 || dto.Location?.Trim().Length > 500 || dto.PreferredWindows?.Count > 10)
            return MaintenanceApiResult<MaintenanceRequestDetailDto>.Error(MaintenanceApiResultCode.BadRequest, "Property, unit, and description are required.");
        if (dto.Signals is null || dto.Signals.Any(signal => !Enum.IsDefined(signal)) || dto.PreferredWindows is null || dto.PreferredWindows.Any(window => window.EndsAtUtc <= window.StartsAtUtc))
            return MaintenanceApiResult<MaintenanceRequestDetailDto>.Error(MaintenanceApiResultCode.BadRequest, "Structured intake is invalid.");

        var leaseScope = await db.TenantLeases
            .Where(link => link.Tenant.UserId == actor.UserId && !link.Tenant.IsDeleted &&
                           link.Lease.IsActive && !link.Lease.IsDeleted &&
                           link.Lease.UnitId == dto.UnitId && link.Lease.Unit.PropertyId == dto.PropertyId)
            .Select(link => new { link.TenantId, link.LeaseId, link.Lease.OrganizationId, UnitName = link.Lease.Unit.Name })
            .SingleOrDefaultAsync(cancellationToken);
        if (leaseScope is null)
            return MaintenanceApiResult<MaintenanceRequestDetailDto>.Error(MaintenanceApiResultCode.NotFound, "Maintenance request scope not found.");

        var normalizedDescription = dto.Description.Trim();
        var normalizedLocation = string.IsNullOrWhiteSpace(dto.Location) ? null : dto.Location.Trim();
        var windows = dto.PreferredWindows.OrderBy(window => window.StartsAtUtc).ToArray();
        var triage = triagePolicy.Evaluate(new MaintenanceTriageInput(
            normalizedLocation,
            normalizedDescription,
            dto.Signals,
            dto.HasPhotos,
            windows.Length > 0));
        var title = string.IsNullOrWhiteSpace(dto.Title)
            ? (normalizedDescription.Length <= 60 ? normalizedDescription : normalizedDescription[..57].TrimEnd() + "...")
            : dto.Title.Trim();
        if (title.Length > 100) title = title[..100];

        var request = new MaintenanceRequest
        {
            PropertyId = dto.PropertyId,
            UnitId = dto.UnitId,
            UnitName = leaseScope.UnitName,
            OrganizationId = leaseScope.OrganizationId,
            SubmittedByUserId = actor.UserId,
            SubmittedByTenantId = leaseScope.TenantId,
            SubmittedUnderLeaseId = leaseScope.LeaseId,
            Title = title,
            Description = normalizedDescription,
            LocationDetails = normalizedLocation,
            Status = EMaintenanceStatus.Reported,
            Priority = triage.Urgency == MaintenanceUrgency.Routine ? EMaintenancePriority.Medium : EMaintenancePriority.High,
            Urgency = triage.Urgency,
            StructuredIntakeJson = JsonSerializer.Serialize(new
            {
                location = normalizedLocation,
                description = normalizedDescription,
                signals = dto.Signals.Distinct().OrderBy(x => x.ToString(), StringComparer.Ordinal).ToArray(),
                hasPhotos = dto.HasPhotos,
                hasPreferredAccessWindows = windows.Length > 0
            }, StoredJson),
            TriagePolicyVersion = triage.PolicyVersion,
            LandlordSummary = triage.LandlordSummary,
            MissingInformationJson = JsonSerializer.Serialize(triage.MissingInformation, StoredJson),
            StopTroubleshooting = triage.StopTroubleshooting,
            TriagedAtUtc = triage.TriagedAtUtc,
            AcknowledgeByUtc = triage.AcknowledgeByUtc,
            ActionByUtc = triage.ActionByUtc,
            CreatedAt = triage.TriagedAtUtc.UtcDateTime,
            UpdatedAt = triage.TriagedAtUtc.UtcDateTime,
            PreferredWindows = windows.Select(window => new MaintenancePreferredWindow
            {
                StartsAtUtc = window.StartsAtUtc,
                EndsAtUtc = window.EndsAtUtc,
                AccessInstructions = NormalizeOptional(window.AccessInstructions, 1000),
                CreatedAtUtc = triage.TriagedAtUtc
            }).ToList()
        };
        db.MaintenanceRequests.Add(request);
        await db.SaveChangesAsync(cancellationToken);
        await RecordActivity(request, actor.UserId, "request.created", "maintenanceRequest", request.Id,
            "Maintenance request created", MaintenanceActivityVisibility.Participants, request.Status.ToString(), cancellationToken: cancellationToken);
        if (request.Urgency == MaintenanceUrgency.Emergency)
            await RecordActivity(request, actor.UserId, "emergency.escalated", "maintenanceRequest", request.Id,
                "Emergency maintenance escalated", MaintenanceActivityVisibility.Participants, request.Urgency.ToString(), cancellationToken: cancellationToken);
        return MaintenanceApiResult<MaintenanceRequestDetailDto>.Success(Map(request));
    }

    public async Task<MaintenanceApiResult<MaintenanceRequestDetailDto>> GetAsync(long id, CancellationToken cancellationToken = default)
    {
        var actor = await actors.GetCurrentAsync(cancellationToken);
        if (actor is null) return MaintenanceApiResult<MaintenanceRequestDetailDto>.Error(MaintenanceApiResultCode.Unauthorized, "Authentication is required.");
        var request = await ScopedRequest(id, actor, tracking: false, cancellationToken);
        return request is null
            ? MaintenanceApiResult<MaintenanceRequestDetailDto>.Error(MaintenanceApiResultCode.NotFound, "Maintenance request not found.")
            : MaintenanceApiResult<MaintenanceRequestDetailDto>.Success(Map(request, actor));
    }

    public async Task<MaintenanceApiResult<IReadOnlyList<MaintenanceRequestDetailDto>>> ListAsync(CancellationToken cancellationToken = default)
    {
        var actor = await actors.GetCurrentAsync(cancellationToken);
        if (actor is null) return MaintenanceApiResult<IReadOnlyList<MaintenanceRequestDetailDto>>.Error(MaintenanceApiResultCode.Unauthorized, "Authentication is required.");
        var requests = await ScopedRequests(actor, tracking: false).OrderByDescending(x => x.UpdatedAt).ToListAsync(cancellationToken);
        return MaintenanceApiResult<IReadOnlyList<MaintenanceRequestDetailDto>>.Success(requests.Select(x => Map(x, actor)).ToArray());
    }

    public async Task<MaintenanceApiResult<MaintenanceRequestDetailDto>> AcknowledgeAsync(long id, CancellationToken cancellationToken = default)
    {
        var actor = await actors.GetCurrentAsync(cancellationToken);
        if (actor is null) return MaintenanceApiResult<MaintenanceRequestDetailDto>.Error(MaintenanceApiResultCode.Unauthorized, "Authentication is required.");
        var request = await ManagerRequest(id, actor.UserId, cancellationToken);
        if (request is null) return MaintenanceApiResult<MaintenanceRequestDetailDto>.Error(MaintenanceApiResultCode.NotFound, "Maintenance request not found.");
        if (request.Status == EMaintenanceStatus.Acknowledged)
            return MaintenanceApiResult<MaintenanceRequestDetailDto>.Success(Map(request));
        if (request.Status != EMaintenanceStatus.Reported)
            return MaintenanceApiResult<MaintenanceRequestDetailDto>.Error(MaintenanceApiResultCode.Conflict, "Only a reported request can be acknowledged.");
        request.Status = EMaintenanceStatus.Acknowledged;
        await db.SaveChangesAsync(cancellationToken);
        await RecordActivity(request, actor.UserId, "request.acknowledged", "maintenanceRequest", request.Id,
            "Maintenance request acknowledged", MaintenanceActivityVisibility.Participants, request.Status.ToString(), cancellationToken: cancellationToken);
        return MaintenanceApiResult<MaintenanceRequestDetailDto>.Success(Map(request));
    }

    public async Task<MaintenanceApiResult<MaintenanceTroubleshootingStepDto>> TroubleshootAsync(long id, PercyTroubleshootingCommandDto command, CancellationToken cancellationToken = default)
    {
        var actor = await actors.GetCurrentAsync(cancellationToken);
        if (actor is null) return MaintenanceApiResult<MaintenanceTroubleshootingStepDto>.Error(MaintenanceApiResultCode.Unauthorized, "Authentication is required.");
        if (!actor.IsTenant) return MaintenanceApiResult<MaintenanceTroubleshootingStepDto>.Error(MaintenanceApiResultCode.NotFound, "Maintenance request not found.");
        if (string.IsNullOrWhiteSpace(command.StepKey) || command.StepKey.Length > 100 ||
            string.IsNullOrWhiteSpace(command.StepCode) || command.StepCode.Length > 100)
            return MaintenanceApiResult<MaintenanceTroubleshootingStepDto>.Error(MaintenanceApiResultCode.BadRequest, "Step and safe step code are required.");

        var request = await TenantRequest(id, actor.UserId, cancellationToken);
        if (request is null) return MaintenanceApiResult<MaintenanceTroubleshootingStepDto>.Error(MaintenanceApiResultCode.NotFound, "Maintenance request not found.");

        var cycleKey = request.ResolutionCycle.ToString(System.Globalization.CultureInfo.InvariantCulture);
        if (request.Urgency == MaintenanceUrgency.Emergency)
            return MaintenanceApiResult<MaintenanceTroubleshootingStepDto>.Error(MaintenanceApiResultCode.Conflict, "Percy troubleshooting is disabled for emergency requests.");
        if (request.StopTroubleshooting)
            return MaintenanceApiResult<MaintenanceTroubleshootingStepDto>.Error(MaintenanceApiResultCode.Conflict, "Troubleshooting has stopped for safety.");
        if (command.IsWorsening || command.HasNewEmergency)
        {
            request.StopTroubleshooting = true;
            await db.SaveChangesAsync(cancellationToken);
            await RecordActivity(request, actor.UserId, "troubleshooting.stopped", "maintenanceRequest", request.Id,
                "Troubleshooting stopped for safety", MaintenanceActivityVisibility.Participants, "stopped", cancellationToken: cancellationToken);
            return MaintenanceApiResult<MaintenanceTroubleshootingStepDto>.Error(MaintenanceApiResultCode.Conflict, "Troubleshooting stopped. Leave the area if needed and contact emergency services for immediate danger.");
        }
        var existingByKey = request.TroubleshootingSteps.SingleOrDefault(step =>
            step.ResolutionCycleKey == cycleKey && step.StepKey == command.StepKey);
        if (existingByKey is not null) return MaintenanceApiResult<MaintenanceTroubleshootingStepDto>.Success(Map(existingByKey));
        if (!SafeSteps.TryGetValue(command.StepCode, out var instruction))
            return MaintenanceApiResult<MaintenanceTroubleshootingStepDto>.Error(MaintenanceApiResultCode.BadRequest, "The requested troubleshooting step is not allowlisted.");
        var existing = request.TroubleshootingSteps.SingleOrDefault(step =>
            step.ResolutionCycleKey == cycleKey && step.StepCode == command.StepCode);
        if (existing is not null) return MaintenanceApiResult<MaintenanceTroubleshootingStepDto>.Success(Map(existing));
        if (request.TroubleshootingSteps.Count(step => step.ResolutionCycleKey == cycleKey) >= 3)
            return MaintenanceApiResult<MaintenanceTroubleshootingStepDto>.Error(MaintenanceApiResultCode.Conflict, "This resolution cycle has reached its three-step safety limit.");

        var step = new MaintenanceTroubleshootingStep
        {
            MaintenanceRequestId = request.Id,
            ResolutionCycleKey = cycleKey,
            StepKey = command.StepKey,
            StepCode = command.StepCode,
            Sequence = request.TroubleshootingSteps.Count == 0 ? 1 : request.TroubleshootingSteps.Max(x => x.Sequence) + 1,
            Instruction = instruction,
            Outcome = MaintenanceTroubleshootingOutcome.Pending,
            CreatedAtUtc = timeProvider.GetUtcNow()
        };
        request.TroubleshootingSteps.Add(step);
        await db.SaveChangesAsync(cancellationToken);
        await RecordActivity(request, actor.UserId, "troubleshooting.issued", "troubleshootingStep", step.Id,
            "Safe troubleshooting step issued", MaintenanceActivityVisibility.Participants, step.Outcome.ToString(), cancellationToken: cancellationToken);
        return MaintenanceApiResult<MaintenanceTroubleshootingStepDto>.Success(Map(step));
    }

    public async Task<MaintenanceApiResult<MaintenanceTroubleshootingStepDto>> RecordTroubleshootingOutcomeAsync(
        long id, long stepId, PercyTroubleshootingOutcomeCommandDto command, CancellationToken cancellationToken = default)
    {
        var actor = await actors.GetCurrentAsync(cancellationToken);
        if (actor is null) return Unauthorized<MaintenanceTroubleshootingStepDto>();
        if (!actor.IsTenant) return NotFound<MaintenanceTroubleshootingStepDto>();
        var request = await TenantRequest(id, actor.UserId, cancellationToken);
        if (request is null) return NotFound<MaintenanceTroubleshootingStepDto>();
        var cycleKey = request.ResolutionCycle.ToString(System.Globalization.CultureInfo.InvariantCulture);
        var step = request.TroubleshootingSteps.SingleOrDefault(x => x.Id == stepId && x.ResolutionCycleKey == cycleKey);
        if (step is null) return NotFound<MaintenanceTroubleshootingStepDto>();
        if (step.Outcome != MaintenanceTroubleshootingOutcome.Pending)
            return Conflict<MaintenanceTroubleshootingStepDto>("maintenance.troubleshooting_already_decided", "This troubleshooting step already has an outcome.");
        if (command.Outcome == MaintenanceTroubleshootingOutcome.Pending || !Enum.IsDefined(command.Outcome))
            return BadRequest<MaintenanceTroubleshootingStepDto>("A terminal troubleshooting outcome is required.");

        step.Outcome = command.Outcome;
        step.TenantResponse = NormalizeOptional(command.TenantResponse, 2000);
        step.AttemptedAtUtc = timeProvider.GetUtcNow();
        if (command.Outcome == MaintenanceTroubleshootingOutcome.StoppedForSafety) request.StopTroubleshooting = true;
        await db.SaveChangesAsync(cancellationToken);
        await RecordActivity(request, actor.UserId,
            command.Outcome == MaintenanceTroubleshootingOutcome.StoppedForSafety ? "troubleshooting.stopped" : "troubleshooting.responded",
            "troubleshootingStep", step.Id, "Troubleshooting outcome recorded", MaintenanceActivityVisibility.Participants,
            step.Outcome.ToString(), cancellationToken: cancellationToken);
        return MaintenanceApiResult<MaintenanceTroubleshootingStepDto>.Success(Map(step));
    }

    private Task<MaintenanceRequest?> ScopedRequest(long id, MaintenanceActor actor, bool tracking, CancellationToken cancellationToken) =>
        ScopedRequests(actor, tracking).SingleOrDefaultAsync(request => request.Id == id, cancellationToken);

    private IQueryable<MaintenanceRequest> ScopedRequests(MaintenanceActor actor, bool tracking) =>
        DetailedRequests(tracking).Where(request =>
            request.Property.LandlordId == actor.UserId ||
            request.OrganizationId != null && db.OrganizationMembers.Any(member => member.OrganizationId == request.OrganizationId && member.UserId == actor.UserId && member.IsActive && member.CanManageMaintenance) ||
            request.AssignedToType == EAssignedToType.Vendor && request.VendorId != null && request.OrganizationId != null &&
                db.Vendors.Any(vendor => vendor.Id == request.VendorId && vendor.PortalUserId == actor.UserId && vendor.OrganizationId == request.OrganizationId && vendor.IsActive && !vendor.IsDeleted) ||
            request.AssignedToType == EAssignedToType.OrganizationMember && request.AssignedToUserId == actor.UserId && request.OrganizationId != null &&
                db.OrganizationMembers.Any(member => member.OrganizationId == request.OrganizationId && member.UserId == actor.UserId && member.IsActive) ||
            request.SubmittedByUserId == actor.UserId ||
            request.SubmittedByUserId == null && request.SubmittedByTenantId != null &&
                db.Tenants.Any(tenant => tenant.Id == request.SubmittedByTenantId && tenant.UserId == actor.UserId) ||
            request.SubmittedByUserId == null && request.SubmittedByTenantId == null &&
                db.Conversations.Any(conversation => conversation.TenantId != null &&
                    (conversation.Id == request.ConversationId || conversation.MaintenanceRequestId == request.Id) &&
                    db.Tenants.Any(tenant => tenant.Id == conversation.TenantId && tenant.UserId == actor.UserId)));

    private Task<MaintenanceRequest?> ManagerRequest(long id, long userId, CancellationToken cancellationToken) =>
        DetailedRequests(true).SingleOrDefaultAsync(request => request.Id == id && (
            request.Property.LandlordId == userId ||
            request.OrganizationId != null && db.OrganizationMembers.Any(member => member.OrganizationId == request.OrganizationId && member.UserId == userId && member.IsActive && member.CanManageMaintenance)
        ), cancellationToken);

    private Task<MaintenanceRequest?> TenantRequest(long id, long userId, CancellationToken cancellationToken) =>
        DetailedRequests(true).SingleOrDefaultAsync(request => request.Id == id && (
            request.SubmittedByUserId == userId ||
            request.SubmittedByUserId == null && request.SubmittedByTenantId != null &&
                db.Tenants.Any(tenant => tenant.Id == request.SubmittedByTenantId && tenant.UserId == userId) ||
            request.SubmittedByUserId == null && request.SubmittedByTenantId == null &&
                db.Conversations.Any(conversation => conversation.TenantId != null &&
                    (conversation.Id == request.ConversationId || conversation.MaintenanceRequestId == request.Id) &&
                    db.Tenants.Any(tenant => tenant.Id == conversation.TenantId && tenant.UserId == userId))), cancellationToken);

    private IQueryable<MaintenanceRequest> DetailedRequests(bool tracking)
    {
        var query = db.MaintenanceRequests.Include(x => x.Property).Include(x => x.PreferredWindows).Include(x => x.TroubleshootingSteps)
            .Include(x => x.Estimates).Include(x => x.WorkOrders).Include(x => x.Appointments).Include(x => x.Completions)
            .Include(x => x.Attachments).Include(x => x.ActivityEvents).AsSplitQuery();
        return tracking ? query : query.AsNoTracking();
    }

    private MaintenanceRequestDetailDto Map(MaintenanceRequest request, MaintenanceActor? actor = null) => new(
        request.Id, request.PropertyId, request.UnitId, request.Title, request.Description, request.LocationDetails,
        request.Status, request.Urgency, request.TriagePolicyVersion, request.LandlordSummary,
        DeserializeMissing(request.MissingInformationJson), request.StopTroubleshooting, request.TriagedAtUtc,
        request.AcknowledgeByUtc, request.ActionByUtc,
        request.PreferredWindows.OrderBy(x => x.StartsAtUtc).Select(x => new MaintenancePreferredWindowDto(x.Id, x.StartsAtUtc, x.EndsAtUtc, x.AccessInstructions)).ToArray(),
        request.TroubleshootingSteps.OrderBy(x => x.Sequence).Select(Map).ToArray(),
        request.ResolutionCycle,
        request.AssignedToType == EAssignedToType.Unassigned ? null : new MaintenanceAssignmentDto(request.AssignedToType,
            request.AssignedToUserId, request.VendorId, request.EstimateRequired, request.AssignedByUserId, request.AssignedAt),
        actor?.IsTenant == true ? [] : request.Estimates.Where(x => actor?.IsVendor != true || x.VendorId == request.VendorId).OrderBy(x => x.Version).Select(MapEstimate).ToArray(),
        actor?.IsTenant == true ? [] : request.WorkOrders.Where(x => actor?.IsVendor != true || x.VendorId == request.VendorId).OrderBy(x => x.Version).Select(MapWorkOrder).ToArray(),
        request.Appointments.OrderBy(x => x.StartsAtUtc).Select(MapAppointment).ToArray(),
        request.Completions.OrderBy(x => x.CreatedAtUtc).Select(x => MapCompletion(x, actor?.IsTenant == true)).ToArray(),
        request.Attachments.Where(x => x.LifecycleState == MaintenanceAttachmentLifecycleState.Active)
            .OrderBy(x => x.Id).Select(x => new MaintenanceAttachmentDto(x.Id, x.MaintenanceRequestId, x.Purpose,
            x.ResolutionCycle, x.MediaType, x.FileName, x.ContentType, x.SizeBytes, x.UploadedByUserId, x.CreatedAtUtc)).ToArray(),
        request.ActivityEvents.Where(x => actor is null || (!actor.IsTenant && !actor.IsVendor) || x.Visibility == MaintenanceActivityVisibility.Participants)
            .OrderBy(x => x.Id).Select(x => new MaintenanceActivityEventDto(x.Id, x.EventType, x.SubjectType, x.SubjectId,
                x.Visibility, x.Summary, x.OccurredAtUtc)).ToArray(),
        AsUtc(request.CreatedAt), AsUtc(request.UpdatedAt),
        Math.Max(0, (timeProvider.GetUtcNow() - AsUtc(request.CreatedAt)).TotalHours),
        new MaintenanceSlaStatusDto(timeProvider.GetUtcNow(),
            request.AcknowledgeByUtc.HasValue && request.AcknowledgeByUtc.Value < timeProvider.GetUtcNow(),
            request.ActionByUtc.HasValue && request.ActionByUtc.Value < timeProvider.GetUtcNow()));

    private static DateTimeOffset AsUtc(DateTime value) =>
        new(DateTime.SpecifyKind(value, DateTimeKind.Utc));

    private static MaintenanceTroubleshootingStepDto Map(MaintenanceTroubleshootingStep step) =>
        new(step.Id, step.ResolutionCycleKey, step.StepKey, step.Sequence, step.StepCode, step.Instruction, step.Outcome,
            step.TenantResponse, step.AttemptedAtUtc);

    private static IReadOnlyList<string> DeserializeMissing(string? json) =>
        string.IsNullOrWhiteSpace(json) ? [] : JsonSerializer.Deserialize<string[]>(json, StoredJson) ?? [];

    private static string? NormalizeOptional(string? value, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var normalized = value.Trim();
        return normalized.Length <= maxLength ? normalized : normalized[..maxLength];
    }

    private Task RecordActivity(MaintenanceRequest request, long actorUserId, string eventType, string subjectType,
        long subjectId, string summary, MaintenanceActivityVisibility visibility, string? status = null,
        string? reason = null, CancellationToken cancellationToken = default) =>
        activity?.RecordAsync(request, actorUserId, eventType, subjectType, subjectId, summary, visibility, status, reason, cancellationToken)
        ?? Task.CompletedTask;
}
