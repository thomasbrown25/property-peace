using System.Text.Json;
using System.Security.Cryptography;
using brownstone_hub_api.Dtos.Maintenance;
using brownstone_hub_api.Services.Maintenance;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers;

[ApiController]
[Route("api/maintenance-requests")]
[Authorize(Roles = "Tenant,Landlord,Admin,Vendor")]
public sealed class MaintenanceRequestsController(
    IMaintenanceRequestApiService service,
    IMaintenanceAttachmentService? attachments = null,
    IMaintenanceCommandExecutor? commands = null) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct) => Result(await service.ListAsync(ct));

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateMaintenanceRequestDto dto,
        [FromHeader(Name = "Idempotency-Key")] string? key, CancellationToken ct)
    {
        var result = await Command(key, "request.create", dto, token => service.CreateAsync(dto, token), ct);
        return result.Code == MaintenanceApiResultCode.Success
            ? CreatedAtAction(nameof(Get), new { id = result.Value!.Id }, result.Value)
            : Failure(result.Code, result.Message, result.ErrorCode);
    }

    [HttpGet("{id:long}")]
    public async Task<IActionResult> Get(long id, CancellationToken ct) => Result(await service.GetAsync(id, ct));

    [HttpPost("{id:long}/acknowledge")]
    public async Task<IActionResult> Acknowledge(long id, [FromHeader(Name = "Idempotency-Key")] string? key, CancellationToken ct) =>
        Result(await Command(key, "request.acknowledge", new { id }, token => service.AcknowledgeAsync(id, token), ct));

    [HttpPost("{id:long}/status")]
    public async Task<IActionResult> ChangeStatus(long id, [FromBody] ChangeMaintenanceStatusDto command,
        [FromHeader(Name = "Idempotency-Key")] string? key, CancellationToken ct) =>
        Result(await Command(key, "request.change-status", new { id, command.Status, command.ExpectedStatus }, token => service.ChangeStatusAsync(id, command, token), ct));

    [HttpPost("{id:long}/percy/troubleshooting")]
    public async Task<IActionResult> Troubleshoot(long id, [FromBody] PercyTroubleshootingCommandDto command,
        [FromHeader(Name = "Idempotency-Key")] string? key, CancellationToken ct) =>
        Result(await Command(key, "troubleshooting.issue", new { id, command }, token => service.TroubleshootAsync(id, command, token), ct));

    [HttpPost("{id:long}/percy/troubleshooting/{stepId:long}/outcome")]
    public async Task<IActionResult> RecordTroubleshootingOutcome(long id, long stepId,
        [FromBody] PercyTroubleshootingOutcomeCommandDto command, [FromHeader(Name = "Idempotency-Key")] string? key, CancellationToken ct) =>
        Result(await Command(key, "troubleshooting.outcome", new { id, stepId, command }, token => service.RecordTroubleshootingOutcomeAsync(id, stepId, command, token), ct));

    [HttpPost("{id:long}/assign")]
    public async Task<IActionResult> Assign(long id, AssignMaintenanceCommandDto command,
        [FromHeader(Name = "Idempotency-Key")] string? key, CancellationToken ct) =>
        Result(await Command(key, "request.assign", new { id, command }, token => service.AssignAsync(id, command, token), ct));

    [HttpPost("{id:long}/estimates")]
    public async Task<IActionResult> SubmitEstimate(long id, SubmitMaintenanceEstimateDto command,
        [FromHeader(Name = "Idempotency-Key")] string? key, CancellationToken ct) =>
        Result(await Command(key, "estimate.submit", new { id, command }, token => service.SubmitEstimateAsync(id, command, token), ct));

    [HttpPost("{id:long}/estimates/{estimateId:long}/approve")]
    public async Task<IActionResult> ApproveEstimate(long id, long estimateId, EstimateVersionCommandDto command,
        [FromHeader(Name = "Idempotency-Key")] string? key, CancellationToken ct) =>
        Result(await Command(key, "estimate.approve", new { id, estimateId, command }, token => service.ApproveEstimateAsync(id, estimateId, command, token), ct));

    [HttpPost("{id:long}/estimates/{estimateId:long}/reject")]
    public async Task<IActionResult> RejectEstimate(long id, long estimateId, RejectEstimateCommandDto command,
        [FromHeader(Name = "Idempotency-Key")] string? key, CancellationToken ct) =>
        Result(await Command(key, "estimate.reject", new { id, estimateId, command }, token => service.RejectEstimateAsync(id, estimateId, command, token), ct));

    [HttpPost("{id:long}/work-orders")]
    public async Task<IActionResult> IssueWorkOrder(long id, IssueMaintenanceWorkOrderDto command,
        [FromHeader(Name = "Idempotency-Key")] string? key, CancellationToken ct) =>
        Result(await Command(key, "work-order.issue", new { id, command }, token => service.IssueWorkOrderAsync(id, command, token), ct));

    [HttpPost("{id:long}/work-orders/{workOrderId:long}/cancel")]
    public async Task<IActionResult> CancelWorkOrder(long id, long workOrderId, CancelMaintenanceWorkOrderDto command,
        [FromHeader(Name = "Idempotency-Key")] string? key, CancellationToken ct) =>
        Result(await Command(key, "work-order.cancel", new { id, workOrderId, command }, token => service.CancelWorkOrderAsync(id, workOrderId, command, token), ct));

    [HttpPost("{id:long}/appointments")]
    public async Task<IActionResult> ProposeAppointment(long id, ProposeMaintenanceAppointmentDto command,
        [FromHeader(Name = "Idempotency-Key")] string? key, CancellationToken ct) =>
        Result(await Command(key, "appointment.propose", new { id, command }, token => service.ProposeAppointmentAsync(id, command, token), ct));

    [HttpPost("{id:long}/appointments/{appointmentId:long}/confirm")]
    public async Task<IActionResult> ConfirmAppointment(long id, long appointmentId, WorkflowVersionCommandDto command,
        [FromHeader(Name = "Idempotency-Key")] string? key, CancellationToken ct) =>
        Result(await Command(key, "appointment.confirm", new { id, appointmentId, command }, token => service.ConfirmAppointmentAsync(id, appointmentId, command, token), ct));

    [HttpPost("{id:long}/appointments/{appointmentId:long}/cancel")]
    public async Task<IActionResult> CancelAppointment(long id, long appointmentId, CancelMaintenanceAppointmentDto command,
        [FromHeader(Name = "Idempotency-Key")] string? key, CancellationToken ct) =>
        Result(await Command(key, "appointment.cancel", new { id, appointmentId, command }, token => service.CancelAppointmentAsync(id, appointmentId, command, token), ct));

    [HttpPost("{id:long}/work-orders/{workOrderId:long}/start")]
    public async Task<IActionResult> StartWork(long id, long workOrderId, WorkflowVersionCommandDto command,
        [FromHeader(Name = "Idempotency-Key")] string? key, CancellationToken ct) =>
        Result(await Command(key, "work-order.start", new { id, workOrderId, command }, token => service.StartWorkAsync(id, workOrderId, command, token), ct));

    [HttpPost("{id:long}/completions")]
    public async Task<IActionResult> SubmitCompletion(long id, SubmitMaintenanceCompletionDto command,
        [FromHeader(Name = "Idempotency-Key")] string? key, CancellationToken ct) =>
        Result(await Command(key, "completion.submit", new { id, command }, token => service.SubmitCompletionAsync(id, command, token), ct));

    [HttpPost("{id:long}/completions/{completionId:long}/confirm")]
    public async Task<IActionResult> ConfirmCompletion(long id, long completionId, CompletionDecisionCommandDto command,
        [FromHeader(Name = "Idempotency-Key")] string? key, CancellationToken ct) =>
        Result(await Command(key, "completion.confirm", new { id, completionId, command }, token => service.ConfirmCompletionAsync(id, completionId, command, token), ct));

    [HttpPost("{id:long}/completions/{completionId:long}/reopen")]
    public async Task<IActionResult> ReopenCompletion(long id, long completionId, CompletionReasonCommandDto command,
        [FromHeader(Name = "Idempotency-Key")] string? key, CancellationToken ct) =>
        Result(await Command(key, "completion.reopen", new { id, completionId, command }, token => service.ReopenCompletionAsync(id, completionId, command, token), ct));

    [HttpPost("{id:long}/completions/{completionId:long}/staff-close")]
    public async Task<IActionResult> StaffCloseCompletion(long id, long completionId, CompletionReasonCommandDto command,
        [FromHeader(Name = "Idempotency-Key")] string? key, CancellationToken ct) =>
        Result(await Command(key, "completion.staff-close", new { id, completionId, command }, token => service.StaffCloseCompletionAsync(id, completionId, command, token), ct));

    [HttpGet("{id:long}/cost-projection")]
    public async Task<IActionResult> CostProjection(long id, CancellationToken ct) => Result(await service.GetCostProjectionAsync(id, ct));

    [HttpGet("{id:long}/attachments")]
    public async Task<IActionResult> ListAttachments(long id, CancellationToken ct) =>
        attachments is null ? StatusCode(500) : Result(await attachments.ListAsync(id, ct));

    [HttpPost("{id:long}/attachments")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(104_857_600)]
    public async Task<IActionResult> UploadAttachment(long id, [FromForm] MaintenanceAttachmentPurpose purpose,
        [FromForm] IFormFile file, [FromHeader(Name = "Idempotency-Key")] string? key, CancellationToken ct)
    {
        if (attachments is null) return StatusCode(500);
        await using var content = file.OpenReadStream();
        var digest = Convert.ToHexString(await SHA256.HashDataAsync(content, ct)).ToLowerInvariant();
        return Result(await Command(key, "attachment.upload",
            new { id, purpose, file.FileName, file.ContentType, file.Length, ContentSha256 = digest },
            token => attachments.UploadAsync(id, purpose, file, token), ct));
    }

    [HttpDelete("{id:long}/attachments/{attachmentId:long}")]
    public async Task<IActionResult> DeleteAttachment(long id, long attachmentId,
        [FromHeader(Name = "Idempotency-Key")] string? key, CancellationToken ct) =>
        attachments is null ? StatusCode(500) : Result(await Command(key, "attachment.delete", new { id, attachmentId },
            token => attachments.DeleteAsync(id, attachmentId, token), ct));

    [HttpGet("{id:long}/attachments/{attachmentId:long}/content")]
    public async Task<IActionResult> DownloadAttachment(long id, long attachmentId, CancellationToken ct)
    {
        if (attachments is null) return StatusCode(500);
        var result = await attachments.DownloadAsync(id, attachmentId, ct);
        return result.Code == MaintenanceApiResultCode.Success
            ? File(result.Value!.Content, result.Value.ContentType, result.Value.FileName, enableRangeProcessing: true)
            : Failure(result.Code, result.Message, result.ErrorCode);
    }

    private Task<MaintenanceApiResult<T>> Command<T>(string? key, string operation, object payload,
        Func<CancellationToken, Task<MaintenanceApiResult<T>>> action, CancellationToken ct) =>
        commands is null ? action(ct) : commands.ExecuteAsync(key ?? string.Empty, operation, JsonSerializer.Serialize(payload), action, ct);

    private IActionResult Result<T>(MaintenanceApiResult<T> result) =>
        result.Code == MaintenanceApiResultCode.Success ? Ok(result.Value) : Failure(result.Code, result.Message, result.ErrorCode);

    private IActionResult Failure(MaintenanceApiResultCode code, string? message, string? errorCode)
    {
        var body = new ProblemDetails { Detail = message };
        if (!string.IsNullOrWhiteSpace(errorCode)) body.Extensions["code"] = errorCode;
        return code switch
        {
            MaintenanceApiResultCode.BadRequest => BadRequest(body),
            MaintenanceApiResultCode.NotFound => NotFound(body),
            MaintenanceApiResultCode.Conflict => Conflict(body),
            MaintenanceApiResultCode.Unauthorized => Unauthorized(body),
            _ => StatusCode(StatusCodes.Status500InternalServerError, body)
        };
    }
}
