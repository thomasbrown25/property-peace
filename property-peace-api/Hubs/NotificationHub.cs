using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;
using brownstone_hub_api.Repositories.Users;
using Microsoft.AspNetCore.Authorization;

namespace brownstone_hub_api.Hubs
{
    /// <summary>
    /// SignalR Hub for real-time notifications
    /// Users connect to groups based on their user ID for targeted notifications
    /// Note: Authorization is handled at the connection level via JWT Bearer authentication
    /// OPTIONS preflight requests are automatically allowed by CORS middleware (before authentication)
    /// </summary>
    [Authorize]
    public class NotificationHub : Hub
    {
        private readonly IUserRepository _userRepository;
        private readonly ILogger<NotificationHub> _logger;

        public NotificationHub(IUserRepository userRepository, ILogger<NotificationHub> logger)
        {
            _userRepository = userRepository;
            _logger = logger;
        }

        /// <summary>
        /// When a client connects, join a group based on their user ID
        /// This allows sending notifications to specific users
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
                    _logger.LogInformation("User {UserId} connected to NotificationHub with connection {ConnectionId} and joined group {GroupName}",
                        userId, Context.ConnectionId, groupName);
                    await base.OnConnectedAsync();
                }
                else
                {
                    _logger.LogWarning("User connected to NotificationHub but could not determine user ID. Connection {ConnectionId}. Claims available: {Claims}",
                        Context.ConnectionId, string.Join(", ", Context.User?.Claims?.Select(c => $"{c.Type}={c.Value}") ?? Array.Empty<string>()));
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in OnConnectedAsync for connection {ConnectionId}", Context.ConnectionId);
                throw;
            }
        }

        /// <summary>
        /// When a client disconnects, remove them from their group
        /// </summary>
        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            try
            {
                var userId = await GetUserIdAsync();
                if (!string.IsNullOrEmpty(userId))
                {
                    await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"user_{userId}");
                    _logger.LogInformation("User {UserId} disconnected from NotificationHub. Connection {ConnectionId}", userId, Context.ConnectionId);
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
                // First, try to get user ID directly from claims
                var userIdClaim = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (!string.IsNullOrEmpty(userIdClaim))
                {
                    return userIdClaim;
                }

                // Try alternative claim name for user ID
                userIdClaim = Context.User?.FindFirst("userId")?.Value;
                if (!string.IsNullOrEmpty(userIdClaim))
                {
                    return userIdClaim;
                }

                // If user ID not in claims, try to look up by email (sub claim)
                // JWT uses "sub" claim for the subject (email in our case)
                var email = Context.User?.FindFirst("sub")?.Value;
                if (string.IsNullOrEmpty(email))
                {
                    // Try alternative claim names
                    email = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                    if (string.IsNullOrEmpty(email))
                    {
                        email = Context.User?.FindFirst(ClaimTypes.Name)?.Value;
                    }
                }

                if (!string.IsNullOrEmpty(email))
                {
                    var user = await _userRepository.GetUser(email);
                    if (user != null)
                    {
                        return user.Id.ToString();
                    }
                }

                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting user ID from claims");
                return null;
            }
        }
    }
}

