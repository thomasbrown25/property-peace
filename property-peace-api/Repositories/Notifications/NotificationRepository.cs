using AutoMapper;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Notification;
using brownstone_hub_api.Enums;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.Notifications
{
    public class NotificationRepository(
        DataContext context,
        ILogger<NotificationRepository> logger,
        IMapper mapper) : INotificationRepository
    {
        private readonly DataContext _context = context;
        private readonly ILogger<NotificationRepository> _logger = logger;
        private readonly IMapper _mapper = mapper;

        public async Task<List<NotificationDto>> GetNotificationsByUserId(long userId, long? organizationId = null)
        {
            try
            {
                var query = _context.Notifications.Where(n => n.UserId == userId);
                
                // Filter by organization if provided
                if (organizationId.HasValue)
                {
                    query = query.Where(n => n.OrganizationId == organizationId.Value);
                }
                
                var notifications = await query
                    .OrderByDescending(n => n.CreatedAt)
                    .ToListAsync();

                return _mapper.Map<List<NotificationDto>>(notifications);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving notifications for user {UserId}, organization {OrganizationId}", userId, organizationId);
                throw;
            }
        }

        public async Task<int> GetUnreadCountByUserId(long userId, long? organizationId = null)
        {
            try
            {
                var query = _context.Notifications.Where(n => n.UserId == userId && !n.IsRead);
                
                // Filter by organization if provided
                if (organizationId.HasValue)
                {
                    query = query.Where(n => n.OrganizationId == organizationId.Value);
                }
                
                return await query.CountAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting unread count for user {UserId}, organization {OrganizationId}", userId, organizationId);
                throw;
            }
        }

        public async Task<bool> MarkNotificationAsRead(long notificationId, long userId)
        {
            try
            {
                var notification = await _context.Notifications
                    .FirstOrDefaultAsync(n => n.Id == notificationId && n.UserId == userId);
                
                if (notification == null)
                {
                    _logger.LogWarning("Notification {NotificationId} not found or does not belong to user {UserId}", notificationId, userId);
                    return false;
                }

                notification.IsRead = true;
                await _context.SaveChangesAsync();

                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error marking notification {NotificationId} as read for user {UserId}", notificationId, userId);
                throw;
            }
        }

        public async Task<int> MarkAllNotificationsAsRead(long userId, long? organizationId = null)
        {
            try
            {
                var query = _context.Notifications.Where(n => n.UserId == userId && !n.IsRead);
                
                // Filter by organization if provided
                if (organizationId.HasValue)
                {
                    query = query.Where(n => n.OrganizationId == organizationId.Value);
                }
                
                return await query.ExecuteUpdateAsync(s => s.SetProperty(n => n.IsRead, true));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error marking all notifications as read for user {UserId}, organization {OrganizationId}", userId, organizationId);
                throw;
            }
        }

        public async Task<NotificationDto> CreateNotification(CreateNotificationDto createNotificationDto)
        {
            try
            {
                var notification = _mapper.Map<Notification>(createNotificationDto);
                notification.CreatedAt = DateTime.UtcNow;
                notification.IsRead = false;

                await _context.Notifications.AddAsync(notification);
                await _context.SaveChangesAsync();

                return _mapper.Map<NotificationDto>(notification);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating notification for user {UserId}", createNotificationDto.UserId);
                throw;
            }
        }

        public async Task<bool> NotificationExistsToday(long userId, ENotificationType type, long? relatedId, string title)
        {
            try
            {
                var today = DateTime.Today;
                var tomorrow = today.AddDays(1);

                var exists = await _context.Notifications
                    .AnyAsync(n => n.UserId == userId &&
                                  n.Type == type &&
                                  n.RelatedId == relatedId &&
                                  n.Title == title &&
                                  n.CreatedAt >= today &&
                                  n.CreatedAt < tomorrow);

                return exists;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking if notification exists for user {UserId}, type {Type}, relatedId {RelatedId}", userId, type, relatedId);
                return false; // If check fails, allow notification to be created
            }
        }

        public async Task<bool> NotificationExistsInLast24Hours(long userId, ENotificationType type, long? relatedId, string title)
        {
            try
            {
                var last24Hours = DateTime.UtcNow.AddHours(-24);

                var exists = await _context.Notifications
                    .AnyAsync(n => n.UserId == userId &&
                                  n.Type == type &&
                                  n.RelatedId == relatedId &&
                                  n.Title == title &&
                                  n.CreatedAt >= last24Hours);

                return exists;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking if notification exists in last 24 hours for user {UserId}, type {Type}, relatedId {RelatedId}", userId, type, relatedId);
                return false; // If check fails, allow notification to be created
            }
        }

        public async Task<bool> NotificationOfTypeExistsSince(long userId, ENotificationType type, DateTime since)
        {
            try
            {
                return await _context.Notifications
                    .AnyAsync(n => n.UserId == userId &&
                                   n.Type == type &&
                                   n.CreatedAt >= since);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking if notification of type {Type} exists since {Since} for user {UserId}", type, since, userId);
                return false;
            }
        }

        public async Task<bool> NotificationExistsSinceForLease(long userId, ENotificationType type, long leaseId, string title, DateTime since)
        {
            try
            {
                return await _context.Notifications
                    .AnyAsync(n => n.UserId == userId &&
                                   n.Type == type &&
                                   n.RelatedId == leaseId &&
                                   n.Title == title &&
                                   n.CreatedAt >= since);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking if notification exists since {Since} for lease {LeaseId}", since, leaseId);
                return false;
            }
        }
    }
}

