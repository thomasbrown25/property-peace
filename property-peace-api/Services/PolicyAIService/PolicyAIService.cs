using brownstone_hub_api.Dtos.LeaseGeneration;
using brownstone_hub_api.Services.OpenAIService;
using System.Text;
using System.Text.Json;

namespace brownstone_hub_api.Services.PolicyAIService
{
    public class PolicyAIService : IPolicyAIService
    {
        private readonly IOpenAIService _openAIService;
        private readonly ILogger<PolicyAIService> _logger;

        public PolicyAIService(
            IOpenAIService openAIService,
            ILogger<PolicyAIService> logger)
        {
            _openAIService = openAIService;
            _logger = logger;
        }

        public async Task<ServiceResponse<FormatPoliciesResponseDto>> FormatPoliciesAsync(FormatPoliciesDto dto)
        {
            try
            {
                if (dto.RawPolicies == null || !dto.RawPolicies.Any())
                {
                    return ServiceResponse<FormatPoliciesResponseDto>.CreateError("No policies provided", "Please provide at least one policy to format.");
                }

                var toneInstruction = dto.Tone.ToLower() switch
                {
                    "strict" => "Use formal, strict language with strong enforcement language (e.g., 'Tenant must', 'Tenant shall not', 'Violation will result in').",
                    "friendly" => "Use friendly, conversational language while maintaining professionalism (e.g., 'We ask that tenants', 'Please be mindful', 'We appreciate').",
                    _ => "Use professional, neutral language (e.g., 'Tenant shall', 'Tenant is expected to', 'Please')."
                };

                var prompt = $@"You are a legal document assistant. Format the following lease policy items into a professional 'POLICIES / HOUSE RULES' section for a residential lease agreement.

Tone: {toneInstruction}

Important guidelines:
- Do NOT make any legal claims or state-specific assertions
- Do NOT claim something is 'legal' or 'required by law' unless explicitly stated
- Use consistent legal-style language appropriate for lease agreements
- Number each policy clearly
- Group related policies together with headings
- Ensure policies are clear and enforceable
- Maintain the original meaning and intent

Raw policy items:
{string.Join("\n", dto.RawPolicies.Select((p, i) => $"{i + 1}. {p}"))}

Please format these into a professional policies section. Return a JSON object with this structure:
{{
  ""policies"": [
    {{
      ""title"": ""Policy heading (e.g., 'Quiet Hours')"",
      ""body"": ""Formatted policy text"",
      ""category"": ""Category name (e.g., 'QuietHours', 'Parking', 'Trash')"",
      ""riskFlags"": [""any potential legal issues or warnings""]
    }}
  ],
  ""markdown"": ""Full formatted markdown text of the policies section with headings and numbered items""
}}";

                var jsonResponse = await _openAIService.GenerateJsonAsync<FormatPoliciesResponseDto>(prompt, 3000);

                if (!jsonResponse.Success || jsonResponse.Data == null)
                {
                    // Fallback: try text generation and parse manually
                    var textResponse = await _openAIService.GenerateTextAsync(prompt, 3000);
                    if (textResponse.Success && !string.IsNullOrEmpty(textResponse.Data))
                    {
                        // Try to extract JSON from text response
                        var jsonMatch = System.Text.RegularExpressions.Regex.Match(textResponse.Data, @"\{[\s\S]*\}");
                        if (jsonMatch.Success)
                        {
                            try
                            {
                                var parsed = JsonSerializer.Deserialize<FormatPoliciesResponseDto>(jsonMatch.Value, new JsonSerializerOptions
                                {
                                    PropertyNameCaseInsensitive = true
                                });
                                if (parsed != null)
                                {
                                    return ServiceResponse<FormatPoliciesResponseDto>.CreateSuccess(parsed);
                                }
                            }
                            catch { }
                        }

                        // If JSON parsing fails, create a simple formatted response
                        return ServiceResponse<FormatPoliciesResponseDto>.CreateSuccess(new FormatPoliciesResponseDto
                        {
                            Policies = dto.RawPolicies.Select((p, i) => new FormattedPolicyItemDto
                            {
                                Title = $"Policy {i + 1}",
                                Body = p,
                                Category = "General"
                            }).ToList(),
                            Markdown = $"# POLICIES / HOUSE RULES\n\n{string.Join("\n\n", dto.RawPolicies.Select((p, i) => $"{i + 1}. {p}"))}"
                        });
                    }

                    return ServiceResponse<FormatPoliciesResponseDto>.CreateError("AI formatting failed", jsonResponse.Message ?? "Failed to format policies using AI.");
                }

                return jsonResponse;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error formatting policies with AI");
                return ServiceResponse<FormatPoliciesResponseDto>.CreateError("Error formatting policies", ex.Message);
            }
        }

