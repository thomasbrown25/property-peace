using System.Reflection;
using brownstone_hub_api.Config;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Filters;
using brownstone_hub_api.Services.RentPaymentAccess;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace brownstone_hub_api.Tests.Services.FeatureReadiness;

public class ProviderEndpointReadinessTests
{
    public static TheoryData<Type, string, string> ProviderEndpoints => new()
    {
        { typeof(LeaseController), nameof(LeaseController.SignLandlordOnly), FeatureKeys.ESignature },
        { typeof(LeaseController), nameof(LeaseController.SendLeaseForSignature), FeatureKeys.ESignature },
        { typeof(LeaseController), nameof(LeaseController.GetLeaseSignatureStatus), FeatureKeys.ESignature },
        { typeof(LeaseController), nameof(LeaseController.CancelLeaseSignature), FeatureKeys.ESignature },
        { typeof(LeaseController), nameof(LeaseController.SyncSignatureStatus), FeatureKeys.ESignature },
        { typeof(LeaseController), nameof(LeaseController.GetLandlordSigningUrl), FeatureKeys.ESignature },
        { typeof(LeaseController), nameof(LeaseController.ResendLeaseSignature), FeatureKeys.ESignature },

        { typeof(OrganizationSmsNumberController), nameof(OrganizationSmsNumberController.SearchAvailable), FeatureKeys.DedicatedSmsNumber },
        { typeof(OrganizationSmsNumberController), nameof(OrganizationSmsNumberController.Purchase), FeatureKeys.DedicatedSmsNumber },
        { typeof(OrganizationSmsNumberController), nameof(OrganizationSmsNumberController.GetPurchaseStatus), FeatureKeys.DedicatedSmsNumber },

        { typeof(AICopilotController), nameof(AICopilotController.GetOrganizationSummary), FeatureKeys.Percy },
        { typeof(AICopilotController), nameof(AICopilotController.Chat), FeatureKeys.Percy },
        { typeof(AICopilotController), nameof(AICopilotController.StreamChat), FeatureKeys.Percy },
        { typeof(AICopilotController), nameof(AICopilotController.ListConversations), FeatureKeys.Percy },
        { typeof(AICopilotController), nameof(AICopilotController.GetConversation), FeatureKeys.Percy },
        { typeof(AICopilotController), nameof(AICopilotController.DeleteConversation), FeatureKeys.Percy },
        { typeof(AICopilotController), nameof(AICopilotController.ConfirmAction), FeatureKeys.Percy },
        { typeof(AICopilotController), nameof(AICopilotController.DeclineAction), FeatureKeys.Percy },
        { typeof(AICopilotController), nameof(AICopilotController.TriggerOverdueRentSweep), FeatureKeys.Percy },
        { typeof(AICopilotController), nameof(AICopilotController.GetAgentDashboardSummary), FeatureKeys.Percy },
        { typeof(AICopilotController), nameof(AICopilotController.GetCollectionsHistory), FeatureKeys.Percy },
        { typeof(AICopilotController), nameof(AICopilotController.ForceFollowUp), FeatureKeys.Percy },
    };
    public static TheoryData<string, RentPaymentAction> StripeRentPaymentEndpoints => new()
    {
        { nameof(StripeController.CreateConnectAccount), RentPaymentAction.Configure },
        { nameof(StripeController.GetAccountStatus), RentPaymentAction.Configure },
        { nameof(StripeController.CreateAccountLink), RentPaymentAction.Configure },
        { nameof(StripeController.CreateLoginLink), RentPaymentAction.Configure },
        { nameof(StripeController.CreateAccountSession), RentPaymentAction.Configure },
        { nameof(StripeController.CreateAccountManagementSession), RentPaymentAction.Configure },
        { nameof(StripeController.SyncBankAccount), RentPaymentAction.Configure },
        { nameof(StripeController.CreateSetupIntent), RentPaymentAction.Pay },
        { nameof(StripeController.CreatePaymentIntent), RentPaymentAction.Pay },
        { nameof(StripeController.UpdatePaymentIntent), RentPaymentAction.Pay }
    };
    [Theory]
    [MemberData(nameof(ProviderEndpoints))]
    public void ProviderTouchingEndpoint_RequiresItsCanonicalReadinessFeature(
        Type controllerType, string actionName, string expectedFeature)
    {
        var action = controllerType.GetMethods(BindingFlags.Instance | BindingFlags.Public)
            .Single(method => method.Name == actionName);

        GetRequiredFeatures(controllerType, action).Should().Contain(expectedFeature);
    }

    [Theory]
    [MemberData(nameof(StripeRentPaymentEndpoints))]
    public void StripeRentPaymentEndpoint_RequiresItsActionSpecificReadinessGate(
        string actionName, RentPaymentAction expectedAction)
    {
        var action = typeof(StripeController).GetMethods(BindingFlags.Instance | BindingFlags.Public)
            .Single(method => method.Name == actionName);

        action.CustomAttributes
            .Where(attribute => attribute.AttributeType == typeof(RequireRentPaymentActionReadyAttribute))
            .Select(attribute => (RentPaymentAction)attribute.ConstructorArguments.Single().Value!)
            .Should().ContainSingle()
            .Which.Should().Be(expectedAction);
    }

    private static IEnumerable<string> GetRequiredFeatures(Type controllerType, MethodInfo action)
    {
        return controllerType.CustomAttributes.Concat(action.CustomAttributes)
            .Where(attribute => attribute.AttributeType == typeof(RequireFeatureReadyAttribute))
            .Select(attribute => (string)attribute.ConstructorArguments.Single().Value!);
    }
}
