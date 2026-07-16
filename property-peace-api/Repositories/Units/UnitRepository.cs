
using AutoMapper;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Unit;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;

namespace brownstone_hub_api.Repositories.Units
{
    public class UnitRepository(DataContext context, ILogger<UnitRepository> logger, IMapper mapper) : IUnitRepository
    {
        private readonly DataContext _context = context;
        private readonly ILogger<UnitRepository> _logger = logger;
        private readonly IMapper _mapper = mapper;

        public async Task<List<LoadUnitDto>> GetUnits(long propertyId, long? organizationId = null)
        {
            try
            {
                var query = _context.Properties
                    .Include(p => p.Units)
                        .ThenInclude(u => u.Lease)
                            .ThenInclude(l => l.TenantLeases)
                                .ThenInclude(tl => tl.Tenant)
                    .Include(p => p.Units)
                        .ThenInclude(u => u.Amenities)
                    .Include(p => p.Units)
                        .ThenInclude(u => u.IncludedUtility)
                    .Include(p => p.Units)
                        .ThenInclude(u => u.MaintenanceRequests)
                    .Where(p => p.Id == propertyId);

                // Filter by organizationId if provided
                if (organizationId.HasValue)
                {
                    query = query.Where(p => p.OrganizationId == organizationId.Value);
                }

                var property = await query.FirstOrDefaultAsync();

                if (property == null)
                {
                    return new List<LoadUnitDto>();
                }

                // Also filter units by organizationId if provided
                var units = property.Units.AsQueryable();
                if (organizationId.HasValue)
                {
                    units = units.Where(u => u.OrganizationId == organizationId.Value);
                }

                // Materialize the query first, then order in memory (int.TryParse with out parameter can't be translated to SQL)
                var unitsList = units.ToList();
                return _mapper.Map<List<LoadUnitDto>>(unitsList.OrderBy(u => int.TryParse(u.Name, out var n) ? n : int.MaxValue).ToList());
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error getting units for property ID {propertyId}");
                throw new Exception($"Error getting units for property ID {propertyId}", ex);
            }
        }

        public async Task<List<LoadUnitDto>> GetUnitsByPropertyIds(List<long> propertyIds, long? organizationId = null)
        {
            try
            {
                var query = _context.Units
                    .Include(u => u.Lease)
                        .ThenInclude(l => l.TenantLeases)
                            .ThenInclude(tl => tl.Tenant)
                    .Include(u => u.Amenities)
                    .Include(u => u.IncludedUtility)
                    .Include(u => u.MaintenanceRequests)
                    .Where(u => propertyIds.Contains(u.PropertyId));

                if (organizationId.HasValue)
                {
                    query = query.Where(u => u.OrganizationId == organizationId.Value);
                }

                var units = await query.ToListAsync();
                return _mapper.Map<List<LoadUnitDto>>(
                    units.OrderBy(u => int.TryParse(u.Name, out var n) ? n : int.MaxValue).ToList());
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting units for property IDs");
                throw new Exception("Error getting units for property IDs", ex);
            }
        }

        public async Task<LoadUnitDto> AddUnit(UpdateUnitDto newUnit, long propertyId, long? organizationId = null)
        {
            try
            {
                var query = _context.Properties
                    .Include(p => p.Units)
                    .Where(p => p.Id == propertyId);

                // Filter by organizationId if provided
                if (organizationId.HasValue)
                {
                    query = query.Where(p => p.OrganizationId == organizationId.Value);
                }

                var property = await query.FirstOrDefaultAsync();

                if (property == null)
                {
                    throw new KeyNotFoundException($"Property with ID {propertyId} not found.");
                }

                // Check if a unit with the same PropertyId and Name already exists
                // This prevents duplicate key violations when backend and frontend both try to create the same unit
                var existingUnit = await _context.Units
                    .FirstOrDefaultAsync(u => u.PropertyId == propertyId && 
                                             u.Name == newUnit.Name &&
                                             (organizationId == null || u.OrganizationId == organizationId));

                if (existingUnit != null)
                {
                    // Update existing unit instead of creating a new one
                    // Use UpdateUnit method which properly handles updates without modifying the Id
                    newUnit.Id = existingUnit.Id;
                    newUnit.PropertyId = propertyId;
                    return await UpdateUnit(newUnit);
                }

                // No existing unit found, create a new one
                var unit = _mapper.Map<Unit>(newUnit);
                unit.PropertyId = propertyId;
                unit.IsOccupied = false; // Always start vacant; only lease operations set this to true

                // Set organizationId from parameter or property
                unit.OrganizationId = organizationId ?? property.OrganizationId;

                _context.Units.Add(unit);
                await _context.SaveChangesAsync();

                return _mapper.Map<LoadUnitDto>(unit);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error adding unit to property ID {propertyId}");
                throw new Exception($"Error adding unit to property ID {propertyId}", ex);
            }
        }

