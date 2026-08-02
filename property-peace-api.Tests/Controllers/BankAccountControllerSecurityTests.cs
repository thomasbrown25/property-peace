using brownstone_hub_api.Controllers;
using brownstone_hub_api.Dtos.BankAccount;
using brownstone_hub_api.Dtos.Organization;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.BankAccountService;
using brownstone_hub_api.Services.OrganizationService;
using brownstone_hub_api.Services.UserService;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Controllers;

public sealed class BankAccountControllerSecurityTests
{
    [Fact]
    public async Task CreateBankAccount_RejectsStripeAccountNotLinkedToAuthenticatedUser()
    {
        await using var context = Services.StripeRentPayments.StripeRentPaymentFlowTests.CreateContext();
        context.Users.Add(new User { Id = 42, StripeAccountId = "acct_owned" });
        await context.SaveChangesAsync();

        var bankAccounts = new Mock<IBankAccountService>(MockBehavior.Strict);
        var organizations = new Mock<IOrganizationService>();
        organizations.Setup(x => x.GetCurrentUserOrganizationAsync(42)).ReturnsAsync(
            new ServiceResponse<LoadOrganizationDto> { Data = new LoadOrganizationDto { Id = 2 } });
        var users = new Mock<IUserService>();
        users.Setup(x => x.GetCurrentUserIdAsync()).ReturnsAsync(
            new ServiceResponse<long?> { Data = 42 });
        var controller = new BankAccountController(bankAccounts.Object, organizations.Object, users.Object,
            context, Mock.Of<ILogger<BankAccountController>>());

        var result = await controller.CreateBankAccount(new CreateBankAccountDto
        {
            OrganizationId = 2,
            StripeAccountId = "acct_someone_else",
            DisplayName = "Operating"
        });

        result.Should().BeOfType<ObjectResult>().Which.StatusCode.Should().Be(403);
        bankAccounts.Verify(x => x.CreateBankAccountAsync(It.IsAny<CreateBankAccountDto>()), Times.Never);
    }

    [Fact]
    public async Task CreateBankAccount_RejectsLinkedAccountOutsideApprovedOrganizationScope()
    {
        await using var context = Services.StripeRentPayments.StripeRentPaymentFlowTests.CreateContext();
        context.Users.Add(new User { Id = 42, StripeAccountId = "acct_owned" });
        context.StripeConnectedPayeeReviews.Add(new StripeConnectedPayeeReview
        {
            UserId = 42,
            StripeAccountId = "acct_owned",
            Status = StripePayeeReviewStatus.PayoutApproved,
            PropertyAuthorityAttested = true,
            ApprovedOrganizationId = 99
        });
        await context.SaveChangesAsync();

        var bankAccounts = new Mock<IBankAccountService>(MockBehavior.Strict);
        var organizations = new Mock<IOrganizationService>();
        organizations.Setup(x => x.GetCurrentUserOrganizationAsync(42)).ReturnsAsync(
            new ServiceResponse<LoadOrganizationDto> { Data = new LoadOrganizationDto { Id = 2 } });
        var users = new Mock<IUserService>();
        users.Setup(x => x.GetCurrentUserIdAsync()).ReturnsAsync(
            new ServiceResponse<long?> { Data = 42 });
        var controller = new BankAccountController(bankAccounts.Object, organizations.Object, users.Object,
            context, Mock.Of<ILogger<BankAccountController>>());

        var result = await controller.CreateBankAccount(new CreateBankAccountDto
        {
            OrganizationId = 2,
            StripeAccountId = "acct_owned",
            DisplayName = "Operating"
        });

        result.Should().BeOfType<ObjectResult>().Which.StatusCode.Should().Be(403);
        bankAccounts.Verify(x => x.CreateBankAccountAsync(It.IsAny<CreateBankAccountDto>()), Times.Never);
    }
}
