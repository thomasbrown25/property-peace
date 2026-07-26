using brownstone_hub_api.Services.LeaseDocumentService;
using FluentAssertions;
using Xunit;

namespace brownstone_hub_api.Tests.Services.LeaseGeneration;

public class LeaseDocumentContentTests
{
    [Fact]
    public void BuildSections_OmitsEnabledSectionsWithoutExplicitContent()
    {
        const string template = """
            { "sections": [
              { "sectionName": "Pets", "enabled": true },
              { "sectionName": "Smoking", "enabled": true },
              { "sectionName": "Policies", "enabled": true },
              { "sectionName": "Maintenance", "enabled": true },
              { "sectionName": "Defaults", "enabled": true },
              { "sectionName": "Termination", "enabled": true }
            ] }
            """;

        var sections = LeaseTemplateContentBuilder.BuildSections(template, new Dictionary<string, string>());

        sections.Should().BeEmpty();
    }

    [Fact]
    public void BuildSections_RendersOnlyTemplateTextAndExplicitVariables()
    {
        const string template = """
            { "sections": [
              { "sectionName": "Smoking", "enabled": true, "content": "Smoking policy: {{Smoking.Policy}}" },
              { "sectionName": "Pets", "enabled": false, "content": "{{Pets.Policy}}" }
            ] }
            """;
        var variables = new Dictionary<string, string> { ["Smoking.Policy"] = "Outside only" };

        var sections = LeaseTemplateContentBuilder.BuildSections(template, variables);

        sections.Should().ContainSingle().Which.Content.Should().Be("Smoking policy: Outside only");
    }

    [Fact]
    public void BuildSections_OmitsSectionWhenAConfiguredValueIsMissing()
    {
        const string template = """
            { "sections": [{ "sectionName": "Rent", "enabled": true, "content": "Rent is {{Lease.MonthlyRent}}." }] }
            """;

        var sections = LeaseTemplateContentBuilder.BuildSections(template, new Dictionary<string, string>());

        sections.Should().BeEmpty();
    }

    [Fact]
    public void BuildSections_RendersConfiguredUtilitiesMaintenancePetsAndKeys()
    {
        const string template = """
            { "sections": [
              { "sectionName": "Utilities", "enabled": true, "content": "{{Utilities.ResponsibilityTable}}" },
              { "sectionName": "Maintenance", "enabled": true, "content": "{{Maintenance.ResponsibilityList}}" },
              { "sectionName": "Pets", "enabled": true, "content": "{{Pets.PolicySummary}}" },
              { "sectionName": "Keys", "enabled": true, "content": "{{Keys.Summary}}" }
            ] }
            """;
        var variables = new Dictionary<string, string>
        {
            ["Utilities.ResponsibilityTable"] = "Water: Landlord",
            ["Maintenance.ResponsibilityList"] = "Lawn: Tenant",
            ["Pets.PolicySummary"] = "One cat",
            ["Keys.Summary"] = "Front door: 2"
        };

        var sections = LeaseTemplateContentBuilder.BuildSections(template, variables);

        sections.Select(x => x.Content).Should().Equal(
            "Water: Landlord", "Lawn: Tenant", "One cat", "Front door: 2");
    }

    [Fact]
    public void BuildSections_MapsRealDefaultTemplateShapeToConfiguredFactsOnly()
    {
        const string template = """
            { "sections": [
              { "sectionName": "Parties", "enabled": true, "order": 1 },
              { "sectionName": "Property Description", "enabled": true, "order": 2 },
              { "sectionName": "Term", "enabled": true, "order": 3 },
              { "sectionName": "Rent", "enabled": true, "order": 4 },
              { "sectionName": "Security Deposit", "enabled": true, "order": 5 },
              { "sectionName": "Utilities", "enabled": true, "order": 6 },
              { "sectionName": "Maintenance", "enabled": true, "order": 7 },
              { "sectionName": "Policies", "enabled": true, "order": 8 },
              { "sectionName": "Defaults", "enabled": true, "order": 9 },
              { "sectionName": "Termination", "enabled": true, "order": 10 },
              { "sectionName": "Signatures", "enabled": true, "order": 11 }
            ] }
            """;
        var variables = new Dictionary<string, string>
        {
            ["Landlord.LegalName"] = "Alice Owner", ["Tenant.FullNameList"] = "Tom Tenant",
            ["Property.FullAddress"] = "1 Main St", ["Unit.Number"] = "2A",
            ["Lease.StartDate"] = "08/01/2026", ["Lease.EndDate"] = "07/31/2027",
            ["Lease.MonthlyRent"] = "$1,500.00", ["Lease.RentDueDay"] = "1",
            ["Lease.SecurityDeposit"] = "$0.00", ["Smoking.Policy"] = "No smoking on the premises."
        };

        var sections = LeaseTemplateContentBuilder.BuildSections(template, variables);

        sections.Select(x => x.Title).Should().Equal("Parties", "Property Description", "Term", "Rent", "Security Deposit", "Policies");
        sections.Should().Contain(x => x.Content.Contains("$1,500.00"));
        sections.Should().Contain(x => x.Content == "No smoking on the premises.");
        sections.Should().NotContain(x => x.Title == "Defaults" || x.Title == "Termination" || x.Title == "Signatures");
    }
}
