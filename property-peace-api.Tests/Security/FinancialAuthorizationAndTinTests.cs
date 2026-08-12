using System.Text.Json;
using brownstone_hub_api.Attributes;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Dtos.Expense;
using brownstone_hub_api.Dtos.Vendor;
using FluentAssertions;
using Microsoft.AspNetCore.Authorization;
using Xunit;

namespace brownstone_hub_api.Tests.Security;

public sealed class FinancialAuthorizationAndTinTests
{
    [Theory]
    [InlineData(typeof(ExpenseController))]
    [InlineData(typeof(FutureExpenseController))]
    [InlineData(typeof(RecurringExpenseController))]
    [InlineData(typeof(BankReconciliationController))]
    [InlineData(typeof(TaxReportController))]
    [InlineData(typeof(VendorController))]
    [InlineData(typeof(MoneyCenterController))]
    public void FinancialControllers_RequireLandlordOrAdminRole(Type controllerType)
    {
        var authorize = controllerType.GetCustomAttributes(typeof(AuthorizeAttribute), true)
            .Cast<AuthorizeAttribute>()
            .Single();

        authorize.Roles.Should().Be("Landlord,Admin");
    }

    [Theory]
    [InlineData(typeof(ExpenseController))]
    [InlineData(typeof(FutureExpenseController))]
    [InlineData(typeof(RecurringExpenseController))]
    [InlineData(typeof(BankReconciliationController))]
    [InlineData(typeof(TaxReportController))]
    [InlineData(typeof(VendorController))]
    [InlineData(typeof(MoneyCenterController))]
    public void FinancialControllers_RequireOwnerOrManagerRoleInActiveOrganization(Type controllerType)
    {
        var organizationRole = controllerType
            .GetCustomAttributes(typeof(RequireOrganizationRoleAttribute), true)
            .Cast<RequireOrganizationRoleAttribute>()
            .Single();

        organizationRole.AllowedRoles.Should().BeEquivalentTo("Owner", "Manager");
    }

    [Fact]
    public void BroadVendorAndExpenseResponses_DoNotSerializeTin()
    {
        const string tin = "12-3456789";

        var vendorJson = JsonSerializer.Serialize(new LoadVendorDto { TaxId = tin });
        var expenseJson = JsonSerializer.Serialize(new LoadExpenseDto { VendorTaxId = tin });

        vendorJson.Should().NotContain(tin).And.NotContain("TaxId");
        expenseJson.Should().NotContain(tin).And.NotContain("VendorTaxId");
    }
}
