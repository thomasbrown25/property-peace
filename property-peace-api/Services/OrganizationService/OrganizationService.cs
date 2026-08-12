using AutoMapper;
using brownstone_hub_api.Dtos.Organization;
using brownstone_hub_api.Dtos.User;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Organizations;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Data;
using brownstone_hub_api.Services.LeaseTemplateService;
using brownstone_hub_api.Services.StripeService;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.OrganizationService
{
    public class OrganizationService : IOrganizationService
    {
        private readonly IOrganizationRepository _organizationRepository;
        private readonly IOrganizationMemberRepository _memberRepository;
        private readonly IUserRepository _userRepository;
        private readonly DataContext _dataContext;
        private readonly IMapper _mapper;
        private readonly ILogger<OrganizationService> _logger;
        private readonly ILeaseTemplateService _leaseTemplateService;
        private readonly IStripeService? _stripeService;

        public OrganizationService(
            IOrganizationRepository organizationRepository,
            IOrganizationMemberRepository memberRepository,
            IUserRepository userRepository,
            DataContext dataContext,
            IMapper mapper,
            ILogger<OrganizationService> logger,
            ILeaseTemplateService leaseTemplateService,
            IStripeService? stripeService = null)
        {
            _organizationRepository = organizationRepository;
            _memberRepository = memberRepository;
            _userRepository = userRepository;
            _dataContext = dataContext;
            _mapper = mapper;
            _logger = logger;
            _leaseTemplateService = leaseTemplateService;
            _stripeService = stripeService;
        }

        public async Task<ServiceResponse<LoadOrganizationDto>> CreateOrganizationAsync(CreateOrganizationDto dto, long userId)
        {
            try
            {
                var user = await _userRepository.GetUser(userId);
                if (user == null)
                {
                    return ServiceResponse<LoadOrganizationDto>.CreateError("User not found", "The specified user does not exist.");
                }

                // Check if organization name already exists for this owner
                var nameExists = await _organizationRepository.OrganizationNameExistsForOwnerAsync(dto.Name, userId);
                if (nameExists)
                {
                    return ServiceResponse<LoadOrganizationDto>.CreateError(
                        "Organization name already exists", 
                        $"You already have an organization with the name '{dto.Name}'. Please choose a different name.",
                        "",
                        400);
                }

                var organization = new Organization
                {
                    Name = dto.Name,
                    Description = dto.Description,
                    OwnerId = userId,
                    IsActive = true,
                    CreatedAt = DateTime.Now,
                    UpdatedAt = DateTime.Now
                };

                var createdOrg = await _organizationRepository.CreateOrganizationAsync(organization);

                // Add the owner as a member with Owner role
                var member = new OrganizationMember
                {
                    OrganizationId = createdOrg.Id,
                    UserId = userId,
                    Role = "Owner",
                    IsActive = true,
                    JoinedAt = DateTime.Now,
                    CanManageProperties = true,
                    CanManageTenants = true,
                    CanManageLeases = true,
                    CanManageMaintenance = true,
                    CanManageBilling = true,
                    CanManageMembers = true
                };

                await _memberRepository.AddMemberAsync(member);

                // Set as current organization using the dedicated repository method
                await _userRepository.UpdateCurrentOrganizationIdAsync(userId, createdOrg.Id);

                // Link the new organization to the owner's existing subscription, or create one if they don't have one yet.
                // Subscriptions are per landlord-user, not per organization — multiple orgs share one subscription.
                try
                {
                    // Check if this landlord already has a subscription (from a previous org)
                    var ownerSubscription = await _dataContext.Subscriptions
                        .FirstOrDefaultAsync(s => s.OwnerUserId == userId && s.UserId == null);

                    if (ownerSubscription != null)
                    {
                        // Reuse existing subscription — just point this org at it
                        createdOrg.SubscriptionId = ownerSubscription.Id;
                        _dataContext.Organizations.Update(createdOrg);
                        await _dataContext.SaveChangesAsync();
                        _logger.LogInformation("Linked organization {OrganizationId} to existing subscription {SubscriptionId} (owner user {UserId})",
                            createdOrg.Id, ownerSubscription.Id, userId);
                    }
                    else
                    {
                        // First org for this landlord — create a Free plan subscription
                        var freePlan = await _dataContext.SubscriptionPlans
                            .FirstOrDefaultAsync(p => p.Name == "Free" && p.IsActive);

                        if (freePlan != null)
                        {
                            var subscription = new Models.Subscription
                            {
                                OrganizationId = createdOrg.Id,
                                OwnerUserId = userId,        // ties subscription to the landlord, not the org
                                SubscriptionPlanId = freePlan.Id,
                                Status = "Active",
                                BillingCycle = "Monthly",
                                TrialStart = null,
                                TrialEnd = null,
                                CurrentPeriodStart = DateTime.UtcNow,
                                CurrentPeriodEnd = null,
                                CreatedAt = DateTime.UtcNow,
                                UpdatedAt = DateTime.UtcNow,
                                StripeSubscriptionId = null,
                                StripeCustomerId = null
                            };

                            await _dataContext.Subscriptions.AddAsync(subscription);
                            await _dataContext.SaveChangesAsync();

                            createdOrg.SubscriptionId = subscription.Id;
                            _dataContext.Organizations.Update(createdOrg);

                            await _dataContext.SubscriptionHistories.AddAsync(new Models.SubscriptionHistory
                            {
                                SubscriptionId = subscription.Id,
                                EventType = "Created",
                                Timestamp = DateTime.UtcNow,
                                Metadata = $"{{\"planType\": \"Free\", \"autoCreated\": true}}"
                            });

                            await _dataContext.SaveChangesAsync();
                            _logger.LogInformation("Created Free plan subscription {SubscriptionId} for landlord {UserId} (org {OrganizationId})",
                                subscription.Id, userId, createdOrg.Id);
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error linking subscription for organization {OrganizationId}", createdOrg.Id);
                    // Don't fail organization creation if subscription setup fails
                }

                // Create default lease template for the organization
                try
                {
                    _logger.LogInformation("Creating default lease template for organization {OrganizationId}", createdOrg.Id);
                    var templateResponse = await _leaseTemplateService.CreateDefaultTemplateForOrganizationAsync(createdOrg.Id, userId);
                    if (templateResponse.Success)
                    {
                        _logger.LogInformation("Default lease template created successfully for organization {OrganizationId}", createdOrg.Id);
                    }
                    else
                    {
                        _logger.LogWarning("Failed to create default lease template for organization {OrganizationId}: {Message}", 
                            createdOrg.Id, templateResponse.Message);
                        // Don't fail organization creation if template creation fails
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Exception occurred while creating default lease template for organization {OrganizationId} during organization creation. Exception: {ExceptionMessage}, StackTrace: {StackTrace}",
                        createdOrg.Id, ex.Message, ex.StackTrace);
                    // Don't fail organization creation if template creation fails
                }

                var orgDto = await MapToLoadDtoAsync(createdOrg, userId);
                return ServiceResponse<LoadOrganizationDto>.CreateSuccess(orgDto, "Organization created successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating organization");
                return ServiceResponse<LoadOrganizationDto>.CreateError("Error creating organization", ex.Message);
            }
        }

        public async Task<ServiceResponse<LoadOrganizationDto>> GetOrganizationByIdAsync(
            long organizationId,
            long selectedOrganizationId,
            long userId)
        {
            try
            {
                if (organizationId <= 0 || selectedOrganizationId <= 0 || organizationId != selectedOrganizationId)
                {
                    return OrganizationReadDenied();
                }

                // The service is a security boundary: selected-id equality alone is not authority.
                var member = await _memberRepository.GetMemberAsync(organizationId, userId);
                if (member == null || !member.IsActive ||
                    member.OrganizationId != organizationId || member.UserId != userId ||
                    (!string.Equals(member.Role, "Owner", StringComparison.OrdinalIgnoreCase) &&
                     !string.Equals(member.Role, "Manager", StringComparison.OrdinalIgnoreCase)))
                {
                    return OrganizationReadDenied();
                }

                var organization = await _organizationRepository.GetOrganizationByIdWithMembersAsync(organizationId);
                if (organization == null || !organization.IsActive || organization.IsDeleted)
                {
                    return OrganizationReadDenied();
                }

                var orgDto = await MapToLoadDtoAsync(organization, userId);
                return ServiceResponse<LoadOrganizationDto>.CreateSuccess(orgDto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving organization");
                return ServiceResponse<LoadOrganizationDto>.CreateError("Error retrieving organization", ex.Message);
            }
        }

        private static ServiceResponse<LoadOrganizationDto> OrganizationReadDenied()
        {
            return ServiceResponse<LoadOrganizationDto>.CreateError(
                "Organization access denied",
                "The requested organization is not available.",
                "",
                403,
                suppressDetailedErrors: true);
        }

        public async Task<ServiceResponse<LoadOrganizationDto>> GetCurrentUserOrganizationAsync(long userId)
        {
            try
            {
                var organization = await _organizationRepository.GetCurrentUserOrganizationAsync(userId);
                if (organization == null)
                {
                    return ServiceResponse<LoadOrganizationDto>.CreateError("No active organization", "User does not have an active organization.");
                }

                var member = await _memberRepository.GetMemberAsync(organization.Id, userId);
                if (!HasExactActiveMembership(organization, member, userId))
                {
                    return ServiceResponse<LoadOrganizationDto>.CreateError("No active organization", "User does not have an active organization.");
                }

                var orgDto = await MapToLoadDtoAsync(organization, userId);
                return ServiceResponse<LoadOrganizationDto>.CreateSuccess(orgDto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving current organization");
                return ServiceResponse<LoadOrganizationDto>.CreateError("Error retrieving organization", ex.Message);
            }
        }

        public async Task<ServiceResponse<List<LoadOrganizationDto>>> GetUserOrganizationsAsync(long userId)
        {
            try
            {
                var organizations = await _organizationRepository.GetOrganizationsByUserIdAsync(userId);
                var orgDtos = new List<LoadOrganizationDto>();

                foreach (var org in organizations)
                {
                    if (!org.IsActive || org.IsDeleted)
                    {
                        continue;
                    }

                    var member = await _memberRepository.GetMemberAsync(org.Id, userId);
                    if (!HasExactActiveMembership(org, member, userId))
                    {
                        continue;
                    }

                    orgDtos.Add(await MapToLoadDtoAsync(org, userId));
                }

                return ServiceResponse<List<LoadOrganizationDto>>.CreateSuccess(orgDtos);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving user organizations");
                return ServiceResponse<List<LoadOrganizationDto>>.CreateError("Error retrieving organizations", ex.Message);
            }
        }

        public async Task<ServiceResponse<LoadOrganizationDto>> UpdateOrganizationAsync(UpdateOrganizationDto dto, long userId)
        {
            try
            {
                var organization = await _organizationRepository.GetOrganizationByIdAsync(dto.Id);
                if (organization == null)
                {
                    return ServiceResponse<LoadOrganizationDto>.CreateError("Organization not found", "The specified organization does not exist.");
                }

                // Check if user is owner or has permission
                var member = await _memberRepository.GetMemberAsync(dto.Id, userId);
                if (member == null || (member.Role != "Owner" && !member.CanManageMembers))
                {
                    return ServiceResponse<LoadOrganizationDto>.CreateError("Unauthorized", "You do not have permission to update this organization.", "", 403);
                }

                // Check if organization name already exists for this owner (excluding current organization)
                if (!string.Equals(organization.Name, dto.Name, StringComparison.OrdinalIgnoreCase))
                {
                    var nameExists = await _organizationRepository.OrganizationNameExistsForOwnerAsync(dto.Name, userId, dto.Id);
                    if (nameExists)
                    {
                        return ServiceResponse<LoadOrganizationDto>.CreateError(
                            "Organization name already exists", 
                            $"You already have an organization with the name '{dto.Name}'. Please choose a different name.",
                            "",
                            400);
                    }
                }

                organization.Name = dto.Name;
                organization.Description = dto.Description;
                organization.UpdatedAt = DateTime.Now;

                var updatedOrg = await _organizationRepository.UpdateOrganizationAsync(organization);
                var orgDto = await MapToLoadDtoAsync(updatedOrg, userId);

                return ServiceResponse<LoadOrganizationDto>.CreateSuccess(orgDto, "Organization updated successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating organization");
                return ServiceResponse<LoadOrganizationDto>.CreateError("Error updating organization", ex.Message);
            }
        }

        public async Task<ServiceResponse<bool>> DeleteOrganizationAsync(
            long organizationId,
            long selectedOrganizationId,
            long userId)
        {
            if (organizationId <= 0 || selectedOrganizationId <= 0 || organizationId != selectedOrganizationId)
            {
                return DeleteDenied();
            }

            try
            {
                // Fast fail before opening a transaction; authority is queried again from the
                // tracked database immediately before destructive work.
                var organization = await _organizationRepository.GetOrganizationByIdAsync(organizationId);
                var member = await _memberRepository.GetMemberAsync(organizationId, userId);
                if (!HasExactActiveOwnerAuthority(organization, member, organizationId, userId))
                {
                    return DeleteDenied();
                }

                await using var transaction = _dataContext.Database.IsRelational()
                    ? await _dataContext.Database.BeginTransactionAsync()
                    : null;

                var persistedOrganization = await _dataContext.Organizations
                    .AsNoTracking()
                    .SingleOrDefaultAsync(o => o.Id == organizationId);
                var persistedOwner = await _dataContext.OrganizationMembers
                    .AsNoTracking()
                    .SingleOrDefaultAsync(m => m.OrganizationId == organizationId && m.UserId == userId);

                if (!HasExactActiveOwnerAuthority(persistedOrganization, persistedOwner, organizationId, userId))
                {
                    return DeleteDenied();
                }

                // A paid/persisted Stripe subscription cannot be atomically cancelled with the
                // database delete. Refuse before touching data rather than risk partial deletion
                // or silently continuing after an external cancellation failure.
                var subscriptionIds = await _dataContext.Subscriptions
                    .Where(s => s.OrganizationId == organizationId)
                    .Select(s => s.Id)
                    .ToListAsync();
                if (persistedOrganization!.SubscriptionId.HasValue)
                {
                    subscriptionIds.Add(persistedOrganization.SubscriptionId.Value);
                }
                subscriptionIds = subscriptionIds.Distinct().ToList();

                var sharedSubscriptions = new List<(Models.Subscription Subscription, Organization Survivor)>();
                foreach (var subscriptionId in subscriptionIds)
                {
                    var subscription = await _dataContext.Subscriptions.SingleOrDefaultAsync(s => s.Id == subscriptionId);
                    if (subscription == null)
                    {
                        continue;
                    }

                    var survivingOrganization = await _dataContext.Organizations
                        .Where(o => o.Id != organizationId && o.SubscriptionId == subscriptionId &&
                            o.IsActive && !o.IsDeleted)
                        .OrderBy(o => o.Id)
                        .FirstOrDefaultAsync();

                    if (survivingOrganization != null)
                    {
                        sharedSubscriptions.Add((subscription, survivingOrganization));
                        continue;
                    }

                    // Deleting an unshared subscription (whether free or paid) is billing work.
                    // It cannot be made atomic with this destructive operation, so fail closed
                    // before mutating any tracked entity.
                    return SubscriptionDeletionConflict();
                }

                foreach (var (subscription, survivor) in sharedSubscriptions)
                {
                    // Preserve shared billing data. If the deleted org was the legacy primary
                    // FK, move that pointer to a surviving organization; never cancel or delete.
                    if (subscription.OrganizationId == organizationId)
                    {
                        subscription.OrganizationId = survivor.Id;
                    }
                }

                // Persist any shared-subscription re-parenting inside the same transaction so the
                // hard-delete query cannot select it by the old primary organization id.
                await _dataContext.SaveChangesAsync();

                // Revalidate persisted authority at the last possible point before destructive
                // persistence. A failed check rolls back any subscription re-parenting above.
                var destructiveOrganization = await _dataContext.Organizations
                    .AsNoTracking()
                    .SingleOrDefaultAsync(o => o.Id == organizationId);
                var destructiveOwner = await _dataContext.OrganizationMembers
                    .AsNoTracking()
                    .SingleOrDefaultAsync(m => m.OrganizationId == organizationId && m.UserId == userId);
                if (!HasExactActiveOwnerAuthority(destructiveOrganization, destructiveOwner, organizationId, userId))
                {
                    return DeleteDenied();
                }

                _logger.LogWarning("Starting complete hard delete for organization {OrganizationId} ({Name}) by user {UserId}",
                    organizationId, persistedOrganization.Name, userId);

                await HardDeleteOrganizationCompletely(organizationId);

                var usersWithOrg = await _dataContext.Users
                    .Where(u => u.CurrentOrganizationId == organizationId)
                    .ToListAsync();
                foreach (var user in usersWithOrg)
                {
                    user.CurrentOrganizationId = null;
                }
                await _dataContext.SaveChangesAsync();

                if (transaction != null)
                {
                    await transaction.CommitAsync();
                }

                _logger.LogInformation("Successfully deleted organization {OrganizationId} and all related data", organizationId);
                return ServiceResponse<bool>.CreateSuccess(true, "Organization and all related data deleted successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting organization {OrganizationId}", organizationId);
                return ServiceResponse<bool>.CreateError(
                    "Organization deletion failed",
                    "The organization could not be deleted. No changes were applied.",
                    "",
                    500,
                    suppressDetailedErrors: true);
            }
        }

        private static bool HasExactActiveOwnerAuthority(
            Organization? organization,
            OrganizationMember? member,
            long organizationId,
            long userId)
        {
            return organization is { IsActive: true, IsDeleted: false } && organization.Id == organizationId &&
                member is { IsActive: true } && member.OrganizationId == organizationId && member.UserId == userId &&
                string.Equals(member.Role, "Owner", StringComparison.OrdinalIgnoreCase);
        }

        private static bool HasExactActiveMembership(
            Organization organization,
            OrganizationMember? member,
            long userId)
        {
            return organization is { IsActive: true, IsDeleted: false } &&
                member is { IsActive: true } && member.OrganizationId == organization.Id && member.UserId == userId;
        }

        private static ServiceResponse<bool> SubscriptionDeletionConflict()
        {
            return ServiceResponse<bool>.CreateError(
                "Organization deletion unavailable",
                "Billing must be resolved before this organization can be deleted.",
                "",
                409,
                suppressDetailedErrors: true);
        }

        private static ServiceResponse<bool> DeleteDenied()
        {
            return ServiceResponse<bool>.CreateError(
                "Organization deletion denied",
                "The organization cannot be deleted by this user.",
                "",
                403,
                suppressDetailedErrors: true);
        }

        private async Task HardDeleteOrganizationCompletely(long organizationId)
        {
            // Delete all properties in this organization
            var properties = await _dataContext.Properties
                .Where(p => p.OrganizationId == organizationId)
                .ToListAsync();

            foreach (var property in properties)
            {
                await HardDeletePropertyCompletely(property.Id);
            }

            // Delete all bank accounts
            var bankAccounts = await _dataContext.BankAccounts
                .Where(ba => ba.OrganizationId == organizationId)
                .ToListAsync();
            _dataContext.BankAccounts.RemoveRange(bankAccounts);

            // Cancel and delete all subscriptions
            var subscriptions = await _dataContext.Subscriptions
                .Where(s => s.OrganizationId == organizationId)
                .ToListAsync();
            
            // Shared subscriptions have already been re-parented. Any unshared subscription
            // causes deletion to fail closed before this method is entered.
            
            // Delete all subscription history for these subscriptions
            var subscriptionIds = subscriptions.Select(s => s.Id).ToList();
            if (subscriptionIds.Any())
            {
                var subscriptionHistories = await _dataContext.SubscriptionHistories
                    .Where(sh => subscriptionIds.Contains(sh.SubscriptionId))
                    .ToListAsync();
                _dataContext.SubscriptionHistories.RemoveRange(subscriptionHistories);
            }
            
            _dataContext.Subscriptions.RemoveRange(subscriptions);

            // Delete all organization members (but NOT the user accounts themselves)
            var organizationMembers = await _dataContext.OrganizationMembers
                .Where(om => om.OrganizationId == organizationId)
                .ToListAsync();
            _dataContext.OrganizationMembers.RemoveRange(organizationMembers);

            // Delete all organization invites
            var organizationInvites = await _dataContext.OrganizationInvites
                .Where(oi => oi.OrganizationId == organizationId)
                .ToListAsync();
            _dataContext.OrganizationInvites.RemoveRange(organizationInvites);

            // Delete all conversations
            var conversations = await _dataContext.Conversations
                .Where(c => c.OrganizationId == organizationId)
                .ToListAsync();
            _dataContext.Conversations.RemoveRange(conversations);

            // Delete all messages
            var messages = await _dataContext.Messages
                .Where(m => m.OrganizationId == organizationId)
                .ToListAsync();
            _dataContext.Messages.RemoveRange(messages);

            // Delete all notifications
            var notifications = await _dataContext.Notifications
                .Where(n => n.OrganizationId == organizationId)
                .ToListAsync();
            _dataContext.Notifications.RemoveRange(notifications);

            // Delete all checklist items
            var checklistItems = await _dataContext.OrganizationChecklistItems
                .Where(ci => ci.OrganizationId == organizationId)
                .ToListAsync();
            _dataContext.OrganizationChecklistItems.RemoveRange(checklistItems);

            // Delete all checklists
            var checklists = await _dataContext.Checklists
                .Where(c => c.OrganizationId == organizationId)
                .ToListAsync();
            foreach (var checklist in checklists)
            {
                // Delete checklist items
                var items = await _dataContext.ChecklistItems
                    .Where(ci => ci.ChecklistId == checklist.Id)
                    .ToListAsync();
                _dataContext.ChecklistItems.RemoveRange(items);
            }
            _dataContext.Checklists.RemoveRange(checklists);

            // Delete all files
            var files = await _dataContext.Files
                .Where(f => f.OrganizationId == organizationId)
                .ToListAsync();
            _dataContext.Files.RemoveRange(files);

            // Delete all file categories
            var fileCategories = await _dataContext.FileCategories
                .Where(fc => fc.OrganizationId == organizationId)
                .ToListAsync();
            _dataContext.FileCategories.RemoveRange(fileCategories);

            // Delete all action suppressions
            var actionSuppressions = await _dataContext.ActionSuppressions
                .Where(a => a.OrganizationId == organizationId)
                .ToListAsync();
            _dataContext.ActionSuppressions.RemoveRange(actionSuppressions);

            // Delete all leases (via properties, but also check direct organizationId)
            var leases = await _dataContext.Leases
                .Where(l => l.OrganizationId == organizationId)
                .ToListAsync();
            foreach (var lease in leases)
            {
                // Delete all payments
                var payments = await _dataContext.Payments
                    .Where(p => p.LeaseId == lease.Id)
                    .ToListAsync();
                _dataContext.Payments.RemoveRange(payments);

                // Delete all deposits
                var deposits = await _dataContext.Deposits
                    .Where(d => d.LeaseId == lease.Id)
                    .ToListAsync();
                _dataContext.Deposits.RemoveRange(deposits);

                // Delete all tenant documents
                var tenantDocuments = await _dataContext.TenantDocuments
                    .Where(td => td.LeaseId == lease.Id)
                    .ToListAsync();
                _dataContext.TenantDocuments.RemoveRange(tenantDocuments);

                // Delete lease history
                var leaseHistories = await _dataContext.LeaseHistories
                    .Where(lh => lh.OriginalLeaseId == lease.Id)
                    .ToListAsync();
                _dataContext.LeaseHistories.RemoveRange(leaseHistories);

                // Delete lease instances and documents
                var leaseInstances = await _dataContext.LeaseInstances
                    .Where(li => li.LeaseId == lease.Id)
                    .ToListAsync();
                
                foreach (var leaseInstance in leaseInstances)
                {
                    var leaseDocuments = await _dataContext.LeaseDocuments
                        .Where(ld => ld.LeaseInstanceId == leaseInstance.Id)
                        .ToListAsync();
                    _dataContext.LeaseDocuments.RemoveRange(leaseDocuments);
                }
                
                _dataContext.LeaseInstances.RemoveRange(leaseInstances);
            }
            _dataContext.Leases.RemoveRange(leases);

            // Delete all tenants (but NOT user accounts - tenants are separate entities)
            var tenants = await _dataContext.Tenants
                .Where(t => t.OrganizationId == organizationId)
                .ToListAsync();
            foreach (var tenant in tenants)
            {
                // Delete tenant documents
                var tenantDocs = await _dataContext.TenantDocuments
                    .Where(td => td.TenantId == tenant.Id)
                    .ToListAsync();
                _dataContext.TenantDocuments.RemoveRange(tenantDocs);
            }
            _dataContext.Tenants.RemoveRange(tenants);

            // Delete all units (via properties, but also check direct organizationId)
            var units = await _dataContext.Units
                .Where(u => u.OrganizationId == organizationId)
                .ToListAsync();
            foreach (var unit in units)
            {
                // Delete all application invites for this unit
                var unitApplicationInvites = await _dataContext.ApplicationInvites
                    .Where(ai => ai.UnitId == unit.Id)
                    .ToListAsync();
                _dataContext.ApplicationInvites.RemoveRange(unitApplicationInvites);

                // Delete all files
                var unitFiles = await _dataContext.Files
                    .Where(f => f.UnitId == unit.Id)
                    .ToListAsync();
                _dataContext.Files.RemoveRange(unitFiles);
            }
            _dataContext.Units.RemoveRange(units);

            // Delete all maintenance requests
            var maintenanceRequests = await _dataContext.MaintenanceRequests
                .Where(mr => mr.OrganizationId == organizationId)
                .ToListAsync();
            foreach (var mr in maintenanceRequests)
            {
                // Delete maintenance images
                var maintenanceImages = await _dataContext.MaintenanceImages
                    .Where(mi => mi.RefId == mr.Id)
                    .ToListAsync();
                _dataContext.MaintenanceImages.RemoveRange(maintenanceImages);

                // Delete maintenance events
                var maintenanceEvents = await _dataContext.MaintenanceEvents
                    .Where(me => me.MaintenanceId == mr.Id)
                    .ToListAsync();
                _dataContext.MaintenanceEvents.RemoveRange(maintenanceEvents);
            }
            _dataContext.MaintenanceRequests.RemoveRange(maintenanceRequests);

            // Delete all expenses
            var expenses = await _dataContext.Expenses
                .Where(e => e.OrganizationId == organizationId)
                .ToListAsync();
            var expenseIds = expenses.Select(e => e.Id).ToList();
            
            // Delete expense receipts first
            if (expenseIds.Any())
            {
                var expenseReceipts = await _dataContext.ExpenseReceipts
                    .Where(er => expenseIds.Contains(er.RefId))
                    .ToListAsync();
                _dataContext.ExpenseReceipts.RemoveRange(expenseReceipts);
            }
            _dataContext.Expenses.RemoveRange(expenses);

            // Delete all recurring expenses
            var recurringExpenses = await _dataContext.RecurringExpenses
                .Where(re => re.OrganizationId == organizationId)
                .ToListAsync();
            _dataContext.RecurringExpenses.RemoveRange(recurringExpenses);

            // Delete all payments (direct organizationId)
            var orgPayments = await _dataContext.Payments
                .Where(p => p.OrganizationId == organizationId)
                .ToListAsync();
            _dataContext.Payments.RemoveRange(orgPayments);

            // Delete all deposits (direct organizationId)
            var orgDeposits = await _dataContext.Deposits
                .Where(d => d.OrganizationId == organizationId)
                .ToListAsync();
            _dataContext.Deposits.RemoveRange(orgDeposits);

            // Delete all rental applications
            var rentalApplications = await _dataContext.RentalApplications
                .Where(ra => ra.OrganizationId == organizationId)
                .ToListAsync();
            _dataContext.RentalApplications.RemoveRange(rentalApplications);

            // Delete all application invites
            var applicationInvites = await _dataContext.ApplicationInvites
                .Where(ai => ai.OrganizationId == organizationId)
                .ToListAsync();
            _dataContext.ApplicationInvites.RemoveRange(applicationInvites);

            // Delete all tenant invites
            var tenantInvites = await _dataContext.TenantInvites
                .Where(ti => ti.OrganizationId == organizationId)
                .ToListAsync();
            _dataContext.TenantInvites.RemoveRange(tenantInvites);

            // Delete all tenant documents (direct organizationId)
            var orgTenantDocuments = await _dataContext.TenantDocuments
                .Where(td => td.OrganizationId == organizationId)
                .ToListAsync();
            _dataContext.TenantDocuments.RemoveRange(orgTenantDocuments);

            // Delete all vendors
            var vendors = await _dataContext.Vendors
                .Where(v => v.OrganizationId == organizationId)
                .ToListAsync();
            _dataContext.Vendors.RemoveRange(vendors);

            // Delete all lease templates
            var leaseTemplates = await _dataContext.LeaseTemplates
                .Where(lt => lt.OrganizationId == organizationId)
                .ToListAsync();
            _dataContext.LeaseTemplates.RemoveRange(leaseTemplates);

            // Delete all document templates
            var documentTemplates = await _dataContext.DocumentTemplates
                .Where(dt => dt.OrganizationId == organizationId)
                .ToListAsync();
            _dataContext.DocumentTemplates.RemoveRange(documentTemplates);

            // Delete all clause libraries
            var clauseLibraries = await _dataContext.ClauseLibraries
                .Where(cl => cl.OrganizationId == organizationId)
                .ToListAsync();
            _dataContext.ClauseLibraries.RemoveRange(clauseLibraries);

            // Delete all policy packs
            var policyPacks = await _dataContext.PolicyPacks
                .Where(pp => pp.OrganizationId == organizationId)
                .ToListAsync();
            _dataContext.PolicyPacks.RemoveRange(policyPacks);

            // Delete the organization itself
            var organization = await _dataContext.Organizations.FindAsync(organizationId);
            if (organization != null)
            {
                _dataContext.Organizations.Remove(organization);
            }

            await _dataContext.SaveChangesAsync();
        }

        private async Task HardDeletePropertyCompletely(long propertyId)
        {
            // Delete all units in this property
            var units = await _dataContext.Units
                .Where(u => u.PropertyId == propertyId)
                .ToListAsync();

            foreach (var unit in units)
            {
                // Delete all leases for this unit
                var leases = await _dataContext.Leases
                    .Where(l => l.UnitId == unit.Id)
                    .ToListAsync();

                foreach (var lease in leases)
                {
                    // Delete all payments
                    var payments = await _dataContext.Payments
                        .Where(p => p.LeaseId == lease.Id)
                        .ToListAsync();
                    _dataContext.Payments.RemoveRange(payments);

                    // Delete all deposits
                    var deposits = await _dataContext.Deposits
                        .Where(d => d.LeaseId == lease.Id)
                        .ToListAsync();
                    _dataContext.Deposits.RemoveRange(deposits);

                    // Delete all tenant documents
                    var tenantDocuments = await _dataContext.TenantDocuments
                        .Where(td => td.LeaseId == lease.Id)
                        .ToListAsync();
                    _dataContext.TenantDocuments.RemoveRange(tenantDocuments);

                    // Delete lease history
                    var leaseHistories = await _dataContext.LeaseHistories
                        .Where(lh => lh.OriginalLeaseId == lease.Id)
                        .ToListAsync();
                    _dataContext.LeaseHistories.RemoveRange(leaseHistories);

                    // Delete lease documents (via LeaseInstance)
                    var leaseInstances = await _dataContext.LeaseInstances
                        .Where(li => li.LeaseId == lease.Id)
                        .ToListAsync();
                    
                    foreach (var leaseInstance in leaseInstances)
                    {
                        var leaseDocuments = await _dataContext.LeaseDocuments
                            .Where(ld => ld.LeaseInstanceId == leaseInstance.Id)
                            .ToListAsync();
                        _dataContext.LeaseDocuments.RemoveRange(leaseDocuments);
                    }
                    
                    // Delete lease instances
                    _dataContext.LeaseInstances.RemoveRange(leaseInstances);

                    // Delete all files for this lease
                    var leaseFiles = await _dataContext.Files
                        .Where(f => f.LeaseId == lease.Id)
                        .ToListAsync();
                    _dataContext.Files.RemoveRange(leaseFiles);

                    // Delete the lease
                    _dataContext.Leases.Remove(lease);
                }

                // Delete all tenants for this unit
                var tenants = await _dataContext.Tenants
                    .Where(t => t.UnitId == unit.Id)
                    .ToListAsync();

                foreach (var tenant in tenants)
                {
                    // Delete tenant documents
                    var tenantDocs = await _dataContext.TenantDocuments
                        .Where(td => td.TenantId == tenant.Id)
                        .ToListAsync();
                    _dataContext.TenantDocuments.RemoveRange(tenantDocs);
                }

                _dataContext.Tenants.RemoveRange(tenants);

                // Delete all application invites for this unit
                var applicationInvites = await _dataContext.ApplicationInvites
                    .Where(ai => ai.UnitId == unit.Id)
                    .ToListAsync();
                _dataContext.ApplicationInvites.RemoveRange(applicationInvites);

                // Delete all files for this unit
                var unitFiles = await _dataContext.Files
                    .Where(f => f.UnitId == unit.Id)
                    .ToListAsync();
                _dataContext.Files.RemoveRange(unitFiles);

                // Delete the unit
                _dataContext.Units.Remove(unit);
            }

            // Delete all maintenance requests for this property
            var maintenanceRequests = await _dataContext.MaintenanceRequests
                .Where(mr => mr.PropertyId == propertyId)
                .ToListAsync();

            foreach (var mr in maintenanceRequests)
            {
                // Delete maintenance images
                var maintenanceImages = await _dataContext.MaintenanceImages
                    .Where(mi => mi.RefId == mr.Id)
                    .ToListAsync();
                _dataContext.MaintenanceImages.RemoveRange(maintenanceImages);

                // Delete maintenance events
                var maintenanceEvents = await _dataContext.MaintenanceEvents
                    .Where(me => me.MaintenanceId == mr.Id)
                    .ToListAsync();
                _dataContext.MaintenanceEvents.RemoveRange(maintenanceEvents);
            }

            _dataContext.MaintenanceRequests.RemoveRange(maintenanceRequests);

            // Delete all expenses for this property
            var expenseIds = await _dataContext.Expenses
                .Where(e => e.PropertyId == propertyId)
                .Select(e => e.Id)
                .ToListAsync();

            // Delete all expense receipts first
            if (expenseIds.Any())
            {
                var expenseReceipts = await _dataContext.ExpenseReceipts
                    .Where(er => expenseIds.Contains(er.RefId))
                    .ToListAsync();
                _dataContext.ExpenseReceipts.RemoveRange(expenseReceipts);
            }

            // Now delete the expenses
            var expenses = await _dataContext.Expenses
                .Where(e => e.PropertyId == propertyId)
                .ToListAsync();
            _dataContext.Expenses.RemoveRange(expenses);

            // Delete all recurring expenses
            var recurringExpenses = await _dataContext.RecurringExpenses
                .Where(re => re.PropertyId == propertyId)
                .ToListAsync();
            _dataContext.RecurringExpenses.RemoveRange(recurringExpenses);

            // Delete all property images
            var propertyImages = await _dataContext.PropertyImages
                .Where(pi => pi.RefId == propertyId)
                .ToListAsync();
            _dataContext.PropertyImages.RemoveRange(propertyImages);

            // Delete all checklists for this property
            var checklists = await _dataContext.Checklists
                .Where(c => c.PropertyId == propertyId)
                .ToListAsync();

            foreach (var checklist in checklists)
            {
                // Delete checklist items
                var checklistItems = await _dataContext.ChecklistItems
                    .Where(ci => ci.ChecklistId == checklist.Id)
                    .ToListAsync();
                _dataContext.ChecklistItems.RemoveRange(checklistItems);
            }

            _dataContext.Checklists.RemoveRange(checklists);

            // Delete all rental applications for this property
            var rentalApplications = await _dataContext.RentalApplications
                .Where(ra => ra.PropertyId == propertyId)
                .ToListAsync();
            _dataContext.RentalApplications.RemoveRange(rentalApplications);

            // Delete all application invites for this property
            var propertyApplicationInvites = await _dataContext.ApplicationInvites
                .Where(ai => ai.PropertyId == propertyId)
                .ToListAsync();
            _dataContext.ApplicationInvites.RemoveRange(propertyApplicationInvites);

            // Delete all files for this property
            var propertyFiles = await _dataContext.Files
                .Where(f => f.PropertyId == propertyId)
                .ToListAsync();
            _dataContext.Files.RemoveRange(propertyFiles);

            // Delete the property
            var property = await _dataContext.Properties.FindAsync(propertyId);
            if (property != null)
            {
                _dataContext.Properties.Remove(property);
            }

            await _dataContext.SaveChangesAsync();
        }

        public async Task<ServiceResponse<bool>> SwitchOrganizationAsync(long organizationId, long userId)
        {
            try
            {
                // Verify user is a member
                var isMember = await _memberRepository.IsUserMemberOfOrganizationAsync(userId, organizationId);
                if (!isMember)
                {
                    return ServiceResponse<bool>.CreateError("Unauthorized", "You are not a member of this organization.", "", 403);
                }

                var user = await _userRepository.GetUser(userId);
                if (user == null)
                {
                    return ServiceResponse<bool>.CreateError("User not found", "The specified user does not exist.");
                }

                user.CurrentOrganizationId = organizationId;
                var userDto = _mapper.Map<LoadUserDto>(user);
                await _userRepository.UpdateUser(userDto);

                return ServiceResponse<bool>.CreateSuccess(true, "Organization switched successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error switching organization");
                return ServiceResponse<bool>.CreateError("Error switching organization", ex.Message);
            }
        }

        public async Task<ServiceResponse<LoadOrganizationDto>> UpdateAgentSettingsAsync(UpdateAgentSettingsDto dto, long userId)
        {
            try
            {
                var user = await _userRepository.GetUser(userId);
                if (user == null || !user.CurrentOrganizationId.HasValue)
                    return ServiceResponse<LoadOrganizationDto>.CreateError("No active organization found", "", "", 404);

                var org = await _dataContext.Organizations
                    .FirstOrDefaultAsync(o => o.Id == user.CurrentOrganizationId.Value && !o.IsDeleted);

                if (org == null)
                    return ServiceResponse<LoadOrganizationDto>.CreateError("Organization not found", "", "", 404);

                // Only owners or members with full manage permissions may change agent settings
                var member = await _memberRepository.GetMemberAsync(org.Id, userId);
                if (member == null || (member.Role != "Owner" && !member.CanManageProperties))
                    return ServiceResponse<LoadOrganizationDto>.CreateError("Unauthorized", "You do not have permission to update agent settings.", "", 403);

                org.IsMaintenanceAgentEnabled = dto.IsMaintenanceAgentEnabled;
                org.IsCollectionsAgentEnabled = dto.IsCollectionsAgentEnabled;
                org.UpdatedAt = DateTime.Now;

                await _dataContext.SaveChangesAsync();

                var result = await MapToLoadDtoAsync(org, userId);
                return ServiceResponse<LoadOrganizationDto>.CreateSuccess(result, "Agent settings updated.");
            }
            catch (Exception ex)
            {
                return ServiceResponse<LoadOrganizationDto>.CreateError("Error updating agent settings", ex.Message);
            }
        }

        private async Task<LoadOrganizationDto> MapToLoadDtoAsync(Organization organization, long? userId = null)
        {
            var memberCount = organization.Members?.Count(m => m.IsActive) ?? 0;

            // Get property count
            var propertyCount = 0;
            if (organization.Properties != null)
            {
                propertyCount = organization.Properties.Count(p => !p.IsDeleted);
            }

            // Resolve the caller's exact active membership before loading or returning sensitive metadata.
            string? userRole = null;
            var canViewSensitiveOrganizationMetadata = false;
            if (userId.HasValue)
            {
                var member = await _memberRepository.GetMemberAsync(organization.Id, userId.Value);
                userRole = member?.Role;
                canViewSensitiveOrganizationMetadata = member != null && member.IsActive &&
                    member.OrganizationId == organization.Id && member.UserId == userId.Value &&
                    (string.Equals(member.Role, "Owner", StringComparison.OrdinalIgnoreCase) ||
                     string.Equals(member.Role, "Manager", StringComparison.OrdinalIgnoreCase));
            }

            User? owner = null;
            if (canViewSensitiveOrganizationMetadata && organization.OwnerId.HasValue)
            {
                owner = await _userRepository.GetUser(organization.OwnerId.Value);
            }

            return new LoadOrganizationDto
            {
                Id = organization.Id,
                Name = organization.Name,
                Description = organization.Description,
                OwnerId = organization.OwnerId,
                OwnerName = owner != null ? $"{owner.FirstName} {owner.LastName}" : string.Empty,
                OwnerEmail = canViewSensitiveOrganizationMetadata ? owner?.Email ?? string.Empty : string.Empty,
                SubscriptionId = canViewSensitiveOrganizationMetadata ? organization.SubscriptionId : null,
                StripeCustomerId = canViewSensitiveOrganizationMetadata ? organization.StripeCustomerId : null,
                IsActive = organization.IsActive,
                CreatedAt = organization.CreatedAt,
                UpdatedAt = organization.UpdatedAt,
                MemberCount = memberCount,
                PropertyCount = propertyCount,
                UserRole = userRole,
                IsMaintenanceAgentEnabled = organization.IsMaintenanceAgentEnabled,
                IsCollectionsAgentEnabled = organization.IsCollectionsAgentEnabled
            };
        }
    }
}