        public async Task<List<LoadUnitDto>> BulkCreateUnits(BulkCreateUnitsDto bulkCreateDto, long? organizationId = null)
        {
            try
            {
                var query = _context.Properties
                    .Include(p => p.Units)
                    .Where(p => p.Id == bulkCreateDto.PropertyId);

                // Filter by organizationId if provided
                if (organizationId.HasValue)
                {
                    query = query.Where(p => p.OrganizationId == organizationId.Value);
                }

                var property = await query.FirstOrDefaultAsync();

                if (property == null)
                {
                    throw new KeyNotFoundException($"Property with ID {bulkCreateDto.PropertyId} not found.");
                }

                // Detect naming convention and adjust unit names
                var existingUnits = property.Units?.ToList() ?? [];
                var namingInfo = DetectNamingConvention(existingUnits);
                
                // Map all units and adjust names based on convention
                var units = new List<Unit>();
                var nextNumber = namingInfo.NextNumber;
                
                // Get organizationId from parameter or property
                var finalOrganizationId = organizationId ?? property.OrganizationId;
                
                foreach (var unitDto in bulkCreateDto.Units)
                {
                    var unit = _mapper.Map<Unit>(unitDto);
                    unit.PropertyId = bulkCreateDto.PropertyId;
                    unit.Id = 0; // Ensure new entity
                    unit.OrganizationId = finalOrganizationId; // Set organizationId
                    unit.IsOccupied = false; // Always start vacant; only lease operations set this to true
                    
                    // If we detected a "unit X" pattern, update names to continue the sequence
                    if (namingInfo.FollowsPattern)
                    {
                        // Only update if the name matches the pattern or is empty/generic
                        // This allows custom names to be preserved if they don't match the pattern
                        if (ShouldUpdateUnitName(unit.Name) || string.IsNullOrWhiteSpace(unit.Name) || unit.Name.Trim().Equals("Unit", StringComparison.OrdinalIgnoreCase))
                        {
                            unit.Name = $"{namingInfo.Prefix}{nextNumber}{namingInfo.Suffix}";
                            nextNumber++;
                        }
                    }
                    // If no pattern detected, generate names for empty/generic ones
                    else if (string.IsNullOrWhiteSpace(unit.Name) || unit.Name.Trim().Equals("Unit", StringComparison.OrdinalIgnoreCase))
                    {
                        unit.Name = $"Unit {nextNumber}";
                        nextNumber++;
                    }
                    
                    units.Add(unit);
                }

                // Use AddRange for bulk insert (best performance)
                _context.Units.AddRange(units);
                await _context.SaveChangesAsync();

                // Return the created units as DTOs
                return _mapper.Map<List<LoadUnitDto>>(units);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error bulk creating units for property ID {bulkCreateDto.PropertyId}");
                throw new Exception($"Error bulk creating units for property ID {bulkCreateDto.PropertyId}", ex);
            }
        }

        private (bool FollowsPattern, string Prefix, string Suffix, int NextNumber) DetectNamingConvention(List<Unit> existingUnits)
        {
            if (existingUnits == null || existingUnits.Count == 0)
            {
                return (false, "Unit ", "", 1);
            }

            // Pattern to match "unit 1", "unit 2", "unit 3", etc. (case-insensitive)
            // Also matches "Unit 1", "UNIT 1", etc.
            var simplePattern = new Regex(@"^unit\s+(\d+)$", RegexOptions.IgnoreCase);
            
            var matchingUnits = existingUnits
                .Where(u => !string.IsNullOrWhiteSpace(u.Name))
                .Select(u => new { Unit = u, Match = simplePattern.Match(u.Name.Trim()) })
                .Where(x => x.Match.Success)
                .ToList();

            if (matchingUnits.Count > 0)
            {
                // Found units following "unit X" pattern
                var numbers = matchingUnits
                    .Select(x => int.Parse(x.Match.Groups[1].Value))
                    .OrderByDescending(n => n)
                    .ToList();
                
                var maxNumber = numbers.First();
                
                // Preserve the exact prefix format (case, spacing) from the first matching unit
                var firstUnitName = matchingUnits.First().Unit.Name.Trim();
                var firstNumber = matchingUnits.First().Match.Groups[1].Value;
                var prefixIndex = firstUnitName.LastIndexOf(firstNumber, StringComparison.OrdinalIgnoreCase);
                string prefix;
                
                if (prefixIndex > 0)
                {
                    prefix = firstUnitName.Substring(0, prefixIndex);
                }
                else
                {
                    prefix = "Unit "; // Default fallback
                }
                
                return (true, prefix, "", maxNumber + 1);
            }

            // No matching pattern found - use default numbering
            return (false, "Unit ", "", 1);
        }

