using brownstone_hub_api.Models;

namespace brownstone_hub_api.Repositories.TaxCategories
{
    public interface ITaxCategoryRepository
    {
        Task<List<TaxCategory>> GetAllTaxCategoriesAsync();
        Task<TaxCategory?> GetTaxCategoryByIdAsync(long id);
        Task<TaxCategory?> GetTaxCategoryByEnumValueAsync(int enumValue);
        Task<TaxCategory?> GetTaxCategoryByNameAsync(string name);
    }
}
