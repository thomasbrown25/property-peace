using System.Reflection;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Middleware;
using FluentAssertions;
using Microsoft.AspNetCore.Authorization;
using Xunit;

namespace brownstone_hub_api.Tests.Controllers;

public sealed class TenantSelfEndpointPolicyTests
{
    [Theory]
    [InlineData(typeof(LeaseController), nameof(LeaseController.GetMyLeases), true)]
    [InlineData(typeof(LeaseController), nameof(LeaseController.GetMyLease), true)]
    [InlineData(typeof(PaymentController), nameof(PaymentController.GetTenantLeasePaymentHistory), true)]
    [InlineData(typeof(RentCollectionController), nameof(RentCollectionController.GetMyRentCollection), false)]
    [InlineData(typeof(FeatureReadinessController), nameof(FeatureReadinessController.GetRentPaymentPayReadiness), false)]
    [InlineData(typeof(StripeController), nameof(StripeController.CreatePaymentIntent), false)]
    [InlineData(typeof(StripeController), nameof(StripeController.UpdatePaymentIntent), false)]
    public void OnlyDesignatedTenantSelfEndpointsOptIn(Type controller, string action, bool headerless)
    {
        controller.GetMethod(action)!.GetCustomAttribute<TenantSelfOrganizationAttribute>()!
            .AllowWithoutOrganization.Should().Be(headerless);
    }

    [Theory]
    [InlineData(typeof(PaymentController), nameof(PaymentController.AddPayment))]
    [InlineData(typeof(RentCollectionController), nameof(RentCollectionController.AddPayment))]
    [InlineData(typeof(RentCollectionController), nameof(RentCollectionController.GetRentCollection))]

    [InlineData(typeof(StripeController), nameof(StripeController.CreateSetupIntent))]
    public void BroadOrMutationEndpointsNeverInheritTenantSelfAuthority(Type controller, string action)
    {
        var method = controller.GetMethod(action)!;
        method.GetCustomAttribute<TenantSelfOrganizationAttribute>().Should().BeNull();
        if (action is nameof(PaymentController.AddPayment) or nameof(RentCollectionController.AddPayment) or nameof(RentCollectionController.GetRentCollection))
            method.GetCustomAttribute<AuthorizeAttribute>()!.Roles.Should().Be("Landlord,Admin");
    }

    [Theory]
    [InlineData(nameof(UserController.GetSettings))]
    [InlineData(nameof(UserController.SaveSettings))]
    [InlineData(nameof(UserController.GetNotificationSettings))]
    [InlineData(nameof(UserController.SaveNotificationSettings))]
    [InlineData(nameof(UserController.UpdateAccount))]
    [InlineData(nameof(UserController.ChangePassword))]
    public void PersonalSettingsAreOrganizationIndependent(string action) =>
        typeof(UserController).GetMethod(action)!.GetCustomAttribute<OrganizationContextOptionalAttribute>().Should().NotBeNull();

    [Theory]
    [InlineData(typeof(PaymentController), nameof(PaymentController.AddPayment))]
    [InlineData(typeof(RentCollectionController), nameof(RentCollectionController.AddPayment))]
    public void ManualPaymentRequiresSelectedOrganizationWriteRole(Type controller, string action) =>
        controller.GetMethod(action)!.GetCustomAttribute<ManualPaymentWriteAttribute>().Should().NotBeNull();
}
