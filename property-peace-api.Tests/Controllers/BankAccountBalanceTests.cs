using System.Reflection;
using System.Text.Json;
using AutoMapper;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Dtos.BankAccount;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.BankAccounts;
using brownstone_hub_api.Services.BankAccountService;
using brownstone_hub_api.Services.OrganizationService;
using brownstone_hub_api.Services.UserService;
using FluentAssertions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Stripe;
using Xunit;
using Account = brownstone_hub_api.Models.BankAccount;
using AccountService = brownstone_hub_api.Services.BankAccountService.BankAccountService;

namespace brownstone_hub_api.Tests.Controllers;

public sealed class BankAccountBalanceTests
{
    [Fact]
    public void Endpoint_InheritsLandlordAdminAuthorization_AndHasReadOnlyRoute()
    {
        typeof(BankAccountController).GetCustomAttribute<AuthorizeAttribute>()!.Roles.Should().Be("Landlord,Admin");
        var method = typeof(BankAccountController).GetMethod(nameof(BankAccountController.GetBankAccountBalance))!;
        method.GetCustomAttribute<HttpGetAttribute>()!.Template.Should().Be("{id:long}/balance");
        method.GetCustomAttribute<AllowAnonymousAttribute>().Should().BeNull();
    }

    [Fact]
    public async Task UnverifiedHeaderAlone_IsForbiddenWithoutServiceCall()
    {
        var service = new Mock<IBankAccountService>(MockBehavior.Strict);
        var controller = Controller(service.Object);
        controller.Request.Headers["X-Organization-Id"] = "99";
        var result = (ObjectResult)await controller.GetBankAccountBalance(7);
        result.StatusCode.Should().Be(403);
        service.VerifyNoOtherCalls();
    }

    [Theory]
    [InlineData(true, 200)]
    [InlineData(false, 404)]
    [InlineData(false, 502)]
    public async Task Controller_UsesVerifiedOrganization_AndPreservesResponse(bool success, int status)
    {
        var response = new ServiceResponse<BankAccountBalanceDto> { Success = success, StatusCode = status };
        var service = new Mock<IBankAccountService>(MockBehavior.Strict);
        service.Setup(x => x.GetBankAccountBalanceAsync(7, 2)).ReturnsAsync(response);
        var controller = Controller(service.Object);
        controller.HttpContext.Items["OrganizationId"] = 2L;
        controller.Request.Headers["X-Organization-Id"] = "99";
        var result = (ObjectResult)await controller.GetBankAccountBalance(7);
        result.StatusCode.Should().Be(status);
        result.Value.Should().BeSameAs(response);
        service.VerifyAll();
    }

    [Theory]
    [InlineData(2, true, "acct_connected", true)]
    [InlineData(99, true, "acct_connected", false)]
    [InlineData(2, false, "acct_connected", false)]
    [InlineData(2, true, "", false)]
    [InlineData(2, true, " ", false)]
    [InlineData(2, true, "platform", false)]
    public async Task Service_OnlyRetrievesActiveConnectedAccountInOrganization(long org, bool active, string stripeId, bool allowed)
    {
        var repository = new Mock<IBankAccountRepository>(MockBehavior.Strict);
        repository.Setup(x => x.GetBankAccountByIdAsync(7, 2)).ReturnsAsync(new Account
            { Id = 7, OrganizationId = org, IsActive = active, StripeAccountId = stripeId });
        var gateway = new Mock<IStripeConnectedBalanceGateway>(MockBehavior.Strict);
        if (allowed) gateway.Setup(x => x.GetAsync("acct_connected")).ReturnsAsync(new Balance());
        var response = await Service(repository.Object, gateway.Object).GetBankAccountBalanceAsync(7, 2);
        response.Success.Should().Be(allowed);
        response.StatusCode.Should().Be(allowed ? 200 : 404);
        gateway.Verify(x => x.GetAsync(It.IsAny<string>()), allowed ? Times.Once() : Times.Never());
        repository.VerifyAll();
    }

    [Theory]
    [InlineData(2, true)]
    [InlineData(99, true)]
    [InlineData(2, false)]
    public async Task ActualRepository_ScopesAccountByIdOrganizationAndActiveFlag(long org, bool active)
    {
        await using var context = Services.StripeRentPayments.StripeRentPaymentFlowTests.CreateContext();
        context.BankAccounts.Add(new Account { Id = 7, OrganizationId = org, IsActive = active, StripeAccountId = "acct_connected" });
        await context.SaveChangesAsync();
        var gateway = new Mock<IStripeConnectedBalanceGateway>(MockBehavior.Strict);
        var allowed = org == 2 && active;
        if (allowed) gateway.Setup(x => x.GetAsync("acct_connected")).ReturnsAsync(new Balance());
        var response = await Service(new BankAccountRepository(context), gateway.Object).GetBankAccountBalanceAsync(7, 2);
        response.Success.Should().Be(allowed);
        gateway.Verify(x => x.GetAsync(It.IsAny<string>()), allowed ? Times.Once() : Times.Never());
    }

