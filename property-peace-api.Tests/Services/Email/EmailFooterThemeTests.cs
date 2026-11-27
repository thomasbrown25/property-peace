using System.Text.RegularExpressions;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Email;

public sealed class EmailFooterThemeTests
{
    [Theory]
    [InlineData("Controllers/UserController.cs", 1)]
    [InlineData("Services/ApplicationInviteService/ApplicationInviteService.cs", 1)]
    [InlineData("Services/ClientService/ClientService.cs", 2)]
    [InlineData("Services/DailySummaryEmailService/DailySummaryEmailService.cs", 1)]
    [InlineData("Services/EmailService/EmailTemplateService.cs", 1)]
    [InlineData("Services/LandlordInviteService/LandlordInviteService.cs", 1)]
    [InlineData("Services/LeaseService/LeaseService.cs", 1)]
    [InlineData("Services/OrganizationInviteService/OrganizationInviteService.cs", 1)]
    [InlineData("Services/TenantInviteService/TenantInviteService.cs", 1)]
    [InlineData("appsettings.json", 6)]
    public void Class_based_footers_use_the_website_footer_color(string sourcePath, int footerCount)
    {
        AssertFooterColors(sourcePath, @"\.footer\s*\{+([^}]+)", footerCount);
    }

    [Theory]
    [InlineData("Services/AIFollowUpService/AIFollowUpService.cs", 1)]
    [InlineData("Services/UserService/UserService.cs", 2)]
    public void Inline_footers_use_the_website_footer_color(string sourcePath, int footerCount)
    {
        AssertFooterColors(sourcePath, @"<div style='([^']*padding: 28px 30px; text-align: center;)'", footerCount);
    }

    private static void AssertFooterColors(string sourcePath, string footerPattern, int footerCount)
    {
        var root = new DirectoryInfo(AppContext.BaseDirectory);
        while (root is not null && !Directory.Exists(Path.Combine(root.FullName, "property-peace-marketing")))
        {
            root = root.Parent;
        }

        Assert.NotNull(root);
        var websiteStyles = File.ReadAllText(Path.Combine(root.FullName, "property-peace-marketing", "app", "globals.css"));
        var brandColor = Regex.Match(websiteStyles, @"--brand-forest:\s*(#[0-9a-fA-F]{6});");
        Assert.True(brandColor.Success);

        var template = File.ReadAllText(Path.Combine(root.FullName, "property-peace-api", sourcePath));
        var footers = Regex.Matches(template, footerPattern);
        Assert.Equal(footerCount, footers.Count);
        foreach (Match footer in footers)
        {
            Assert.Matches($@"background(?:-color)?:\s*{brandColor.Groups[1].Value};", footer.Groups[1].Value);
        }
    }
}
