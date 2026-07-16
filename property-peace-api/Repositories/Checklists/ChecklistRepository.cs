using AutoMapper;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Checklist;
using brownstone_hub_api.Enums;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace brownstone_hub_api.Repositories.Checklists
{
    public class ChecklistRepository(DataContext context, IMapper mapper, ILogger<ChecklistRepository> logger) : IChecklistRepository
    {
        private readonly DataContext _context = context;
        private readonly IMapper _mapper = mapper;
        private readonly ILogger<ChecklistRepository> _logger = logger;

        public async Task<LoadChecklistDto> AddChecklist(AddChecklistDto checklist, long landlordId, long? organizationId = null)
        {
            try
            {
                var entity = _mapper.Map<Models.Checklist>(checklist);
                entity.LandlordId = landlordId;
                
                // Serialize image arrays to JSON strings
                if (checklist.BeforeMoveInImagesBlobNames != null && checklist.BeforeMoveInImagesBlobNames.Any())
                {
                    entity.BeforeMoveInImagesBlobNames = JsonSerializer.Serialize(checklist.BeforeMoveInImagesBlobNames);
                }
                if (checklist.BeforeMoveInImagesUrls != null && checklist.BeforeMoveInImagesUrls.Any())
                {
                    entity.BeforeMoveInImagesUrls = JsonSerializer.Serialize(checklist.BeforeMoveInImagesUrls);
                }
                if (checklist.AfterMoveOutImagesBlobNames != null && checklist.AfterMoveOutImagesBlobNames.Any())
                {
                    entity.AfterMoveOutImagesBlobNames = JsonSerializer.Serialize(checklist.AfterMoveOutImagesBlobNames);
                }
                if (checklist.AfterMoveOutImagesUrls != null && checklist.AfterMoveOutImagesUrls.Any())
                {
                    entity.AfterMoveOutImagesUrls = JsonSerializer.Serialize(checklist.AfterMoveOutImagesUrls);
                }
                
                // Set organizationId if provided, otherwise try to get it from property
                if (organizationId.HasValue)
                {
                    entity.OrganizationId = organizationId.Value;
                }
                else
                {
                    var property = await _context.Properties.FindAsync(checklist.PropertyId);
                    if (property?.OrganizationId != null)
                    {
                        entity.OrganizationId = property.OrganizationId;
                    }
                }
                
                // Map items
                if (checklist.Items != null && checklist.Items.Count > 0)
                {
                    entity.Items = checklist.Items.Select(item => new Models.ChecklistItem
                    {
                        Name = item.Name,
                        Description = item.Description,
                        Category = item.Category,
                        Condition = item.Condition,
                        Notes = item.Notes,
                        HasDamage = item.HasDamage,
                        DamageDescription = item.DamageDescription,
                        SortOrder = item.SortOrder,
                        IsChecked = false
                    }).ToList();
                }
                
                await _context.Checklists.AddAsync(entity);
                await _context.SaveChangesAsync();

                // Reload with related entities
                await _context.Entry(entity).Reference(e => e.Property).LoadAsync();
                if (entity.UnitId.HasValue)
                {
                    await _context.Entry(entity).Reference(e => e.Unit).LoadAsync();
                }
                if (entity.LeaseId.HasValue)
                {
                    await _context.Entry(entity).Reference(e => e.Lease).LoadAsync();
                }
                if (entity.TenantId.HasValue)
                {
                    await _context.Entry(entity).Reference(e => e.Tenant).LoadAsync();
                }
                await _context.Entry(entity).Collection(e => e.Items).LoadAsync();

                return MapToDto(entity);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding checklist for landlord {LandlordId}", landlordId);
                throw;
            }
        }

        public async Task<LoadChecklistDto?> GetChecklistById(long id)
        {
            try
            {
                var checklist = await _context.Checklists
                    .Include(c => c.Property)
                    .Include(c => c.Unit)
                    .Include(c => c.Lease)
                    .Include(c => c.Tenant)
                    .Include(c => c.Items.OrderBy(i => i.SortOrder).ThenBy(i => i.Id))
                    .FirstOrDefaultAsync(c => c.Id == id);

                return checklist == null ? null : MapToDto(checklist);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving checklist with ID {ChecklistId}", id);
                throw;
            }
        }

        public async Task<List<LoadChecklistDto>> GetChecklistsByLandlordId(long landlordId)
        {
            try
            {
                var checklists = await _context.Checklists
                    .Include(c => c.Property)
                    .Include(c => c.Unit)
                    .Include(c => c.Lease)
                    .Include(c => c.Tenant)
                    .Include(c => c.Items.OrderBy(i => i.SortOrder).ThenBy(i => i.Id))
                    .Where(c => c.LandlordId == landlordId)
                    .OrderByDescending(c => c.InspectionDate)
                    .ToListAsync();

                return checklists.Select(MapToDto).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving checklists for landlord {LandlordId}", landlordId);
                throw;
            }
        }

        public async Task<List<LoadChecklistDto>> GetChecklistsByPropertyId(long propertyId)
        {
            try
            {
                var checklists = await _context.Checklists
                    .Include(c => c.Property)
                    .Include(c => c.Unit)
                    .Include(c => c.Lease)
                    .Include(c => c.Tenant)
                    .Include(c => c.Items.OrderBy(i => i.SortOrder).ThenBy(i => i.Id))
                    .Where(c => c.PropertyId == propertyId)
                    .OrderByDescending(c => c.InspectionDate)
                    .ToListAsync();

                return checklists.Select(MapToDto).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving checklists for property {PropertyId}", propertyId);
                throw;
            }
        }

        public async Task<List<LoadChecklistDto>> GetChecklistsByUnitId(long unitId)
        {
            try
            {
                var checklists = await _context.Checklists
                    .Include(c => c.Property)
                    .Include(c => c.Unit)
                    .Include(c => c.Lease)
                    .Include(c => c.Tenant)
                    .Include(c => c.Items.OrderBy(i => i.SortOrder).ThenBy(i => i.Id))
                    .Where(c => c.UnitId == unitId)
                    .OrderByDescending(c => c.InspectionDate)
                    .ToListAsync();

                return checklists.Select(MapToDto).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving checklists for unit {UnitId}", unitId);
                throw;
            }
        }

        public async Task<List<LoadChecklistDto>> GetChecklistsByLeaseId(long leaseId)
        {
            try
            {
                var checklists = await _context.Checklists
                    .Include(c => c.Property)
                    .Include(c => c.Unit)
                    .Include(c => c.Lease)
                    .Include(c => c.Tenant)
                    .Include(c => c.Items.OrderBy(i => i.SortOrder).ThenBy(i => i.Id))
                    .Where(c => c.LeaseId == leaseId)
                    .OrderByDescending(c => c.InspectionDate)
                    .ToListAsync();

                return checklists.Select(MapToDto).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving checklists for lease {LeaseId}", leaseId);
                throw;
            }
        }

        public async Task<List<LoadChecklistDto>> GetChecklistsByType(long landlordId, ETenantDocumentType checklistType)
        {
            try
            {
                var checklists = await _context.Checklists
                    .Include(c => c.Property)
                    .Include(c => c.Unit)
                    .Include(c => c.Lease)
                    .Include(c => c.Tenant)
                    .Include(c => c.Items.OrderBy(i => i.SortOrder).ThenBy(i => i.Id))
                    .Where(c => c.LandlordId == landlordId && c.ChecklistType == checklistType)
                    .OrderByDescending(c => c.InspectionDate)
                    .ToListAsync();

                return checklists.Select(MapToDto).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving checklists for landlord {LandlordId} with type {ChecklistType}", landlordId, checklistType);
                throw;
            }
        }

        public async Task<List<LoadChecklistDto>> GetChecklistsByOrganizationId(long organizationId)
        {
            try
            {
                var checklists = await _context.Checklists
                    .Include(c => c.Property)
                    .Include(c => c.Unit)
                    .Include(c => c.Lease)
                    .Include(c => c.Tenant)
                    .Include(c => c.Items.OrderBy(i => i.SortOrder).ThenBy(i => i.Id))
                    .Where(c => c.OrganizationId == organizationId)
                    .OrderByDescending(c => c.InspectionDate)
                    .ToListAsync();

                return checklists.Select(MapToDto).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving checklists for organization {OrganizationId}", organizationId);
                throw;
            }
        }

        public async Task<List<LoadChecklistDto>> GetChecklistsByTypeAndOrganizationId(long organizationId, ETenantDocumentType checklistType)
        {
            try
            {
                var checklists = await _context.Checklists
                    .Include(c => c.Property)
                    .Include(c => c.Unit)
                    .Include(c => c.Lease)
                    .Include(c => c.Tenant)
                    .Include(c => c.Items.OrderBy(i => i.SortOrder).ThenBy(i => i.Id))
                    .Where(c => c.OrganizationId == organizationId && c.ChecklistType == checklistType)
                    .OrderByDescending(c => c.InspectionDate)
                    .ToListAsync();

                return checklists.Select(MapToDto).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving checklists for organization {OrganizationId} with type {ChecklistType}", organizationId, checklistType);
                throw;
            }
        }

        public async Task<LoadChecklistDto> UpdateChecklist(UpdateChecklistDto checklist)
        {
            try
            {
                var entity = await _context.Checklists
                    .Include(c => c.Items)
                    .FirstOrDefaultAsync(c => c.Id == checklist.Id)
                    ?? throw new KeyNotFoundException($"Checklist with ID {checklist.Id} not found.");

            // Update checklist fields
            if (!string.IsNullOrEmpty(checklist.Title)) entity.Title = checklist.Title;
            if (checklist.LeaseId.HasValue) entity.LeaseId = checklist.LeaseId.Value;
            if (checklist.InspectionDate.HasValue) entity.InspectionDate = checklist.InspectionDate.Value;
            if (checklist.CompletedAt.HasValue) entity.CompletedAt = checklist.CompletedAt.Value;
            if (checklist.IsCompleted.HasValue) entity.IsCompleted = checklist.IsCompleted.Value;
            if (checklist.ConductedBy.HasValue) entity.ConductedBy = checklist.ConductedBy.Value;
            if (checklist.TenantSignature != null) entity.TenantSignature = checklist.TenantSignature;
            if (checklist.LandlordSignature != null) entity.LandlordSignature = checklist.LandlordSignature;
            if (checklist.TenantSignedAt.HasValue) entity.TenantSignedAt = checklist.TenantSignedAt.Value;
            if (checklist.LandlordSignedAt.HasValue) entity.LandlordSignedAt = checklist.LandlordSignedAt.Value;
            if (checklist.GeneralNotes != null) entity.GeneralNotes = checklist.GeneralNotes;
            if (checklist.ConditionNotes != null) entity.ConditionNotes = checklist.ConditionNotes;
            
            // Update image arrays
            if (checklist.BeforeMoveInImagesBlobNames != null)
            {
                entity.BeforeMoveInImagesBlobNames = checklist.BeforeMoveInImagesBlobNames.Any() 
                    ? JsonSerializer.Serialize(checklist.BeforeMoveInImagesBlobNames) 
                    : null;
            }
            if (checklist.BeforeMoveInImagesUrls != null)
            {
                entity.BeforeMoveInImagesUrls = checklist.BeforeMoveInImagesUrls.Any() 
                    ? JsonSerializer.Serialize(checklist.BeforeMoveInImagesUrls) 
                    : null;
            }
            if (checklist.AfterMoveOutImagesBlobNames != null)
            {
                entity.AfterMoveOutImagesBlobNames = checklist.AfterMoveOutImagesBlobNames.Any() 
                    ? JsonSerializer.Serialize(checklist.AfterMoveOutImagesBlobNames) 
                    : null;
            }
            if (checklist.AfterMoveOutImagesUrls != null)
            {
                entity.AfterMoveOutImagesUrls = checklist.AfterMoveOutImagesUrls.Any() 
                    ? JsonSerializer.Serialize(checklist.AfterMoveOutImagesUrls) 
                    : null;
            }

            // Update items
            if (checklist.Items != null)
            {
                // Get existing item IDs
                var existingItemIds = checklist.Items.Where(i => i.Id.HasValue).Select(i => i.Id!.Value).ToList();
                
                // Remove items that are no longer in the update
                var itemsToRemove = entity.Items.Where(i => !existingItemIds.Contains(i.Id)).ToList();
                foreach (var item in itemsToRemove)
                {
                    _context.ChecklistItems.Remove(item);
                }

                // Update or add items
                foreach (var itemDto in checklist.Items)
                {
                    if (itemDto.Id.HasValue)
                    {
                        // Update existing item
                        var existingItem = entity.Items.FirstOrDefault(i => i.Id == itemDto.Id.Value);
                        if (existingItem != null)
                        {
                            if (!string.IsNullOrEmpty(itemDto.Name)) existingItem.Name = itemDto.Name;
                            if (itemDto.Description != null) existingItem.Description = itemDto.Description;
                            if (itemDto.Category != null) existingItem.Category = itemDto.Category;
                            if (itemDto.Condition != null) existingItem.Condition = itemDto.Condition;
                            if (itemDto.Notes != null) existingItem.Notes = itemDto.Notes;
                            if (itemDto.HasDamage.HasValue) existingItem.HasDamage = itemDto.HasDamage.Value;
                            if (itemDto.DamageDescription != null) existingItem.DamageDescription = itemDto.DamageDescription;
                            if (itemDto.PhotoBlobNames != null)
                                existingItem.PhotoBlobNames = itemDto.PhotoBlobNames.Any() ? JsonSerializer.Serialize(itemDto.PhotoBlobNames) : null;
                            if (itemDto.PhotoBlobUrls != null)
                                existingItem.PhotoBlobUrls = itemDto.PhotoBlobUrls.Any() ? JsonSerializer.Serialize(itemDto.PhotoBlobUrls) : null;
                            if (itemDto.IsChecked.HasValue)
                            {
                                existingItem.IsChecked = itemDto.IsChecked.Value;
                                existingItem.CheckedAt = itemDto.IsChecked.Value ? DateTime.Now : null;
                            }
                            if (itemDto.CheckedAt.HasValue) existingItem.CheckedAt = itemDto.CheckedAt.Value;
                            if (itemDto.SortOrder.HasValue) existingItem.SortOrder = itemDto.SortOrder.Value;
                        }
                    }
                    else
                    {
                        // Add new item
                        entity.Items.Add(new Models.ChecklistItem
                        {
                            Name = itemDto.Name ?? string.Empty,
                            Description = itemDto.Description,
                            Category = itemDto.Category,
                            Condition = itemDto.Condition,
                            Notes = itemDto.Notes,
                            HasDamage = itemDto.HasDamage ?? false,
                            DamageDescription = itemDto.DamageDescription,
                            PhotoBlobNames = itemDto.PhotoBlobNames != null && itemDto.PhotoBlobNames.Any() ? JsonSerializer.Serialize(itemDto.PhotoBlobNames) : null,
                            PhotoBlobUrls = itemDto.PhotoBlobUrls != null && itemDto.PhotoBlobUrls.Any() ? JsonSerializer.Serialize(itemDto.PhotoBlobUrls) : null,
                            IsChecked = itemDto.IsChecked ?? false,
                            CheckedAt = itemDto.IsChecked == true ? DateTime.Now : null,
                            SortOrder = itemDto.SortOrder ?? 0
                        });
                    }
                }
            }

            entity.UpdatedAt = DateTime.Now;

            await _context.SaveChangesAsync();

            // Reload with related entities
            await _context.Entry(entity).Reference(e => e.Property).LoadAsync();
            if (entity.UnitId.HasValue)
            {
                await _context.Entry(entity).Reference(e => e.Unit).LoadAsync();
            }
            if (entity.LeaseId.HasValue)
            {
                await _context.Entry(entity).Reference(e => e.Lease).LoadAsync();
            }
            if (entity.TenantId.HasValue)
            {
                await _context.Entry(entity).Reference(e => e.Tenant).LoadAsync();
            }
            await _context.Entry(entity).Collection(e => e.Items).LoadAsync();

                return MapToDto(entity);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating checklist {ChecklistId}", checklist.Id);
                throw;
            }
        }

        public async Task<LoadChecklistDto> UpdateChecklistItemPhoto(long checklistId, long itemId, string blobName, string blobUrl)
        {
            try
            {
                var item = await _context.ChecklistItems
                    .FirstOrDefaultAsync(i => i.Id == itemId && i.ChecklistId == checklistId)
                    ?? throw new KeyNotFoundException($"Item {itemId} not found in checklist {checklistId}");

                // Append to multi-photo arrays
                var names = string.IsNullOrEmpty(item.PhotoBlobNames)
                    ? new List<string>()
                    : JsonSerializer.Deserialize<List<string>>(item.PhotoBlobNames) ?? new List<string>();
                var urls = string.IsNullOrEmpty(item.PhotoBlobUrls)
                    ? new List<string>()
                    : JsonSerializer.Deserialize<List<string>>(item.PhotoBlobUrls) ?? new List<string>();

                names.Add(blobName);
                urls.Add(blobUrl);

                item.PhotoBlobNames = JsonSerializer.Serialize(names);
                item.PhotoBlobUrls = JsonSerializer.Serialize(urls);

                await _context.SaveChangesAsync();

                var entity = await _context.Checklists
                    .Include(c => c.Property)
                    .Include(c => c.Unit)
                    .Include(c => c.Lease)
                    .Include(c => c.Tenant)
                    .Include(c => c.Items.OrderBy(i => i.SortOrder).ThenBy(i => i.Id))
                    .FirstAsync(c => c.Id == checklistId);

                return MapToDto(entity);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating photo for item {ItemId} in checklist {ChecklistId}", itemId, checklistId);
                throw;
            }
        }

        public async Task<LoadChecklistDto> DeleteChecklistItemPhoto(long checklistId, long itemId, string blobName)
        {
            try
            {
                var item = await _context.ChecklistItems
                    .FirstOrDefaultAsync(i => i.Id == itemId && i.ChecklistId == checklistId)
                    ?? throw new KeyNotFoundException($"Item {itemId} not found in checklist {checklistId}");

                var names = string.IsNullOrEmpty(item.PhotoBlobNames)
                    ? new List<string>()
                    : JsonSerializer.Deserialize<List<string>>(item.PhotoBlobNames) ?? new List<string>();
                var urls = string.IsNullOrEmpty(item.PhotoBlobUrls)
                    ? new List<string>()
                    : JsonSerializer.Deserialize<List<string>>(item.PhotoBlobUrls) ?? new List<string>();

                var idx = names.IndexOf(blobName);
                if (idx >= 0)
                {
                    names.RemoveAt(idx);
                    if (urls.Count > idx) urls.RemoveAt(idx);
                }

                item.PhotoBlobNames = names.Any() ? JsonSerializer.Serialize(names) : null;
                item.PhotoBlobUrls = urls.Any() ? JsonSerializer.Serialize(urls) : null;

                await _context.SaveChangesAsync();

                var entity = await _context.Checklists
                    .Include(c => c.Property)
                    .Include(c => c.Unit)
                    .Include(c => c.Lease)
                    .Include(c => c.Tenant)
                    .Include(c => c.Items.OrderBy(i => i.SortOrder).ThenBy(i => i.Id))
                    .FirstAsync(c => c.Id == checklistId);

                return MapToDto(entity);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting photo {BlobName} from item {ItemId} in checklist {ChecklistId}", blobName, itemId, checklistId);
                throw;
            }
        }

        public async Task<bool> DeleteChecklist(long id)
        {
            try
            {
                var entity = await _context.Checklists.FindAsync(id);
                if (entity == null)
                {
                    return false;
                }

                _context.Checklists.Remove(entity);
                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting checklist {ChecklistId}", id);
                throw;
            }
        }

        private static LoadChecklistDto MapToDto(Models.Checklist checklist)
        {
            return new LoadChecklistDto
            {
                Id = checklist.Id,
                ChecklistType = checklist.ChecklistType,
                ChecklistTypeName = checklist.ChecklistType == ETenantDocumentType.MoveInChecklist 
                    ? "Move-In Checklist" 
                    : checklist.ChecklistType == ETenantDocumentType.MoveOutChecklist 
                        ? "Move-Out Checklist" 
                        : checklist.ChecklistType.ToString(),
                PropertyId = checklist.PropertyId,
                PropertyName = checklist.Property?.Name ?? string.Empty,
                UnitId = checklist.UnitId,
                UnitName = checklist.Unit?.Name ?? null,
                LeaseId = checklist.LeaseId,
                LeaseStartDate = checklist.Lease?.StartDate,
                LeaseEndDate = checklist.Lease?.EndDate,
                TenantId = checklist.TenantId,
                TenantName = checklist.Tenant != null 
                    ? $"{checklist.Tenant.Firstname} {checklist.Tenant.Lastname}" 
                    : null,
                Title = checklist.Title,
                InspectionDate = checklist.InspectionDate,
                CompletedAt = checklist.CompletedAt,
                IsCompleted = checklist.IsCompleted,
                ConductedBy = checklist.ConductedBy,
                TenantSignature = checklist.TenantSignature,
                LandlordSignature = checklist.LandlordSignature,
                TenantSignedAt = checklist.TenantSignedAt,
                LandlordSignedAt = checklist.LandlordSignedAt,
                GeneralNotes = checklist.GeneralNotes,
                ConditionNotes = checklist.ConditionNotes,
                BeforeMoveInImagesBlobNames = !string.IsNullOrEmpty(checklist.BeforeMoveInImagesBlobNames) 
                    ? JsonSerializer.Deserialize<List<string>>(checklist.BeforeMoveInImagesBlobNames) 
                    : null,
                BeforeMoveInImagesUrls = !string.IsNullOrEmpty(checklist.BeforeMoveInImagesUrls) 
                    ? JsonSerializer.Deserialize<List<string>>(checklist.BeforeMoveInImagesUrls) 
                    : null,
                AfterMoveOutImagesBlobNames = !string.IsNullOrEmpty(checklist.AfterMoveOutImagesBlobNames) 
                    ? JsonSerializer.Deserialize<List<string>>(checklist.AfterMoveOutImagesBlobNames) 
                    : null,
                AfterMoveOutImagesUrls = !string.IsNullOrEmpty(checklist.AfterMoveOutImagesUrls) 
                    ? JsonSerializer.Deserialize<List<string>>(checklist.AfterMoveOutImagesUrls) 
                    : null,
                LandlordId = checklist.LandlordId,
                Items = checklist.Items.Select(i => new LoadChecklistItemDto
                {
                    Id = i.Id,
                    Name = i.Name,
                    Description = i.Description,
                    Category = i.Category,
                    Condition = i.Condition,
                    Notes = i.Notes,
                    HasDamage = i.HasDamage,
                    DamageDescription = i.DamageDescription,
                    PhotoBlobNames = !string.IsNullOrEmpty(i.PhotoBlobNames)
                        ? JsonSerializer.Deserialize<List<string>>(i.PhotoBlobNames)
                        : null,
                    PhotoBlobUrls = !string.IsNullOrEmpty(i.PhotoBlobUrls)
                        ? JsonSerializer.Deserialize<List<string>>(i.PhotoBlobUrls)
                        : null,
                    IsChecked = i.IsChecked,
                    CheckedAt = i.CheckedAt,
                    SortOrder = i.SortOrder
                }).ToList(),
                CreatedAt = checklist.CreatedAt,
                UpdatedAt = checklist.UpdatedAt
            };
        }

        public async Task<int> DeleteChecklistsByPropertyId(long propertyId)
        {
            try
            {
                var checklists = await _context.Checklists
                    .Where(c => c.PropertyId == propertyId)
                    .ToListAsync();
                
                _context.Checklists.RemoveRange(checklists);
                await _context.SaveChangesAsync();
                
                return checklists.Count;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting checklists for property {PropertyId}", propertyId);
                throw;
            }
        }
    }
}

