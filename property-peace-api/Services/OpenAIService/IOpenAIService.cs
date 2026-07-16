namespace brownstone_hub_api.Services.OpenAIService
{
    public interface IOpenAIService
    {
        Task<ServiceResponse<string>> GenerateTextAsync(string prompt, int maxTokens = 1000);
        Task<ServiceResponse<T>> GenerateJsonAsync<T>(string prompt, int maxTokens = 2000) where T : class;
    }
}
