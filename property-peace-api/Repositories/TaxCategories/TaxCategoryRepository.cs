using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.TaxCategories
{
    public class TaxCategoryRepository(DataContext context, ILogger<TaxCategoryRepository> logger) : ITaxCategoryRepository
    {
        private readonly DataContext _context = context;
        private readonly ILogger<TaxCategoryRepository> _logger = logger;

        public async Task<List<TaxCategory>> GetAllTaxCategoriesAsync()
        {
            try
            {
                return await _context.TaxCategories
                    .OrderBy(tc => tc.SortOrder)
                    .ThenBy(tc => tc.Name)
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving all tax categories");
                throw;
            }
        }

        public async Task<TaxCategory?> GetTaxCategoryByIdAsync(long id)
        {
            try
            {
                return await _context.TaxCategories
                    .FirstOrDefaultAsync(tc => tc.Id == id);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving tax category with ID {TaxCategoryId}", id);
                throw;
            }
        }

        public async Task<TaxCategory?> GetTaxCategoryByEnumValueAsync(int enumValue)
        {
            try
            {
                return await _context.TaxCategories
                    .FirstOrDefaultAsync(tc => tc.EnumValue == enumValue);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving tax category with enum value {EnumValue}", enumValue);
                throw;
            }
        }

        public async Task<TaxCategory?> GetTaxCategoryByNameAsync(string name)
        {
            try
            {
                return await _context.TaxCategories
                    .FirstOrDefaultAsync(tc => tc.Name == name);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving tax category with name {Name}", name);
                throw;
            }
        }
    }
}
