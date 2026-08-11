using FluentAssertions;
using Xunit;

namespace brownstone_hub_api.Tests.Security;

public sealed class JwtBearerClaimMappingTests
{
    [Fact]
    public void Jwt_bearer_preserves_explicit_numeric_name_identifier_when_token_also_has_email_subject()
    {
        var program = File.ReadAllText(ApiFile("Program.cs"));
        var jwtBearerStart = program.IndexOf(".AddJwtBearer(options =>", StringComparison.Ordinal);
        var tokenValidationStart = program.IndexOf("options.TokenValidationParameters", jwtBearerStart, StringComparison.Ordinal);

        jwtBearerStart.Should().BeGreaterThanOrEqualTo(0);
        tokenValidationStart.Should().BeGreaterThan(jwtBearerStart);

        var jwtBearerPreamble = program[jwtBearerStart..tokenValidationStart];
        jwtBearerPreamble.Should().Contain(
            "options.MapInboundClaims = false;",
            "mapping the email-valued sub claim to NameIdentifier creates a duplicate that can shadow the explicit numeric NameIdentifier claim");
    }

    private static string ApiFile(params string[] parts)
    {
        var root = FindRepositoryRoot();
        return Path.Combine([root, "property-peace-api", .. parts]);
    }

    private static string FindRepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null)
        {
            if (Directory.Exists(Path.Combine(directory.FullName, "property-peace-api")) &&
                Directory.Exists(Path.Combine(directory.FullName, "property-peace-api.Tests")))
            {
                return directory.FullName;
            }

            directory = directory.Parent;
        }

        throw new DirectoryNotFoundException("Could not locate the Property Peace repository root.");
    }
}
