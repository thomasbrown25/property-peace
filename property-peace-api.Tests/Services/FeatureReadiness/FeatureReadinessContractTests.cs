using System.Text.Json;
using System.Text.Json.Serialization;
using brownstone_hub_api.Config;
using brownstone_hub_api.Services.FeatureReadiness;
using FluentAssertions;
using Microsoft.Extensions.Options;
using Xunit;

namespace brownstone_hub_api.Tests.Services.FeatureReadiness;

public class FeatureReadinessContractTests
{
    public static TheoryData<FeatureReadinessState> NonInvokableStates => new()
    {
        FeatureReadinessState.Unavailable,
        FeatureReadinessState.ComingSoon,
        FeatureReadinessState.ConfigurationRequired,
        FeatureReadinessState.Suspended,
    };

    [Fact]
    public void Contract_DefinesTheCanonicalStates()
    {
        Enum.GetNames<FeatureReadinessState>().Should().Equal(
            "Unavailable", "ComingSoon", "ConfigurationRequired", "Pilot", "Available", "Suspended");
    }

    [Theory]
    [MemberData(nameof(NonInvokableStates))]
    public void Evaluate_DeniesNonInvokableGlobalState_EvenWhenEveryOtherGatePasses(FeatureReadinessState state)
    {
        var result = FeatureReadinessEvaluator.Evaluate(
            FeatureKeys.TenantScreening, state,
            planEntitled: true, organizationReady: true,
            providerConfigured: true, userAuthorized: true);

        result.CanInvoke.Should().BeFalse();
        result.GlobalGateEnabled.Should().BeFalse();
    }

    [Theory]
    [InlineData(FeatureReadinessState.Available)]
    [InlineData(FeatureReadinessState.Pilot)]
    public void Evaluate_AllowsInvokableState_OnlyWhenEveryGatePasses(FeatureReadinessState state)
    {
        var ready = FeatureReadinessEvaluator.Evaluate(
            FeatureKeys.TenantScreening, state, true, true, true, true);
        var notEntitled = FeatureReadinessEvaluator.Evaluate(
            FeatureKeys.TenantScreening, state, false, true, true, true);

        ready.CanInvoke.Should().BeTrue();
        notEntitled.CanInvoke.Should().BeFalse();
        notEntitled.Blockers.Should().Contain("PlanEntitlement");
    }

    [Fact]
    public void Options_DefaultEveryCanonicalFeatureToUnavailable_FailClosed()
    {
        var options = new FeatureReadinessOptions();

        FeatureKeys.All.Should().OnlyContain(key =>
            options.GetState(key) == FeatureReadinessState.Unavailable);
    }

    [Fact]
    public void ResponseContract_SerializesStateToCamelCaseWireValue()
    {
        var result = FeatureReadinessEvaluator.Evaluate(
            FeatureKeys.TenantScreening, FeatureReadinessState.ConfigurationRequired,
            true, true, true, true);
        var jsonOptions = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        jsonOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase));

        var json = JsonSerializer.Serialize(result, jsonOptions);
        using var document = JsonDocument.Parse(json);

        document.RootElement.GetProperty("state").GetString().Should().Be("configurationRequired");
    }

    [Fact]
    public void ResponseContract_ContainsGateResultsButNoProviderSecrets()
    {
        var result = FeatureReadinessEvaluator.Evaluate(
            FeatureKeys.TenantScreening, FeatureReadinessState.Available,
            true, true, true, true);

        var publicProperties = result.GetType().GetProperties().Select(property => property.Name);
        publicProperties.Should().Contain(new[]
        {
            "Feature", "State", "CanInvoke", "PlanEntitled", "GlobalGateEnabled",
            "OrganizationReady", "ProviderConfigured", "UserAuthorized", "Blockers"
        });
        publicProperties.Should().NotContain(name =>
            name.Contains("Secret", StringComparison.OrdinalIgnoreCase) ||
            name.Contains("ApiKey", StringComparison.OrdinalIgnoreCase) ||
            name.Contains("Token", StringComparison.OrdinalIgnoreCase));
    }
}
