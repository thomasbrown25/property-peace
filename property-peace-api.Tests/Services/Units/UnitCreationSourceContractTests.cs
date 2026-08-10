using Xunit;

namespace brownstone_hub_api.Tests.Services.Units;

public sealed class UnitCreationSourceContractTests
{
    [Fact]
    public void Both_creation_paths_have_no_legacy_gate_or_plan_limit_interpretation()
    {
        var root = FindRepositoryRoot();
        var source = File.ReadAllText(Path.Combine(
            root, "property-peace-api", "Services", "UnitService", "UnitService.cs"));

        Assert.DoesNotContain("IFeatureGateService", source, StringComparison.Ordinal);
        Assert.DoesNotContain("CanAddUnitToPropertyAsync", source, StringComparison.Ordinal);
        Assert.DoesNotContain("GetCurrentTotalUnits", source, StringComparison.Ordinal);
        Assert.DoesNotContain("MaxTotalUnits", source, StringComparison.Ordinal);
        Assert.DoesNotContain("ISubscriptionRepository", source, StringComparison.Ordinal);
        Assert.Contains("RequestedQuantity: 1", source, StringComparison.Ordinal);
        Assert.Contains("RequestedQuantity: unitsToAdd", source, StringComparison.Ordinal);
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

        throw new DirectoryNotFoundException("Could not locate repository root.");
    }
}
