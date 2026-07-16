using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Checklist;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.Checklists
{
    public class MoveInReportTemplateRepository(DataContext context, ILogger<MoveInReportTemplateRepository> logger) : IMoveInReportTemplateRepository
    {
        private readonly DataContext _context = context;
        private readonly ILogger<MoveInReportTemplateRepository> _logger = logger;

        public async Task<LoadMoveInReportTemplateDto?> GetByOrganizationId(long organizationId)
        {
            try
            {
                var template = await _context.OrganizationMoveInReportTemplates
                    .AsNoTracking()
                    .Include(t => t.Spaces.OrderBy(s => s.SortOrder))
                    .ThenInclude(s => s.Items.OrderBy(i => i.SortOrder))
                    .FirstOrDefaultAsync(t => t.OrganizationId == organizationId);

                return template == null ? null : MapToDto(template);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving move-in report template for organization {OrganizationId}", organizationId);
                throw;
            }
        }

        public async Task<LoadMoveInReportTemplateDto> AddOrUpdate(long organizationId, AddOrUpdateMoveInReportTemplateDto dto)
        {
            try
            {
                var existing = await _context.OrganizationMoveInReportTemplates
                    .Include(t => t.Spaces)
                    .ThenInclude(s => s.Items)
                    .FirstOrDefaultAsync(t => t.OrganizationId == organizationId);

                if (existing != null)
                {
                    _context.OrganizationReportSpaceItems.RemoveRange(existing.Spaces.SelectMany(s => s.Items));
                    _context.OrganizationReportSpaces.RemoveRange(existing.Spaces);
                    _context.OrganizationMoveInReportTemplates.Remove(existing);
                    await _context.SaveChangesAsync();
                }

                var template = new OrganizationMoveInReportTemplate
                {
                    OrganizationId = organizationId,
                    Name = dto.Name ?? "Move-in Condition Report",
                    CreatedAt = DateTime.Now,
                    UpdatedAt = DateTime.Now
                };
                await _context.OrganizationMoveInReportTemplates.AddAsync(template);
                await _context.SaveChangesAsync();

                for (var i = 0; i < dto.Spaces.Count; i++)
                {
                    var spaceDto = dto.Spaces[i];
                    var space = new OrganizationReportSpace
                    {
                        TemplateId = template.Id,
                        SpaceLabel = spaceDto.SpaceLabel,
                        CustomName = spaceDto.CustomName,
                        Quantity = spaceDto.Quantity,
                        SortOrder = spaceDto.SortOrder
                    };
                    await _context.OrganizationReportSpaces.AddAsync(space);
                    await _context.SaveChangesAsync();

                    for (var j = 0; j < spaceDto.Items.Count; j++)
                    {
                        var itemDto = spaceDto.Items[j];
                        await _context.OrganizationReportSpaceItems.AddAsync(new OrganizationReportSpaceItem
                        {
                            SpaceId = space.Id,
                            ItemName = itemDto.ItemName,
                            SortOrder = itemDto.SortOrder
                        });
                    }
                }
                await _context.SaveChangesAsync();

                var reloaded = await _context.OrganizationMoveInReportTemplates
                    .AsNoTracking()
                    .Include(t => t.Spaces.OrderBy(s => s.SortOrder))
                    .ThenInclude(s => s.Items.OrderBy(i => i.SortOrder))
                    .FirstAsync(t => t.Id == template.Id);
                return MapToDto(reloaded);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding/updating move-in report template for organization {OrganizationId}", organizationId);
                throw;
            }
        }

        private static LoadMoveInReportTemplateDto MapToDto(OrganizationMoveInReportTemplate t)
        {
            return new LoadMoveInReportTemplateDto
            {
                Id = t.Id,
                OrganizationId = t.OrganizationId,
                Name = t.Name,
                CreatedAt = t.CreatedAt,
                UpdatedAt = t.UpdatedAt,
                Spaces = t.Spaces.Select(s => new LoadMoveInReportTemplateSpaceDto
                {
                    Id = s.Id,
                    SpaceLabel = s.SpaceLabel,
                    CustomName = s.CustomName,
                    Quantity = s.Quantity,
                    SortOrder = s.SortOrder,
                    Items = s.Items.Select(i => new LoadMoveInReportTemplateSpaceItemDto
                    {
                        Id = i.Id,
                        ItemName = i.ItemName,
                        SortOrder = i.SortOrder
                    }).ToList()
                }).ToList()
            };
        }
    }
}
