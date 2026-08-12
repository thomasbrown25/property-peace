using brownstone_hub_api.Dtos.Message;
using brownstone_hub_api.Services.MessageService;
using brownstone_hub_api.Services.MessageDeliveries;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using brownstone_hub_api.Hubs;
using Microsoft.Extensions.Logging;
using brownstone_hub_api.Services.SmsService;
using brownstone_hub_api.Data;
using brownstone_hub_api.Repositories.Conversations;
using Microsoft.EntityFrameworkCore;


namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Tenant,Landlord,Admin")]
    public class MessageController(
        IMessageService messageService,
        IHubContext<ConversationHub> hubContext,
        IOutboundMessageDeliveryEnqueuer deliveryEnqueuer,
        IOutboundSmsSecurityService outboundSmsSecurity,
        ILogger<MessageController> logger,
        DataContext? dataContext = null) : ControllerBase
    {
        private readonly IMessageService _messageService = messageService;
        private readonly IHubContext<ConversationHub> _hubContext = hubContext;
        private readonly IOutboundMessageDeliveryEnqueuer _deliveryEnqueuer = deliveryEnqueuer;
        private readonly IOutboundSmsSecurityService _outboundSmsSecurity = outboundSmsSecurity;
        private readonly ILogger<MessageController> _logger = logger;
        private readonly DataContext? _dataContext = dataContext;


        [HttpPost]
        public async Task<IActionResult> AddMessage([FromBody] AddMessageDto message, CancellationToken cancellationToken = default)
        {
            // Public REST sends are always in-app. External channel evidence is accepted only
            // through authenticated provider ingestion services.
            message.Channel = "inApp";
            if (!TryGetPositiveId(HttpContext.Items["UserId"], out var userId) ||
                !TryGetPositiveId(HttpContext.Items["OrganizationId"], out var organizationId))
                return Forbid();

            // Resolve the persisted conversation organization before MessageRepository can create
            // an SMS outbox row. A selected organization cannot authorize another org's sender.
            var smsDecision = await _outboundSmsSecurity.AuthorizeConversationEnqueueAsync(
                userId, organizationId, message.ConversationId, cancellationToken);
            if (!smsDecision.IsAllowed)
                return StatusCode(StatusCodes.Status403Forbidden, new
                {
                    Message = "This organization is not authorized to send SMS for the conversation.",
                    ReasonCode = smsDecision.ReasonCode
                });

            var response = await _messageService.AddMessage(message);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            // External outbox rows are resolved and saved atomically with the message/timeline by
            // MessageRepository. Do not enqueue here: a second post-commit path creates duplicates.

            // Replays never repeat ephemeral side effects; the atomic outbox already exists.
            if (response.Data?.WasReplayed == true)
                return Ok(response);

            // Send SignalR notification to conversation participants
            try
            {
                // Send to conversation group
                var conversationGroup = $"conversation_{message.ConversationId}";
                await _hubContext.Clients.Group(conversationGroup)
                    .SendAsync("MessageReceived", response.Data);

                // Also notify all participants via their user groups to update conversation list
                await _hubContext.Clients.Group(conversationGroup)
                    .SendAsync("ConversationListUpdated");
            }
            catch (Exception)
            {
                // Log but don't fail the request if SignalR fails
                // The message was already saved successfully
            }

            return Ok(response);
        }

        private static bool TryGetPositiveId(object? value, out long id)
        {
            id = value switch { long longValue => longValue, int intValue => intValue, _ => 0 };
            return id > 0;
        }

        private async Task<bool> IsConversationInActiveOrganizationAsync(
            long conversationId,
            CancellationToken cancellationToken = default)
        {
            if (_dataContext is null ||
                !TryGetPositiveId(HttpContext.Items["UserId"], out var userId) ||
                !TryGetPositiveId(HttpContext.Items["OrganizationId"], out var organizationId))
                return false;

            return await _dataContext.Conversations
                .WhereActiveParticipant(_dataContext.OrganizationMembers, _dataContext.Tenants, userId)
                .AnyAsync(conversation =>
                    conversation.Id == conversationId &&
                    conversation.OrganizationId == organizationId,
                    cancellationToken);
        }

        private async Task<bool> IsMessageInActiveOrganizationAsync(
            long messageId,
            CancellationToken cancellationToken = default)
        {
            if (_dataContext is null)
                return false;

            var conversationId = await _dataContext.Messages.AsNoTracking()
                .Where(message => message.Id == messageId && !message.IsDeleted)
                .Select(message => (long?)message.ConversationId)
                .SingleOrDefaultAsync(cancellationToken);

            return conversationId.HasValue &&
                await IsConversationInActiveOrganizationAsync(conversationId.Value, cancellationToken);
        }

        [HttpGet("{messageId}")]
        public async Task<IActionResult> GetMessage(long messageId, CancellationToken cancellationToken = default)
        {
            if (!await IsMessageInActiveOrganizationAsync(messageId, cancellationToken))
                return NotFound();

            var response = await _messageService.GetMessageById(messageId);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }

        [HttpGet("conversation/{conversationId}")]
        public async Task<IActionResult> GetMessages(long conversationId, [FromQuery] int skip = 0, [FromQuery] int take = 50, CancellationToken cancellationToken = default)
        {
            if (!await IsConversationInActiveOrganizationAsync(conversationId, cancellationToken))
                return NotFound();

            var response = await _messageService.GetMessagesByConversationId(conversationId, skip, take);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }

        [HttpPut("{messageId}")]
        public async Task<IActionResult> UpdateMessage(long messageId, [FromBody] string content, CancellationToken cancellationToken = default)
        {
            if (!await IsMessageInActiveOrganizationAsync(messageId, cancellationToken))
                return NotFound();

            var response = await _messageService.UpdateMessage(messageId, content);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }

        [HttpDelete("{messageId}")]
        public async Task<IActionResult> DeleteMessage(long messageId, CancellationToken cancellationToken = default)
        {
            if (!await IsMessageInActiveOrganizationAsync(messageId, cancellationToken))
                return NotFound();

            var response = await _messageService.DeleteMessage(messageId);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }

        [HttpPost("{messageId}/read")]
        public async Task<IActionResult> MarkMessageAsRead(long messageId, CancellationToken cancellationToken = default)
        {
            if (!await IsMessageInActiveOrganizationAsync(messageId, cancellationToken))
                return NotFound();

            var response = await _messageService.MarkMessageAsRead(messageId);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }

        [HttpPost("conversation/{conversationId}/read")]
        public async Task<IActionResult> MarkConversationAsRead(long conversationId, CancellationToken cancellationToken = default)
        {
            if (!await IsConversationInActiveOrganizationAsync(conversationId, cancellationToken))
                return NotFound();

            var response = await _messageService.MarkConversationAsRead(conversationId);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }
    }
}

