using System.Text.Json;
using System.Text.RegularExpressions;

namespace brownstone_hub_api.Services.LeaseDocumentService;

public static class LeaseTemplateContentBuilder
{
    private static readonly Regex PlaceholderPattern = new(@"\{\{([^}]+)\}\}", RegexOptions.Compiled);

    public static IReadOnlyList<LeaseTemplateSection> BuildSections(
        string templateStructure,
        IReadOnlyDictionary<string, string> variables)
    {
        using var template = JsonDocument.Parse(templateStructure);
        if (!template.RootElement.TryGetProperty("sections", out var sectionsElement))
            return [];

        var sections = new List<LeaseTemplateSection>();
        foreach (var sectionElement in sectionsElement.EnumerateArray())
        {
            var enabled = sectionElement.TryGetProperty("enabled", out var enabledProperty)
                && enabledProperty.ValueKind is JsonValueKind.True;
            if (!enabled)
                continue;

            if (!sectionElement.TryGetProperty("content", out var contentProperty))
            {
                var sectionName = sectionElement.TryGetProperty("sectionName", out var configuredName)
                    ? configuredName.GetString() ?? string.Empty
                    : string.Empty;
                var compatibleContent = BuildDefaultShapeContent(sectionName, variables);
                if (!string.IsNullOrWhiteSpace(compatibleContent))
                    sections.Add(new LeaseTemplateSection(sectionName, compatibleContent));
                continue;
            }

            var rawContent = contentProperty.GetString();
            if (string.IsNullOrWhiteSpace(rawContent))
                continue;

            var missingConfiguredValue = false;
            var content = PlaceholderPattern.Replace(rawContent, match =>
            {
                var key = match.Groups[1].Value.Trim();
                if (variables.TryGetValue(key, out var value) && !string.IsNullOrWhiteSpace(value))
                    return value;

                missingConfiguredValue = true;
                return string.Empty;
            });
            if (missingConfiguredValue || string.IsNullOrWhiteSpace(content))
                continue;

            sections.Add(new LeaseTemplateSection(
                sectionElement.TryGetProperty("sectionName", out var name) ? name.GetString() ?? string.Empty : string.Empty,
                content));
        }

        return sections;
    }

    private static string? BuildDefaultShapeContent(string sectionName, IReadOnlyDictionary<string, string> variables)
    {
        string? Value(string key) => variables.TryGetValue(key, out var value) && !string.IsNullOrWhiteSpace(value)
            ? value.Trim()
            : null;
        static string? Join(params string?[] lines)
        {
            var present = lines.Where(x => !string.IsNullOrWhiteSpace(x)).ToArray();
            return present.Length == 0 ? null : string.Join(Environment.NewLine, present);
        }

        return sectionName.Trim().ToLowerInvariant() switch
        {
            "parties" => Join(
                Value("Landlord.LegalName") is { } landlord ? $"Landlord: {landlord}" : null,
                Value("Tenant.FullNameList") is { } tenants ? $"Tenant(s): {tenants}" : null),
            "property description" or "property" or "property & unit" => Join(
                Value("Property.FullAddress") is { } address ? $"Property: {address}" : null,
                Value("Unit.Number") is { } unit ? $"Unit: {unit}" : null),
            "term" => Join(
                Value("Lease.StartDate") is { } start ? $"Start date: {start}" : null,
                Value("Lease.EndDate") is { } end ? $"End date: {end}" : null),
            "rent" => Join(
                Value("Lease.MonthlyRent") is { } rent ? $"Rent: {rent}" : null,
                Value("Lease.RentDueDay") is { } due ? $"Rent due day: {due}" : null),
            "security deposit" => Value("Lease.SecurityDeposit") is { } deposit ? $"Security deposit: {deposit}" : null,
            "utilities" => Join(Value("Utilities.ResponsibilityTable"), Value("Utilities.SharedDisclosure")),
            "maintenance" => Join(Value("Maintenance.ResponsibilityList"), Value("Maintenance.NotificationMethods")),
            "policies" => Join(Value("Smoking.Policy"), Value("Pets.PolicySummary"), Value("Parking.Summary"),
                Value("Lease.AdditionalTerms"), Value("LeadPaint.Disclosure"), Value("State.RequiredDisclosures")),
            "defaults" => Value("Lease.DefaultsClause"),
            "termination" => Join(Value("Lease.TerminationClause"), Value("Lease.EarlyTerminationClause")),
            _ => null
        };
    }
}

public sealed record LeaseTemplateSection(string Title, string Content);