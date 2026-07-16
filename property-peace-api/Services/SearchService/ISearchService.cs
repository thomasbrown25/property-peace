using brownstone_hub_api.Dtos.Search;

namespace brownstone_hub_api.Services.SearchService
{
    public interface ISearchService
    {
        Task<ServiceResponse<SearchResultDto>> GlobalSearch(string query, int maxResults = 10);
    }
}