    [Fact]
    public async Task MissingAccount_DoesNotCallStripe()
    {
        var repository = new Mock<IBankAccountRepository>();
        var gateway = new Mock<IStripeConnectedBalanceGateway>(MockBehavior.Strict);
        var response = await Service(repository.Object, gateway.Object).GetBankAccountBalanceAsync(7, 2);
        response.StatusCode.Should().Be(404);
        gateway.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task StripeFailure_IsSanitizedAndDoesNotReturnInventedBalance()
    {
        var repository = new Mock<IBankAccountRepository>();
        repository.Setup(x => x.GetBankAccountByIdAsync(7, 2)).ReturnsAsync(new Account
            { Id = 7, OrganizationId = 2, StripeAccountId = "acct_connected" });
        var gateway = new Mock<IStripeConnectedBalanceGateway>();
        gateway.Setup(x => x.GetAsync("acct_connected")).ThrowsAsync(new StripeException("secret-provider-details"));
        var response = await Service(repository.Object, gateway.Object).GetBankAccountBalanceAsync(7, 2);
        response.Success.Should().BeFalse();
        response.StatusCode.Should().Be(502);
        response.Data.Should().BeNull();
        JsonSerializer.Serialize(response).Should().NotContain("secret-provider-details");
        response.Errors.Details.Should().BeNull();
        response.Errors.InnerException.Should().BeNull();
    }

    [Fact]
    public async Task Gateway_UsesConnectedStripeRequestOptionsExactlyOnce()
    {
        var balance = new Balance();
        var stripe = new Mock<BalanceService>();
        stripe.Setup(x => x.GetAsync(It.IsAny<BalanceGetOptions>(),
            It.Is<RequestOptions>(o => o.StripeAccount == "acct_connected"), It.IsAny<CancellationToken>())).ReturnsAsync(balance);
        var result = await new StripeConnectedBalanceGateway(stripe.Object).GetAsync("acct_connected");
        result.Should().BeSameAs(balance);
        stripe.Verify(x => x.GetAsync(It.IsAny<BalanceGetOptions>(),
            It.Is<RequestOptions>(o => o.StripeAccount == "acct_connected"), It.IsAny<CancellationToken>()), Times.Once());
        stripe.VerifyNoOtherCalls();
    }

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData("platform")]
    public async Task Gateway_RejectsMissingConnectedAccountWithoutPlatformRequest(string account)
    {
        var stripe = new Mock<BalanceService>(MockBehavior.Strict);
        await Assert.ThrowsAsync<ArgumentException>(() => new StripeConnectedBalanceGateway(stripe.Object).GetAsync(account));
        stripe.VerifyNoOtherCalls();
    }

    [Theory]
    [InlineData("usd", 12345, "123.45")]
    [InlineData("eur", -12345, "-123.45")]
    [InlineData("JPY", 12345, "12345")]
    [InlineData("krw", 12345, "12345")]
    [InlineData("bif", 12345, "12345")]
    [InlineData("clp", 12345, "12345")]
    [InlineData("djf", 12345, "12345")]
    [InlineData("gnf", 12345, "12345")]
    [InlineData("kmf", 12345, "12345")]
    [InlineData("mga", 12345, "12345")]
    [InlineData("pyg", 12345, "12345")]
    [InlineData("rwf", 12345, "12345")]
    [InlineData("vnd", 12345, "12345")]
    [InlineData("vuv", 12345, "12345")]
    [InlineData("xaf", 12345, "12345")]
    [InlineData("xof", 12345, "12345")]
    [InlineData("xpf", 12345, "12345")]
    [InlineData("bhd", 12345, "12.345")]
    [InlineData("jod", 12345, "12.345")]
    [InlineData("kwd", 12345, "12.345")]
    [InlineData("omr", 12345, "12.345")]
    [InlineData("tnd", 12345, "12.345")]
    [InlineData("isk", 12300, "123")]
    [InlineData("ugx", 12300, "123")]
    [InlineData("huf", 12345, "123.45")]
    [InlineData("twd", 12345, "123.45")]
    public void ProductionConversion_UsesStripeCurrencyUnits(string currency, long amount, string expected)
    {
        StripeBalanceMapper.ToMajorUnits(amount, currency).Should().Be(decimal.Parse(expected, System.Globalization.CultureInfo.InvariantCulture));
    }

    [Fact]
    public void EmptyStripeBalance_ReturnsEmptyListNotUsdZero()
    {
        StripeBalanceMapper.Map(new Balance()).Balances.Should().BeEmpty();
    }

    [Fact]
    public void ProductionMapping_UnionsCurrenciesAggregatesAndKeepsAvailableSeparateFromPending()
    {
        var result = StripeBalanceMapper.Map(new Balance
        {
            Available = new() { new() { Currency = "USD", Amount = 100 }, new() { Currency = "usd", Amount = -25 }, new() { Currency = "jpy", Amount = 123 } },
            Pending = new() { new() { Currency = "usd", Amount = 350 }, new() { Currency = "kwd", Amount = 12345 } }
        });
        result.Balances.Should().BeEquivalentTo(new[]
        {
            new StripeCurrencyBalanceDto { Currency = "usd", Available = .75m, Pending = 3.5m },
            new StripeCurrencyBalanceDto { Currency = "jpy", Available = 123m },
            new StripeCurrencyBalanceDto { Currency = "kwd", Pending = 12.345m }
        });
        var json = JsonSerializer.Serialize(result, new JsonSerializerOptions(JsonSerializerDefaults.Web));
        json.Should().Contain("\"balances\"").And.Contain("\"available\":0.75").And.Contain("\"pending\":3.5");
    }

    private static AccountService Service(IBankAccountRepository repository, IStripeConnectedBalanceGateway gateway) =>
        new(repository, Mock.Of<IMapper>(), NullLogger<AccountService>.Instance, gateway);

    private static BankAccountController Controller(IBankAccountService service) =>
        new(service, Mock.Of<IOrganizationService>(), Mock.Of<IUserService>(), null!, NullLogger<BankAccountController>.Instance)
        { ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() } };
}
