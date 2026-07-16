using AutoMapper;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Checklist;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.Checklists
{
    public class OrganizationChecklistItemRepository(DataContext context, IMapper mapper, ILogger<OrganizationChecklistItemRepository> logger) : IOrganizationChecklistItemRepository
    {
        private readonly DataContext _context = context;
        private readonly IMapper _mapper = mapper;
        private readonly ILogger<OrganizationChecklistItemRepository> _logger = logger;

        public async Task<LoadOrganizationChecklistItemDto> AddOrganizationChecklistItem(AddOrganizationChecklistItemDto item, long organizationId)
        {
            try
            {
                var entity = _mapper.Map<Models.OrganizationChecklistItem>(item);
                entity.OrganizationId = organizationId;
                entity.IsDefault = false; // User-created items are not default
                
                await _context.OrganizationChecklistItems.AddAsync(entity);
                await _context.SaveChangesAsync();

                return MapToDto(entity);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding organization checklist item for organization {OrganizationId}", organizationId);
                throw;
            }
        }

        public async Task<LoadOrganizationChecklistItemDto?> GetOrganizationChecklistItemById(long id)
        {
            try
            {
                var item = await _context.OrganizationChecklistItems
                    .FirstOrDefaultAsync(i => i.Id == id && !i.IsDeleted);

                return item == null ? null : MapToDto(item);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving organization checklist item with ID {ItemId}", id);
                throw;
            }
        }

        public async Task<List<LoadOrganizationChecklistItemDto>> GetOrganizationChecklistItemsByOrganizationId(long organizationId)
        {
            try
            {
                var items = await _context.OrganizationChecklistItems
                    .Where(i => i.OrganizationId == organizationId && !i.IsDeleted)
                    .OrderBy(i => i.SortOrder)
                    .ThenBy(i => i.Category)
                    .ThenBy(i => i.Name)
                    .ToListAsync();

                return items.Select(MapToDto).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving organization checklist items for organization {OrganizationId}", organizationId);
                throw;
            }
        }

        public async Task<LoadOrganizationChecklistItemDto> UpdateOrganizationChecklistItem(UpdateOrganizationChecklistItemDto item)
        {
            try
            {
                var entity = await _context.OrganizationChecklistItems.FindAsync(item.Id);
                if (entity == null || entity.IsDeleted)
                {
                    throw new Exception("Organization checklist item not found");
                }

                entity.Name = item.Name;
                entity.Description = item.Description;
                entity.Category = item.Category;
                entity.SortOrder = item.SortOrder;
                entity.UpdatedAt = DateTime.Now;

                await _context.SaveChangesAsync();

                return MapToDto(entity);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating organization checklist item {ItemId}", item.Id);
                throw;
            }
        }

        public async Task<bool> DeleteOrganizationChecklistItem(long id)
        {
            try
            {
                var entity = await _context.OrganizationChecklistItems.FindAsync(id);
                if (entity == null || entity.IsDeleted)
                {
                    return false;
                }

                // Soft delete - don't delete default items, just mark as deleted
                if (entity.IsDefault)
                {
                    entity.IsDeleted = true;
                    entity.DeletedAt = DateTime.Now;
                }
                else
                {
                    _context.OrganizationChecklistItems.Remove(entity);
                }

                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting organization checklist item {ItemId}", id);
                throw;
            }
        }

        public async Task SeedDefaultChecklistItems(long organizationId)
        {
            try
            {
                // Check if default items already exist for this organization
                var existingDefaults = await _context.OrganizationChecklistItems
                    .Where(i => i.OrganizationId == organizationId && i.IsDefault && !i.IsDeleted)
                    .AnyAsync();

                if (existingDefaults)
                {
                    return; // Already seeded
                }

                // Default items that apply to both move-in and move-out
                var commonItems = new[]
                {
                    new { Name = "Walls - Clean and undamaged", Category = "Interior", Description = "Check all walls for cleanliness and damage" },
                    new { Name = "Floors - Clean and undamaged", Category = "Interior", Description = "Check all flooring surfaces" },
                    new { Name = "Windows - Clean and functional", Category = "Interior", Description = "Check all windows open/close properly" },
                    new { Name = "Doors - Functional locks", Category = "Interior", Description = "Check all doors and locks work properly" },
                    new { Name = "Kitchen - Appliances working", Category = "Kitchen", Description = "Test all kitchen appliances" },
                    new { Name = "Kitchen - Sink and faucet", Category = "Kitchen", Description = "Check sink and faucet functionality" },
                    new { Name = "Bathroom - Toilet functional", Category = "Bathroom", Description = "Test toilet functionality" },
                    new { Name = "Bathroom - Shower/tub functional", Category = "Bathroom", Description = "Check shower/tub and water pressure" },
                    new { Name = "Bathroom - Sink and faucet", Category = "Bathroom", Description = "Check bathroom sink functionality" },
                    new { Name = "HVAC - Heating working", Category = "HVAC", Description = "Test heating system" },
                    new { Name = "HVAC - Cooling working", Category = "HVAC", Description = "Test cooling system" },
                    new { Name = "Electrical - All outlets working", Category = "Electrical", Description = "Test all electrical outlets" },
                    new { Name = "Electrical - Light fixtures working", Category = "Electrical", Description = "Test all light fixtures" },
                    new { Name = "Smoke detectors - Functional", Category = "Safety", Description = "Test all smoke detectors" },
                    new { Name = "Carbon monoxide detectors - Functional", Category = "Safety", Description = "Test all CO detectors" }
                };

                // Move-in specific items
                var moveInItems = new[]
                {
                    new { Name = "Keys and access - All keys provided", Category = "Move-In", Description = "Verify all keys and access codes are provided" },
                    new { Name = "Parking - Assigned space available", Category = "Move-In", Description = "Confirm parking space assignment" },
                    new { Name = "Mailbox - Access provided", Category = "Move-In", Description = "Verify mailbox access" },
                    new { Name = "Utilities - Transfer information provided", Category = "Move-In", Description = "Confirm utility transfer instructions given" }
                };

                // Move-out specific items
                var moveOutItems = new[]
                {
                    new { Name = "Keys - All keys returned", Category = "Move-Out", Description = "Verify all keys and access devices returned" },
                    new { Name = "Cleaning - Unit cleaned thoroughly", Category = "Move-Out", Description = "Check that unit is cleaned to move-out standards" },
                    new { Name = "Personal items - All removed", Category = "Move-Out", Description = "Confirm all personal belongings removed" },
                    new { Name = "Utilities - Disconnected or transferred", Category = "Move-Out", Description = "Verify utilities are disconnected or transferred" },
                    new { Name = "Damage assessment - Document all damage", Category = "Move-Out", Description = "Document any damage beyond normal wear and tear" }
                };

                var allItems = commonItems
                    .Concat(moveInItems)
                    .Concat(moveOutItems)
                    .ToList();

                var entities = allItems.Select((item, index) => new Models.OrganizationChecklistItem
                {
                    Name = item.Name,
                    Description = item.Description,
                    Category = item.Category,
                    OrganizationId = organizationId,
                    IsDefault = true,
                    SortOrder = index
                }).ToList();

                await _context.OrganizationChecklistItems.AddRangeAsync(entities);
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error seeding default checklist items for organization {OrganizationId}", organizationId);
                throw;
            }
        }

        private LoadOrganizationChecklistItemDto MapToDto(Models.OrganizationChecklistItem item)
        {
            return new LoadOrganizationChecklistItemDto
            {
                Id = item.Id,
                Name = item.Name,
                Description = item.Description,
                Category = item.Category,
                IsDefault = item.IsDefault,
                SortOrder = item.SortOrder,
                OrganizationId = item.OrganizationId,
                CreatedAt = item.CreatedAt,
                UpdatedAt = item.UpdatedAt
            };
        }
    }
}

