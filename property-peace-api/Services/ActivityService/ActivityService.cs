using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Activity;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.UserService;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Http;

namespace brownstone_hub_api.Services.ActivityService
{
    public class ActivityService(
        DataContext context,
        IUserRepository userRepository,
        IUserService userService,
        IHttpContextAccessor httpContextAccessor,
        ILogger<ActivityService> logger) : IActivityService
    {
        private readonly DataContext _context = context;
        private readonly IUserRepository _userRepository = userRepository;
        private readonly IUserService _userService = userService;
        private readonly IHttpContextAccessor _httpContextAccessor = httpContextAccessor;
        private readonly ILogger<ActivityService> _logger = logger;

        private long? GetCurrentOrganizationId()
        {
            if (_httpContextAccessor.HttpContext?.Items.TryGetValue("OrganizationId", out var orgIdObj) == true && orgIdObj is long orgId)
            {
                return orgId;
            }
            return null;
        }

        private (string iconType, string color) GetActivityIconAndColor(string activityType)
        {
            return activityType.ToLower() switch
            {
                "payment" => ("DollarOutlined", "success"),
                "maintenance" => ("ToolOutlined", "warning"),
                "lease" => ("FileTextOutlined", "info"),
                "property" => ("HomeFilled", "primary"),
                "tenant" => ("UserOutlined", "success"),
                "staffmember" => ("UserOutlined", "info"),
                "expense" => ("DollarCircleOutlined", "error"),
                "file" => ("FileOutlined", "default"),
                "message" => ("MessageOutlined", "info"),
                "application" => ("FormOutlined", "warning"),
                "system" => ("SettingOutlined", "default"),
                "notification" => ("BellOutlined", "default"),
                _ => ("BellOutlined", "default")
            };
        }

        private async Task<(string name, string email)> GetUserInfo(long? userId)
        {
            if (!userId.HasValue)
            {
                return ("System", string.Empty);
            }

            var user = await _userRepository.GetUser(userId.Value);
            if (user == null)
            {
                return ("System", string.Empty);
            }

            var name = $"{user.FirstName} {user.LastName}".Trim();
            if (string.IsNullOrEmpty(name))
            {
                name = user.Email ?? "Unknown User";
            }

            return (name, user.Email ?? string.Empty);
        }

        public async Task<ServiceResponse<ActivityListResponseDto>> GetActivities(long userId, ActivityFilterDto filter)
        {
            var response = new ServiceResponse<ActivityListResponseDto>();

            try
            {
                // Validate current user
                var currentUserIdResponse = await _userService.GetCurrentUserIdAsync();
                if (!currentUserIdResponse.Success || !currentUserIdResponse.Data.HasValue)
                {
                    response.Success = false;
                    response.Message = "User not found";
                    response.StatusCode = 401;
                    return response;
                }

                if (currentUserIdResponse.Data.Value != userId)
                {
                    response.Success = false;
                    response.Message = "Unauthorized access";
                    response.StatusCode = 403;
                    return response;
                }

                var organizationId = GetCurrentOrganizationId();
                
                // OPTIMIZATION: Limit the number of records fetched per type to reduce memory usage
                // We'll fetch more than needed, then sort/filter/paginate, but this is still much faster
                var maxRecordsPerType = Math.Max(filter.PageSize * 3, 100); // Fetch 3x page size or 100, whichever is larger
                
                // NOTE: Queries must run sequentially because DbContext is not thread-safe
                // However, we still get major performance gains from:
                // 1. Batched user lookups (eliminating N+1 problem)
                // 2. Database-level filtering and limiting
                // 3. Reduced memory usage
                var activities = new List<ActivityDto>();
                activities.AddRange(await GetNotificationActivities(userId, organizationId, filter, maxRecordsPerType));
                activities.AddRange(await GetPaymentActivities(userId, organizationId, filter, maxRecordsPerType));
                activities.AddRange(await GetMaintenanceActivities(userId, organizationId, filter, maxRecordsPerType));
                activities.AddRange(await GetLeaseActivities(userId, organizationId, filter, maxRecordsPerType));
                activities.AddRange(await GetPropertyActivities(userId, organizationId, filter, maxRecordsPerType));
                activities.AddRange(await GetTenantActivities(userId, organizationId, filter, maxRecordsPerType));
                activities.AddRange(await GetStaffMemberActivities(userId, organizationId, filter, maxRecordsPerType));
                activities.AddRange(await GetExpenseActivities(userId, organizationId, filter, maxRecordsPerType));
                activities.AddRange(await GetFileActivities(userId, organizationId, filter, maxRecordsPerType));
                activities.AddRange(await GetMessageActivities(userId, organizationId, filter, maxRecordsPerType));
                activities.AddRange(await GetApplicationActivities(userId, organizationId, filter, maxRecordsPerType));

                // Sort by CreatedAt descending
                activities = activities.OrderByDescending(a => a.CreatedAt).ToList();

                // Apply filters
                if (filter.StartDate.HasValue)
                {
                    activities = activities.Where(a => a.CreatedAt >= filter.StartDate.Value).ToList();
                }
                if (filter.EndDate.HasValue)
                {
                    activities = activities.Where(a => a.CreatedAt <= filter.EndDate.Value).ToList();
                }
                if (filter.ActivityTypes != null && filter.ActivityTypes.Count > 0)
                {
                    activities = activities.Where(a => filter.ActivityTypes.Contains(a.ActivityType, StringComparer.OrdinalIgnoreCase)).ToList();
                }
                if (filter.PropertyId.HasValue)
                {
                    activities = activities.Where(a => a.PropertyId == filter.PropertyId.Value).ToList();
                }

                var totalCount = activities.Count;
                var page = filter.Page;
                var pageSize = filter.PageSize;
                var skip = (page - 1) * pageSize;

                var pagedActivities = activities.Skip(skip).Take(pageSize).ToList();

                response.Data = new ActivityListResponseDto
                {
                    Activities = pagedActivities,
                    TotalCount = totalCount,
                    Page = page,
                    PageSize = pageSize,
                    HasMore = skip + pageSize < totalCount
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving activities for user {UserId}", userId);
                response.Success = false;
                response.Message = ex.Message;
                response.StatusCode = 500;
                return response;
            }

            return response;
        }

        private async Task<List<ActivityDto>> GetNotificationActivities(long userId, long? organizationId, ActivityFilterDto filter, int maxRecords = 100)
        {
            var query = _context.Notifications.Where(n => n.UserId == userId);
            
            if (organizationId.HasValue)
            {
                query = query.Where(n => n.OrganizationId == organizationId.Value);
            }

            // Apply date filter at database level for better performance
            if (filter.StartDate.HasValue)
            {
                query = query.Where(n => n.CreatedAt >= filter.StartDate.Value);
            }
            if (filter.EndDate.HasValue)
            {
                query = query.Where(n => n.CreatedAt <= filter.EndDate.Value);
            }

            // Order and limit at database level
            var notifications = await query
                .Include(n => n.Organization)
                .OrderByDescending(n => n.CreatedAt)
                .Take(maxRecords)
                .ToListAsync();

            // Batch user lookups
            var userIds = notifications.Where(n => n.PerformedByUserId.HasValue).Select(n => n.PerformedByUserId.Value).Distinct().ToList();
            var users = userIds.Any() 
                ? await _context.Users.Where(u => userIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u)
                : new Dictionary<long, Models.User>();

            var activityList = new List<ActivityDto>();
            foreach (var n in notifications)
            {
                var (iconType, color) = GetActivityIconAndColor("Notification");
                string performedByName = "System";
                string? performedByEmail = null;

                if (n.PerformedByUserId.HasValue && users.TryGetValue(n.PerformedByUserId.Value, out var user))
                {
                    var name = $"{user.FirstName} {user.LastName}".Trim();
                    performedByName = string.IsNullOrEmpty(name) ? (user.Email ?? "Unknown User") : name;
                    performedByEmail = user.Email ?? string.Empty;
                }
                else if (!string.IsNullOrEmpty(n.PerformedByName))
                {
                    performedByName = n.PerformedByName;
                }

                activityList.Add(new ActivityDto
                {
                    Id = n.Id,
                    ActivityType = "Notification",
                    NotificationType = n.Type,
                    Title = n.Title,
                    Message = n.Message,
                    CreatedAt = n.CreatedAt,
                    RelatedId = n.RelatedId,
                    RelatedEntityType = n.Type.ToString(),
                    PerformedByUserId = n.PerformedByUserId,
                    PerformedByName = performedByName,
                    PerformedByEmail = performedByEmail,
                    OrganizationId = n.OrganizationId,
                    IconType = iconType,
                    Color = color,
                    IsRead = n.IsRead
                });
            }
            return activityList;
        }

        private async Task<List<ActivityDto>> GetPaymentActivities(long userId, long? organizationId, ActivityFilterDto filter, int maxRecords = 100)
        {
            try
            {
                var query = _context.Payments
                    .Include(p => p.Lease)
                        .ThenInclude(l => l.Unit)
                            .ThenInclude(u => u.Property)
                    .Where(p => p.Lease != null && 
                                p.Lease.Unit != null && 
                                p.Lease.Unit.Property != null && 
                                !string.IsNullOrEmpty(p.Lease.Unit.Property.Name)); // Only include valid properties

                if (organizationId.HasValue)
                {
                    query = query.Where(p => p.OrganizationId == organizationId.Value);
                }
                else
                {
                    // Filter by landlord's properties
                    query = query.Where(p => p.Lease != null && 
                                            p.Lease.Unit != null && 
                                            p.Lease.Unit.Property != null && 
                                            p.Lease.Unit.Property.LandlordId == userId);
                }

                // Apply date filter at database level
                if (filter.StartDate.HasValue)
                {
                    query = query.Where(p => p.CreatedAt >= filter.StartDate.Value);
                }
                if (filter.EndDate.HasValue)
                {
                    query = query.Where(p => p.CreatedAt <= filter.EndDate.Value);
                }

                var payments = await query
                    .OrderByDescending(p => p.CreatedAt)
                    .Take(maxRecords)
                    .ToListAsync();

                // Batch user lookups
                var userIds = payments.Where(p => p.CreatedByUserId.HasValue).Select(p => p.CreatedByUserId.Value).Distinct().ToList();
                var users = userIds.Any() 
                    ? await _context.Users.Where(u => userIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u)
                    : new Dictionary<long, Models.User>();

                var activities = new List<ActivityDto>();
                foreach (var payment in payments)
                {
                    // Skip if required navigation properties are null
                    if (payment.Lease == null || payment.Lease.Unit == null || payment.Lease.Unit.Property == null)
                    {
                        continue;
                    }

                    string performedByName = "System";
                    string? performedByEmail = null;

                    if (payment.CreatedByUserId.HasValue && users.TryGetValue(payment.CreatedByUserId.Value, out var user))
                    {
                        var name = $"{user.FirstName} {user.LastName}".Trim();
                        performedByName = string.IsNullOrEmpty(name) ? (user.Email ?? "Unknown User") : name;
                        performedByEmail = user.Email ?? string.Empty;
                    }
                    else if (!string.IsNullOrEmpty(payment.Method) && 
                        (payment.Method.Contains("Online", StringComparison.OrdinalIgnoreCase) || 
                         payment.Method.Contains("Stripe", StringComparison.OrdinalIgnoreCase)))
                    {
                        performedByName = "System"; // Automated tenant payment
                    }

                    var (iconType, color) = GetActivityIconAndColor("Payment");
                    activities.Add(new ActivityDto
                    {
                        Id = payment.Id,
                        ActivityType = "Payment",
                        Title = "Payment Received",
                        Message = $"Payment of ${payment.Amount:F2} received for {payment.Lease.Unit.Property.Name}",
                        CreatedAt = payment.CreatedAt,
                        RelatedId = payment.Id,
                        RelatedEntityType = "Payment",
                        PerformedByUserId = payment.CreatedByUserId,
                        PerformedByName = performedByName,
                        PerformedByEmail = performedByEmail,
                        OrganizationId = payment.OrganizationId,
                        PropertyId = payment.PropertyId,
                        LeaseId = payment.LeaseId,
                        IconType = iconType,
                        Color = color
                    });
                }

                return activities;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving payment activities for user {UserId}", userId);
                return new List<ActivityDto>(); // Return empty list on error to prevent breaking the entire activities call
            }
        }

        private async Task<List<ActivityDto>> GetMaintenanceActivities(long userId, long? organizationId, ActivityFilterDto filter, int maxRecords = 100)
        {
            var query = _context.MaintenanceRequests
                .Include(m => m.Property)
                .Include(m => m.Unit)
                .Where(m => m.Property.LandlordId == userId);

            if (organizationId.HasValue)
            {
                query = query.Where(m => m.OrganizationId == organizationId.Value);
            }

            // Apply date filter at database level
            if (filter.StartDate.HasValue)
            {
                query = query.Where(m => m.CreatedAt >= filter.StartDate.Value);
            }
            if (filter.EndDate.HasValue)
            {
                query = query.Where(m => m.CreatedAt <= filter.EndDate.Value);
            }

            var maintenances = await query
                .OrderByDescending(m => m.CreatedAt)
                .Take(maxRecords)
                .ToListAsync();

            var activities = new List<ActivityDto>();
            foreach (var maintenance in maintenances)
            {
                // Maintenance requests are typically created by tenants or system
                string performedByName = "System";
                string? performedByEmail = null;

                var (iconType, color) = GetActivityIconAndColor("Maintenance");
                activities.Add(new ActivityDto
                {
                    Id = maintenance.Id,
                    ActivityType = "Maintenance",
                    Title = "Maintenance Request",
                    Message = $"Maintenance request '{maintenance.Title}' for {maintenance.Property.Name}",
                    CreatedAt = maintenance.CreatedAt,
                    RelatedId = maintenance.Id,
                    RelatedEntityType = "Maintenance",
                    PerformedByName = performedByName,
                    PerformedByEmail = performedByEmail,
                    OrganizationId = maintenance.OrganizationId,
                    PropertyId = maintenance.PropertyId,
                    IconType = iconType,
                    Color = color
                });
            }

            return activities;
        }

        private async Task<List<ActivityDto>> GetLeaseActivities(long userId, long? organizationId, ActivityFilterDto filter, int maxRecords = 100)
        {
            var query = _context.Leases
                .Include(l => l.Unit)
                    .ThenInclude(u => u.Property)
                        .ThenInclude(p => p.Landlord)
                .Include(l => l.LeaseAgreement)
                .Where(l => l.Unit.Property.LandlordId == userId);

            if (organizationId.HasValue)
            {
                query = query.Where(l => l.OrganizationId == organizationId.Value);
            }

            // Apply date filter at database level
            if (filter.StartDate.HasValue)
            {
                query = query.Where(l => l.StartDate >= filter.StartDate.Value ||
                                         (l.LeaseAgreement != null && l.LeaseAgreement.SignatureSentAt.HasValue && l.LeaseAgreement.SignatureSentAt >= filter.StartDate.Value) ||
                                         (l.LeaseAgreement != null && l.LeaseAgreement.SignatureCompletedAt.HasValue && l.LeaseAgreement.SignatureCompletedAt >= filter.StartDate.Value));
            }
            if (filter.EndDate.HasValue)
            {
                query = query.Where(l => l.StartDate <= filter.EndDate.Value ||
                                         (l.LeaseAgreement != null && l.LeaseAgreement.SignatureSentAt.HasValue && l.LeaseAgreement.SignatureSentAt <= filter.EndDate.Value) ||
                                         (l.LeaseAgreement != null && l.LeaseAgreement.SignatureCompletedAt.HasValue && l.LeaseAgreement.SignatureCompletedAt <= filter.EndDate.Value));
            }

            var leases = await query
                .OrderByDescending(l => l.LeaseAgreement != null
                    ? l.LeaseAgreement.SignatureCompletedAt ?? l.LeaseAgreement.SignatureSentAt ?? l.StartDate
                    : l.StartDate)
                .Take(maxRecords)
                .ToListAsync();

            var activities = new List<ActivityDto>();
            foreach (var lease in leases)
            {
                // Only create activities for leases that have been sent or signed
                // This ensures we're showing actual activity, not just lease creation dates
                if (lease.LeaseAgreement?.SignatureStatus == ESignatureStatus.NotSent && !lease.LeaseAgreement.SignatureSentAt.HasValue)
                {
                    continue; // Skip leases that haven't been sent yet
                }

                var (iconType, color) = GetActivityIconAndColor("Lease");
                
                // Determine performed by name and email
                string performedByName = "System";
                string? performedByEmail = null;

                if (lease.Unit.Property?.Landlord != null)
                {
                    var landlord = lease.Unit.Property.Landlord;
                    var firstName = landlord.FirstName ?? string.Empty;
                    var lastName = landlord.LastName ?? string.Empty;
                    var email = landlord.Email ?? string.Empty;
                    var fullName = $"{firstName} {lastName}".Trim();
                    
                    if (string.IsNullOrEmpty(fullName))
                    {
                        performedByName = !string.IsNullOrEmpty(email) ? email : "System";
                    }
                    else
                    {
                        performedByName = fullName;
                    }
                    performedByEmail = email;
                }
                
                // Determine the most appropriate timestamp for the activity
                // Use SignatureCompletedAt for signed leases, SignatureSentAt for sent leases
                DateTime activityDate;
                string activityTitle;
                
                if (lease.LeaseAgreement?.SignatureStatus == ESignatureStatus.Completed && lease.LeaseAgreement.SignatureCompletedAt.HasValue)
                {
                    activityDate = lease.LeaseAgreement.SignatureCompletedAt.Value;
                    activityTitle = "Lease Signed";
                }
                else if (lease.LeaseAgreement?.SignatureSentAt.HasValue == true)
                {
                    activityDate = lease.LeaseAgreement.SignatureSentAt!.Value;
                    activityTitle = "Lease Sent";
                }
                else
                {
                    // Fallback to StartDate only if we have no other timestamp
                    activityDate = lease.StartDate ?? DateTime.UtcNow;
                    activityTitle = "Lease Created";
                }
                
                activities.Add(new ActivityDto
                {
                    Id = lease.Id,
                    ActivityType = "Lease",
                    Title = activityTitle,
                    Message = $"Lease for {lease.Unit.Property.Name} - Unit {lease.Unit.Name}",
                    CreatedAt = activityDate,
                    RelatedId = lease.Id,
                    RelatedEntityType = "Lease",
                    PerformedByName = performedByName,
                    PerformedByEmail = performedByEmail,
                    OrganizationId = lease.OrganizationId,
                    PropertyId = lease.Unit.PropertyId,
                    IconType = iconType,
                    Color = color
                });
            }

            return activities;
        }

        private async Task<List<ActivityDto>> GetPropertyActivities(long userId, long? organizationId, ActivityFilterDto filter, int maxRecords = 100)
        {
            var query = _context.Properties
                .Include(p => p.Landlord)
                .Where(p => p.LandlordId == userId);

            if (organizationId.HasValue)
            {
                query = query.Where(p => p.OrganizationId == organizationId.Value);
            }

            // Apply date filter at database level
            if (filter.StartDate.HasValue)
            {
                query = query.Where(p => p.DateListed >= filter.StartDate.Value);
            }
            if (filter.EndDate.HasValue)
            {
                query = query.Where(p => p.DateListed <= filter.EndDate.Value);
            }

            var properties = await query
                .OrderByDescending(p => p.DateListed)
                .Take(maxRecords)
                .ToListAsync();

            // Batch user lookups
            var landlordIds = properties.Select(p => p.LandlordId).Distinct().ToList();
            var landlords = landlordIds.Any() 
                ? await _context.Users.Where(u => landlordIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u)
                : new Dictionary<long, Models.User>();

            var activities = new List<ActivityDto>();
            foreach (var property in properties)
            {
                // Properties are typically created by landlords, but we don't track the creator
                // Use landlord info if available
                string performedByName = "System";
                string? performedByEmail = null;

                if (landlords.TryGetValue(property.LandlordId, out var landlord))
                {
                    var name = $"{landlord.FirstName} {landlord.LastName}".Trim();
                    performedByName = string.IsNullOrEmpty(name) ? (landlord.Email ?? "Unknown User") : name;
                    performedByEmail = landlord.Email ?? string.Empty;
                }

                var (iconType, color) = GetActivityIconAndColor("Property");
                activities.Add(new ActivityDto
                {
                    Id = property.Id,
                    ActivityType = "Property",
                    Title = "Property Added",
                    Message = $"Property '{property.Name}' added",
                    CreatedAt = property.DateListed,
                    RelatedId = property.Id,
                    RelatedEntityType = "Property",
                    PerformedByName = performedByName,
                    PerformedByEmail = performedByEmail,
                    OrganizationId = property.OrganizationId,
                    PropertyId = property.Id,
                    IconType = iconType,
                    Color = color
                });
            }

            return activities;
        }

        private async Task<List<ActivityDto>> GetTenantActivities(long userId, long? organizationId, ActivityFilterDto filter, int maxRecords = 100)
        {
            var query = _context.Tenants
                .Include(t => t.Unit)
                    .ThenInclude(u => u.Property)
                .Where(t => t.Unit.Property.LandlordId == userId);

            if (organizationId.HasValue)
            {
                query = query.Where(t => t.OrganizationId == organizationId.Value);
            }

            // Apply date filter at database level
            if (filter.StartDate.HasValue)
            {
                query = query.Where(t => t.CreatedAt >= filter.StartDate.Value);
            }
            if (filter.EndDate.HasValue)
            {
                query = query.Where(t => t.CreatedAt <= filter.EndDate.Value);
            }

            var tenants = await query
                .OrderByDescending(t => t.CreatedAt)
                .Take(maxRecords)
                .ToListAsync();

            // Batch user lookups
            var landlordIds = tenants.Where(t => t.Unit?.Property?.LandlordId != null).Select(t => t.Unit.Property.LandlordId).Distinct().ToList();
            var landlords = landlordIds.Any() 
                ? await _context.Users.Where(u => landlordIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u)
                : new Dictionary<long, Models.User>();

            var activities = new List<ActivityDto>();
            foreach (var tenant in tenants)
            {
                // Tenants are typically added by landlords
                string performedByName = "System";
                string? performedByEmail = null;

                if (tenant.Unit?.Property?.LandlordId != null && landlords.TryGetValue(tenant.Unit.Property.LandlordId, out var landlord))
                {
                    var name = $"{landlord.FirstName} {landlord.LastName}".Trim();
                    performedByName = string.IsNullOrEmpty(name) ? (landlord.Email ?? "Unknown User") : name;
                    performedByEmail = landlord.Email ?? string.Empty;
                }

                var (iconType, color) = GetActivityIconAndColor("Tenant");
                activities.Add(new ActivityDto
                {
                    Id = tenant.Id,
                    ActivityType = "Tenant",
                    Title = "Tenant Added",
                    Message = $"Tenant {tenant.Firstname} {tenant.Lastname} added to {tenant.Unit?.Property?.Name ?? "Property"}",
                    CreatedAt = tenant.CreatedAt,
                    RelatedId = tenant.Id,
                    RelatedEntityType = "Tenant",
                    PerformedByName = performedByName,
                    PerformedByEmail = performedByEmail,
                    OrganizationId = tenant.OrganizationId,
                    PropertyId = tenant.Unit?.PropertyId,
                    IconType = iconType,
                    Color = color
                });
            }

            return activities;
        }

        private async Task<List<ActivityDto>> GetStaffMemberActivities(long userId, long? organizationId, ActivityFilterDto filter, int maxRecords = 100)
        {
            // Get all organizations the user is a member of or owns
            var organizations = await _context.Organizations
                .Where(o => o.OwnerId == userId || o.Members.Any(m => m.UserId == userId && m.IsActive))
                .Select(o => o.Id)
                .ToListAsync();

            if (!organizations.Any())
            {
                return new List<ActivityDto>();
            }

            var query = _context.StaffMembers
                .Include(sm => sm.Organization)
                    .ThenInclude(o => o.Owner)
                .Include(sm => sm.User)
                .Where(sm => organizations.Contains(sm.OrganizationId));

            if (organizationId.HasValue)
            {
                query = query.Where(sm => sm.OrganizationId == organizationId.Value);
            }

            // Apply date filter at database level
            if (filter.StartDate.HasValue)
            {
                query = query.Where(sm => sm.CreatedAt >= filter.StartDate.Value);
            }
            if (filter.EndDate.HasValue)
            {
                query = query.Where(sm => sm.CreatedAt <= filter.EndDate.Value);
            }

            var staffMembers = await query
                .OrderByDescending(sm => sm.CreatedAt)
                .Take(maxRecords)
                .ToListAsync();

            // Batch user lookups
            var ownerIds = staffMembers.Where(sm => sm.Organization?.OwnerId != null).Select(sm => sm.Organization!.OwnerId).Distinct().ToList();
            var owners = ownerIds.Any() 
                ? await _context.Users.Where(u => ownerIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u)
                : new Dictionary<long, Models.User>();

            var activities = new List<ActivityDto>();
            foreach (var staffMember in staffMembers)
            {
                // Staff members are typically added by organization owners
                string performedByName = "System";
                string? performedByEmail = null;

                // Use organization owner as the person who added the staff member
                if (staffMember.Organization?.OwnerId != null && owners.TryGetValue(staffMember.Organization.OwnerId.Value, out var owner))
                {
                    var name = $"{owner.FirstName} {owner.LastName}".Trim();
                    performedByName = string.IsNullOrEmpty(name) ? (owner.Email ?? "Unknown User") : name;
                    performedByEmail = owner.Email ?? string.Empty;
                }

                var staffName = staffMember.User != null
                    ? $"{staffMember.User.FirstName} {staffMember.User.LastName}".Trim()
                    : $"{staffMember.FirstName} {staffMember.LastName}".Trim();
                
                if (string.IsNullOrEmpty(staffName))
                {
                    staffName = staffMember.User?.Email ?? staffMember.Email ?? "Unknown Staff Member";
                }

                var (iconType, color) = GetActivityIconAndColor("StaffMember");
                activities.Add(new ActivityDto
                {
                    Id = staffMember.Id,
                    ActivityType = "StaffMember",
                    Title = "Staff Member Added",
                    Message = $"Staff member {staffName} added to {staffMember.Organization?.Name ?? "Organization"}",
                    CreatedAt = staffMember.CreatedAt,
                    RelatedId = staffMember.Id,
                    RelatedEntityType = "StaffMember",
                    PerformedByName = performedByName,
                    PerformedByEmail = performedByEmail,
                    OrganizationId = staffMember.OrganizationId,
                    IconType = iconType,
                    Color = color
                });
            }

            return activities;
        }

        private async Task<List<ActivityDto>> GetExpenseActivities(long userId, long? organizationId, ActivityFilterDto filter, int maxRecords = 100)
        {
            var query = _context.Expenses.Where(e => e.LandlordId == userId);

            if (organizationId.HasValue)
            {
                query = query.Where(e => e.OrganizationId == organizationId.Value);
            }

            // Apply date filter at database level
            if (filter.StartDate.HasValue)
            {
                query = query.Where(e => e.CreatedAt >= filter.StartDate.Value);
            }
            if (filter.EndDate.HasValue)
            {
                query = query.Where(e => e.CreatedAt <= filter.EndDate.Value);
            }

            var expenses = await query
                .Include(e => e.Property)
                .OrderByDescending(e => e.CreatedAt)
                .Take(maxRecords)
                .ToListAsync();

            // Batch user lookups
            var landlordIds = expenses.Where(e => e.LandlordId > 0).Select(e => e.LandlordId).Distinct().ToList();
            var landlords = landlordIds.Any() 
                ? await _context.Users.Where(u => landlordIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u)
                : new Dictionary<long, Models.User>();

            var activities = new List<ActivityDto>();
            foreach (var expense in expenses)
            {
                // Expenses are typically created by landlords
                string performedByName = "System";
                string? performedByEmail = null;

                if (expense.LandlordId > 0 && landlords.TryGetValue(expense.LandlordId, out var landlord))
                {
                    var name = $"{landlord.FirstName} {landlord.LastName}".Trim();
                    performedByName = string.IsNullOrEmpty(name) ? (landlord.Email ?? "Unknown User") : name;
                    performedByEmail = landlord.Email ?? string.Empty;
                }

                var (iconType, color) = GetActivityIconAndColor("Expense");
                activities.Add(new ActivityDto
                {
                    Id = expense.Id,
                    ActivityType = "Expense",
                    Title = "Expense Recorded",
                    Message = $"Expense of ${expense.Amount:F2} for {expense.Name} - {expense.Property.Name}",
                    CreatedAt = expense.CreatedAt,
                    RelatedId = expense.Id,
                    RelatedEntityType = "Expense",
                    PerformedByName = performedByName,
                    PerformedByEmail = performedByEmail,
                    OrganizationId = expense.OrganizationId,
                    PropertyId = expense.PropertyId,
                    IconType = iconType,
                    Color = color
                });
            }

            return activities;
        }

        private async Task<List<ActivityDto>> GetFileActivities(long userId, long? organizationId, ActivityFilterDto filter, int maxRecords = 100)
        {
            var query = _context.Files.Where(f => !f.IsDeleted);

            if (organizationId.HasValue)
            {
                query = query.Where(f => f.OrganizationId == organizationId.Value);
            }

            // Only files for properties owned by this landlord
            query = query.Where(f => f.Property != null && f.Property.LandlordId == userId);

            // Apply date filter at database level
            if (filter.StartDate.HasValue)
            {
                query = query.Where(f => f.CreatedAt >= filter.StartDate.Value);
            }
            if (filter.EndDate.HasValue)
            {
                query = query.Where(f => f.CreatedAt <= filter.EndDate.Value);
            }

            var files = await query
                .Include(f => f.Property)
                .Include(f => f.CreatedByUser)
                .OrderByDescending(f => f.CreatedAt)
                .Take(maxRecords)
                .ToListAsync();

            // Batch user lookups (if CreatedByUser is not already loaded)
            var userIds = files.Where(f => f.CreatedBy.HasValue && f.CreatedByUser == null).Select(f => f.CreatedBy.Value).Distinct().ToList();
            var users = userIds.Any() 
                ? await _context.Users.Where(u => userIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u)
                : new Dictionary<long, Models.User>();

            var activities = new List<ActivityDto>();
            foreach (var file in files)
            {
                string performedByName = "System";
                string? performedByEmail = null;

                if (file.CreatedBy.HasValue)
                {
                    if (file.CreatedByUser != null)
                    {
                        var name = $"{file.CreatedByUser.FirstName} {file.CreatedByUser.LastName}".Trim();
                        performedByName = string.IsNullOrEmpty(name) ? (file.CreatedByUser.Email ?? "Unknown User") : name;
                        performedByEmail = file.CreatedByUser.Email ?? string.Empty;
                    }
                    else if (users.TryGetValue(file.CreatedBy.Value, out var user))
                    {
                        var name = $"{user.FirstName} {user.LastName}".Trim();
                        performedByName = string.IsNullOrEmpty(name) ? (user.Email ?? "Unknown User") : name;
                        performedByEmail = user.Email ?? string.Empty;
                    }
                }

                var (iconType, color) = GetActivityIconAndColor("File");
                activities.Add(new ActivityDto
                {
                    Id = file.Id,
                    ActivityType = "File",
                    Title = "File Uploaded",
                    Message = $"File '{file.Title}' uploaded to {file.Property?.Name ?? "Property"}",
                    CreatedAt = file.CreatedAt,
                    RelatedId = file.Id,
                    RelatedEntityType = "File",
                    PerformedByUserId = file.CreatedBy,
                    PerformedByName = performedByName,
                    PerformedByEmail = performedByEmail,
                    OrganizationId = file.OrganizationId,
                    PropertyId = file.PropertyId,
                    IconType = iconType,
                    Color = color
                });
            }

            return activities;
        }

        private async Task<List<ActivityDto>> GetMessageActivities(long userId, long? organizationId, ActivityFilterDto filter, int maxRecords = 100)
        {
            // Get messages from conversations where user is a participant or landlord
            var query = _context.Messages
                .Include(m => m.Conversation)
                    .ThenInclude(c => c.Property)
                .Include(m => m.Sender)
                .Where(m => m.SenderId == userId || 
                           (m.Conversation != null && m.Conversation.Property != null && m.Conversation.Property.LandlordId == userId));

            if (organizationId.HasValue)
            {
                query = query.Where(m => m.OrganizationId == organizationId.Value);
            }

            // Apply date filter at database level
            if (filter.StartDate.HasValue)
            {
                query = query.Where(m => m.CreatedAt >= filter.StartDate.Value);
            }
            if (filter.EndDate.HasValue)
            {
                query = query.Where(m => m.CreatedAt <= filter.EndDate.Value);
            }

            var messages = await query
                .OrderByDescending(m => m.CreatedAt)
                .Take(maxRecords)
                .ToListAsync();

            // Batch user lookups
            var senderIds = messages.Where(m => m.SenderId > 0).Select(m => m.SenderId).Distinct().ToList();
            var senders = senderIds.Any() 
                ? await _context.Users.Where(u => senderIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u)
                : new Dictionary<long, Models.User>();

            var activities = new List<ActivityDto>();
            foreach (var message in messages)
            {
                string performedByName = "System";
                string? performedByEmail = null;

                if (message.SenderId > 0 && senders.TryGetValue(message.SenderId, out var sender))
                {
                    var name = $"{sender.FirstName} {sender.LastName}".Trim();
                    performedByName = string.IsNullOrEmpty(name) ? (sender.Email ?? "Unknown User") : name;
                    performedByEmail = sender.Email ?? string.Empty;
                }

                var (iconType, color) = GetActivityIconAndColor("Message");
                activities.Add(new ActivityDto
                {
                    Id = message.Id,
                    ActivityType = "Message",
                    Title = "Message Sent",
                    Message = message.Content.Length > 100 ? message.Content.Substring(0, 100) + "..." : message.Content,
                    CreatedAt = message.CreatedAt,
                    RelatedId = message.Id,
                    RelatedEntityType = "Message",
                    PerformedByUserId = message.SenderId,
                    PerformedByName = performedByName,
                    PerformedByEmail = performedByEmail,
                    OrganizationId = message.OrganizationId,
                    PropertyId = message.Conversation?.PropertyId,
                    ConversationId = message.ConversationId,
                    IconType = iconType,
                    Color = color
                });
            }

            return activities;
        }

        private async Task<List<ActivityDto>> GetApplicationActivities(long userId, long? organizationId, ActivityFilterDto filter, int maxRecords = 100)
        {
            var query = _context.RentalApplications
                .Include(a => a.Property)
                .Where(a => a.LandlordId == userId);

            if (organizationId.HasValue)
            {
                query = query.Where(a => a.OrganizationId == organizationId.Value);
            }

            // Apply date filter at database level
            if (filter.StartDate.HasValue)
            {
                query = query.Where(a => (a.SubmittedAt ?? a.CreatedAt) >= filter.StartDate.Value);
            }
            if (filter.EndDate.HasValue)
            {
                query = query.Where(a => (a.SubmittedAt ?? a.CreatedAt) <= filter.EndDate.Value);
            }

            var applications = await query
                .OrderByDescending(a => a.SubmittedAt ?? a.CreatedAt)
                .Take(maxRecords)
                .ToListAsync();

            var activities = new List<ActivityDto>();
            foreach (var application in applications)
            {
                string performedByName = "System";
                string? performedByEmail = null;

                // Applications are created by applicants (tenants), but approvals are system actions
                if (application.Status != EApplicationStatus.Approved)
                {
                    performedByName = $"{application.FirstName} {application.LastName}".Trim();
                    performedByEmail = application.Email;
                }

                var (iconType, color) = GetActivityIconAndColor("Application");
                activities.Add(new ActivityDto
                {
                    Id = application.Id,
                    ActivityType = "Application",
                    Title = $"Application {application.Status}",
                    Message = $"Application from {application.FirstName} {application.LastName} for {application.Property.Name}",
                    CreatedAt = application.SubmittedAt ?? application.CreatedAt,
                    RelatedId = application.Id,
                    RelatedEntityType = "Application",
                    PerformedByName = performedByName,
                    PerformedByEmail = performedByEmail,
                    OrganizationId = application.OrganizationId,
                    PropertyId = application.PropertyId,
                    IconType = iconType,
                    Color = color
                });
            }

            return activities;
        }
    }
}

