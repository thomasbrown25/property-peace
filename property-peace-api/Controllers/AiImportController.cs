using System.Text.Json;
using brownstone_hub_api.Dtos.Import;
using brownstone_hub_api.Services.OpenAIService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/ai-import")]
    [Authorize(Roles = "Landlord,Admin")]
    public class AiImportController(IOpenAIService openAIService, ILogger<AiImportController> logger) : ControllerBase
    {
        private readonly IOpenAIService _openAIService = openAIService;
        private readonly ILogger<AiImportController> _logger = logger;

        [HttpPost("map-csv")]
        public async Task<IActionResult> MapCsv([FromBody] AiCsvImportMappingRequest request, CancellationToken cancellationToken)
        {
            if (request.SourceHeaders.Count == 0)
                return BadRequest(new { success = false, message = "CSV headers are required." });

            if (request.ExpectedFields.Count == 0)
                return BadRequest(new { success = false, message = "Expected import fields are required." });

            var sampleRows = request.SampleRows.Take(10).ToList();
            var prompt = BuildPrompt(request, sampleRows);
            var response = await _openAIService.GenerateJsonAsync<AiCsvImportMappingResponse>(prompt, maxTokens: 2500);

            if (!response.Success || response.Data == null)
            {
                _logger.LogWarning("AI CSV import mapping failed for {EntityType}: {Message}", request.EntityType, response.Message);
                return StatusCode(response.StatusCode == 0 ? 503 : response.StatusCode, new
                {
                    success = false,
                    message = response.Message ?? "AI import mapping is unavailable.",
                    errors = response.Errors
                });
            }

            var validSourceHeaders = request.SourceHeaders.ToHashSet(StringComparer.OrdinalIgnoreCase);
            var validFieldKeys = request.ExpectedFields.Select(f => f.Key).ToHashSet(StringComparer.OrdinalIgnoreCase);

            var mappings = response.Data.Mappings
                .Where(m => !string.IsNullOrWhiteSpace(m.FieldKey) && validFieldKeys.Contains(m.FieldKey))
                .Select(m => new AiCsvFieldMappingDto
                {
                    FieldKey = m.FieldKey,
                    SourceHeader = !string.IsNullOrWhiteSpace(m.SourceHeader) && validSourceHeaders.Contains(m.SourceHeader)
                        ? m.SourceHeader
                        : null,
                    Confidence = Math.Clamp(m.Confidence, 0, 1),
                    Transformation = NormalizeTransformation(m.Transformation),
                    Reason = m.Reason
                })
                .ToList();

            return Ok(new { success = true, data = new AiCsvImportMappingResponse { Mappings = mappings } });
        }

        private static string BuildPrompt(AiCsvImportMappingRequest request, List<Dictionary<string, string?>> sampleRows)
        {
            var payload = new
            {
                entityType = request.EntityType,
                sourceHeaders = request.SourceHeaders,
                sampleRows,
                expectedFields = request.ExpectedFields.Select(f => new { f.Key, f.Required, f.Aliases })
            };

            return $@"You are Property Peace's CSV import mapping agent.
Your job is to inspect CSV headers AND sample values, then decide where each source column belongs in Property Peace's import schema.
Do not require users to rename columns to match a template.

Rules:
- Return ONLY JSON matching this shape: {{ ""mappings"": [{{ ""fieldKey"": ""first_name"", ""sourceHeader"": ""Full Name"", ""confidence"": 0.95, ""transformation"": ""split_first"", ""reason"": ""Full Name values contain first and last names."" }}] }}.
- fieldKey must be one of the expected field keys.
- sourceHeader must be one of the sourceHeaders, or null if there is no reasonable source.
- confidence is 0 to 1.
- Use headers and values together. For example, a column called 'mail' with email-looking values maps to email.
- For tenant names, recognize first-name columns such as f name, f_name, fname, given, first, first name.
- Recognize last-name columns such as l name, l_name, lname, surname, family, last, last name.
- If one column contains full names, map it to BOTH first_name and last_name with transformations split_first and split_last.
- For full names, support First Last and Last, First values.
- Supported transformation values: none, split_first, split_last, boolean, number, currency, date.
- Prefer not to map a source column if it would be misleading.

CSV import context:
{JsonSerializer.Serialize(payload, new JsonSerializerOptions { WriteIndented = true })}";
        }

        private static string NormalizeTransformation(string? transformation)
        {
            var allowed = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "none", "split_first", "split_last", "boolean", "number", "currency", "date"
            };

            return !string.IsNullOrWhiteSpace(transformation) && allowed.Contains(transformation)
                ? transformation.ToLowerInvariant()
                : "none";
        }
    }
}