        private bool ShouldUpdateUnitName(string unitName)
        {
            if (string.IsNullOrWhiteSpace(unitName))
            {
                return true;
            }

            // Check if the name matches "unit X" pattern (case-insensitive)
            var simplePattern = new Regex(@"^unit\s+\d+$", RegexOptions.IgnoreCase);
            return simplePattern.IsMatch(unitName.Trim());
        }

        public async Task<LoadUnitDto> UpdateUnit(UpdateUnitDto updateUnitDto)
        {
            try
            {
                var unit = await _context.Units
                    .Include(u => u.Amenities)
                    .Include(u => u.IncludedUtility)
                    .FirstOrDefaultAsync(u => u.Id == updateUnitDto.Id) ?? throw new KeyNotFoundException($"Unit with ID {updateUnitDto.Id} not found.");
                unit.Amenities ??= [];

                // Remove all existing amenities first
                if (unit.Amenities.Count != 0)
                {
                    _context.Amenities.RemoveRange(unit.Amenities);
                }

                // Map and add new amenities
                var updatedAmenities = _mapper.Map<List<Amenity>>(updateUnitDto.Amenities);
                unit.Amenities = updatedAmenities;

                var preservedIsOccupied = unit.IsOccupied; // Don't let client overwrite occupancy
                _mapper.Map(updateUnitDto, unit);
                unit.IsOccupied = preservedIsOccupied; // Restore; only lease operations control this
                _context.Units.Update(unit);
                await _context.SaveChangesAsync();

                return _mapper.Map<LoadUnitDto>(unit);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error updating unit {updateUnitDto.Id}");
                throw new Exception($"Error updating unit {updateUnitDto.Id}", ex);
            }
        }

        public async Task<LoadUnitDto> GetUnitById(long id, long? organizationId = null)
        {
            try
            {
                var query = _context.Units
                    .Include(u => u.Amenities)
                    .Include(u => u.IncludedUtility)
                    .Include(u => u.Lease)
                        .ThenInclude(l => l.TenantLeases)
                            .ThenInclude(tl => tl.Tenant)
                    .Include(u => u.MaintenanceRequests)
                        .ThenInclude(m => m.Images)
                    .Where(u => u.Id == id);

                // Filter by organizationId if provided
                if (organizationId.HasValue)
                {
                    query = query.Where(u => u.OrganizationId == organizationId.Value);
                }

                var unit = await query.FirstOrDefaultAsync();

                return _mapper.Map<LoadUnitDto>(unit);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error getting unit ID {id}");
                throw new Exception($"Error getting unit ID {id}", ex);
            }
        }

        public async Task<LoadUnitDto> DeleteUnit(long id)
        {
            try
            {
                var unit = await _context.Units.FindAsync(id);

                _context.Units.Remove(unit);
                await _context.SaveChangesAsync();

                return _mapper.Map<LoadUnitDto>(unit);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error deleting unit ID {id}");
                throw new Exception($"Error deleting unit ID {id}", ex);
            }
        }

        public async Task<int> DeleteUnitsByPropertyId(long propertyId)
        {
            try
            {
                var units = await _context.Units
                    .Where(u => u.PropertyId == propertyId)
                    .ToListAsync();
                
                _context.Units.RemoveRange(units);
                await _context.SaveChangesAsync();
                
                return units.Count;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting units for property {PropertyId}", propertyId);
                throw new Exception($"Error deleting units for property {propertyId}", ex);
            }
        }
    }
}