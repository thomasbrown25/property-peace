using System.Reflection;
using brownstone_hub_api.Config;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Filters;
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
        { typeof(AICopilotController), nameof(AICopilotController.ArchiveConversation), FeatureKeys.Percy },
        { typeof(AICopilotController), nameof(AICopilotController.ConfirmAction), FeatureKeys.Percy },
        { typeof(AICopilotController), nameof(AICopilotController.DeclineAction), FeatureKeys.Percy },
        { typeof(AICopilotController), nameof(AICopilotController.TriggerOverdueRentSweep), FeatureKeys.Percy },
        { typeof(AICopilotController), nameof(AICopilotController.GetAgentDashboardSummary), FeatureKeys.Percy },
        { typeof(AICopilotController), nameof(AICopilotController.GetCollectionsHistory), FeatureKeys.Percy },
        { typeof(AICopilotController), nameof(AICopilotController.ForceFollowUp), FeatureKeys.Percy },

        { typeof(StripeController), nameof(StripeController.CreateConnectAccount), FeatureKeys.OnlineRentCollection },
        { typeof(StripeController), nameof(StripeController.GetAccountStatus), FeatureKeys.OnlineRentCollection },
        { typeof(StripeController), nameof(StripeController.CreateAccountLink), FeatureKeys.OnlineRentCollection },
        { typeof(StripeController), nameof(StripeController.CreateLoginLink), FeatureKeys.OnlineRentCollection },
        { typeof(StripeController), nameof(StripeController.CreateAccountSession), FeatureKeys.OnlineRentCollection },
        { typeof(StripeController), nameof(StripeController.SyncBankAccount), FeatureKeys.OnlineRentCollection },
        { typeof(StripeController), nameof(StripeController.CreateSetupIntent), FeatureKeys.OnlineRentCollection },
        { typeof(StripeController), nameof(StripeController.CreatePaymentIntent), FeatureKeys.OnlineRentCollection },
        { typeof(StripeController), nameof(StripeController.UpdatePaymentIntent), FeatureKeys.OnlineRentCollection },
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

    private static IEnumerable<string> GetRequiredFeatures(Type controllerType, MethodInfo action)
    {
        return controllerType.CustomAttributes.Concat(action.CustomAttributes)
            .Where(attribute => attribute.AttributeType == typeof(RequireFeatureReadyAttribute))
            .Select(attribute => (string)attribute.ConstructorArguments.Single().Value!);
    }
}
