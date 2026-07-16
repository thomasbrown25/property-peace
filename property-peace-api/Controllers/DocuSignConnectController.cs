using System.Security.Cryptography;
using System.Text;
using brownstone_hub_api.Config;
using brownstone_hub_api.Dtos.Lease;
using brownstone_hub_api.Hubs;
using brownstone_hub_api.Repositories.Leases;
using brownstone_hub_api.Services.LeaseService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Options;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/docusign/connect")]
    [AllowAnonymous]
    public class DocuSignConnectController(
        ILeaseRepository leaseRepository,
        ILeaseService leaseService,
        IHubContext<NotificationHub> hubContext,
        IOptions<DocuSignSettings> docuSignSettings,
        ILogger<DocuSignConnectController> logger) : ControllerBase
    {
        private readonly ILeaseRepository _leaseRepository = leaseRepository;
        private readonly ILeaseService _leaseService = leaseService;
        private readonly IHubContext<NotificationHub> _hubContext = hubContext;
        private readonly DocuSignSettings _docuSignSettings = docuSignSettings.Value;
        private readonly ILogger<DocuSignConnectController> _logger = logger;

        private static readonly string[] ProcessedEvents = ["envelope-completed", "recipient-signed", "envelope-sent", "envelope-delivered"];

        [HttpPost]
        [IgnoreAntiforgeryToken]
        public async Task<IActionResult> HandleConnect()
        {
            string body;
            try
            {
                using var reader = new StreamReader(Request.Body, Encoding.UTF8, leaveOpen: true);
                body = await reader.ReadToEndAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "DocuSign Connect: failed to read body");
                return Ok();
            }

            if (string.IsNullOrWhiteSpace(body))
            {
                _logger.LogWarning("DocuSign Connect: empty body");
                return Ok();
            }

            if (!string.IsNullOrEmpty(_docuSignSettings.ConnectSecret))
            {
                var signatureHeader = Request.Headers["X-Docusign-Signature-1"].FirstOrDefault();
                if (string.IsNullOrEmpty(signatureHeader) || !VerifyHmac(body, signatureHeader))
                {
                    _logger.LogWarning("DocuSign Connect: HMAC verification failed");
                    return Ok();
                }
            }

            string? envelopeId = null;
            string? eventType = null;
            try
            {
                using var doc = System.Text.Json.JsonDocument.Parse(body);
                var root = doc.RootElement;
                eventType = root.TryGetProperty("event", out var ev) ? ev.GetString() : null;
                if (root.TryGetProperty("data", out var data))
                    envelopeId = data.TryGetProperty("envelopeId", out var eid) ? eid.GetString() : null;
                if (string.IsNullOrEmpty(envelopeId) && root.TryGetProperty("envelopeId", out var eidRoot))
                    envelopeId = eidRoot.GetString();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "DocuSign Connect: failed to parse JSON");
                return Ok();
            }

            if (string.IsNullOrEmpty(envelopeId))
            {
                _logger.LogWarning("DocuSign Connect: no envelopeId in payload");
                return Ok();
            }

            if (!string.IsNullOrEmpty(eventType) && !ProcessedEvents.Contains(eventType, StringComparer.OrdinalIgnoreCase))
            {
                _logger.LogDebug("DocuSign Connect: ignoring event {Event}", eventType);
                return Ok();
            }

            var leaseInfo = await _leaseRepository.GetLeaseByDocuSignEnvelopeIdAsync(envelopeId);
            if (leaseInfo == null)
            {
                _logger.LogInformation("DocuSign Connect: no lease for envelope {EnvelopeId}", envelopeId);
                return Ok();
            }

            var syncResult = await _leaseService.SyncLeaseSignatureStatusFromConnectAsync(leaseInfo.LeaseId, leaseInfo.OrganizationId);
            if (!syncResult.Success)
            {
                _logger.LogWarning("DocuSign Connect: sync failed for lease {LeaseId}, envelope {EnvelopeId}: {Message}",
                    leaseInfo.LeaseId, envelopeId, syncResult.Message);
                return Ok();
            }

            try
            {
                await _hubContext.Clients
                    .Group($"user_{leaseInfo.LandlordId}")
                    .SendAsync("LeaseSignatureUpdated", new { leaseId = leaseInfo.LeaseId });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "DocuSign Connect: failed to send SignalR for lease {LeaseId}", leaseInfo.LeaseId);
            }

            _logger.LogInformation("DocuSign Connect: processed envelope {EnvelopeId}, lease {LeaseId}", envelopeId, leaseInfo.LeaseId);
            return Ok();
        }

        private bool VerifyHmac(string payload, string signatureHeader)
        {
            try
            {
                var secret = Encoding.UTF8.GetBytes(_docuSignSettings.ConnectSecret);
                using var hmac = new HMACSHA256(secret);
                var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(payload));
                var computed = Convert.ToBase64String(hash);
                return string.Equals(computed, signatureHeader.Trim(), StringComparison.Ordinal);
            }
            catch
            {
                return false;
            }
        }
    }
}
