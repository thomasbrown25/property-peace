

using AutoMapper;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Property;
using brownstone_hub_api.Enums;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.Properties
{
    public class PropertyRepository(DataContext context, ILogger<PropertyRepository> logger, IMapper mapper) : IPropertyRepository
    {
        private readonly DataContext _context = context;
        private readonly ILogger<PropertyRepository> _logger = logger;
        private readonly IMapper _mapper = mapper;

        public Task<LoadPropertyDto> AddProperty(UpdatePropertyDto propertyDto) =>
            AddProperty(propertyDto, CancellationToken.None);

        public async Task<LoadPropertyDto> AddProperty(UpdatePropertyDto propertyDto, CancellationToken cancellationToken)
        {
            try
            {
                var entity = _mapper.Map<Property>(propertyDto);

                var entry = await _context.Properties.AddAsync(entity, cancellationToken);
                await _context.SaveChangesAsync(cancellationToken);

                var saved = entry.Entity;

                return _mapper.Map<LoadPropertyDto>(saved);
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding property");
                throw new Exception("Error adding property", ex);
            }
        }


        public Task<LoadPropertyDto> UpdateProperty(UpdatePropertyDto property) =>
            UpdateProperty(property, CancellationToken.None);

        public async Task<LoadPropertyDto?> UpdatePropertyForMutationAsync(
            UpdatePropertyDto property,
            long organizationId,
            CancellationToken cancellationToken)
        {
            var existingProperty = await _context.Properties
                .Where(p => !p.IsDeleted && p.OrganizationId == organizationId)
                .Include(p => p.Units)
                .FirstOrDefaultAsync(p => p.Id == property.Id, cancellationToken);
            if (existingProperty is null)
            {
                return null;
            }

            var existingName = existingProperty.Name;
            var existingLandlordId = existingProperty.LandlordId;
            _mapper.Map(property, existingProperty);
            existingProperty.OrganizationId = organizationId;
            existingProperty.LandlordId = existingLandlordId;
            existingProperty.Name = string.IsNullOrWhiteSpace(property.Name)
                ? existingName
                : property.Name.Trim();
            existingProperty.TargetRent = property.TargetRent;
            existingProperty.TargetDeposit = property.TargetDeposit;
            await _context.SaveChangesAsync(cancellationToken);
            return _mapper.Map<LoadPropertyDto>(existingProperty);
        }

        public async Task<LoadPropertyDto> UpdateProperty(UpdatePropertyDto property, CancellationToken cancellationToken)
        {
            try
            {
                var existingProperty = await _context.Properties
                    .Where(p => !p.IsDeleted)
                    .Include(p => p.Units)
                    .FirstOrDefaultAsync(p => p.Id == property.Id, cancellationToken) ?? throw new KeyNotFoundException("Property not found");

                // Log the incoming values for debugging
                _logger.LogInformation("Updating property {PropertyId}: Name={Name}, TargetRent={TargetRent}, TargetDeposit={TargetDeposit}", 
                    property.Id, property.Name, property.TargetRent, property.TargetDeposit);

                // Preserve existing name before mapping (Map overwrites with DTO value, which may be null when client omits it)
                var existingName = existingProperty.Name;

                // Map all properties using AutoMapper
                _mapper.Map(property, existingProperty);

                // Only update Name when the DTO provides one; otherwise keep existing (so property settings save doesn't overwrite with null/empty)
                if (!string.IsNullOrWhiteSpace(property.Name))
                    existingProperty.Name = property.Name.Trim();
                else
                    existingProperty.Name = existingName;

                existingProperty.TargetRent = property.TargetRent;
                existingProperty.TargetDeposit = property.TargetDeposit;

                // Explicitly mark these properties as modified to ensure EF Core saves them
                _context.Entry(existingProperty).Property(p => p.Name).IsModified = true;
                _context.Entry(existingProperty).Property(p => p.TargetRent).IsModified = true;
                _context.Entry(existingProperty).Property(p => p.TargetDeposit).IsModified = true;
                
                // Log the values after mapping
                _logger.LogInformation("After mapping - Name={Name}, TargetRent={TargetRent}, TargetDeposit={TargetDeposit}", 
                    existingProperty.Name, existingProperty.TargetRent, existingProperty.TargetDeposit);
                
                await _context.SaveChangesAsync(cancellationToken);

                _logger.LogInformation("Property {PropertyId} updated successfully", property.Id);

                return _mapper.Map<LoadPropertyDto>(existingProperty);
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating property with ID {PropertyId}", property.Id);
                throw new Exception($"Error updating property with ID {property.Id}", ex);
            }
        }

        public Task<LoadPropertyDto?> GetPropertyById(long propertyId) =>
            GetPropertyByIdInternal(propertyId, organizationId: null, CancellationToken.None);

        public Task<LoadPropertyDto?> GetPropertyById(long propertyId, long organizationId) =>
            GetPropertyByIdInternal(propertyId, organizationId, CancellationToken.None);

        public Task<LoadPropertyDto?> GetPropertyByIdForMutationAsync(long propertyId, long organizationId, CancellationToken cancellationToken) =>
            GetPropertyByIdInternal(propertyId, organizationId, cancellationToken);

        public async Task<LoadPropertyDto?> GetInactivePropertyByIdForMutationAsync(
            long propertyId, long organizationId, CancellationToken cancellationToken)
        {
            var property = await _context.Properties
                .Where(p => p.IsDeleted && p.OrganizationId == organizationId)
                .Include(p => p.Units)
                .FirstOrDefaultAsync(p => p.Id == propertyId, cancellationToken);
            return property is null ? null : _mapper.Map<LoadPropertyDto>(property);
        }

        private async Task<LoadPropertyDto?> GetPropertyByIdInternal(long propertyId, long? organizationId, CancellationToken cancellationToken)
        {
            try
            {
                var property = await _context.Properties
                        .Where(p => !p.IsDeleted)
                        .Include(p => p.Images)
                        .Include(p => p.MaintenanceRequests)
                                .ThenInclude(m => m.Images)
                        .Include(p => p.Units)
                            .ThenInclude(u => u.Amenities)
                        .Include(p => p.Units)
                            .ThenInclude(u => u.IncludedUtility)
                        .Include(p => p.Units)
                            .ThenInclude(u => u.Lease)
                                .ThenInclude(l => l.TenantLeases)
                                    .ThenInclude(tl => tl.Tenant)
                        .Include(p => p.Units)
                            .ThenInclude(u => u.Lease)
                                .ThenInclude(l => l.LeaseFees)
                        .Include(p => p.Units)
                            .ThenInclude(u => u.Lease)
                                .ThenInclude(l => l.LeaseLandlords)
                        .Include(p => p.Units)
                            .ThenInclude(u => u.Lease)
                                .ThenInclude(l => l.LeaseDeposits)
                        .Include(p => p.Units)
                            .ThenInclude(u => u.Lease)
                                .ThenInclude(l => l.Pets)
                        .Include(p => p.Units)
                            .ThenInclude(u => u.Lease)
                                .ThenInclude(l => l.Parking)
                        .Include(p => p.Units)
                            .ThenInclude(u => u.Lease)
                                .ThenInclude(l => l.UtilityServiceResponsibilities)
                        .Include(p => p.Units)
                            .ThenInclude(u => u.Lease)
                                .ThenInclude(l => l.MaintenanceResponsibilities)
                        .Include(p => p.Units)
                            .ThenInclude(u => u.Lease)
                                .ThenInclude(l => l.LeaseKeys)
                        .Include(p => p.Units)
                            .ThenInclude(u => u.Lease)
                                .ThenInclude(l => l.LeaseCoSigners)
                        .Include(p => p.Units)
                            .ThenInclude(u => u.Lease)
                                .ThenInclude(l => l.LeaseAdditionalSigners)
                        .Include(p => p.Units)
                            .ThenInclude(u => u.MaintenanceRequests)
                                .ThenInclude(m => m.Images)
                        .Include(p => p.PrimaryManager)
                        .AsSplitQuery()
                    .FirstOrDefaultAsync(p => p.Id == propertyId &&
                        (!organizationId.HasValue || p.OrganizationId == organizationId.Value), cancellationToken);

                if (property == null)
                {
                    return null;
                }

                return _mapper.Map<LoadPropertyDto>(property);
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving property with ID {PropertyId}", propertyId);
                throw new Exception($"Error retrieving property with ID {propertyId}", ex);
            }
        }
        public async Task<List<LoadPropertyDto>> GetPropertiesByLandlordId(long landlordId, long? organizationId = null)
        {
            try
            {
                var query = _context.Properties.Where(p => p.LandlordId == landlordId && !p.IsDeleted);
                
                // Filter by organization if provided
                if (organizationId.HasValue)
                {
                    query = query.Where(p => p.OrganizationId == organizationId.Value);
                }
                
                var properties = await query
                        .Include(p => p.Images)
                        .Include(p => p.MaintenanceRequests)
                            .ThenInclude(m => m.Images)
                        .Include(p => p.Units)
                            .ThenInclude(u => u.Amenities)
                        .Include(p => p.Units)
                            .ThenInclude(u => u.IncludedUtility)
                        .Include(p => p.Units)
                            .ThenInclude(u => u.Lease)
                                .ThenInclude(l => l.TenantLeases)
                                    .ThenInclude(tl => tl.Tenant)
                        .Include(p => p.Units)
                            .ThenInclude(u => u.Lease)
                                .ThenInclude(l => l.LeaseFees)
                        .Include(p => p.Units)
                            .ThenInclude(u => u.Lease)
                                .ThenInclude(l => l.LeaseLandlords)
                        .Include(p => p.Units)
                            .ThenInclude(u => u.Lease)
                                .ThenInclude(l => l.LeaseDeposits)
                        .Include(p => p.Units)
                            .ThenInclude(u => u.Lease)
                                .ThenInclude(l => l.Pets)
                        .Include(p => p.Units)
                            .ThenInclude(u => u.Lease)
                                .ThenInclude(l => l.Parking)
                        .Include(p => p.Units)
                            .ThenInclude(u => u.Lease)
                                .ThenInclude(l => l.UtilityServiceResponsibilities)
                        .Include(p => p.Units)
                            .ThenInclude(u => u.Lease)
                                .ThenInclude(l => l.MaintenanceResponsibilities)
                        .Include(p => p.Units)
                            .ThenInclude(u => u.Lease)
                                .ThenInclude(l => l.LeaseKeys)
                        .Include(p => p.Units)
                            .ThenInclude(u => u.Lease)
                                .ThenInclude(l => l.LeaseCoSigners)
                        .Include(p => p.Units)
                            .ThenInclude(u => u.Lease)
                                .ThenInclude(l => l.LeaseAdditionalSigners)
                        .Include(p => p.Units)
                            .ThenInclude(u => u.MaintenanceRequests)
                                .ThenInclude(m => m.Images)
                        .Include(p => p.PrimaryManager)
                        .OrderBy(p => p.Name)
                        .ToListAsync();


                return _mapper.Map<List<LoadPropertyDto>>(properties);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving properties for landlord ID {LandlordId}", landlordId);
                throw new Exception($"Error retrieving properties for landlord ID {landlordId}", ex);
            }
        }

        public async Task<List<LoadPropertyDto>> GetPropertiesByOrganizationId(long organizationId)
        {
            try
            {
                // List view: omit lease-builder-only nav properties (Pets, Parking, UtilityServiceResponsibilities,
                // MaintenanceResponsibilities, LeaseKeys, LeaseLandlords, LeaseDeposits, LeaseCoSigners,
                // LeaseAdditionalSigners) — those are fetched on-demand via GET /api/property/{id} or
                // GET /api/lease/{id} when editing. Also omit Unit.MaintenanceRequests.Images (shown separately).
                var properties = await _context.Properties
                        .Where(p => p.OrganizationId == organizationId && !p.IsDeleted)
                        .Include(p => p.Images)
                        .Include(p => p.MaintenanceRequests)
                            .ThenInclude(m => m.Images)
                        .Include(p => p.Units)
                            .ThenInclude(u => u.Amenities)
                        .Include(p => p.Units)
                            .ThenInclude(u => u.IncludedUtility)
                        .Include(p => p.Units)
                            .ThenInclude(u => u.Lease)
                                .ThenInclude(l => l.TenantLeases)
                                    .ThenInclude(tl => tl.Tenant)
                        .Include(p => p.Units)
                            .ThenInclude(u => u.Lease)
                                .ThenInclude(l => l.LeaseFees)
                        .Include(p => p.Units)
                            .ThenInclude(u => u.Lease)
                                .ThenInclude(l => l.LeaseAgreement)
                        .Include(p => p.PrimaryManager)
                        .OrderBy(p => p.Name)
                        .ToListAsync();

                return _mapper.Map<List<LoadPropertyDto>>(properties);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving properties for organization ID {OrganizationId}", organizationId);
                throw new Exception($"Error retrieving properties for organization ID {organizationId}", ex);
            }
        }

        public async Task<int> GetOccupiedPropertiesCountAsync(long organizationId)
        {
            try
            {
                return await _context.Properties.CountAsync(p => p.OrganizationId == organizationId && !p.IsDeleted && p.IsOccupied);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving occupied properties count for organization ID {OrganizationId}", organizationId);
                throw new Exception($"Error retrieving occupied properties count for organization ID {organizationId}", ex);
            }
        }

        public async Task<int> GetVacantPropertiesCountAsync(long organizationId)
        {
            try
            {
                return await _context.Properties.CountAsync(p => p.OrganizationId == organizationId && !p.IsDeleted && !p.IsOccupied);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving vacant properties count for organization ID {OrganizationId}", organizationId);
                throw new Exception($"Error retrieving vacant properties count for organization ID {organizationId}", ex);
            }
        }

        public async Task<LoadPropertyDto> DeleteProperty(long propertyId)
        {
            try
            {
                var property = await _context.Properties.FindAsync(propertyId);

                if (property == null)
                {
                    throw new KeyNotFoundException($"Property with ID {propertyId} not found");
                }

                // Map to DTO before deletion (since we need to return it)
                var propertyDto = _mapper.Map<LoadPropertyDto>(property);

                // Hard delete: actually remove the property from the database
                _context.Properties.Remove(property);
                await _context.SaveChangesAsync();

                return propertyDto;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting property with ID {PropertyId}", propertyId);
                throw new Exception($"Error deleting property with ID {propertyId}", ex);
            }
        }

        public async Task<LoadPropertyDto> DeleteProperty(
            long propertyId, long organizationId, CancellationToken cancellationToken)
        {
            var property = await _context.Properties.FirstOrDefaultAsync(
                p => p.Id == propertyId && !p.IsDeleted && p.OrganizationId == organizationId,
                cancellationToken) ?? throw new KeyNotFoundException($"Property with ID {propertyId} not found");
            var propertyDto = _mapper.Map<LoadPropertyDto>(property);
            _context.Properties.Remove(property);
            await _context.SaveChangesAsync(cancellationToken);
            return propertyDto;
        }

        public async Task<LoadPropertyDto> InactivateProperty(long propertyId)
        {
            try
            {
                var property = await _context.Properties.FindAsync(propertyId);

                if (property == null)
                {
                    throw new KeyNotFoundException($"Property with ID {propertyId} not found");
                }

                // Set IsDeleted to 1 (true) to inactivate the property
                property.IsDeleted = true;
                property.DeletedAt = DateTime.UtcNow;

                _context.Properties.Update(property);
                await _context.SaveChangesAsync();

                return _mapper.Map<LoadPropertyDto>(property);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error inactivating property with ID {PropertyId}", propertyId);
                throw new Exception($"Error inactivating property with ID {propertyId}", ex);
            }
        }

        public async Task<LoadPropertyDto> InactivateProperty(
            long propertyId, long organizationId, CancellationToken cancellationToken)
        {
            var property = await _context.Properties.FirstOrDefaultAsync(
                p => p.Id == propertyId && !p.IsDeleted && p.OrganizationId == organizationId,
                cancellationToken) ?? throw new KeyNotFoundException($"Property with ID {propertyId} not found");
            property.IsDeleted = true;
            property.DeletedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync(cancellationToken);
            return _mapper.Map<LoadPropertyDto>(property);
        }

        public async Task<LoadPropertyDto> ReactivateProperty(long propertyId)
        {
            try
            {
                var property = await _context.Properties.FindAsync(propertyId);

                if (property == null)
                {
                    throw new KeyNotFoundException($"Property with ID {propertyId} not found");
                }

                // Set IsDeleted to 0 (false) to reactivate the property
                property.IsDeleted = false;
                property.DeletedAt = null;

                _context.Properties.Update(property);
                await _context.SaveChangesAsync();

                return _mapper.Map<LoadPropertyDto>(property);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error reactivating property with ID {PropertyId}", propertyId);
                throw new Exception($"Error reactivating property with ID {propertyId}", ex);
            }
        }

        public async Task<LoadPropertyDto> ReactivateProperty(
            long propertyId, long organizationId, CancellationToken cancellationToken)
        {
            var property = await _context.Properties.FirstOrDefaultAsync(
                p => p.Id == propertyId && p.IsDeleted && p.OrganizationId == organizationId,
                cancellationToken) ?? throw new KeyNotFoundException($"Property with ID {propertyId} not found");
            property.IsDeleted = false;
            property.DeletedAt = null;
            await _context.SaveChangesAsync(cancellationToken);
            return _mapper.Map<LoadPropertyDto>(property);
        }

        public async Task<bool> IsSingleUnitPortfolio(long organizationId)
        {
            try
            {
                var hasAnyNonSF = await _context.Properties
                    .Where(p => p.OrganizationId == organizationId && !p.IsDeleted)
                    .AnyAsync(p => p.PropertyType != EPropertyType.SingleFamily);

                return !hasAnyNonSF;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking if single unit portfolio for organization ID {OrganizationId}", organizationId);
                throw new Exception($"Error checking if single unit portfolio for organization ID {organizationId}", ex);
            }
        }

        public async Task<(int TotalProperties, int TotalUnits, int OccupiedUnits)> GetDashboardCountsAsync(long organizationId)
        {
            try
            {
                var today = DateTime.UtcNow.Date;

                var totalProperties = await _context.Properties
                    .CountAsync(p => p.OrganizationId == organizationId && !p.IsDeleted);

                var unitQuery = _context.Units
                    .Where(u => u.Property.OrganizationId == organizationId && !u.Property.IsDeleted);

                var totalUnits = await unitQuery.CountAsync();

                var occupiedUnits = await unitQuery
                    .CountAsync(u => u.Lease != null && u.Lease.IsActive &&
                                     u.Lease.StartDate.HasValue && u.Lease.StartDate <= today &&
                                     u.Lease.EndDate.HasValue && u.Lease.EndDate >= today);

                return (totalProperties, totalUnits, occupiedUnits);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving dashboard counts for organization {OrganizationId}", organizationId);
                throw new Exception($"Error retrieving dashboard counts for organization {organizationId}", ex);
            }
        }

        public async Task<int> GetTotalPropertyCountAsync(long organizationId) =>
            await _context.Properties.CountAsync(p => p.OrganizationId == organizationId && !p.IsDeleted);

        public async Task<int> GetTotalPropertyCountByLandlordAsync(long landlordId) =>
            await _context.Properties.CountAsync(p => p.LandlordId == landlordId && !p.IsDeleted);

        public async Task<int> GetTotalUnitCountAsync(long organizationId) =>
            await _context.Units.CountAsync(u => u.Property.OrganizationId == organizationId && !u.Property.IsDeleted);

        public async Task<int> GetTotalUnitCountByLandlordAsync(long landlordId) =>
            await _context.Units.CountAsync(u => u.Property.LandlordId == landlordId && !u.Property.IsDeleted);

        public async Task<List<long>> GetUnitIdsByPropertyId(long propertyId)
        {
            try
            {
                return await _context.Units
                    .Where(u => u.PropertyId == propertyId)
                    .Select(u => u.Id)
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving unit IDs for property {PropertyId}", propertyId);
                throw;
            }
        }

        public async Task<List<long>> GetTenantIdsByPropertyId(long propertyId)
        {
            try
            {
                return await _context.Tenants
                    .Include(t => t.Unit)
                    .Where(t => t.Unit.PropertyId == propertyId)
                    .Select(t => t.Id)
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving tenant IDs for property {PropertyId}", propertyId);
                throw;
            }
        }

        public async Task<List<long>> GetLeaseIdsByPropertyId(long propertyId)
        {
            try
            {
                return await _context.Leases
                    .Include(l => l.Unit)
                    .Where(l => l.Unit.PropertyId == propertyId && !l.IsDeleted)
                    .Select(l => l.Id)
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving lease IDs for property {PropertyId}", propertyId);
                throw;
            }
        }

        public async Task<int> DeleteDepositsByLeaseIds(List<long> leaseIds)
        {
            try
            {
                var deposits = await _context.Deposits
                    .Where(d => leaseIds.Contains(d.LeaseId))
                    .ToListAsync();
                
                _context.Deposits.RemoveRange(deposits);
                await _context.SaveChangesAsync();
                
                return deposits.Count;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting deposits for lease IDs: {LeaseIds}", string.Join(", ", leaseIds));
                throw;
            }
        }

        public async Task<bool> PropertyNameExistsInOrganization(string? propertyName, long organizationId, long? excludePropertyId = null)
        {
            try
            {
                // If property name is null or empty, no duplicate check needed
                if (string.IsNullOrWhiteSpace(propertyName))
                {
                    return false;
                }

                var query = _context.Properties
                    .Where(p => p.OrganizationId == organizationId 
                        && !p.IsDeleted 
                        && p.Name != null
                        && p.Name.ToLower().Trim() == propertyName.ToLower().Trim());

                // Exclude the current property when updating
                if (excludePropertyId.HasValue)
                {
                    query = query.Where(p => p.Id != excludePropertyId.Value);
                }

                return await query.AnyAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking if property name exists in organization {OrganizationId}", organizationId);
                throw;
            }
        }
    }
}