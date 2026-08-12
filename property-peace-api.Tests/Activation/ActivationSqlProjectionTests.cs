using System.Text.RegularExpressions;
using FluentAssertions;
using Xunit;

namespace brownstone_hub_api.Tests.Activation;

public sealed class ActivationSqlProjectionTests
{
    [Fact]
    public void Evaluate_QueryContractUsesBoundedNarrowSqlProjections()
    {
        var sourcePath = FindSourceFile();
        var source = File.ReadAllText(sourcePath);

        source.Should().NotContain(".Include(",
            "activation must not hydrate full entities or navigation graphs");
        source.Should().Contain("private const int CandidateLimit = 64;");

        Regex.Matches(source, @"\.ToListAsync\(").Should().HaveCount(4,
            "there are exactly four multi-row candidate queries");
        Regex.Matches(source, @"\.Take\(CandidateLimit\)\s*\.ToListAsync\(").Should().HaveCount(4,
            "every multi-row query must be capped before database execution");

        source.Should().Contain(".Select(x => new LeaseFact(")
            .And.Contain(".Select(x => new ListingFact(")
            .And.Contain(".Select(x => new ApplicationFact(")
            .And.Contain("select new PaymentFact(",
                "queries must project only activation facts rather than persistence entities");

        source.Should().NotContain("Select(x => x)")
            .And.NotContain("Select(x => x.Unit)")
            .And.NotContain("Select(x => x.Property)")
            .And.NotContain("Select(x => x.Tenant)");

        var paymentProjectionStart = source.IndexOf("select new PaymentFact(", StringComparison.Ordinal);
        var paymentProjectionEnd = source.IndexOf("var hasCommunication", paymentProjectionStart,
            StringComparison.Ordinal);
        paymentProjectionStart.Should().BeGreaterThanOrEqualTo(0);
        paymentProjectionEnd.Should().BeGreaterThan(paymentProjectionStart);
        var paymentProjection = source[paymentProjectionStart..paymentProjectionEnd];
        paymentProjection.Should().NotContain("StripeAccountId,")
            .And.NotContain("ExternalAccountFingerprint,")
            .And.NotContain("StripeDisabledReason,",
                "raw provider/payment evidence must never become a selected result field");
    }

    private static string FindSourceFile()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null)
        {
            var candidate = Path.Combine(directory.FullName,
                "property-peace-api", "Services", "Activation", "ActivationService.cs");
            if (File.Exists(candidate)) return candidate;
            directory = directory.Parent;
        }

        throw new FileNotFoundException("Could not locate ActivationService.cs from the test output directory.");
    }
}