        public async Task<ServiceResponse<List<string>>> SuggestPoliciesAsync(SuggestPoliciesDto dto)
        {
            try
            {
                var toneInstruction = dto.Tone.ToLower() switch
                {
                    "strict" => "Use formal, strict language with strong enforcement language (e.g., 'Tenant must', 'Tenant shall not', 'Violation will result in').",
                    "friendly" => "Use friendly, conversational language while maintaining professionalism (e.g., 'We ask that tenants', 'Please be mindful', 'We appreciate').",
                    _ => "Use professional, neutral language (e.g., 'Tenant shall', 'Tenant is expected to', 'Please')."
                };

                var prompt = $@"You are a lease agreement assistant. Generate a comprehensive list of 10-15 common residential lease policies that landlords typically include in lease agreements.

Tone: {toneInstruction}

Include policies covering these important categories:
- Rent payment terms and due dates
- Security deposit and fees
- Quiet hours and noise restrictions
- Parking rules and regulations
- Trash disposal and recycling
- Maintenance and repair responsibilities
- Guest and overnight visitor policies
- Smoking and drug policies
- Pet policies and restrictions
- Keys, locks, and security
- Alterations and modifications to the property
- Move-out cleaning requirements
- Utilities responsibility
- Subletting and assignment
- Entry and inspection rights

Return a JSON array of policy items as strings. Each policy should be clear, concise, and professionally worded in the specified tone. Format each as a complete sentence or short paragraph.";

                var response = await _openAIService.GenerateJsonAsync<List<string>>(prompt, 2000);

                if (!response.Success || response.Data == null)
                {
                    return ServiceResponse<List<string>>.CreateError("AI suggestion failed", response.Message ?? "Failed to generate policy suggestions.");
                }

                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error suggesting policies");
                return ServiceResponse<List<string>>.CreateError("Error suggesting policies", ex.Message);
            }
        }

        public async Task<ServiceResponse<List<string>>> NormalizePoliciesAsync(List<string> policies)
        {
            try
            {
                if (policies == null || !policies.Any())
                {
                    return ServiceResponse<List<string>>.CreateSuccess(new List<string>());
                }

                // Simple normalization: dedupe and clean
                var normalized = policies
                    .Where(p => !string.IsNullOrWhiteSpace(p))
                    .Select(p => p.Trim())
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();

                // If we have OpenAI, we can do smarter grouping
                if (normalized.Count > 1)
                {
                    var prompt = $@"You are a lease policy assistant. Normalize and deduplicate the following policy items. Group similar items together and remove duplicates.

Policies:
{string.Join("\n", normalized.Select((p, i) => $"{i + 1}. {p}"))}

Return a JSON array of normalized, deduplicated policy items. Keep the most complete version when duplicates are found.";

                    var aiResponse = await _openAIService.GenerateJsonAsync<List<string>>(prompt, 2000);
                    if (aiResponse.Success && aiResponse.Data != null && aiResponse.Data.Any())
                    {
                        return aiResponse;
                    }
                }

                return ServiceResponse<List<string>>.CreateSuccess(normalized);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error normalizing policies");
                // Fallback to simple normalization
                var normalized = policies
                    .Where(p => !string.IsNullOrWhiteSpace(p))
                    .Select(p => p.Trim())
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();
                return ServiceResponse<List<string>>.CreateSuccess(normalized);
            }
        }
    }
}
