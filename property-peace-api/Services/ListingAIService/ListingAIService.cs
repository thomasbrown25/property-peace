using Anthropic.SDK;
using Anthropic.SDK.Common;
using Anthropic.SDK.Messaging;
using brownstone_hub_api.Config;
using Microsoft.Extensions.Options;
using AnthropicMessage = Anthropic.SDK.Messaging.Message;

namespace brownstone_hub_api.Services.ListingAIService
{
    public class ListingAIService(IOptions<AnthropicSettings> anthropicSettings, ILogger<ListingAIService> logger) : IListingAIService
    {
        private readonly AnthropicSettings _settings = anthropicSettings.Value;
        private readonly ILogger<ListingAIService> _logger = logger;

        public async Task<ServiceResponse<string>> GenerateMarketingDescription(
            string propertyName,
            string propertyAddress,
            string? unitName,
            int? squareFeet,
            int? yearBuilt,
            string? bedrooms,
            string? baths,
            decimal monthlyRent,
            List<string> basicAmenities,
            List<string> propertyAmenities,
            List<string> propertyFeatures)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(_settings.ApiKey))
                {
                    return ServiceResponse<string>.CreateError(
                        "Failed to generate description",
                        "AI description generation is not configured correctly. Please update the Anthropic API key and try again.",
                        statusCode: StatusCodes.Status503ServiceUnavailable);
                }

                var prompt = BuildMarketingDescriptionPrompt(
                    propertyName,
                    propertyAddress,
                    unitName,
                    squareFeet,
                    yearBuilt,
                    bedrooms,
                    baths,
                    monthlyRent,
                    basicAmenities,
                    propertyAmenities,
                    propertyFeatures
                );

                var client = new AnthropicClient(_settings.ApiKey);
                var parameters = new MessageParameters
                {
                    Model = !string.IsNullOrWhiteSpace(_settings.Model) ? _settings.Model : _settings.FastModel,
                    MaxTokens = 2000,
                    Messages = [new AnthropicMessage(RoleType.User, prompt)],
                    System = [new SystemMessage("You write polished, compliant rental listing descriptions for a property management platform. Return only the finished listing description text.")],
                    Temperature = 0.7m,
                    Stream = false
                };

                var response = await client.Messages.GetClaudeMessageAsync(parameters);
                var description = response.Content.OfType<TextContent>().FirstOrDefault()?.Text?.Trim();

                if (string.IsNullOrWhiteSpace(description))
                {
                    return ServiceResponse<string>.CreateError(
                        "Failed to generate description",
                        "AI service returned an empty response.",
                        statusCode: StatusCodes.Status502BadGateway);
                }

                return ServiceResponse<string>.CreateSuccess(description);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating marketing description with Anthropic");
                return ServiceResponse<string>.CreateError(
                    "Error generating description",
                    "AI description generation failed. Please try again.",
                    statusCode: StatusCodes.Status502BadGateway,
                    suppressDetailedErrors: true);
            }
        }

        private string BuildMarketingDescriptionPrompt(
            string propertyName,
            string propertyAddress,
            string? unitName,
            int? squareFeet,
            int? yearBuilt,
            string? bedrooms,
            string? baths,
            decimal monthlyRent,
            List<string> basicAmenities,
            List<string> propertyAmenities,
            List<string> propertyFeatures)
        {
            var prompt = $@"Create a compelling and professional marketing description for a rental property listing. 
The description should be engaging, highlight key features, and attract potential tenants.

Property Details:
- Name: {propertyName}
- Address: {propertyAddress}
{(unitName != null ? $"- Unit: {unitName}" : "")}
{(squareFeet.HasValue ? $"- Square Feet: {squareFeet}" : "")}
{(yearBuilt.HasValue ? $"- Year Built: {yearBuilt}" : "")}
{(bedrooms != null ? $"- Bedrooms: {bedrooms}" : "")}
{(baths != null ? $"- Bathrooms: {baths}" : "")}
- Monthly Rent: ${monthlyRent:F2}

Basic Amenities:
{string.Join(", ", basicAmenities.Any() ? basicAmenities : new[] { "None specified" })}

Property Amenities:
{string.Join(", ", propertyAmenities.Any() ? propertyAmenities : new[] { "None specified" })}

Property Features:
{string.Join(", ", propertyFeatures.Any() ? propertyFeatures : new[] { "None specified" })}

Please create a marketing description that:
1. Starts with an engaging opening that highlights the property's best features
2. Describes the property in a way that appeals to potential renters
3. Mentions key amenities and features naturally
4. Creates a sense of urgency and desirability
5. Is professional but warm and inviting
6. Is between 200-400 words
7. Does not include the rent amount in the description (it's already displayed separately)
8. Avoids fair-housing-sensitive claims about ideal renters, families, age, disability, protected classes, or neighborhood demographics

Return only the description text, no additional formatting or labels.";

            return prompt;
        }
    }
}
