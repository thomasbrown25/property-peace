using brownstone_hub_api.Dtos.Message;
using brownstone_hub_api.Services.MessageService;
using brownstone_hub_api.Services.MessageDeliveries;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using brownstone_hub_api.Hubs;
using Microsoft.Extensions.Logging;


namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Tenant,Landlord,Admin")]
    public class MessageController(
        IMessageService messageService,
        IHubContext<ConversationHub> hubContext,
        IOutboundMessageDeliveryEnqueuer deliveryEnqueuer,
        ILogger<MessageController> logger) : ControllerBase
    {
        private readonly IMessageService _messageService = messageService;
        private readonly IHubContext<ConversationHub> _hubContext = hubContext;
        private readonly IOutboundMessageDeliveryEnqueuer _deliveryEnqueuer = deliveryEnqueuer;
        private readonly ILogger<MessageController> _logger = logger;


        [HttpPost]
        public async Task<IActionResult> AddMessage([FromBody] AddMessageDto message)
        {
            // Public REST sends are always in-app. External channel evidence is accepted only
            // through authenticated provider ingestion services.
            message.Channel = "inApp";
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

        [HttpGet("{messageId}")]
        public async Task<IActionResult> GetMessage(long messageId)
        {
            var response = await _messageService.GetMessageById(messageId);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }

        [HttpGet("conversation/{conversationId}")]
        public async Task<IActionResult> GetMessages(long conversationId, [FromQuery] int skip = 0, [FromQuery] int take = 50)
        {
            var response = await _messageService.GetMessagesByConversationId(conversationId, skip, take);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }

        [HttpPut("{messageId}")]
        public async Task<IActionResult> UpdateMessage(long messageId, [FromBody] string content)
        {
            var response = await _messageService.UpdateMessage(messageId, content);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }

        [HttpDelete("{messageId}")]
        public async Task<IActionResult> DeleteMessage(long messageId)
        {
            var response = await _messageService.DeleteMessage(messageId);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }

        [HttpPost("{messageId}/read")]
        public async Task<IActionResult> MarkMessageAsRead(long messageId)
        {
            var response = await _messageService.MarkMessageAsRead(messageId);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }

        [HttpPost("conversation/{conversationId}/read")]
        public async Task<IActionResult> MarkConversationAsRead(long conversationId)
        {
            var response = await _messageService.MarkConversationAsRead(conversationId);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }
    }
}

