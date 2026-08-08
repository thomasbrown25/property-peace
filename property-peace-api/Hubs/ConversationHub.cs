using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Repositories.Conversations;
using Microsoft.AspNetCore.Authorization;

namespace brownstone_hub_api.Hubs
{
    /// <summary>
    /// SignalR Hub for real-time conversation and message updates
    /// Users connect to groups based on their user ID and conversation IDs
    /// </summary>
    [Authorize]
    public class ConversationHub : Hub
    {
        private readonly IUserRepository _userRepository;
        private readonly IConversationRepository _conversationRepository;
        private readonly ILogger<ConversationHub> _logger;

        public ConversationHub(
            IUserRepository userRepository,
            IConversationRepository conversationRepository,
            ILogger<ConversationHub> logger)
        {
            _userRepository = userRepository;
            _conversationRepository = conversationRepository;
            _logger = logger;
        }

        /// <summary>
        /// When a client connects, join a group based on their user ID
        /// This allows sending conversation updates to specific users
        /// </summary>
        public override async Task OnConnectedAsync()
        {
            try
            {
                var userId = await GetUserIdAsync();
                if (!string.IsNullOrEmpty(userId))
                {
                    // Join a group named after the user ID
                    var groupName = $"user_{userId}";
                    await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
                    _logger.LogInformation("User {UserId} connected to ConversationHub with connection {ConnectionId} and joined group {GroupName}",
                        userId, Context.ConnectionId, groupName);
                    await base.OnConnectedAsync();
                }
                else
                {
                    _logger.LogWarning("User connected to ConversationHub but could not determine user ID. Connection {ConnectionId}",
                        Context.ConnectionId);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in OnConnectedAsync for connection {ConnectionId}", Context.ConnectionId);
                throw;
            }
        }

        /// <summary>
        /// Join a specific conversation group to receive real-time updates for that conversation
        /// </summary>
        public async Task JoinConversation(long conversationId)
        {
            var userId = await GetNumericUserIdAsync();
            if (!userId.HasValue)
            {
                _logger.LogWarning("Unable to resolve a numeric user for conversation join on connection {ConnectionId}", Context.ConnectionId);
                throw new HubException("Conversation not found");
            }

            var conversation = await _conversationRepository.GetConversationById(conversationId, userId.Value);
            if (conversation == null)
            {
                _logger.LogWarning("User {UserId} refused access to conversation {ConversationId}", userId.Value, conversationId);
                throw new HubException("Conversation not found");
            }

            var groupName = $"conversation_{conversationId}";
            await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
            _logger.LogInformation("User {UserId} joined conversation {ConversationId} group {GroupName}",
                userId.Value, conversationId, groupName);
        }

        private async Task<long?> GetNumericUserIdAsync()
        {
            var nameIdentifier = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var userIdClaim = Context.User?.FindFirst("userId")?.Value;
            var subject = Context.User?.FindFirst("sub")?.Value;
            if (long.TryParse(nameIdentifier, out var nameId) && nameId > 0) return nameId;
            if (long.TryParse(userIdClaim, out var explicitId) && explicitId > 0) return explicitId;
            if (long.TryParse(subject, out var subjectId) && subjectId > 0) return subjectId;

            var email = subject;
            if (string.IsNullOrWhiteSpace(email) && !string.IsNullOrWhiteSpace(nameIdentifier))
                email = nameIdentifier;
            if (string.IsNullOrWhiteSpace(email))
                email = Context.User?.FindFirst(ClaimTypes.Name)?.Value;
            if (string.IsNullOrWhiteSpace(email)) return null;

            var user = await _userRepository.GetUser(email);
            return user?.Id > 0 ? user.Id : null;
        }

        /// <summary>
        /// Leave a specific conversation group
        /// </summary>
        public async Task LeaveConversation(long conversationId)
        {
            try
            {
                var groupName = $"conversation_{conversationId}";
                await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);
                _logger.LogInformation("User left conversation {ConversationId} group {GroupName}",
                    conversationId, groupName);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error leaving conversation {ConversationId}", conversationId);
            }
        }

        /// <summary>
        /// When a client disconnects, remove them from their groups
        /// </summary>
        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            try
            {
                var userId = await GetUserIdAsync();
                if (!string.IsNullOrEmpty(userId))
                {
                    await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"user_{userId}");
                    _logger.LogInformation("User {UserId} disconnected from ConversationHub. Connection {ConnectionId}", userId, Context.ConnectionId);
                }

                if (exception != null)
                {
                    _logger.LogWarning(exception, "User disconnected with exception. Connection {ConnectionId}", Context.ConnectionId);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in OnDisconnectedAsync for connection {ConnectionId}", Context.ConnectionId);
            }
            finally
            {
                await base.OnDisconnectedAsync(exception);
            }
        }

        /// <summary>
        /// Extract user ID from JWT claims or lookup by email
        /// </summary>
        private async Task<string?> GetUserIdAsync()
        {
            try
            {
                var userId = await GetNumericUserIdAsync();
                return userId?.ToString();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting user ID from claims");
                return null;
            }
        }
    }
}

