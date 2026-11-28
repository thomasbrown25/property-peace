using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Checklist;
using brownstone_hub_api.Dtos.LeaseTransitionChecklist;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Checklists;
using brownstone_hub_api.Repositories.Users;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.LeaseTransitionChecklistService
{
    public class LeaseTransitionChecklistService(
        DataContext context,
        IUserRepository users,
        IOrganizationChecklistItemRepository organizationItems,
        IHttpContextAccessor httpContextAccessor) : ILeaseTransitionChecklistService
    {
        private readonly DataContext _context = context;
        private readonly IUserRepository _users = users;
        private readonly IOrganizationChecklistItemRepository _organizationItems = organizationItems;
        private readonly IHttpContextAccessor _httpContext = httpContextAccessor;

        public async Task<ServiceResponse<List<LoadLeaseTransitionChecklistDto>>> List(long? propertyId, long? unitId, long? leaseId)
        {
            var scope = await GetScope();
            if (scope is null) return Unauthorized<List<LoadLeaseTransitionChecklistDto>>();
            var query = _context.LeaseTransitionChecklists.AsNoTracking().Include(x => x.Items).Include(x => x.Property).Include(x => x.Unit).Include(x => x.ConditionReport).ThenInclude(x => x!.Items)
                .Where(x => x.OrganizationId == scope.Value.OrganizationId && x.LandlordId == scope.Value.UserId &&
                    x.Property.OrganizationId == scope.Value.OrganizationId && x.Property.LandlordId == scope.Value.UserId && !x.Property.IsDeleted);
            if (propertyId.HasValue) query = query.Where(x => x.PropertyId == propertyId.Value);
            if (unitId.HasValue) query = query.Where(x => x.UnitId == unitId.Value);
            if (leaseId.HasValue) query = query.Where(x => x.LeaseId == leaseId.Value);
            var rows = await query.OrderByDescending(x => x.UpdatedAt ?? x.CreatedAt).ToListAsync();
            return new ServiceResponse<List<LoadLeaseTransitionChecklistDto>> { Success = true, Data = rows.Select(Map).ToList() };
        }

        public async Task<ServiceResponse<LoadLeaseTransitionChecklistDto>> Get(long id)
        {
            var entity = await FindOwned(id);
            return entity is null ? NotFound<LoadLeaseTransitionChecklistDto>() : new ServiceResponse<LoadLeaseTransitionChecklistDto> { Success = true, Data = Map(entity) };
        }

        public async Task<ServiceResponse<LoadLeaseTransitionChecklistDto>> Create(CreateLeaseTransitionChecklistDto dto)
        {
            var scope = await GetScope();
            if (scope is null) return Unauthorized<LoadLeaseTransitionChecklistDto>();
            dto.RequestId = dto.RequestId?.Trim() ?? string.Empty;
            if (dto.PropertyId <= 0 || dto.RequestId.Length is 0 or > 64) return BadRequest<LoadLeaseTransitionChecklistDto>("Property and a valid request ID are required.");
            if (!Enum.IsDefined(dto.Phase)) return BadRequest<LoadLeaseTransitionChecklistDto>("The handoff phase is invalid.");
            var property = await _context.Properties.AsNoTracking().FirstOrDefaultAsync(x => x.Id == dto.PropertyId && x.OrganizationId == scope.Value.OrganizationId && x.LandlordId == scope.Value.UserId && !x.IsDeleted);
            if (property is null) return NotFound<LoadLeaseTransitionChecklistDto>();
            if (dto.LeaseId.HasValue)
            {
                var lease = await _context.Leases.Include(x => x.Unit).FirstOrDefaultAsync(x => x.Id == dto.LeaseId.Value && x.OrganizationId == scope.Value.OrganizationId && !x.IsDeleted);
                if (lease is null || lease.Unit.PropertyId != dto.PropertyId) return BadRequest<LoadLeaseTransitionChecklistDto>("The selected lease does not belong to this property.");
                if (dto.UnitId.HasValue && dto.UnitId.Value != lease.UnitId) return BadRequest<LoadLeaseTransitionChecklistDto>("The selected lease does not belong to this unit.");
                dto.UnitId = lease.UnitId;
            }
            if (dto.UnitId.HasValue && !await _context.Units.AnyAsync(x => x.Id == dto.UnitId.Value && x.PropertyId == dto.PropertyId))
                return BadRequest<LoadLeaseTransitionChecklistDto>("The selected unit does not belong to this property.");
            if (PropertyTypeClassification.IsMultiUnit(property.PropertyType.ToString()) && !dto.UnitId.HasValue)
                return BadRequest<LoadLeaseTransitionChecklistDto>("A unit is required for this property.");
            var existing = await LoadOwnedByRequest(scope.Value, dto.RequestId);
            if (existing is not null)
            {
                if (existing.PropertyId != dto.PropertyId || existing.UnitId != dto.UnitId || existing.LeaseId != dto.LeaseId || existing.Phase != dto.Phase)
                    return BadRequest<LoadLeaseTransitionChecklistDto>("That request ID was already used for a different handoff.");
                return Success(Map(existing));
            }
            if (dto.LeaseId.HasValue)
            {
                existing = await _context.LeaseTransitionChecklists.Include(x => x.Items).Include(x => x.ConditionReport).ThenInclude(x => x!.Items)
                    .FirstOrDefaultAsync(x => x.OrganizationId == scope.Value.OrganizationId && x.LandlordId == scope.Value.UserId && x.LeaseId == dto.LeaseId && x.Phase == dto.Phase);
                if (existing is not null) return Success(Map(existing));
                if (await _context.LeaseTransitionChecklists.AnyAsync(x => x.OrganizationId == scope.Value.OrganizationId && x.LeaseId == dto.LeaseId && x.Phase == dto.Phase))
                    return Conflict<LoadLeaseTransitionChecklistDto>("A handoff checklist already exists for this lease.");
            }
            var entity = new LeaseTransitionChecklist { OrganizationId = scope.Value.OrganizationId, LandlordId = scope.Value.UserId, PropertyId = dto.PropertyId, UnitId = dto.UnitId, LeaseId = dto.LeaseId, Phase = dto.Phase, RequestId = dto.RequestId, Items = DefaultItems(dto.Phase) };
            try
            {
                _context.LeaseTransitionChecklists.Add(entity);
                await _context.SaveChangesAsync();
                var loaded = await FindOwned(entity.Id);
                return loaded is null ? NotFound<LoadLeaseTransitionChecklistDto>() : Success(Map(loaded), "Transition checklist created");
            }
            catch (DbUpdateException)
            {
                _context.ChangeTracker.Clear();
                existing = await LoadOwnedByRequest(scope.Value, dto.RequestId);
                if (existing is not null) return Success(Map(existing));
                if (dto.LeaseId.HasValue)
                {
                    existing = await _context.LeaseTransitionChecklists.Include(x => x.Items).Include(x => x.ConditionReport).ThenInclude(x => x!.Items)
                        .FirstOrDefaultAsync(x => x.OrganizationId == scope.Value.OrganizationId && x.LandlordId == scope.Value.UserId && x.LeaseId == dto.LeaseId && x.Phase == dto.Phase);
                    if (existing is not null) return Success(Map(existing));
                    if (await _context.LeaseTransitionChecklists.AnyAsync(x => x.OrganizationId == scope.Value.OrganizationId && x.LeaseId == dto.LeaseId && x.Phase == dto.Phase))
                        return Conflict<LoadLeaseTransitionChecklistDto>("A handoff checklist already exists for this lease.");
                }
                throw;
            }
        }

        public async Task<ServiceResponse<LoadLeaseTransitionChecklistDto>> UpdateItem(long id, string key, UpdateLeaseTransitionChecklistItemDto dto)
        {
            var entity = await FindOwned(id);
            if (entity is null) return NotFound<LoadLeaseTransitionChecklistDto>();
            var item = entity.Items.SingleOrDefault(x => x.Key == key);
            if (item is null) return NotFound<LoadLeaseTransitionChecklistDto>();
            if (!Enum.IsDefined(dto.Status)) return BadRequest<LoadLeaseTransitionChecklistDto>("The item status is invalid.");
            if (item.Key == "condition-report" || (!item.AllowNotApplicable && dto.Status == ELeaseTransitionItemStatus.NotApplicable)) return BadRequest<LoadLeaseTransitionChecklistDto>("This item cannot be marked not applicable.");
            item.Status = dto.Status;
            item.NotApplicableReason = dto.Status == ELeaseTransitionItemStatus.NotApplicable ? dto.NotApplicableReason?.Trim() : null;
            item.CompletedAt = dto.Status == ELeaseTransitionItemStatus.Done ? DateTime.UtcNow : null;
            entity.UpdatedAt = DateTime.UtcNow;
            try
            {
                await _context.SaveChangesAsync();
                return Success(Map(entity));
            }
            catch (DbUpdateConcurrencyException)
            {
                return Conflict<LoadLeaseTransitionChecklistDto>("The checklist changed while it was being updated. Refresh and try again.");
            }
        }

        public async Task<ServiceResponse<LoadLeaseTransitionChecklistDto>> LinkConditionReport(long id, LinkConditionReportDto dto)
        {
            var entity = await FindOwned(id);
            if (entity is null) return NotFound<LoadLeaseTransitionChecklistDto>();
            if (dto.ConditionReportId.HasValue)
            {
                var report = await _context.Checklists.Include(x => x.Items).FirstOrDefaultAsync(x =>
                    x.Id == dto.ConditionReportId.Value && x.PropertyId == entity.PropertyId && x.LandlordId == entity.LandlordId &&
                    (x.OrganizationId == entity.OrganizationId || (x.OrganizationId == null && x.ChecklistType != ETenantDocumentType.ConditionReport)));
                var reportIsEligibleType = report?.ChecklistType is ETenantDocumentType.ConditionReport or ETenantDocumentType.MoveInChecklist or ETenantDocumentType.MoveOutChecklist;
                var unitMatches = report is not null && await IsEligibleReportUnit(report, entity);
                if (report is null || !reportIsEligibleType || report.PropertyId != entity.PropertyId || !unitMatches || (entity.LeaseId.HasValue && report.LeaseId.HasValue && report.LeaseId != entity.LeaseId)) return BadRequest<LoadLeaseTransitionChecklistDto>("That condition report does not belong to this handoff.");
                if (await _context.LeaseTransitionChecklists.AnyAsync(x => x.ConditionReportId == report.Id && x.Id != entity.Id)) return BadRequest<LoadLeaseTransitionChecklistDto>("That condition report is already linked to another handoff.");
                entity.ConditionReport = report;
            }
            else if (!entity.ConditionReportId.HasValue)
            {
                var templates = await _organizationItems.GetOrganizationChecklistItemsByOrganizationId(entity.OrganizationId);
                if (templates.Count == 0) { await _organizationItems.SeedDefaultChecklistItems(entity.OrganizationId); templates = await _organizationItems.GetOrganizationChecklistItemsByOrganizationId(entity.OrganizationId); }
                var report = new Checklist { ChecklistType = ETenantDocumentType.ConditionReport, PropertyId = entity.PropertyId, UnitId = entity.UnitId, LeaseId = entity.LeaseId, LandlordId = entity.LandlordId, OrganizationId = entity.OrganizationId, RequestId = dto.RequestId, Title = "Condition Report", InspectionDate = DateTime.UtcNow, Items = templates.Select(x => new ChecklistItem { Name = x.Name, Description = x.Description, Category = x.Category, SortOrder = x.SortOrder }).ToList() };
                entity.ConditionReport = report;
            }
            entity.UpdatedAt = DateTime.UtcNow;
            try
            {
                await _context.SaveChangesAsync();
                return Success(Map(entity));
            }
            catch (DbUpdateConcurrencyException)
            {
                _context.ChangeTracker.Clear();
                var current = await FindOwned(id);
                if (current?.ConditionReportId is long linkedId && (!dto.ConditionReportId.HasValue || linkedId == dto.ConditionReportId.Value)) return Success(Map(current));
                return Conflict<LoadLeaseTransitionChecklistDto>("The checklist changed while the condition report was being linked. Refresh and try again.");
            }
            catch (DbUpdateException)
            {
                _context.ChangeTracker.Clear();
                var current = await FindOwned(id);
                if (current?.ConditionReportId is long linkedId && (!dto.ConditionReportId.HasValue || linkedId == dto.ConditionReportId.Value)) return Success(Map(current));
                return Conflict<LoadLeaseTransitionChecklistDto>("The condition report was linked by another handoff. Refresh and try again.");
            }
        }

        public async Task<ServiceResponse<LoadLeaseTransitionChecklistDto>> DetachConditionReport(long id)
        {
            var entity = await FindOwned(id);
            if (entity is null) return NotFound<LoadLeaseTransitionChecklistDto>();
            entity.ConditionReportId = null; entity.UpdatedAt = DateTime.UtcNow;
            try
            {
                await _context.SaveChangesAsync();
                return Success(Map(entity));
            }
            catch (DbUpdateConcurrencyException)
            {
                return Conflict<LoadLeaseTransitionChecklistDto>("The checklist changed while the condition report was being detached. Refresh and try again.");
            }
        }

        private async Task<LeaseTransitionChecklist?> FindOwned(long id)
        {
            var scope = await GetScope();
            if (scope is null) return null;
            return await _context.LeaseTransitionChecklists.Include(x => x.Items).Include(x => x.Property).Include(x => x.Unit).Include(x => x.ConditionReport).ThenInclude(x => x!.Items)
                .SingleOrDefaultAsync(x => x.Id == id && x.OrganizationId == scope.Value.OrganizationId && x.LandlordId == scope.Value.UserId &&
                    x.Property.OrganizationId == scope.Value.OrganizationId && x.Property.LandlordId == scope.Value.UserId && !x.Property.IsDeleted);
        }
        private async Task<bool> IsEligibleReportUnit(Checklist report, LeaseTransitionChecklist handoff)
        {
            var reportUnitId = report.UnitId;
            if (!reportUnitId.HasValue && report.LeaseId.HasValue)
            {
                reportUnitId = await _context.Leases.AsNoTracking()
                    .Where(lease => lease.Id == report.LeaseId && lease.Unit.PropertyId == handoff.PropertyId)
                    .Select(lease => (long?)lease.UnitId).SingleOrDefaultAsync();
            }
            if (reportUnitId == handoff.UnitId) return true;
            if (reportUnitId.HasValue && handoff.UnitId.HasValue) return false;

            // A property-level record can match a known unit only for a single-unit rental.
            var unitIds = await _context.Units.AsNoTracking()
                .Where(x => x.PropertyId == handoff.PropertyId)
                .Select(x => x.Id)
                .Take(2)
                .ToListAsync();
            return unitIds.Count == 1 && unitIds[0] == (handoff.UnitId ?? reportUnitId);
        }
        private async Task<LeaseTransitionChecklist?> LoadOwnedByRequest((long UserId, long OrganizationId) scope, string requestId) =>
            await _context.LeaseTransitionChecklists.Include(x => x.Items).Include(x => x.Property).Include(x => x.Unit).Include(x => x.ConditionReport).ThenInclude(x => x!.Items)
                .FirstOrDefaultAsync(x => x.OrganizationId == scope.OrganizationId && x.LandlordId == scope.UserId && x.RequestId == requestId);
        private async Task<(long UserId, long OrganizationId)?> GetScope()
        {
            var user = await _users.GetCurrentUser();
            if (user?.Id is not long userId || _httpContext.HttpContext?.Items["OrganizationId"] is not long organizationId) return null;
            return (userId, organizationId);
        }
        private static List<LeaseTransitionChecklistItem> DefaultItems(ELeaseTransitionPhase phase)
        {
            var labels = phase == ELeaseTransitionPhase.MoveIn ? new[] { ("confirm-handoff", "Confirm the move-in date, handoff time, and tenant contacts.", false), ("lease-records", "Save the signed lease and applicable addenda or disclosures.", false), ("funds", "Record move-in funds received and save receipts, if applicable.", true), ("unit-ready", "Check cleaning, repairs, locks, and safety devices.", false), ("condition-report", "Complete condition report", false), ("utilities", "Confirm utilities and record meter readings, if applicable.", true), ("access-devices", "Record keys, remotes, passes, and access devices handed over.", false), ("share-records", "Share move-in records and maintenance contact details.", false) } : new[] { ("confirm-possession", "Confirm the move-out date and possession handoff.", false), ("access-devices", "Record returned keys, remotes, passes, and access devices.", false), ("condition-report", "Complete condition report", false), ("repair-photos", "Photograph and document repair or cleaning needs before work starts.", false), ("utilities", "Record final utility readings or transfers, if applicable.", true), ("forwarding-address", "Record forwarding address or agreed contact method, if applicable.", true), ("deposit-follow-up", "Review deposit requirements and record follow-up.", false), ("turnover", "Log repairs or cleaning for the next turnover.", false) };
            return labels.Select((x, index) => new LeaseTransitionChecklistItem { Key = x.Item1, Label = x.Item2, AllowNotApplicable = x.Item3, SortOrder = index }).ToList();
        }
        private static LoadLeaseTransitionChecklistDto Map(LeaseTransitionChecklist entity) => new() { Id = entity.Id, PropertyId = entity.PropertyId, PropertyName = entity.Property?.Name, UnitId = entity.UnitId, UnitName = entity.Unit?.Name, LeaseId = entity.LeaseId, Phase = entity.Phase, RequestId = entity.RequestId, ConditionReportId = entity.ConditionReportId ?? entity.ConditionReport?.Id, ConditionReport = entity.ConditionReport is null ? null : MapReport(entity.ConditionReport), Items = entity.Items.OrderBy(x => x.SortOrder).Select(x => new LoadLeaseTransitionChecklistItemDto { Key = x.Key, Label = x.Label, SortOrder = x.SortOrder, AllowNotApplicable = x.AllowNotApplicable, Status = (entity.ConditionReportId.HasValue || entity.ConditionReport is not null) && x.Key == "condition-report" ? (entity.ConditionReport?.IsCompleted == true ? ELeaseTransitionItemStatus.Done : ELeaseTransitionItemStatus.Pending) : x.Status, NotApplicableReason = x.NotApplicableReason, CompletedAt = x.CompletedAt }).ToList(), CreatedAt = entity.CreatedAt, UpdatedAt = entity.UpdatedAt };
        private static LoadChecklistDto MapReport(Checklist report) => new() { Id = report.Id, ChecklistType = report.ChecklistType, ChecklistTypeName = report.ChecklistType == ETenantDocumentType.ConditionReport ? "Condition Report" : report.ChecklistType.ToString(), Title = report.Title, InspectionDate = report.InspectionDate, IsCompleted = report.IsCompleted, CompletedAt = report.CompletedAt, PropertyId = report.PropertyId, UnitId = report.UnitId, LeaseId = report.LeaseId, LandlordId = report.LandlordId, Items = report.Items.Select(x => new LoadChecklistItemDto { Id = x.Id, Name = x.Name, Description = x.Description, Category = x.Category, Condition = x.Condition, Notes = x.Notes, HasDamage = x.HasDamage, DamageDescription = x.DamageDescription, IsChecked = x.IsChecked, CheckedAt = x.CheckedAt, SortOrder = x.SortOrder }).ToList() };
        private static ServiceResponse<T> Success<T>(T data, string? message = null) => new() { Success = true, Data = data, Message = message ?? string.Empty };
        private static ServiceResponse<T> Unauthorized<T>() => ServiceResponse<T>.CreateError("Organization not found", statusCode: 401);
        private static ServiceResponse<T> NotFound<T>() => ServiceResponse<T>.CreateError("Checklist not found", statusCode: 404);
        private static ServiceResponse<T> BadRequest<T>(string message) => ServiceResponse<T>.CreateError(message, statusCode: 400);
        private static ServiceResponse<T> Conflict<T>(string message) => ServiceResponse<T>.CreateError(message, statusCode: 409);
    }
}
