using AutoMapper;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Conversation;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using brownstone_hub_api.Models;

namespace brownstone_hub_api.Repositories.Conversations
{
    public class ConversationRepository(
        DataContext context,
        ILogger<ConversationRepository> logger,
        IMapper mapper) : IConversationRepository
    {
        private readonly DataContext _context = context;
        private readonly ILogger<ConversationRepository> _logger = logger;
        private readonly IMapper _mapper = mapper;

        public async Task<LoadConversationDto> AddConversation(AddConversationDto conversation, long landlordId, long? organizationId = null)
        {
            try
            {
                // One-on-one tenant messages should be one thread per person, not one thread
                // per lease/property/new-message click. Reuse an existing active direct
                // conversation when the same tenant user/participant is already connected
                // to this landlord.
                if (!conversation.IsGroupChat && !conversation.ForceNewConversation)
                {
                    var existingConversation = await FindExistingDirectConversationAsync(conversation, landlordId, organizationId);
                    if (existingConversation != null)
                    {
                        await EnsureDirectConversationParticipantsAsync(
                            existingConversation.Id,
                            landlordId,
                            await GetDirectConversationParticipantUserIdsAsync(conversation, landlordId));
                        await ReviveAndHydrateDirectConversationAsync(
                            existingConversation,
                            organizationId,
                            conversation.PropertyId,
                            conversation.LeaseId,
                            conversation.TenantId);

                        return await GetConversationById(existingConversation.Id, landlordId);
                    }
                }

                var entity = new Conversation
                {
                    Title = conversation.Title,
                    Description = conversation.Description,
                    IsGroupChat = conversation.IsGroupChat,
                    LandlordId = landlordId,
                    OrganizationId = organizationId,
                    PropertyId = conversation.PropertyId,
                    LeaseId = conversation.LeaseId,
                    TenantId = conversation.TenantId,
                    CreatedBy = landlordId
                };

                await _context.Conversations.AddAsync(entity);
                await _context.SaveChangesAsync();

                // Always add the landlord (creator) as a participant
                var participants = new List<ConversationParticipant>
                {
                    new ConversationParticipant
                    {
                        ConversationId = entity.Id,
                        UserId = landlordId,
                        IsDeleted = false
                    }
                };

                // Add additional participants if provided
                if (conversation.ParticipantUserIds.Any())
                {
                    // Filter out landlord if they're already in the list to avoid duplicates
                    var additionalParticipants = conversation.ParticipantUserIds
                        .Where(userId => userId != landlordId)
                        .Distinct()
                        .Select(userId => new ConversationParticipant
                        {
                            ConversationId = entity.Id,
                            UserId = userId,
                            IsDeleted = false
                        }).ToList();

                    participants.AddRange(additionalParticipants);
                }

                await _context.ConversationParticipants.AddRangeAsync(participants);
                await _context.SaveChangesAsync();

                return await GetConversationById(entity.Id, landlordId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding conversation");
                throw;
            }
        }

        private async Task<List<long>> GetDirectConversationParticipantUserIdsAsync(AddConversationDto conversation, long landlordId)
        {
            var userIds = conversation.ParticipantUserIds
                .Where(userId => userId > 0 && userId != landlordId)
                .Distinct()
                .ToList();

            if (conversation.TenantId.HasValue)
            {
                var tenantUserId = await _context.Tenants
                    .AsNoTracking()
                    .Where(t => t.Id == conversation.TenantId.Value && !t.IsDeleted && t.UserId.HasValue)
                    .Select(t => t.UserId!.Value)
                    .FirstOrDefaultAsync();

                if (tenantUserId > 0 && tenantUserId != landlordId && !userIds.Contains(tenantUserId))
                {
                    userIds.Add(tenantUserId);
                }
            }

            return userIds;
        }

        private async Task<Conversation?> FindExistingDirectConversationAsync(AddConversationDto conversation, long landlordId, long? organizationId)
        {
            var participantUserIds = await GetDirectConversationParticipantUserIdsAsync(conversation, landlordId);
            var tenantId = conversation.TenantId;

            if (!tenantId.HasValue && participantUserIds.Count == 0)
            {
                return null;
            }

            IQueryable<Conversation> query = _context.Conversations
                .Include(c => c.Tenant)
                .Include(c => c.Participants)
                .Where(c => !c.IsGroupChat && c.LandlordId == landlordId &&
                    !_context.SupportAndFeedbacks.Any(ticket => ticket.ConversationId == c.Id));

            if (organizationId.HasValue)
            {
                // Older rows may not have OrganizationId backfilled; still reuse them when
                // the tenant/participant identity matches so the inbox does not fork.
                query = query.Where(c => c.OrganizationId == organizationId.Value || c.OrganizationId == null);
            }

            if (tenantId.HasValue && participantUserIds.Count > 0)
            {
                query = query.Where(c =>
                    c.TenantId == tenantId.Value ||
                    (c.Tenant != null && c.Tenant.UserId.HasValue && participantUserIds.Contains(c.Tenant.UserId.Value)) ||
                    c.Participants.Any(p => participantUserIds.Contains(p.UserId) && !p.IsDeleted));
            }
            else if (tenantId.HasValue)
            {
                query = query.Where(c => c.TenantId == tenantId.Value);
            }
            else
            {
                query = query.Where(c => c.Participants.Any(p => participantUserIds.Contains(p.UserId) && !p.IsDeleted));
            }

            return await query
                .OrderBy(c => c.IsArchived)
                .ThenByDescending(c => c.LastMessageAt ?? c.CreatedAt)
                .ThenByDescending(c => c.Id)
                .FirstOrDefaultAsync();
        }

        private async Task<Conversation?> FindExistingDirectConversationForTenantLandlordAsync(long tenantUserId, long tenantId, long landlordId, long? organizationId)
        {
            IQueryable<Conversation> query = _context.Conversations
                .Include(c => c.Tenant)
                .Include(c => c.Participants)
                .Where(c => !c.IsGroupChat && c.LandlordId == landlordId &&
                    !_context.SupportAndFeedbacks.Any(ticket => ticket.ConversationId == c.Id));

            if (organizationId.HasValue)
            {
                query = query.Where(c => c.OrganizationId == organizationId.Value || c.OrganizationId == null);
            }

            return await query
                .Where(c =>
                    c.TenantId == tenantId ||
                    (c.Tenant != null && c.Tenant.UserId == tenantUserId) ||
                    c.Participants.Any(p => p.UserId == tenantUserId && !p.IsDeleted))
                .OrderBy(c => c.IsArchived)
                .ThenByDescending(c => c.LastMessageAt ?? c.CreatedAt)
                .ThenByDescending(c => c.Id)
                .FirstOrDefaultAsync();
        }

        private async Task ReviveAndHydrateDirectConversationAsync(Conversation conversation, long? organizationId, long? propertyId, long? leaseId, long? tenantId)
        {
            var changed = false;

            if (conversation.IsArchived)
            {
                conversation.IsArchived = false;
                changed = true;
            }

            if (!conversation.OrganizationId.HasValue && organizationId.HasValue)
            {
                conversation.OrganizationId = organizationId;
                changed = true;
            }

            if (!conversation.PropertyId.HasValue && propertyId.HasValue)
            {
                conversation.PropertyId = propertyId;
                changed = true;
            }

            if (!conversation.LeaseId.HasValue && leaseId.HasValue)
            {
                conversation.LeaseId = leaseId;
                changed = true;
            }

            if (!conversation.TenantId.HasValue && tenantId.HasValue)
            {
                conversation.TenantId = tenantId;
                changed = true;
            }

            if (changed)
            {
                conversation.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }
        }

        private async Task EnsureDirectConversationParticipantsAsync(long conversationId, long landlordId, IEnumerable<long> otherUserIds)
        {
            var desiredUserIds = otherUserIds
                .Append(landlordId)
                .Where(userId => userId > 0)
                .Distinct()
                .ToList();

            if (desiredUserIds.Count == 0) return;

            var existingUserIds = await _context.ConversationParticipants
                .Where(p => p.ConversationId == conversationId && desiredUserIds.Contains(p.UserId) && !p.IsDeleted)
                .Select(p => p.UserId)
                .ToListAsync();

            var missingParticipants = desiredUserIds
                .Except(existingUserIds)
                .Select(userId => new ConversationParticipant
                {
                    ConversationId = conversationId,
                    UserId = userId,
                    IsDeleted = false
                })
                .ToList();

            if (missingParticipants.Count == 0) return;

            await _context.ConversationParticipants.AddRangeAsync(missingParticipants);
            await _context.SaveChangesAsync();
        }

        public async Task<LoadConversationDto> GetConversationById(long conversationId, long userId)
        {
            try
            {
                var conversation = await _context.Conversations
                    .Include(c => c.Landlord)
                    .Include(c => c.Property)
                    .Include(c => c.Lease)
                    .Include(c => c.Tenant)
                    .Include(c => c.Participants)
                        .ThenInclude(p => p.User)
                    .FirstOrDefaultAsync(c => c.Id == conversationId);

                if (conversation == null)
                    return null;

                var dto = new LoadConversationDto
                {
                    Id = conversation.Id,
                    Title = conversation.Title,
                    Description = conversation.Description,
                    IsGroupChat = conversation.IsGroupChat,
                    LandlordId = conversation.LandlordId,
                    LandlordName = conversation.Landlord != null
                        ? $"{conversation.Landlord.FirstName} {conversation.Landlord.LastName}".Trim()
                        : conversation.Landlord?.Email ?? "Unknown",
                    LandlordEmail = conversation.Landlord?.Email,
                    PropertyId = conversation.PropertyId,
                    PropertyName = conversation.Property?.Name,
                    LeaseId = conversation.LeaseId,
                    TenantId = conversation.TenantId,
                    TenantName = conversation.Tenant != null
                        ? $"{conversation.Tenant.Firstname} {conversation.Tenant.Lastname}".Trim()
                        : null,
                    TenantEmail = conversation.Tenant?.Email,
                    TenantPhoneNumber = conversation.Tenant?.PhoneNumber,
                    IsArchived = conversation.IsArchived,
                    IsPinned = conversation.IsPinned,
                    LastMessageAt = conversation.LastMessageAt,
                    LastMessagePreview = conversation.LastMessagePreview,
                    LastMessageBy = conversation.LastMessageBy,
                    AiSummary = conversation.AiSummary,
                    AiSummaryUpdatedAt = conversation.AiSummaryUpdatedAt,
                    HasUrgentItems = conversation.HasUrgentItems,
                    UrgentItemsJson = conversation.UrgentItemsJson,
                    UrgentItemsDetectedAt = conversation.UrgentItemsDetectedAt,
                    CreatedAt = conversation.CreatedAt,
                    UpdatedAt = conversation.UpdatedAt,
                    Participants = conversation.Participants
                        .Where(p => !p.IsDeleted)
                        .Select(p => new ConversationParticipantDto
                        {
                            UserId = p.UserId,
                            UserName = p.User != null
                                ? $"{p.User.FirstName} {p.User.LastName}".Trim()
                                : p.User?.Email ?? "Unknown",
                            UserEmail = p.User?.Email,
                            IsAdmin = p.IsAdmin,
                            JoinedAt = p.JoinedAt,
                            IsActive = !p.IsDeleted
                        }).ToList()
                };

                await AttachLandlordSmsNumberAsync(dto, conversation.OrganizationId);

                // Get unread count for this user
                dto.UnreadCount = await GetUnreadCount(conversationId, userId);

                // Get last message sender name
                if (conversation.LastMessageBy.HasValue)
                {
                    var lastSender = await _context.Users.FindAsync(conversation.LastMessageBy.Value);
                    dto.LastMessageByName = lastSender != null
                        ? $"{lastSender.FirstName} {lastSender.LastName}".Trim()
                        : lastSender?.Email ?? "Unknown";
                }

                return dto;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving conversation {ConversationId}", conversationId);
                throw;
            }
        }

        public async Task<List<LoadConversationDto>> GetConversationsByLandlordId(long landlordId, bool includeArchived = false)
        {
            try
            {
                var query = _context.Conversations
                    .Include(c => c.Landlord)
                    .Include(c => c.Property)
                    .Include(c => c.Lease)
                    .Include(c => c.Tenant)
                    .Include(c => c.Participants)
                        .ThenInclude(p => p.User)
                    .Where(c => c.LandlordId == landlordId &&
                        !_context.SupportAndFeedbacks.Any(ticket => ticket.ConversationId == c.Id));

                if (!includeArchived)
                {
                    query = query.Where(c => !c.IsArchived);
                }

                var conversations = await query
                    .OrderByDescending(c => c.IsPinned)
                    .ThenByDescending(c => c.LastMessageAt ?? c.CreatedAt)
                    .ToListAsync();

                var dtos = new List<LoadConversationDto>();

                foreach (var conversation in conversations)
                {
                    var dto = new LoadConversationDto
                    {
                        Id = conversation.Id,
                        Title = conversation.Title,
                        Description = conversation.Description,
                        IsGroupChat = conversation.IsGroupChat,
                        LandlordId = conversation.LandlordId,
                        LandlordName = conversation.Landlord != null
                        ? $"{conversation.Landlord.FirstName} {conversation.Landlord.LastName}".Trim()
                        : conversation.Landlord?.Email ?? "Unknown",
                        LandlordEmail = conversation.Landlord?.Email,
                        PropertyId = conversation.PropertyId,
                        PropertyName = conversation.Property?.Name,
                        LeaseId = conversation.LeaseId,
                        TenantId = conversation.TenantId,
                        TenantName = conversation.Tenant != null
                            ? $"{conversation.Tenant.Firstname} {conversation.Tenant.Lastname}".Trim()
                            : null,
                        TenantEmail = conversation.Tenant?.Email,
                    TenantPhoneNumber = conversation.Tenant?.PhoneNumber,
                        IsArchived = conversation.IsArchived,
                        IsPinned = conversation.IsPinned,
                        LastMessageAt = conversation.LastMessageAt,
                        LastMessagePreview = conversation.LastMessagePreview,
                        LastMessageBy = conversation.LastMessageBy,
                        AiSummary = conversation.AiSummary,
                        AiSummaryUpdatedAt = conversation.AiSummaryUpdatedAt,
                        HasUrgentItems = conversation.HasUrgentItems,
                        UrgentItemsJson = conversation.UrgentItemsJson,
                        UrgentItemsDetectedAt = conversation.UrgentItemsDetectedAt,
                        CreatedAt = conversation.CreatedAt,
                        UpdatedAt = conversation.UpdatedAt,
                        Participants = conversation.Participants
                            .Where(p => !p.IsDeleted)
                            .Select(p => new ConversationParticipantDto
                            {
                                UserId = p.UserId,
                                UserName = p.User != null
                                ? $"{p.User.FirstName} {p.User.LastName}".Trim()
                                : p.User?.Email ?? "Unknown",
                                UserEmail = p.User?.Email,
                                IsAdmin = p.IsAdmin,
                                JoinedAt = p.JoinedAt,
                                IsActive = !p.IsDeleted
                            }).ToList()
                    };

                    await AttachLandlordSmsNumberAsync(dto, conversation.OrganizationId);

                    // Get unread count (we'll optimize this later with a single query)
                    dto.UnreadCount = await GetUnreadCount(conversation.Id, landlordId);

                    // Check if conversation has any urgent messages (not suppressed)
                    var hasUrgentMessages = await _context.Messages
                        .Where(m => m.ConversationId == conversation.Id && m.IsUrgent && !m.IsDeleted)
                        .AnyAsync();
                    
                    // Update HasUrgentItems based on actual message status
                    dto.HasUrgentItems = hasUrgentMessages;

                    // Get last message sender name
                    if (conversation.LastMessageBy.HasValue)
                    {
                        var lastSender = await _context.Users.FindAsync(conversation.LastMessageBy.Value);
                        dto.LastMessageByName = lastSender != null
                        ? $"{lastSender.FirstName} {lastSender.LastName}".Trim()
                        : lastSender?.Email ?? "Unknown";
                    }

                    dtos.Add(dto);
                }

                return dtos;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving conversations for landlord {LandlordId}", landlordId);
                throw;
            }
        }

        public async Task<List<LoadConversationDto>> GetConversationsByOrganizationId(long organizationId, bool includeArchived = false, long? landlordId = null)
        {
            try
            {
                var query = _context.Conversations
                    .Include(c => c.Landlord)
                    .Include(c => c.Property)
                    .Include(c => c.Lease)
                    .Include(c => c.Tenant)
                    .Include(c => c.Participants)
                        .ThenInclude(p => p.User)
                    .Where(c => c.OrganizationId == organizationId &&
                        !_context.SupportAndFeedbacks.Any(ticket => ticket.ConversationId == c.Id));

                if (!includeArchived)
                {
                    query = query.Where(c => !c.IsArchived);
                }

                var conversations = await query
                    .OrderByDescending(c => c.IsPinned)
                    .ThenByDescending(c => c.LastMessageAt ?? c.CreatedAt)
                    .ToListAsync();

                var dtos = new List<LoadConversationDto>();

                foreach (var conversation in conversations)
                {
                    var dto = new LoadConversationDto
                    {
                        Id = conversation.Id,
                        Title = conversation.Title,
                        Description = conversation.Description,
                        IsGroupChat = conversation.IsGroupChat,
                        LandlordId = conversation.LandlordId,
                        LandlordName = conversation.Landlord != null
                        ? $"{conversation.Landlord.FirstName} {conversation.Landlord.LastName}".Trim()
                        : conversation.Landlord?.Email ?? "Unknown",
                        LandlordEmail = conversation.Landlord?.Email,
                        PropertyId = conversation.PropertyId,
                        PropertyName = conversation.Property?.Name,
                        LeaseId = conversation.LeaseId,
                        TenantId = conversation.TenantId,
                        TenantName = conversation.Tenant != null
                            ? $"{conversation.Tenant.Firstname} {conversation.Tenant.Lastname}".Trim()
                            : conversation.Tenant?.Email ?? "Unknown",
                        TenantEmail = conversation.Tenant?.Email,
                    TenantPhoneNumber = conversation.Tenant?.PhoneNumber,
                        IsArchived = conversation.IsArchived,
                        IsPinned = conversation.IsPinned,
                        AiSummary = conversation.AiSummary,
                        AiSummaryUpdatedAt = conversation.AiSummaryUpdatedAt,
                        HasUrgentItems = conversation.HasUrgentItems,
                        UrgentItemsJson = conversation.UrgentItemsJson,
                        UrgentItemsDetectedAt = conversation.UrgentItemsDetectedAt,
                        CreatedAt = conversation.CreatedAt,
                        UpdatedAt = conversation.UpdatedAt,
                        LastMessageAt = conversation.LastMessageAt,
                        LastMessagePreview = conversation.LastMessagePreview,
                        LastMessageBy = conversation.LastMessageBy
                    };

                    await AttachLandlordSmsNumberAsync(dto, conversation.OrganizationId);

                    // Get unread count for the landlord if provided
                    if (landlordId.HasValue)
                    {
                        dto.UnreadCount = await GetUnreadCount(conversation.Id, landlordId.Value);
                    }
                    else
                    {
                        dto.UnreadCount = 0;
                    }

                    // Check if conversation has any urgent messages (not suppressed)
                    var hasUrgentMessages = await _context.Messages
                        .Where(m => m.ConversationId == conversation.Id && m.IsUrgent && !m.IsDeleted)
                        .AnyAsync();
                    
                    // Update HasUrgentItems based on actual message status
                    dto.HasUrgentItems = hasUrgentMessages;

                    // Get participants
                    dto.Participants = conversation.Participants?
                        .Where(p => !p.IsDeleted)
                        .Select(p => new ConversationParticipantDto
                        {
                            UserId = p.UserId,
                            UserName = p.User != null
                                ? $"{p.User.FirstName} {p.User.LastName}".Trim()
                                : p.User?.Email ?? "Unknown",
                            UserEmail = p.User?.Email,
                            IsAdmin = p.IsAdmin,
                            JoinedAt = p.JoinedAt,
                            IsActive = !p.IsDeleted
                        }).ToList() ?? new List<ConversationParticipantDto>();

                    // Get last message sender name
                    if (conversation.LastMessageBy.HasValue)
                    {
                        var lastSender = await _context.Users.FindAsync(conversation.LastMessageBy.Value);
                        dto.LastMessageByName = lastSender != null
                        ? $"{lastSender.FirstName} {lastSender.LastName}".Trim()
                        : lastSender?.Email ?? "Unknown";
                    }

                    dtos.Add(dto);
                }

                return dtos;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving conversations for organization {OrganizationId}", organizationId);
                throw;
            }
        }

        public async Task<List<LoadConversationDto>> GetConversationsByParticipantUserId(long userId, bool includeArchived = false)
        {
            try
            {
                var query = _context.Conversations
                    .Include(c => c.Landlord)
                    .Include(c => c.Property)
                    .Include(c => c.Lease)
                    .Include(c => c.Tenant)
                    .Include(c => c.Participants)
                        .ThenInclude(p => p.User)
                    .Where(c => c.Participants.Any(p => p.UserId == userId && !p.IsDeleted) &&
                        !_context.SupportAndFeedbacks.Any(ticket => ticket.ConversationId == c.Id));

                if (!includeArchived)
                {
                    query = query.Where(c => !c.IsArchived);
                }

                var conversations = await query
                    .OrderByDescending(c => c.IsPinned)
                    .ThenByDescending(c => c.LastMessageAt ?? c.CreatedAt)
                    .ToListAsync();

                var dtos = new List<LoadConversationDto>();

                foreach (var conversation in conversations)
                {
                    var dto = new LoadConversationDto
                    {
                        Id = conversation.Id,
                        Title = conversation.Title,
                        Description = conversation.Description,
                        IsGroupChat = conversation.IsGroupChat,
                        LandlordId = conversation.LandlordId,
                        LandlordName = conversation.Landlord != null
                        ? $"{conversation.Landlord.FirstName} {conversation.Landlord.LastName}".Trim()
                        : conversation.Landlord?.Email ?? "Unknown",
                        LandlordEmail = conversation.Landlord?.Email,
                        PropertyId = conversation.PropertyId,
                        PropertyName = conversation.Property?.Name,
                        LeaseId = conversation.LeaseId,
                        TenantId = conversation.TenantId,
                        TenantName = conversation.Tenant != null
                            ? $"{conversation.Tenant.Firstname} {conversation.Tenant.Lastname}".Trim()
                            : null,
                        TenantEmail = conversation.Tenant?.Email,
                    TenantPhoneNumber = conversation.Tenant?.PhoneNumber,
                        IsArchived = conversation.IsArchived,
                        IsPinned = conversation.IsPinned,
                        LastMessageAt = conversation.LastMessageAt,
                        LastMessagePreview = conversation.LastMessagePreview,
                        LastMessageBy = conversation.LastMessageBy,
                        AiSummary = conversation.AiSummary,
                        AiSummaryUpdatedAt = conversation.AiSummaryUpdatedAt,
                        HasUrgentItems = conversation.HasUrgentItems,
                        UrgentItemsJson = conversation.UrgentItemsJson,
                        UrgentItemsDetectedAt = conversation.UrgentItemsDetectedAt,
                        CreatedAt = conversation.CreatedAt,
                        UpdatedAt = conversation.UpdatedAt,
                        Participants = conversation.Participants
                            .Where(p => !p.IsDeleted)
                            .Select(p => new ConversationParticipantDto
                            {
                                UserId = p.UserId,
                                UserName = p.User != null
                                ? $"{p.User.FirstName} {p.User.LastName}".Trim()
                                : p.User?.Email ?? "Unknown",
                                UserEmail = p.User?.Email,
                                IsAdmin = p.IsAdmin,
                                JoinedAt = p.JoinedAt,
                                IsActive = !p.IsDeleted
                            }).ToList()
                    };

                    await AttachLandlordSmsNumberAsync(dto, conversation.OrganizationId);

                    // Get unread count for the participant
                    dto.UnreadCount = await GetUnreadCount(conversation.Id, userId);

                    // Check if conversation has any urgent messages (not suppressed)
                    var hasUrgentMessages = await _context.Messages
                        .Where(m => m.ConversationId == conversation.Id && m.IsUrgent && !m.IsDeleted)
                        .AnyAsync();
                    
                    // Update HasUrgentItems based on actual message status
                    dto.HasUrgentItems = hasUrgentMessages;

                    // Get last message sender name
                    if (conversation.LastMessageBy.HasValue)
                    {
                        var lastSender = await _context.Users.FindAsync(conversation.LastMessageBy.Value);
                        dto.LastMessageByName = lastSender != null
                        ? $"{lastSender.FirstName} {lastSender.LastName}".Trim()
                        : lastSender?.Email ?? "Unknown";
                    }

                    dtos.Add(dto);
                }

                return dtos;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving conversations for participant user {UserId}", userId);
                throw;
            }
        }

        public async Task<LoadConversationDto> UpdateConversation(long conversationId, AddConversationDto conversation)
        {
            try
            {
                var existing = await _context.Conversations.FindAsync(conversationId);
                if (existing == null)
                    throw new KeyNotFoundException("Conversation not found");

                existing.Title = conversation.Title;
                existing.Description = conversation.Description;
                existing.IsGroupChat = conversation.IsGroupChat;
                existing.UpdatedAt = DateTime.UtcNow;

                _context.Conversations.Update(existing);
                await _context.SaveChangesAsync();

                return await GetConversationById(conversationId, existing.LandlordId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating conversation {ConversationId}", conversationId);
                throw;
            }
        }

        public async Task<bool> DeleteConversation(long conversationId)
        {
            try
            {
                var conversation = await _context.Conversations.FindAsync(conversationId);
                if (conversation == null)
                    return false;

                _context.Conversations.Remove(conversation);
                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting conversation {ConversationId}", conversationId);
                throw;
            }
        }

        public async Task<LoadConversationDto> ArchiveConversation(long conversationId, bool archive)
        {
            try
            {
                var conversation = await _context.Conversations.FindAsync(conversationId);
                if (conversation == null)
                    throw new KeyNotFoundException("Conversation not found");

                conversation.IsArchived = archive;
                conversation.UpdatedAt = DateTime.UtcNow;

                _context.Conversations.Update(conversation);
                await _context.SaveChangesAsync();

                return await GetConversationById(conversationId, conversation.LandlordId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error archiving conversation {ConversationId}", conversationId);
                throw;
            }
        }

        public async Task<LoadConversationDto> PinConversation(long conversationId, bool pin)
        {
            try
            {
                var conversation = await _context.Conversations.FindAsync(conversationId);
                if (conversation == null)
                    throw new KeyNotFoundException("Conversation not found");

                conversation.IsPinned = pin;
                conversation.UpdatedAt = DateTime.UtcNow;

                _context.Conversations.Update(conversation);
                await _context.SaveChangesAsync();

                return await GetConversationById(conversationId, conversation.LandlordId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error pinning conversation {ConversationId}", conversationId);
                throw;
            }
        }

        private async Task AttachLandlordSmsNumberAsync(LoadConversationDto dto, long? organizationId)
        {
            if (!organizationId.HasValue) return;

            var smsNumber = await _context.OrganizationSmsNumbers
                .AsNoTracking()
                .Where(x => x.OrganizationId == organizationId.Value && x.IsActive && x.IsPrimary)
                .Select(x => x.PhoneNumber)
                .FirstOrDefaultAsync();

            dto.LandlordSmsNumber = smsNumber;
        }

        public async Task<int> GetUnreadCount(long conversationId, long userId)
        {
            try
            {
                // Count messages in this conversation that haven't been read by this user
                // Exclude messages sent by the current user (they don't count as unread for themselves)
                var totalMessages = await _context.Messages
                    .Where(m => m.ConversationId == conversationId && !m.IsDeleted && m.SenderId != userId)
                    .CountAsync();

                var readMessages = await _context.MessageReads
                    .Where(mr => mr.Message.ConversationId == conversationId && mr.UserId == userId && mr.Message.SenderId != userId)
                    .CountAsync();

                return Math.Max(0, totalMessages - readMessages);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting unread count for conversation {ConversationId}", conversationId);
                return 0;
            }
        }

        public async Task<LoadConversationDto> GetOrCreateTenantLandlordConversation(long tenantUserId)
        {
            try
            {
                // Get tenant - include leases, organization with owner, and related relationships
                var tenant = await _context.Tenants
                    .Include(t => t.TenantLeases)
                        .ThenInclude(tl => tl.Lease)
                            .ThenInclude(l => l.Unit)
                                .ThenInclude(u => u.Property)
                    .Include(t => t.Organization)
                        .ThenInclude(o => o.Owner)
                    .FirstOrDefaultAsync(t => t.UserId == tenantUserId && !t.IsDeleted);

                if (tenant == null)
                {
                    throw new Exception("Tenant not found");
                }

                long landlordId;
                long? leaseId = null;
                long? propertyId = null;
                long tenantId = tenant.Id;
                string conversationTitle = "Conversation with Landlord";
                string conversationDescription = "Messages with your landlord";

                // Priority 1: Try to get landlord from first lease (if lease exists)
                var firstLease = tenant.TenantLeases?.FirstOrDefault()?.Lease;
                if (firstLease != null && !firstLease.IsDeleted)
                {
                    landlordId = firstLease.Unit.Property.LandlordId;
                    leaseId = firstLease.Id;
                    propertyId = firstLease.Unit.PropertyId;
                    conversationTitle = $"Conversation with {firstLease.Unit.Property.Name}";
                    conversationDescription = $"Messages about {firstLease.Unit.Property.Name}";
                }
                // Priority 2: Try to find landlord through organization (organization owner)
                // Tenants are tied to organizations, so this should be the primary fallback
                else if (tenant.OrganizationId.HasValue && tenant.Organization != null)
                {
                    if (tenant.Organization.OwnerId.HasValue)
                    {
                        landlordId = tenant.Organization.OwnerId.Value;
                        conversationTitle = $"Conversation with {tenant.Organization.Name}";
                        conversationDescription = $"Messages with {tenant.Organization.Name}";
                    }
                    else
                    {
                        // Organization exists but has no owner - try tenant invite as fallback
                        var tenantInvite = await _context.TenantInvites
                            .Include(ti => ti.CreatedByUser)
                            .Where(ti => ti.TenantId == tenantId && ti.IsUsed)
                            .OrderByDescending(ti => ti.UsedAt ?? ti.CreatedAt)
                            .FirstOrDefaultAsync();

                        if (tenantInvite != null && tenantInvite.CreatedByUser != null)
                        {
                            landlordId = tenantInvite.CreatedBy;
                        }
                        else
                        {
                            throw new Exception("Unable to determine landlord. The organization does not have an owner assigned. Please contact support.");
                        }
                    }
                }
                // Priority 3: Fallback to tenant invite if no organization
                else
                {
                    var tenantInvite = await _context.TenantInvites
                        .Include(ti => ti.CreatedByUser)
                        .Where(ti => ti.TenantId == tenantId && ti.IsUsed)
                        .OrderByDescending(ti => ti.UsedAt ?? ti.CreatedAt)
                        .FirstOrDefaultAsync();

                    if (tenantInvite != null && tenantInvite.CreatedByUser != null)
                    {
                        landlordId = tenantInvite.CreatedBy;
                    }
                    else
                    {
                        throw new Exception("Unable to determine landlord. Please contact support.");
                    }
                }

                // Check if a direct conversation already exists for this landlord + tenant user.
                // This intentionally ignores LeaseId/PropertyId so a person with multiple
                // leases/units still has one inbox thread.
                var existingConversation = await FindExistingDirectConversationForTenantLandlordAsync(
                    tenantUserId,
                    tenantId,
                    landlordId,
                    tenant.OrganizationId);

                if (existingConversation != null)
                {
                    await EnsureDirectConversationParticipantsAsync(existingConversation.Id, landlordId, [tenantUserId]);
                    await ReviveAndHydrateDirectConversationAsync(existingConversation, tenant.OrganizationId, propertyId, leaseId, tenantId);
                    return await GetConversationById(existingConversation.Id, tenantUserId);
                }

                // Create new conversation
                var conversation = new Conversation
                {
                    Title = conversationTitle,
                    Description = conversationDescription,
                    IsGroupChat = false,
                    LandlordId = landlordId,
                    PropertyId = propertyId,
                    LeaseId = leaseId,
                    TenantId = tenantId,
                    OrganizationId = tenant.OrganizationId,
                    CreatedBy = tenantUserId
                };

                await _context.Conversations.AddAsync(conversation);
                await _context.SaveChangesAsync();

                await EnsureDirectConversationParticipantsAsync(conversation.Id, landlordId, [tenantUserId]);

                return await GetConversationById(conversation.Id, tenantUserId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting or creating tenant-landlord conversation for tenant user {TenantUserId}", tenantUserId);
                throw;
            }
        }

        public async Task<List<LoadConversationDto>> GetConversationsByTenantUserId(long tenantUserId, bool includeArchived = false)
        {
            try
            {
                var tenant = await _context.Tenants
                    .FirstOrDefaultAsync(t => t.UserId == tenantUserId && !t.IsDeleted);

                if (tenant == null) return [];

                var query = _context.Conversations
                    .Include(c => c.Landlord)
                    .Include(c => c.Property)
                    .Include(c => c.Lease)
                    .Include(c => c.Tenant)
                    .Include(c => c.Participants).ThenInclude(p => p.User)
                    .Where(c => (c.TenantId == tenant.Id || c.Participants.Any(p => p.UserId == tenantUserId && !p.IsDeleted)) &&
                        !_context.SupportAndFeedbacks.Any(ticket => ticket.ConversationId == c.Id));

                if (!includeArchived)
                    query = query.Where(c => !c.IsArchived);

                var conversations = await query
                    .OrderByDescending(c => c.IsPinned)
                    .ThenByDescending(c => c.LastMessageAt ?? c.CreatedAt)
                    .ToListAsync();

                var dtos = new List<LoadConversationDto>();
                foreach (var conversation in conversations)
                {
                    var dto = new LoadConversationDto
                    {
                        Id = conversation.Id,
                        Title = conversation.Title,
                        Description = conversation.Description,
                        IsGroupChat = conversation.IsGroupChat,
                        LandlordId = conversation.LandlordId,
                        LandlordName = conversation.Landlord != null
                            ? $"{conversation.Landlord.FirstName} {conversation.Landlord.LastName}".Trim()
                            : conversation.Landlord?.Email ?? "Unknown",
                        LandlordEmail = conversation.Landlord?.Email,
                        PropertyId = conversation.PropertyId,
                        PropertyName = conversation.Property?.Name,
                        LeaseId = conversation.LeaseId,
                        TenantId = conversation.TenantId,
                        TenantName = conversation.Tenant != null
                            ? $"{conversation.Tenant.Firstname} {conversation.Tenant.Lastname}".Trim()
                            : null,
                        TenantEmail = conversation.Tenant?.Email,
                    TenantPhoneNumber = conversation.Tenant?.PhoneNumber,
                        IsArchived = conversation.IsArchived,
                        IsPinned = conversation.IsPinned,
                        LastMessageAt = conversation.LastMessageAt,
                        LastMessagePreview = conversation.LastMessagePreview,
                        LastMessageBy = conversation.LastMessageBy,
                        CreatedAt = conversation.CreatedAt,
                        UpdatedAt = conversation.UpdatedAt,
                        Participants = conversation.Participants
                            .Where(p => !p.IsDeleted)
                            .Select(p => new ConversationParticipantDto
                            {
                                UserId = p.UserId,
                                UserName = p.User != null
                                    ? $"{p.User.FirstName} {p.User.LastName}".Trim()
                                    : p.User?.Email ?? "Unknown",
                                UserEmail = p.User?.Email,
                                IsAdmin = p.IsAdmin,
                                JoinedAt = p.JoinedAt,
                                IsActive = !p.IsDeleted
                            }).ToList()
                    };

                    await AttachLandlordSmsNumberAsync(dto, conversation.OrganizationId);

                    dto.UnreadCount = await GetUnreadCount(conversation.Id, tenantUserId);

                    if (conversation.LastMessageBy.HasValue)
                    {
                        var lastSender = await _context.Users.FindAsync(conversation.LastMessageBy.Value);
                        dto.LastMessageByName = lastSender != null
                            ? $"{lastSender.FirstName} {lastSender.LastName}".Trim()
                            : lastSender?.Email ?? "Unknown";
                    }

                    dtos.Add(dto);
                }

                return dtos;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving conversations for tenant user {TenantUserId}", tenantUserId);
                throw;
            }
        }

        public async Task<List<TenantAvailableLandlordDto>> GetAvailableLandlordsForTenant(long tenantUserId)
        {
            try
            {
                var tenant = await _context.Tenants
                    .Include(t => t.TenantLeases)
                        .ThenInclude(tl => tl.Lease)
                            .ThenInclude(l => l.Unit)
                                .ThenInclude(u => u.Property)
                    .FirstOrDefaultAsync(t => t.UserId == tenantUserId && !t.IsDeleted);

                if (tenant == null) return [];

                var result = new List<TenantAvailableLandlordDto>();
                var seen = new HashSet<long>();

                async Task AddLandlordAsync(long landlordUserId, string? propertyName = null)
                {
                    if (landlordUserId <= 0 || seen.Contains(landlordUserId)) return;

                    var landlordUser = await _context.Users.FindAsync(landlordUserId);
                    if (landlordUser == null) return;

                    seen.Add(landlordUserId);
                    result.Add(new TenantAvailableLandlordDto
                    {
                        LandlordUserId = landlordUserId,
                        Name = !string.IsNullOrWhiteSpace($"{landlordUser.FirstName} {landlordUser.LastName}".Trim())
                               ? $"{landlordUser.FirstName} {landlordUser.LastName}".Trim()
                               : landlordUser.Email ?? "Unknown",
                        Email = landlordUser.Email,
                        PropertyName = propertyName
                    });
                }

                foreach (var tl in tenant.TenantLeases.Where(tl => tl.Lease != null && !tl.Lease.IsDeleted))
                {
                    var property = tl.Lease?.Unit?.Property;
                    if (property == null) continue;
                    await AddLandlordAsync(property.LandlordId, property.Name);
                }

                if (result.Count == 0 && tenant.OrganizationId.HasValue)
                {
                    var organization = await _context.Organizations
                        .AsNoTracking()
                        .FirstOrDefaultAsync(o => o.Id == tenant.OrganizationId.Value && !o.IsDeleted);

                    if (organization?.OwnerId.HasValue == true)
                    {
                        await AddLandlordAsync(organization.OwnerId.Value, organization.Name);
                    }

                    var organizationPropertyLandlords = await _context.Properties
                        .AsNoTracking()
                        .Where(p => p.OrganizationId == tenant.OrganizationId.Value && !p.IsDeleted)
                        .Select(p => new { p.LandlordId, p.Name })
                        .Distinct()
                        .ToListAsync();

                    foreach (var propertyLandlord in organizationPropertyLandlords)
                    {
                        await AddLandlordAsync(propertyLandlord.LandlordId, propertyLandlord.Name);
                    }
                }

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving available landlords for tenant user {TenantUserId}", tenantUserId);
                throw;
            }
        }

        public async Task<LoadConversationDto> GetOrCreateConversationForTenantLandlord(long tenantUserId, long landlordUserId)
        {
            try
            {
                var tenant = await _context.Tenants
                    .Include(t => t.TenantLeases)
                        .ThenInclude(tl => tl.Lease)
                            .ThenInclude(l => l.Unit)
                                .ThenInclude(u => u.Property)
                    .FirstOrDefaultAsync(t => t.UserId == tenantUserId && !t.IsDeleted);

                if (tenant == null) throw new Exception("Tenant not found");

                // Find the most relevant lease for this landlord
                var relatedLease = tenant.TenantLeases?
                    .Where(tl => tl.Lease != null && !tl.Lease.IsDeleted && tl.Lease.Unit?.Property?.LandlordId == landlordUserId)
                    .OrderByDescending(tl => tl.Lease!.StartDate)
                    .FirstOrDefault()?.Lease;

                var existing = await FindExistingDirectConversationForTenantLandlordAsync(
                    tenantUserId,
                    tenant.Id,
                    landlordUserId,
                    tenant.OrganizationId);

                if (existing != null)
                {
                    await EnsureDirectConversationParticipantsAsync(existing.Id, landlordUserId, [tenantUserId]);
                    await ReviveAndHydrateDirectConversationAsync(existing, tenant.OrganizationId, relatedLease?.Unit?.Property?.Id, relatedLease?.Id, tenant.Id);
                    return await GetConversationById(existing.Id, tenantUserId);
                }

                if (relatedLease == null && tenant.OrganizationId.HasValue)
                {
                    var landlordInTenantOrganization = await _context.Organizations
                        .AsNoTracking()
                        .AnyAsync(o => o.Id == tenant.OrganizationId.Value && !o.IsDeleted && o.OwnerId == landlordUserId)
                        || await _context.Properties
                            .AsNoTracking()
                            .AnyAsync(p => p.OrganizationId == tenant.OrganizationId.Value && !p.IsDeleted && p.LandlordId == landlordUserId);

                    if (!landlordInTenantOrganization)
                    {
                        throw new Exception("Landlord is not connected to this tenant");
                    }
                }

                var landlordUser = await _context.Users.FindAsync(landlordUserId);
                var landlordName = landlordUser != null
                    ? $"{landlordUser.FirstName} {landlordUser.LastName}".Trim()
                    : "Landlord";

                var conversation = new Conversation
                {
                    Title = $"Conversation with {landlordName}",
                    Description = "Messages with your landlord",
                    IsGroupChat = false,
                    LandlordId = landlordUserId,
                    PropertyId = relatedLease?.Unit?.Property?.Id,
                    LeaseId = relatedLease?.Id,
                    TenantId = tenant.Id,
                    OrganizationId = tenant.OrganizationId,
                    CreatedBy = tenantUserId
                };

                await _context.Conversations.AddAsync(conversation);
                await _context.SaveChangesAsync();

                // Add both parties as participants so MessageController can notify them
                var participants = new List<ConversationParticipant>
                {
                    new ConversationParticipant { ConversationId = conversation.Id, UserId = tenantUserId, IsDeleted = false },
                    new ConversationParticipant { ConversationId = conversation.Id, UserId = landlordUserId, IsDeleted = false }
                };
                await _context.ConversationParticipants.AddRangeAsync(participants);
                await _context.SaveChangesAsync();

                return await GetConversationById(conversation.Id, tenantUserId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting or creating conversation for tenant {TenantUserId} with landlord {LandlordUserId}", tenantUserId, landlordUserId);
                throw;
            }
        }

        public async Task<int> DeleteConversationsByPropertyId(long propertyId)
        {
            try
            {
                var conversations = await _context.Conversations
                    .Where(c => c.PropertyId == propertyId)
                    .ToListAsync();
                
                _context.Conversations.RemoveRange(conversations);
                await _context.SaveChangesAsync();
                
                return conversations.Count;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting conversations for property {PropertyId}", propertyId);
                throw;
            }
        }

        public async Task<LoadConversationDto?> UpdateConversationAnalysisAsync(long conversationId, string? summary, bool hasUrgentItems, string? urgentItemsJson)
        {
            try
            {
                var conversation = await _context.Conversations
                    .FirstOrDefaultAsync(c => c.Id == conversationId);

                if (conversation == null)
                {
                    return null;
                }

                // Check if conversation actually has any urgent messages (not suppressed)
                var actualHasUrgentMessages = await _context.Messages
                    .Where(m => m.ConversationId == conversationId && m.IsUrgent && !m.IsDeleted)
                    .AnyAsync();

                conversation.AiSummary = summary;
                conversation.AiSummaryUpdatedAt = DateTime.UtcNow;
                conversation.HasUrgentItems = actualHasUrgentMessages; // Use actual message status
                conversation.UrgentItemsJson = urgentItemsJson; // Keep for backward compatibility during migration
                conversation.UrgentItemsDetectedAt = actualHasUrgentMessages ? DateTime.UtcNow : conversation.UrgentItemsDetectedAt;
                conversation.UpdatedAt = DateTime.UtcNow;

                _context.Conversations.Update(conversation);
                await _context.SaveChangesAsync();

                return await GetConversationById(conversationId, conversation.LandlordId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating conversation analysis for conversation {ConversationId}", conversationId);
                throw;
            }
        }

        public async Task<LoadConversationDto?> ClearSpecificUrgentItemAsync(long conversationId, string urgentItemId, long? messageId = null)
        {
            try
            {
                var conversation = await _context.Conversations
                    .FirstOrDefaultAsync(c => c.Id == conversationId);

                if (conversation == null)
                {
                    return null;
                }

                // Parse existing urgent items
                List<UrgentItemDto>? urgentItems = null;
                if (!string.IsNullOrEmpty(conversation.UrgentItemsJson))
                {
                    try
                    {
                        urgentItems = System.Text.Json.JsonSerializer.Deserialize<List<UrgentItemDto>>(conversation.UrgentItemsJson);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to parse urgent items JSON for conversation {ConversationId}", conversationId);
                        urgentItems = new List<UrgentItemDto>();
                    }
                }

                if (urgentItems == null || urgentItems.Count == 0)
                {
                    // No urgent items to clear
                    return await GetConversationById(conversationId, conversation.LandlordId);
                }

                // Try to remove the item with the matching ID (case-insensitive comparison)
                var initialCount = urgentItems.Count;
                UrgentItemDto? itemToRemove = null;
                
                // First try to match by ID if urgentItemId is provided
                if (!string.IsNullOrEmpty(urgentItemId))
                {
                    itemToRemove = urgentItems.FirstOrDefault(item => 
                        !string.IsNullOrEmpty(item.Id) && 
                        string.Equals(item.Id, urgentItemId, StringComparison.OrdinalIgnoreCase));
                }
                
                // If no match by ID and we have a messageId, try to match by message content
                if (itemToRemove == null && messageId.HasValue)
                {
                    _logger.LogInformation("Urgent item with ID {UrgentItemId} not found by exact match, attempting content-based match using message {MessageId}", urgentItemId, messageId.Value);
                    
                    // Get message content
                    var message = await _context.Messages
                        .FirstOrDefaultAsync(m => m.Id == messageId.Value && m.ConversationId == conversationId);
                    
                    if (message != null)
                    {
                        var messageContent = message.Content.ToLowerInvariant().Trim();
                        
                        // Try to find urgent item by matching message content with messageExcerpt or description
                        itemToRemove = urgentItems.FirstOrDefault(item =>
                        {
                            // Match by messageExcerpt if available
                            if (!string.IsNullOrEmpty(item.MessageExcerpt))
                            {
                                var excerpt = item.MessageExcerpt.ToLowerInvariant().Trim();
                                if (messageContent.Contains(excerpt) || excerpt.Contains(messageContent))
                                {
                                    return true;
                                }
                                
                                // Check for matching words
                                var excerptWords = excerpt.Split(new[] { ' ', '\n', '\r', '\t' }, StringSplitOptions.RemoveEmptyEntries)
                                    .Where(w => w.Length > 3)
                                    .ToList();
                                var messageWords = messageContent.Split(new[] { ' ', '\n', '\r', '\t' }, StringSplitOptions.RemoveEmptyEntries)
                                    .Where(w => w.Length > 3)
                                    .ToList();
                                
                                var matchingWords = excerptWords.Count(word => messageWords.Contains(word));
                                if (matchingWords >= 2)
                                {
                                    return true;
                                }
                            }
                            
                            // Match by description keywords
                            if (!string.IsNullOrEmpty(item.Description))
                            {
                                var description = item.Description.ToLowerInvariant();
                                var urgentKeywords = new[] { "leak", "broken", "burst", "pipe", "sink", "help", "urgent", "emergency" };
                                if (urgentKeywords.Any(keyword => messageContent.Contains(keyword) && description.Contains(keyword)))
                                {
                                    return true;
                                }
                            }
                            
                            return false;
                        });
                    }
                }
                
                if (itemToRemove != null)
                {
                    urgentItems.Remove(itemToRemove);
                    _logger.LogInformation("Removed urgent item {UrgentItemId} from conversation {ConversationId}", urgentItemId, conversationId);
                }
                
                var removed = initialCount != urgentItems.Count;

                if (!removed)
                {
                    _logger.LogWarning("Urgent item with ID {UrgentItemId} not found in conversation {ConversationId}. Available IDs: {AvailableIds}", 
                        urgentItemId, 
                        conversationId,
                        string.Join(", ", urgentItems.Select(i => i.Id ?? "(null)")));
                }

                // Update the conversation
                if (urgentItems.Count == 0)
                {
                    // No more urgent items
                    conversation.HasUrgentItems = false;
                    conversation.UrgentItemsJson = null;
                }
                else
                {
                    // Still has urgent items, update the JSON
                    conversation.HasUrgentItems = true;
                    conversation.UrgentItemsJson = System.Text.Json.JsonSerializer.Serialize(urgentItems);
                }

                conversation.UpdatedAt = DateTime.UtcNow;

                _context.Conversations.Update(conversation);
                await _context.SaveChangesAsync();

                return await GetConversationById(conversationId, conversation.LandlordId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error clearing specific urgent item {UrgentItemId} for conversation {ConversationId}", urgentItemId, conversationId);
                throw;
            }
        }

        public async Task<List<UrgentMessageDetailDto>> GetAllUrgentMessageDetailsAsync(long organizationId)
        {
            try
            {
                // Get all conversations with urgent items for this organization
                var conversations = await _context.Conversations
                    .Include(c => c.Property)
                        .ThenInclude(p => p.Units)
                    .Include(c => c.Tenant)
                    .Include(c => c.Lease)
                        .ThenInclude(l => l.Unit)
                    .Where(c => c.OrganizationId == organizationId 
                        && !c.IsArchived 
                        && c.HasUrgentItems 
                        && !_context.SupportAndFeedbacks.Any(ticket => ticket.ConversationId == c.Id)
                        && !string.IsNullOrEmpty(c.UrgentItemsJson))
                    .ToListAsync();

                var urgentMessageDetails = new List<UrgentMessageDetailDto>();

                // Get suppressed message IDs
                var suppressedMessageIds = await _context.ActionSuppressions
                    .Where(s => s.OrganizationId == organizationId
                        && s.ActionType == "urgentMessage"
                        && s.IsActive
                        && (s.SuppressedUntil == null || s.SuppressedUntil > DateTime.UtcNow))
                    .Select(s => s.EntityId)
                    .ToHashSetAsync();

                foreach (var conversation in conversations)
                {
                    // Parse urgent items
                    List<UrgentItemDto>? urgentItems = null;
                    try
                    {
                        urgentItems = System.Text.Json.JsonSerializer.Deserialize<List<UrgentItemDto>>(conversation.UrgentItemsJson ?? "[]");
                    }
                    catch
                    {
                        continue;
                    }

                    if (urgentItems == null || urgentItems.Count == 0)
                        continue;

                    // Get ALL messages for this conversation (including suppressed ones) to properly match urgent items
                    // We need to check if the matching message is suppressed before creating the detail
                    var tenantUserId = conversation.TenantId.HasValue 
                        ? await _context.Tenants
                            .Where(t => t.Id == conversation.TenantId.Value)
                            .Select(t => t.UserId)
                            .FirstOrDefaultAsync()
                        : null;

                    var allMessages = await _context.Messages
                        .Where(m => m.ConversationId == conversation.Id
                            && (tenantUserId == null || m.SenderId == tenantUserId.Value))
                        .OrderByDescending(m => m.CreatedAt)
                        .ToListAsync();

                    // Get only non-suppressed messages for fallback scenarios
                    var nonSuppressedMessages = allMessages
                        .Where(m => !suppressedMessageIds.Contains(m.Id))
                        .ToList();

                    // Determine if property is multi-unit
                    var unitCount = conversation.Property?.Units?.Count ?? 0;
                    var isMultiUnit = unitCount > 1;

                    // Get unit name from lease if available
                    string? unitName = null;
                    if (conversation.Lease?.Unit != null)
                    {
                        unitName = conversation.Lease.Unit.Name;
                    }
                    else if (conversation.Property?.Units != null && conversation.Property.Units.Count == 1)
                    {
                        unitName = conversation.Property.Units.First().Name;
                    }

                    // Sort urgent items by priority: maintenance/safety first, then payment, then others
                    var prioritizedUrgentItems = urgentItems.OrderBy(item =>
                    {
                        var type = item.Type?.ToLower() ?? "";
                        return type switch
                        {
                            "maintenance" or "safety" => 0, // Highest priority
                            "payment" => 1,
                            "lease_violation" => 2,
                            _ => 3
                        };
                    }).ToList();

                    // For each urgent item, find matching message and create detail
                    foreach (var urgentItem in prioritizedUrgentItems)
                    {
                        // First, try to find the message that matches this urgent item's excerpt
                        // Search in ALL messages (including suppressed) to find the original match
                        var matchingMessage = allMessages.FirstOrDefault(m =>
                        {
                            if (string.IsNullOrEmpty(urgentItem.MessageExcerpt))
                                return false; // Don't match if no excerpt - we need a specific match

                            var messageContent = m.Content.ToLowerInvariant().Trim();
                            var excerpt = urgentItem.MessageExcerpt.ToLowerInvariant().Trim();

                            // Check if message contains excerpt or vice versa
                            return messageContent.Contains(excerpt) || excerpt.Contains(messageContent);
                        });

                        // If we found a matching message, check if it's suppressed
                        if (matchingMessage != null && suppressedMessageIds.Contains(matchingMessage.Id))
                        {
                            // The message that triggered this urgent item is suppressed, skip it
                            continue;
                        }

                        // If no matching message found by excerpt, try to use a non-suppressed message as fallback
                        // Only do this if there's no excerpt (meaning we can't match it to a specific message)
                        if (matchingMessage == null)
                        {
                            if (string.IsNullOrEmpty(urgentItem.MessageExcerpt) && nonSuppressedMessages.Count > 0)
                            {
                                matchingMessage = nonSuppressedMessages.First();
                            }
                            else
                            {
                                // We have an excerpt but no matching message - skip this urgent item
                                continue;
                            }
                        }

                        if (matchingMessage == null)
                            continue;

                        // Determine recommended action based on urgent item type
                        // Priority: maintenance/safety issues should always be recommended over payment
                        var recommendedAction = urgentItem.Type?.ToLower() switch
                        {
                            "maintenance" or "safety" => "Create maintenance request",
                            "payment" => "Review payment status",
                            "lease_violation" => "Review lease terms",
                            _ => "Review message and respond"
                        };

                        // Get tenant name
                        string? tenantName = null;
                        if (conversation.Tenant != null)
                        {
                            tenantName = $"{conversation.Tenant.Firstname} {conversation.Tenant.Lastname}".Trim();
                        }

                        urgentMessageDetails.Add(new UrgentMessageDetailDto
                        {
                            MessageId = matchingMessage.Id,
                            ConversationId = conversation.Id,
                            PropertyId = conversation.PropertyId,
                            PropertyName = conversation.Property?.Name,
                            LeaseId = conversation.LeaseId,
                            UnitName = isMultiUnit ? unitName : null,
                            IsMultiUnitProperty = isMultiUnit,
                            MessageCreatedAt = matchingMessage.CreatedAt,
                            MessageContent = matchingMessage.Content,
                            TenantName = tenantName,
                            UrgentItem = urgentItem,
                            RecommendedAction = recommendedAction
                        });
                    }
                }

                // If multiple urgent items exist for the same message, prioritize maintenance/safety items
                // Group by message ID and keep only the highest priority item per message
                var deduplicatedDetails = urgentMessageDetails
                    .GroupBy(d => d.MessageId)
                    .Select(group =>
                    {
                        // If multiple items for same message, prioritize: maintenance/safety > payment > others
                        if (group.Count() > 1)
                        {
                            return group.OrderBy(d =>
                            {
                                var type = d.UrgentItem?.Type?.ToLower() ?? "";
                                return type switch
                                {
                                    "maintenance" or "safety" => 0, // Highest priority
                                    "payment" => 1,
                                    "lease_violation" => 2,
                                    _ => 3
                                };
                            }).First();
                        }
                        return group.First();
                    })
                    // Final safety check: filter out any details where the message ID is suppressed
                    .Where(d => !suppressedMessageIds.Contains(d.MessageId))
                    .ToList();

                // Sort by message date (most recent first)
                return deduplicatedDetails.OrderByDescending(d => d.MessageCreatedAt).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting all urgent message details for organization {OrganizationId}", organizationId);
                throw;
            }
        }
    }
}

