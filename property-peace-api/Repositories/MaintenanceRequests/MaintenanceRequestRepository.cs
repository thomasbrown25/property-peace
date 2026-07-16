using AutoMapper;
using AutoMapper.QueryableExtensions;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.MaintenanceCategory;
using brownstone_hub_api.Dtos.MaintenanceEvent;
using brownstone_hub_api.Dtos.MaintenanceRequest;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.MaintenanceRequests
{
    public class MaintenanceRequestRepository(DataContext context, ILogger<MaintenanceRequestRepository> logger, IMapper mapper) : IMaintenanceRequestRepository
    {
        private readonly DataContext _context = context;
        private readonly ILogger<MaintenanceRequestRepository> _logger = logger;
        private readonly IMapper _mapper = mapper;

        public async Task<LoadMaintenanceRequestDto> AddMaintenanceRequest(AddMaintenanceRequestDto request)
        {
            try
            {
                var newRequest = _mapper.Map<MaintenanceRequest>(request);
                
                // Explicitly ensure OrganizationId is set (in case AutoMapper didn't map it)
                if (request.OrganizationId.HasValue)
                {
                    newRequest.OrganizationId = request.OrganizationId.Value;
                    _logger.LogInformation("Setting OrganizationId {OrganizationId} on maintenance request {Title}", request.OrganizationId.Value, request.Title);
                }
                else
                {
                    _logger.LogWarning("OrganizationId is not set on maintenance request DTO for request {Title}", request.Title);
                }

                // Generate order number if not already set (before saving)
                if (string.IsNullOrEmpty(newRequest.OrderNumber) && newRequest.OrganizationId.HasValue)
                {
                    var year = DateTime.UtcNow.Year;
                    // Get the count of maintenance requests for this organization in the current year
                    // This count will be the next sequential number
                    var count = await _context.MaintenanceRequests
                        .Where(m => m.OrganizationId == newRequest.OrganizationId.Value && 
                                    m.CreatedAt.Year == year)
                        .CountAsync();
                    
                    // Format: MR-{Year}-{SequentialNumber} (e.g., MR-2024-0001)
                    // Add 1 because this will be the next request
                    newRequest.OrderNumber = $"MR-{year}-{(count + 1):D4}";
                }

                await _context.MaintenanceRequests.AddAsync(newRequest);
                await _context.SaveChangesAsync();
                
                _logger.LogInformation("Maintenance request {RequestId} created with OrganizationId {OrganizationId} and OrderNumber {OrderNumber}", 
                    newRequest.Id, newRequest.OrganizationId, newRequest.OrderNumber);

                var result = await _context.MaintenanceRequests
                    .Include(r => r.Property)
                    .Include(r => r.Unit)
                    .Include(r => r.VendorEntity)
                    .Where(r => r.Id == newRequest.Id)
                    .FirstOrDefaultAsync();

                return _mapper.Map<LoadMaintenanceRequestDto>(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding maintenance request");
                throw new Exception("Error adding maintenance request", ex);
            }
        }

        public async Task<LoadMaintenanceRequestDto?> UpdateMaintenanceRequest(UpdateMaintenanceRequestDto request)
        {
            try
            {
                var existingRequest = await _context.MaintenanceRequests
                    .Include(r => r.Property)
                    .Include(r => r.Unit)
                    .Include(r => r.VendorEntity)
                    .FirstOrDefaultAsync(r => r.Id == request.Id);

                if (existingRequest == null)
                {
                    return null;
                }

                _mapper.Map(request, existingRequest);
                await _context.SaveChangesAsync();

                // Reload with includes to ensure we have the latest data
                var updatedRequest = await _context.MaintenanceRequests
                    .Include(r => r.Property)
                    .Include(r => r.Unit)
                    .Include(r => r.VendorEntity)
                    .FirstOrDefaultAsync(r => r.Id == request.Id);

                return _mapper.Map<LoadMaintenanceRequestDto>(updatedRequest);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating maintenance request with ID {RequestId}", request.Id);
                throw new Exception("Error updating maintenance request", ex);
            }
        }

        public async Task<LoadMaintenanceRequestDto> GetMaintenanceRequestById(long requestId)
        {
            try
            {
                var request = await _context.MaintenanceRequests
                    .Include(r => r.Images)
                    .Include(r => r.Property)
                    .Include(r => r.Unit)
                    .Include(r => r.VendorEntity)
                    .FirstOrDefaultAsync(r => r.Id == requestId)
                     ?? throw new KeyNotFoundException($"Maintenance request with ID {requestId} not found.");

                return _mapper.Map<LoadMaintenanceRequestDto>(request);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving maintenance request with ID {RequestId}", requestId);
                throw new Exception("Error retrieving maintenance request", ex);
            }
        }


        public async Task<List<LoadMaintenanceRequestDto>> GetMaintenanceRequestsByUnitId(long unitId)
        {
            try
            {
                var requests = await _context.MaintenanceRequests
                    .Include(r => r.Images)
                    .Include(r => r.Property)
                    .Include(r => r.Unit)
                    .Where(r => r.UnitId == unitId)
                    .OrderByDescending(r => r.CreatedAt)
                    .ToListAsync();

                return _mapper.Map<List<LoadMaintenanceRequestDto>>(requests);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving maintenance requests for unit ID {UnitId}", unitId);
                throw new Exception("Error retrieving maintenance requests", ex);
            }
        }

        public async Task<List<LoadMaintenanceRequestDto>> GetCurrentMaintenanceByPropertyId(long propertyId)
        {
            try
            {
                var requests = await _context.MaintenanceRequests
                    .AsNoTracking()
                    .Include(r => r.Images)
                    .Include(r => r.Property)
                        .ThenInclude(p => p.Images)
                    .Include(r => r.Unit)
                    .Where(r => r.PropertyId == propertyId &&
                                !r.Property.IsDeleted &&
                                r.Status != EMaintenanceStatus.Resolved &&
                                r.Status != EMaintenanceStatus.Resolved)
                    .OrderByDescending(r => r.CreatedAt)
                    .ToListAsync();

                return _mapper.Map<List<LoadMaintenanceRequestDto>>(requests);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving CURRENT maintenance for property {PropertyId}", propertyId);
                throw new Exception("Error retrieving current maintenance requests", ex);
            }
        }

        public async Task<List<LoadMaintenanceRequestDto>> GetMaintenanceHistoryByPropertyId(long propertyId)
        {
            try
            {
                var requests = await _context.MaintenanceRequests
                    .AsNoTracking()
                    .Include(r => r.Images)
                    .Include(r => r.Property)
                        .ThenInclude(p => p.Images)
                    .Include(r => r.Unit)
                    .Where(r => r.PropertyId == propertyId &&
                                !r.Property.IsDeleted &&
                                (r.Status == EMaintenanceStatus.Resolved ||
                                 r.Status == EMaintenanceStatus.Resolved))
                    // Prefer CompletedAt if present; fall back to UpdatedAt
                    .OrderByDescending(r => r.CompletedAt ?? r.UpdatedAt)
                    .ToListAsync();

                return _mapper.Map<List<LoadMaintenanceRequestDto>>(requests);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving HISTORY maintenance for property {PropertyId}", propertyId);
                throw new Exception("Error retrieving maintenance history", ex);
            }
        }

        public async Task<List<LoadMaintenanceRequestDto>> GetCurrentMaintenanceByLandlordId(long landlordId)
        {
            try
            {
                var requests = await _context.MaintenanceRequests
                    .AsNoTracking()
                    .Include(r => r.Images)
                    .Include(r => r.Property)
                        .ThenInclude(p => p.Images)
                    .Include(r => r.Unit)
                    .Where(r => r.Property.LandlordId == landlordId &&
                                !r.Property.IsDeleted &&
                                r.Status != EMaintenanceStatus.Resolved &&
                                r.Status != EMaintenanceStatus.Resolved)
                    .OrderByDescending(r => r.CreatedAt)
                    .ToListAsync();

                return _mapper.Map<List<LoadMaintenanceRequestDto>>(requests);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving CURRENT maintenance for landlord {LandlordId}", landlordId);
                throw new Exception("Error retrieving current maintenance requests", ex);
            }
        }

        public async Task<List<LoadMaintenanceRequestDto>> GetMaintenanceHistoryByLandlordId(long landlordId)
        {
            try
            {
                var requests = await _context.MaintenanceRequests
                    .AsNoTracking()
                    .Include(r => r.Images)
                    .Include(r => r.Property)
                    .Include(r => r.Unit)
                    .Where(r => r.Property.LandlordId == landlordId &&
                                !r.Property.IsDeleted &&
                                (r.Status == EMaintenanceStatus.Resolved ||
                                 r.Status == EMaintenanceStatus.Resolved))
                    .OrderByDescending(r => r.CompletedAt ?? r.UpdatedAt)
                    .ToListAsync();

                return _mapper.Map<List<LoadMaintenanceRequestDto>>(requests);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving HISTORY maintenance for landlord {LandlordId}", landlordId);
                throw new Exception("Error retrieving maintenance history", ex);
            }
        }

        public async Task<List<LoadMaintenanceRequestDto>> GetCurrentMaintenanceByOrganizationId(long organizationId)
        {
            try
            {
                var requests = await _context.MaintenanceRequests
                    .AsNoTracking()
                    .Include(r => r.Images)
                    .Include(r => r.Property)
                    .Include(r => r.Unit)
                    .Include(r => r.VendorEntity)
                    .Where(r => r.OrganizationId == organizationId &&
                                !r.Property.IsDeleted &&
                                r.Status != EMaintenanceStatus.Resolved &&
                                r.Status != EMaintenanceStatus.Resolved)
                    .OrderByDescending(r => r.CreatedAt)
                    .ToListAsync();

                return _mapper.Map<List<LoadMaintenanceRequestDto>>(requests);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving CURRENT maintenance for organization {OrganizationId}", organizationId);
                throw new Exception("Error retrieving current maintenance requests", ex);
            }
        }

        public async Task<List<LoadMaintenanceRequestDto>> GetMaintenanceHistoryByOrganizationId(long organizationId)
        {
            try
            {
                var requests = await _context.MaintenanceRequests
                    .AsNoTracking()
                    .Include(r => r.Images)
                    .Include(r => r.Property)
                    .Include(r => r.Unit)
                    .Include(r => r.VendorEntity)
                    .Where(r => r.OrganizationId == organizationId &&
                                !r.Property.IsDeleted &&
                                (r.Status == EMaintenanceStatus.Resolved ||
                                 r.Status == EMaintenanceStatus.Resolved))
                    .OrderByDescending(r => r.CompletedAt ?? r.UpdatedAt)
                    .ToListAsync();

                return _mapper.Map<List<LoadMaintenanceRequestDto>>(requests);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving HISTORY maintenance for organization {OrganizationId}", organizationId);
                throw new Exception("Error retrieving maintenance history", ex);
            }
        }

        public async Task<List<LoadMaintenanceRequestDto>> GetCurrentMaintenanceByTenantUserId(long tenantUserId)
        {
            try
            {
                // Get the tenant's lease to find their unitId
                // Filter out deleted tenants and deleted leases, prefer active leases
                var tenantLeases = await _context.TenantLeases
                    .AsNoTracking()
                    .Include(tl => tl.Tenant)
                    .Include(tl => tl.Lease)
                    .Where(tl => tl.Tenant.UserId == tenantUserId && 
                                !tl.Tenant.IsDeleted && 
                                tl.Lease != null && 
                                !tl.Lease.IsDeleted)
                    .ToListAsync();
                var tenants = tenantLeases.Select(tl => tl.Tenant).Distinct().ToList();

                if (!tenants.Any())
                {
                    _logger.LogWarning("No active tenant or lease found for user ID {TenantUserId}", tenantUserId);
                    return new List<LoadMaintenanceRequestDto>();
                }

                // Get all unit IDs from all the tenant's leases
                var unitIds = tenantLeases
                    .Where(tl => tl.Lease != null)
                    .Select(tl => tl.Lease!.UnitId)
                    .Distinct()
                    .ToList();

                if (!unitIds.Any())
                {
                    _logger.LogWarning("No valid unit IDs found for tenant user ID {TenantUserId}", tenantUserId);
                    return new List<LoadMaintenanceRequestDto>();
                }

                var requests = await _context.MaintenanceRequests
                    .AsNoTracking()
                    .Include(r => r.Images)
                    .Include(r => r.Property)
                    .Include(r => r.Unit)
                    .Where(r => r.UnitId.HasValue && 
                                unitIds.Contains(r.UnitId.Value) &&
                                !r.Property.IsDeleted &&
                                r.Status != EMaintenanceStatus.Resolved &&
                                r.Status != EMaintenanceStatus.Resolved)
                    .OrderByDescending(r => r.CreatedAt)
                    .ToListAsync();

                return _mapper.Map<List<LoadMaintenanceRequestDto>>(requests);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving CURRENT maintenance for tenant user {TenantUserId}", tenantUserId);
                throw new Exception("Error retrieving current maintenance requests", ex);
            }
        }

        public async Task<List<LoadMaintenanceRequestDto>> GetMaintenanceHistoryByTenantUserId(long tenantUserId)
        {
            try
            {
                // Get the tenant's lease to find their unitId
                // Filter out deleted tenants and deleted leases, prefer active leases
                var tenantLeases = await _context.TenantLeases
                    .AsNoTracking()
                    .Include(tl => tl.Tenant)
                    .Include(tl => tl.Lease)
                    .Where(tl => tl.Tenant.UserId == tenantUserId && 
                                !tl.Tenant.IsDeleted && 
                                tl.Lease != null && 
                                !tl.Lease.IsDeleted)
                    .ToListAsync();
                var tenants = tenantLeases.Select(tl => tl.Tenant).Distinct().ToList();

                if (!tenants.Any())
                {
                    _logger.LogWarning("No active tenant or lease found for user ID {TenantUserId}", tenantUserId);
                    return new List<LoadMaintenanceRequestDto>();
                }

                // Get all unit IDs from all the tenant's leases
                var unitIds = tenantLeases
                    .Where(tl => tl.Lease != null)
                    .Select(tl => tl.Lease!.UnitId)
                    .Distinct()
                    .ToList();

                if (!unitIds.Any())
                {
                    _logger.LogWarning("No valid unit IDs found for tenant user ID {TenantUserId}", tenantUserId);
                    return new List<LoadMaintenanceRequestDto>();
                }

                var requests = await _context.MaintenanceRequests
                    .AsNoTracking()
                    .Include(r => r.Images)
                    .Include(r => r.Property)
                    .Include(r => r.Unit)
                    .Where(r => r.UnitId.HasValue && 
                                unitIds.Contains(r.UnitId.Value) &&
                                !r.Property.IsDeleted &&
                                (r.Status == EMaintenanceStatus.Resolved ||
                                 r.Status == EMaintenanceStatus.Resolved))
                    .OrderByDescending(r => r.CompletedAt ?? r.UpdatedAt)
                    .ToListAsync();

                return _mapper.Map<List<LoadMaintenanceRequestDto>>(requests);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving HISTORY maintenance for tenant user {TenantUserId}", tenantUserId);
                throw new Exception("Error retrieving maintenance history", ex);
            }
        }




        public async Task<List<MaintenanceEventDto>> GetMaintenanceEventsByRequestId(long maintenanceRequestId)
        {
            try
            {
                var eventsQuery = _context.MaintenanceEvents
                    .AsNoTracking()
                    .Where(e => e.MaintenanceId == maintenanceRequestId)
                    .OrderByDescending(e => e.ChangedAt);

                var eventsList = await eventsQuery.ToListAsync();
                return _mapper.Map<List<MaintenanceEventDto>>(eventsList);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving maintenance events for request {RequestId}", maintenanceRequestId);
                throw new Exception("Error retrieving maintenance events", ex);
            }
        }

        public async Task<int> GetPropertyOpenMaintenanceRequestsCount(long propertyId)
        {
            try
            {
                return await _context.MaintenanceRequests
                    .CountAsync(r =>
                        r.PropertyId == propertyId &&
                        !r.Property.IsDeleted &&
                        (r.Status == EMaintenanceStatus.Acknowledged ||
                         r.Status == EMaintenanceStatus.InProgress));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error counting open maintenance requests for property ID {PropertyId}", propertyId);
                throw new Exception("Error counting open maintenance requests", ex);
            }
        }

        public async Task<bool> DeleteMaintenanceRequest(long requestId)
        {
            try
            {
                var request = await _context.MaintenanceRequests.FindAsync(requestId);
                if (request == null)
                {
                    return false;
                }

                _context.MaintenanceRequests.Remove(request);
                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting maintenance request with ID {RequestId}", requestId);
                throw new Exception("Error deleting maintenance request", ex);
            }
        }

        public async Task<int> DeleteMaintenanceRequestsByPropertyId(long propertyId)
        {
            try
            {
                var requests = await _context.MaintenanceRequests
                    .Where(mr => mr.PropertyId == propertyId)
                    .ToListAsync();
                
                _context.MaintenanceRequests.RemoveRange(requests);
                await _context.SaveChangesAsync();
                
                return requests.Count;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting maintenance requests for property {PropertyId}", propertyId);
                throw new Exception("Error deleting maintenance requests", ex);
            }
        }

        public async Task<List<LoadMaintenanceRequestDto>> GetMaintenanceRequestsByPropertyId(long propertyId)
        {
            try
            {
                var requests = await _context.MaintenanceRequests
                    //.Include(r => r.Category)
                    .Include(r => r.Images)
                    .Include(r => r.Property)
                    .Include(r => r.Unit)
                    .Where(r => r.PropertyId == propertyId && !r.Property.IsDeleted)
                    .OrderByDescending(r => r.CreatedAt)
                    .ToListAsync();

                return _mapper.Map<List<LoadMaintenanceRequestDto>>(requests);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving maintenance requests for property ID {PropertyId}", propertyId);
                throw new Exception("Error retrieving maintenance requests", ex);
            }
        }

        public async Task<List<LoadMaintenanceCategoryDto>> GetMaintenanceCategories()
        {
            try
            {
                var categories = await _context.MaintenanceCategories
                    .OrderBy(c => c.Value)
                    .ToListAsync();

                return _mapper.Map<List<LoadMaintenanceCategoryDto>>(categories);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving maintenance categories");
                throw new Exception("Error retrieving maintenance categories", ex);
            }
        }

        public async Task<List<LoadMaintenanceRequestDto>> ReopenMaintenance(long requestId)
        {
            try
            {
                var requests = await _context.MaintenanceRequests
                    .Where(r => r.Id == requestId)
                    .ToListAsync();

                foreach (var request in requests)
                {
                    request.Status = EMaintenanceStatus.Reported;
                    request.CompletedAt = null;
                }

                var updatedRequests = await _context.MaintenanceRequests
                    .Include(r => r.Property)
                    .Include(r => r.Unit)
                    .Where(r => r.Id == requestId)
                    .ToListAsync();

                await _context.SaveChangesAsync();
                return _mapper.Map<List<LoadMaintenanceRequestDto>>(updatedRequests);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error reopening maintenance requests");
                throw new Exception("Error reopening maintenance requests", ex);
            }
        }

        public async Task<LoadMaintenanceRequestDto> ResolveMaintenance(long requestId)
        {
            try
            {
                var request = await _context.MaintenanceRequests
                    .Include(r => r.Property)
                    .Include(r => r.Unit)
                    .FirstOrDefaultAsync(r => r.Id == requestId);

                if (request == null)
                {
                    throw new KeyNotFoundException($"Maintenance request with ID {requestId} not found.");
                }

                request.Status = EMaintenanceStatus.Resolved;
                request.CompletedAt = DateTime.Now;

                await _context.SaveChangesAsync();

                // Reload with includes to ensure we have the latest data
                var resolvedRequest = await _context.MaintenanceRequests
                    .Include(r => r.Property)
                    .Include(r => r.Unit)
                    .FirstOrDefaultAsync(r => r.Id == requestId);

                return _mapper.Map<LoadMaintenanceRequestDto>(resolvedRequest);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error resolving maintenance request with ID {RequestId}", requestId);
                throw new Exception("Error resolving maintenance request", ex);
            }
        }

        public async Task<LoadMaintenanceRequestDto?> AssignMaintenanceRequest(long maintenanceRequestId, AssignMaintenanceRequestDto dto, long assignedByUserId)
        {
            try
            {
                var request = await _context.MaintenanceRequests
                    .Include(r => r.Property)
                    .Include(r => r.Unit)
                    .Include(r => r.VendorEntity)
                    .FirstOrDefaultAsync(r => r.Id == maintenanceRequestId);

                if (request == null)
                    return null;

                request.AssignedToType = dto.AssignedToType;
                request.AssignedAt = dto.AssignedToType == EAssignedToType.Unassigned ? null : DateTime.UtcNow;
                request.AssignedByUserId = dto.AssignedToType == EAssignedToType.Unassigned ? null : assignedByUserId;

                if (dto.AssignedToType == EAssignedToType.Vendor)
                {
                    request.VendorId = dto.VendorId;
                    request.AssignedContactName = null;
                    request.AssignedContactPhone = null;
                    request.AssignedContactEmail = null;
                }
                else if (dto.AssignedToType == EAssignedToType.OneTimeContact)
                {
                    request.AssignedContactName = dto.ContactName;
                    request.AssignedContactPhone = dto.ContactPhone;
                    request.AssignedContactEmail = dto.ContactEmail;
                    request.VendorId = null;

                    // Optionally save the one-time contact as a reusable vendor
                    if (dto.SaveAsVendor && request.OrganizationId.HasValue && !string.IsNullOrWhiteSpace(dto.ContactName))
                    {
                        var newVendor = new Vendor
                        {
                            Name = dto.ContactName,
                            Phone = dto.ContactPhone,
                            Email = dto.ContactEmail,
                            Notes = dto.ContactNotes,
                            OrganizationId = request.OrganizationId,
                            LandlordId = assignedByUserId,
                            IsActive = true,
                            CreatedAt = DateTime.UtcNow,
                            UpdatedAt = DateTime.UtcNow
                        };
                        _context.Vendors.Add(newVendor);
                        await _context.SaveChangesAsync();
                        request.VendorId = newVendor.Id;
                        request.AssignedToType = EAssignedToType.Vendor;
                    }
                }
                else if (dto.AssignedToType == EAssignedToType.Self)
                {
                    request.VendorId = null;
                    request.AssignedContactName = null;
                    request.AssignedContactPhone = null;
                    request.AssignedContactEmail = null;
                }
                else // Unassigned
                {
                    request.VendorId = null;
                    request.AssignedContactName = null;
                    request.AssignedContactPhone = null;
                    request.AssignedContactEmail = null;
                }

                // Auto-advance to InProgress when assigned
                if (dto.AssignedToType != EAssignedToType.Unassigned && request.Status == EMaintenanceStatus.Reported)
                    request.Status = EMaintenanceStatus.InProgress;

                await _context.SaveChangesAsync();

                var updated = await _context.MaintenanceRequests
                    .Include(r => r.Property)
                    .Include(r => r.Unit)
                    .Include(r => r.VendorEntity)
                    .FirstOrDefaultAsync(r => r.Id == maintenanceRequestId);

                return _mapper.Map<LoadMaintenanceRequestDto>(updated);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error assigning maintenance request {RequestId}", maintenanceRequestId);
                throw new Exception("Error assigning maintenance request", ex);
            }
        }
    }
}