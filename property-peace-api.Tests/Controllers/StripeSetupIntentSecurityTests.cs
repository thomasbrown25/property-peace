using System.Reflection;
using System.Security.Claims;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Stripe;
using brownstone_hub_api.Dtos.User;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Middleware;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.BankAccounts;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.BankAccountService;
using brownstone_hub_api.Services.OrganizationService;
using brownstone_hub_api.Services.StripeRentPayments;
using brownstone_hub_api.Services.StripeService;
using brownstone_hub_api.Services.UserService;
using brownstone_hub_api.Tests.Services.StripeRentPayments;
using FluentAssertions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Controllers;

public sealed class StripeSetupIntentSecurityTests
{
    [Fact]
    public void SetupIsExplicitlyTenantOnlyAndRequiresResolvedOrganization()
    {
        var method = typeof(StripeController).GetMethod(nameof(StripeController.CreateSetupIntent))!;
        method.GetCustomAttribute<AuthorizeAttribute>()!.Roles.Should().Be("Tenant");
        method.GetCustomAttribute<TenantSelfOrganizationAttribute>()!.AllowWithoutOrganization.Should().BeFalse();
        method.GetCustomAttribute<OrganizationContextOptionalAttribute>().Should().BeNull();
    }

    [Theory]
    [InlineData("acct_snapshot", "cus_acct_snapshot_7")]
    [InlineData("acct_landlord", "cus_acct_landlord_7")]
    public async Task SetupUsesOnlyCurrentTenantsLeasePayeeAndAccountScopedCustomer(string account, string customer)
    {
        await using var db = await Seed(account);
        // A platform subscription customer must never be used for connected rent setup.
        db.Users.Add(new User { Id = 7, StripeCustomerId = "cus_platform_subscription" });
        await db.SaveChangesAsync();
        var gateway = new Mock<IStripeRentGateway>(MockBehavior.Strict);
        gateway.Setup(x => x.CreateSetupIntentAsync(customer, account, 7, 44, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new StripeRentSetupResult("seti_scoped", "test_client_secret"));
        var risk = new Mock<IStripeRentRiskService>(MockBehavior.Strict);
        risk.Setup(x => x.EvaluateCollectionPayeeAsync(It.Is<StripeRentPayment>(p =>
                p.LeaseId == 44 && p.OrganizationId == 9 && p.TenantUserId == 7
                && p.DestinationStripeAccountId == account), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RentTransferRiskDecision.Allow());

        var result = (await Controller(db, gateway.Object, risk.Object).CreateSetupIntent(44))
            .Should().BeOfType<OkObjectResult>().Subject;
        var response = result.Value.Should().BeOfType<ServiceResponse<CreateSetupIntentResponseDto>>().Subject;
        response.Data!.CustomerId.Should().Be(customer);
        response.Data.StripeAccountId.Should().Be(account);
        response.Data.SetupIntentId.Should().Be("seti_scoped");
        gateway.VerifyAll();
        gateway.VerifyNoOtherCalls();
        risk.VerifyAll();
        risk.VerifyNoOtherCalls();
    }

    [Theory]
    [InlineData("foreign-user")]
    [InlineData("foreign-organization")]
    [InlineData("missing-organization")]
    [InlineData("foreign-lease")]
    [InlineData("missing-lease")]
    [InlineData("inactive-lease")]
    [InlineData("deleted-lease")]
    [InlineData("deleted-tenant")]
    [InlineData("foreign-tenant-organization")]
    [InlineData("short-stay")]
    public async Task SetupRejectsUnscopedOrUnauthorizedLeaseBeforeRiskOrStripe(string scenario)
    {
        await using var db = await Seed("acct_snapshot");
        var lease = db.Leases.Local.Single();
        if (scenario == "inactive-lease") lease.IsActive = false;
        if (scenario == "deleted-lease") lease.IsDeleted = true;
        if (scenario == "deleted-tenant") db.Tenants.Local.Single(t => t.UserId == 7).IsDeleted = true;
        if (scenario == "foreign-tenant-organization") db.Tenants.Local.Single(t => t.UserId == 7).OrganizationId = 99;
        if (scenario == "short-stay") db.Units.Local.Single().RentalMode = ERentalMode.ShortTerm;
        await db.SaveChangesAsync();
        var gateway = new Mock<IStripeRentGateway>(MockBehavior.Strict);
        var risk = new Mock<IStripeRentRiskService>(MockBehavior.Strict);
        var controller = Controller(db, gateway.Object, risk.Object,
            scenario == "foreign-user" ? 8 : 7,
            scenario == "missing-organization" ? null : scenario == "foreign-organization" ? 99 : 9);

        (await controller.CreateSetupIntent(scenario == "foreign-lease" ? 55 : scenario == "missing-lease" ? 0 : 44))
            .Should().BeOfType<ObjectResult>().Which.StatusCode.Should().Be(403);
        gateway.VerifyNoOtherCalls();
        risk.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task SetupRejectsUnreadyPayeeBeforeCreatingCustomerOrSetupIntent()
    {
        await using var db = await Seed("acct_snapshot");
        var gateway = new Mock<IStripeRentGateway>(MockBehavior.Strict);
        var risk = new Mock<IStripeRentRiskService>(MockBehavior.Strict);
        risk.Setup(x => x.EvaluateCollectionPayeeAsync(It.IsAny<StripeRentPayment>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new RentTransferRiskDecision(false, "not approved"));
        (await Controller(db, gateway.Object, risk.Object).CreateSetupIntent(44)).Should().BeOfType<ConflictObjectResult>();
        gateway.VerifyNoOtherCalls();
        risk.VerifyAll();
    }

    private static async Task<DataContext> Seed(string account)
    {
        var db = StripeRentPaymentFlowTests.CreateContext();
        await StripeRentPaymentFlowTests.SeedLeaseAsync(db, 44, 9);
        await StripeRentPaymentFlowTests.SeedLeaseDestinationAsync(db, 44, 9, account);
        return db;
    }

    private static StripeController Controller(DataContext db, IStripeRentGateway gateway,
        IStripeRentRiskService risk, long userId = 7, long? organizationId = 9)
    {
        var users = new Mock<IUserService>(MockBehavior.Strict);
        users.Setup(x => x.GetUserByIdAsync(userId))
            .ReturnsAsync(ServiceResponse<LoadUserDto>.CreateSuccess(new LoadUserDto { Id = userId }));
        var controller = new StripeController(Mock.Of<IStripeService>(MockBehavior.Strict), users.Object,
            Mock.Of<IOrganizationService>(), Mock.Of<IBankAccountService>(), Mock.Of<IBankAccountRepository>(),
            Mock.Of<IUserRepository>(), Mock.Of<ILogger<StripeController>>(), context: db, rentGateway: gateway, rentRisk: risk);
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity([
                new Claim(ClaimTypes.NameIdentifier, userId.ToString()), new Claim(ClaimTypes.Role, "Tenant")], "test"))
        } };
        if (organizationId.HasValue) controller.HttpContext.Items["OrganizationId"] = organizationId.Value;
        return controller;
    }
}
