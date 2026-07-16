using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Search;
using brownstone_hub_api.Repositories.Users;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.SearchService
{
    public class SearchService(DataContext context, ILogger<SearchService> logger, IUserRepository userRepository) : ISearchService
    {
        private readonly DataContext _context = context;
        private readonly ILogger<SearchService> _logger = logger;
        private readonly IUserRepository _userRepository = userRepository;

        public async Task<ServiceResponse<SearchResultDto>> GlobalSearch(string query, int maxResults = 10)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(query))
                {
                    return ServiceResponse<SearchResultDto>.CreateSuccess(new SearchResultDto(), "Search query is empty");
                }

                var currentUser = await _userRepository.GetCurrentUser();
                if (currentUser == null)
                {
                    return ServiceResponse<SearchResultDto>.CreateError("Unable to retrieve current user", "User not found");
                }

                var landlordId = currentUser.Id;
                var searchTerm = query.Trim().ToLower();
                var result = new SearchResultDto();

                // Search Properties (exclude deleted properties)
                var properties = await _context.Properties
                    .AsNoTracking()
                    .Where(p => p.LandlordId == landlordId && !p.IsDeleted &&
                        (p.Name.ToLower().Contains(searchTerm) ||
                         (!string.IsNullOrEmpty(p.StreetAddress) && p.StreetAddress.ToLower().Contains(searchTerm))))
                    .Take(maxResults)
                    .Select(p => new PropertySearchResultDto
                    {
                        Id = p.Id,
                        Name = p.Name,
                        Address = p.StreetAddress ?? string.Empty,
                        PropertyType = p.PropertyType.ToString()
                    })
                    .ToListAsync();

                result.Properties = properties;

                // Search Tenants (exclude tenants from deleted properties)
                var tenantEntities = await _context.Tenants
                    .AsNoTracking()
                    .Include(t => t.TenantLeases)
                        .ThenInclude(tl => tl.Lease)
                            .ThenInclude(l => l!.Unit)
                                .ThenInclude(u => u!.Property)
                    .Where(t => t.TenantLeases.Any(tl => tl.Lease != null &&
                        tl.Lease.Unit != null &&
                        tl.Lease.Unit.Property != null &&
                        !tl.Lease.Unit.Property.IsDeleted &&
                        tl.Lease.Unit.Property.LandlordId == landlordId) &&
                        ((t.Firstname != null && t.Firstname.ToLower().Contains(searchTerm)) ||
                         (t.Lastname != null && t.Lastname.ToLower().Contains(searchTerm)) ||
                         (t.Email != null && t.Email.ToLower().Contains(searchTerm)) ||
                         (t.PhoneNumber != null && t.PhoneNumber.Contains(searchTerm))))
                    .Take(maxResults)
                    .ToListAsync();

                var tenants = tenantEntities.Select(t => 
                {
                    var firstLease = t.TenantLeases?.FirstOrDefault()?.Lease;
                    return new TenantSearchResultDto
                    {
                        Id = t.Id,
                        Firstname = t.Firstname ?? string.Empty,
                        Lastname = t.Lastname ?? string.Empty,
                        Email = t.Email ?? string.Empty,
                        PhoneNumber = t.PhoneNumber ?? string.Empty,
                        PropertyId = firstLease?.Unit?.PropertyId,
                        PropertyName = firstLease?.Unit?.Property?.Name,
                        UnitId = firstLease?.Unit?.Id,
                        UnitName = firstLease?.Unit?.Name
                    };
                }).ToList();

                result.Tenants = tenants;

                // Search Leases (by property name, unit name, or tenant names) - exclude leases from deleted properties
                var leaseEntities = await _context.Leases
                    .AsNoTracking()
                    .Include(l => l.Unit)
                        .ThenInclude(u => u.Property)
                    .Include(l => l.TenantLeases)
                        .ThenInclude(tl => tl.Tenant)
                    .Where(l => l.Unit != null &&
                        l.Unit.Property != null &&
                        !l.Unit.Property.IsDeleted &&
                        l.Unit.Property.LandlordId == landlordId &&
                        ((l.Unit.Property.Name != null && l.Unit.Property.Name.ToLower().Contains(searchTerm)) ||
                         (l.Unit.Name != null && l.Unit.Name.ToLower().Contains(searchTerm)) ||
                         l.TenantLeases.Any(tl => (tl.Tenant.Firstname != null && tl.Tenant.Firstname.ToLower().Contains(searchTerm)) ||
                                           (tl.Tenant.Lastname != null && tl.Tenant.Lastname.ToLower().Contains(searchTerm)))))
                    .Take(maxResults)
                    .ToListAsync();

                var leases = leaseEntities.Select(l => new LeaseSearchResultDto
                {
                    Id = l.Id,
                    PropertyId = l.Unit?.PropertyId ?? 0,
                    PropertyName = l.Unit?.Property?.Name ?? string.Empty,
                    UnitId = l.UnitId,
                    UnitName = l.Unit?.Name ?? string.Empty,
                    StartDate = l.StartDate ?? DateTime.UtcNow,
                    EndDate = l.EndDate ?? DateTime.UtcNow,
                    RentAmount = l.RentAmount ?? 0m,
                    IsActive = !l.IsDeleted,
                    TenantNames = l.TenantLeases?.Select(tl => $"{tl.Tenant.Firstname ?? ""} {tl.Tenant.Lastname ?? ""}".Trim()).Where(n => !string.IsNullOrEmpty(n)).ToList() ?? []
                }).ToList();

                result.Leases = leases;

                return ServiceResponse<SearchResultDto>.CreateSuccess(result, "Search completed successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error performing global search with query {Query}", query);
                return ServiceResponse<SearchResultDto>.CreateError("Error performing search", ex.Message, ex.InnerException?.Message);
            }
        }
    }
}

