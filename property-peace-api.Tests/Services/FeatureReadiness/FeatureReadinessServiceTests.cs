using brownstone_hub_api.Config;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.FeatureReadiness;
using brownstone_hub_api.Services.SubscriptionService;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.FeatureReadiness;

public class FeatureReadinessServiceTests
{
    [Fact]
    public async Task PilotFeature_UsesExplicitRequestOrganization_NotUsersPersistedCurrentOrganization()
    {
        var service = CreateService(
            FeatureReadinessState.Pilot,
            organizationId: 17,
            pilotOrganizations: new Dictionary<string, List<long>>
            {
                [FeatureKeys.TenantScreening] = [17]
            });

        var result = await service.GetAsync(42, 99, FeatureKeys.TenantScreening);

        result.CanInvoke.Should().BeFalse();
        result.OrganizationReady.Should().BeFalse();
        result.Blockers.Should().Contain("OrganizationReadiness");
    }

    [Fact]
    public async Task OrganizationScopedFeature_FailsClosed_WhenRequestOrganizationIsMissing()
    {
        var service = CreateService(FeatureReadinessState.Available, organizationId: 17);

        var result = await service.GetAsync(42, null, FeatureKeys.TenantScreening);

        result.CanInvoke.Should().BeFalse();
        result.OrganizationReady.Should().BeFalse();
    }

    [Fact]
    public async Task PilotFeature_DeniesOrganization_WhenNoEnrollmentIsConfigured()
    {
        var service = CreateService(FeatureReadinessState.Pilot, organizationId: 17);

        var result = await service.GetAsync(42, 17, FeatureKeys.TenantScreening);

        result.CanInvoke.Should().BeFalse();
        result.OrganizationReady.Should().BeFalse();
        result.Blockers.Should().Contain("OrganizationReadiness");
    }

    [Fact]
    public async Task PilotFeature_AllowsOnlyExplicitlyEnrolledOrganization()
    {
        var service = CreateService(
            FeatureReadinessState.Pilot,
            organizationId: 17,
            pilotOrganizations: new Dictionary<string, List<long>>
            {
                [FeatureKeys.TenantScreening] = [17]
            });

        var result = await service.GetAsync(42, 17, FeatureKeys.TenantScreening);

        result.CanInvoke.Should().BeTrue();
        result.OrganizationReady.Should().BeTrue();
    }

    [Fact]
    public async Task PilotFeature_DeniesOrganization_NotOnFeatureAllowlist()
    {
        var service = CreateService(
            FeatureReadinessState.Pilot,
            organizationId: 17,
            pilotOrganizations: new Dictionary<string, List<long>>
            {
                [FeatureKeys.TenantScreening] = [99]
            });

        var result = await service.GetAsync(42, 17, FeatureKeys.TenantScreening);

        result.CanInvoke.Should().BeFalse();
        result.OrganizationReady.Should().BeFalse();
    }

    [Fact]
    public async Task OnlineRentCollection_RemainsGloballySuspendedWithoutLeaseScopedEntitlement()
    {
        var service = CreateService(
            FeatureReadinessState.Available,
            organizationId: 17,
            feature: FeatureKeys.OnlineRentCollection,
            providerSettings: new Dictionary<string, string?>
            {
                ["Stripe:RentPaymentsEnabled"] = "true",
                ["Stripe:SecretKey"] = "stripe-secret"
            });

        var result = await service.GetAsync(42, 17, FeatureKeys.OnlineRentCollection);

        result.State.Should().Be(FeatureReadinessState.Suspended);
        result.GlobalGateEnabled.Should().BeFalse();
        result.CanInvoke.Should().BeFalse();
    }

    [Fact]
    public async Task ESignature_DeniesConfiguration_WhenPrivateKeyPathDoesNotExist()
    {
        var service = CreateService(
            FeatureReadinessState.Available,
            organizationId: 17,
            feature: FeatureKeys.ESignature,
            providerSettings: new Dictionary<string, string?>
            {
                ["DocuSign:IntegrationKey"] = "integration",
                ["DocuSign:UserId"] = "user",
                ["DocuSign:AccountId"] = "account",
                ["DocuSign:PrivateKeyPath"] = Path.Combine(Path.GetTempPath(), $"missing-{Guid.NewGuid():N}.pem")
            });

        var result = await service.GetAsync(42, 17, FeatureKeys.ESignature);

        result.ProviderConfigured.Should().BeFalse();
        result.CanInvoke.Should().BeFalse();
    }

    [Fact]
    public async Task ESignature_AcceptsReadableExistingPrivateKeyPath()
    {
        var privateKeyPath = Path.GetTempFileName();
        try
        {
            await System.IO.File.WriteAllTextAsync(privateKeyPath, "test-private-key-material");
            var service = CreateService(
                FeatureReadinessState.Available,
                organizationId: 17,
                feature: FeatureKeys.ESignature,
                providerSettings: new Dictionary<string, string?>
                {
                    ["DocuSign:IntegrationKey"] = "integration",
                    ["DocuSign:UserId"] = "user",
                    ["DocuSign:AccountId"] = "account",
                    ["DocuSign:PrivateKeyPath"] = privateKeyPath
                });

            var result = await service.GetAsync(42, 17, FeatureKeys.ESignature);

            result.ProviderConfigured.Should().BeTrue();
            result.CanInvoke.Should().BeTrue();
        }
        finally
        {
            System.IO.File.Delete(privateKeyPath);
        }
    }

    private static FeatureReadinessService CreateService(
        FeatureReadinessState state,
        long? organizationId,
        Dictionary<string, List<long>>? pilotOrganizations = null,
        string feature = FeatureKeys.TenantScreening,
        Dictionary<string, string?>? providerSettings = null)
    {
        var readinessOptions = new FeatureReadinessOptions
        {
            Features = new Dictionary<string, FeatureReadinessState>(StringComparer.OrdinalIgnoreCase)
            {
                [feature] = state
            },
            PilotOrganizations = pilotOrganizations ?? new Dictionary<string, List<long>>(StringComparer.OrdinalIgnoreCase)
        };
        var options = new Mock<IOptionsSnapshot<FeatureReadinessOptions>>();
        options.SetupGet(snapshot => snapshot.Value).Returns(readinessOptions);

        var configurationValues = providerSettings ?? new Dictionary<string, string?>
        {
            ["RentSpree:EnableBackgroundChecks"] = "true",
            ["RentSpree:ApiKey"] = "api-key",
            ["RentSpree:ApiSecret"] = "api-secret"
        };
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(configurationValues).Build();

        var featureGate = new Mock<IFeatureGateService>();
        featureGate.Setup(gate => gate.HasPlanFeatureAccessAsync(42, feature)).ReturnsAsync(true);

        var userRepository = new Mock<IUserRepository>();
        userRepository.Setup(repository => repository.GetUser(42)).ReturnsAsync(new User
        {
            Id = 42,
            CurrentOrganizationId = organizationId,
            UserRoles =
            [
                new UserRole { Role = new Role { RoleName = "Landlord" } }
            ]
        });

        return new FeatureReadinessService(
            options.Object,
            configuration,
            featureGate.Object,
            userRepository.Object,
            Mock.Of<ILogger<FeatureReadinessService>>());
    }
}
