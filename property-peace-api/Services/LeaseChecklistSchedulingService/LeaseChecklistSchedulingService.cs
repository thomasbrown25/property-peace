using brownstone_hub_api.Dtos.Checklist;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Repositories.Checklists;
using brownstone_hub_api.Repositories.Leases;

namespace brownstone_hub_api.Services.LeaseChecklistSchedulingService
{
    public class LeaseChecklistSchedulingService : ILeaseChecklistSchedulingService
    {
        private readonly ILeaseRepository _leaseRepository;
        private readonly IChecklistRepository _checklistRepository;
        private readonly IOrganizationChecklistItemRepository _organizationChecklistItemRepository;
        private readonly ILogger<LeaseChecklistSchedulingService> _logger;

        public LeaseChecklistSchedulingService(
            ILeaseRepository leaseRepository,
            IChecklistRepository checklistRepository,
            IOrganizationChecklistItemRepository organizationChecklistItemRepository,
            ILogger<LeaseChecklistSchedulingService> logger)
        {
            _leaseRepository = leaseRepository;
            _checklistRepository = checklistRepository;
            _organizationChecklistItemRepository = organizationChecklistItemRepository;
            _logger = logger;
        }

        public async Task ProcessDueChecklistsAsync(DateTime? asOfDate = null)
        {
            var date = (asOfDate ?? DateTime.UtcNow).Date;
            var candidates = await _leaseRepository.GetLeasesDueForStartDateChecklist(date);
            _logger.LogInformation(
                "Lease checklist scheduling: found {Count} eligible lease(s) as of {Date}",
                candidates.Count,
                date);

            foreach (var lease in candidates)
            {
                if (!lease.OrganizationId.HasValue || lease.LandlordId <= 0)
                    continue;

                try
                {
                    var existing = await _checklistRepository.GetChecklistsByLeaseId(lease.Id);
                    if (existing.Any(c => c.ChecklistType == ETenantDocumentType.MoveInChecklist))
                    {
                        _logger.LogInformation(
                            "Lease checklist scheduling: move-in checklist already exists for lease {LeaseId}",
                            lease.Id);
                        continue;
                    }

                    var templates = await _organizationChecklistItemRepository
                        .GetOrganizationChecklistItemsByOrganizationId(lease.OrganizationId.Value);
                    if (!templates.Any(item => item.IsDefault))
                    {
                        await _organizationChecklistItemRepository
                            .SeedDefaultChecklistItems(lease.OrganizationId.Value);
                        templates = await _organizationChecklistItemRepository
                            .GetOrganizationChecklistItemsByOrganizationId(lease.OrganizationId.Value);
                    }

                    var checklist = new AddChecklistDto
                    {
                        ChecklistType = ETenantDocumentType.MoveInChecklist,
                        PropertyId = lease.PropertyId,
                        UnitId = lease.UnitId,
                        LeaseId = lease.Id,
                        InspectionDate = lease.StartDate,
                        Title = $"{(string.IsNullOrWhiteSpace(lease.UnitName) ? $"Unit {lease.UnitId}" : lease.UnitName)} - Move-In Checklist",
                        Items = templates
                            .Where(item => item.IsDefault)
                            .OrderBy(item => item.SortOrder)
                            .Select(item => new AddChecklistItemDto
                            {
                                Name = item.Name,
                                Description = item.Description,
                                Category = item.Category,
                                SortOrder = item.SortOrder
                            })
                            .ToList()
                    };

                    await _checklistRepository.AddChecklist(
                        checklist,
                        lease.LandlordId,
                        lease.OrganizationId.Value);

                    _logger.LogInformation(
                        "Lease checklist scheduling: created move-in checklist for lease {LeaseId}",
                        lease.Id);
                }
                catch (Exception ex)
                {
                    _logger.LogError(
                        ex,
                        "Lease checklist scheduling failed for lease {LeaseId}",
                        lease.Id);
                }
            }
        }
    }
}
