using System.Reflection;
using System.Security.Claims;
using brownstone_hub_api.Attributes;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Dtos.Organization;
using brownstone_hub_api.Dtos.Stripe;
using brownstone_hub_api.Dtos.User;
using brownstone_hub_api.Filters;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.BankAccounts;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.BankAccountService;
using brownstone_hub_api.Services.OrganizationService;
using brownstone_hub_api.Services.StripeRentPayments;
using brownstone_hub_api.Services.StripeService;
using brownstone_hub_api.Services.UserService;
using FluentAssertions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Configuration;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Controllers;

public sealed class StripeControllerSecurityTests
{
    [Theory]
    [InlineData("deposit:pooled:123")]
    [InlineData("fee:0")]
    [InlineData("fee:019")]
    [InlineData("fee:abc")]
    [InlineData("rent:124:2026-09-01")]
    [InlineData("rent:123:2026-9-01")]
    [InlineData("rent:123:2026-02-30")]
    [InlineData("rent:0123:2026-09-01")]
    [InlineData("")]
    public async Task UnsupportedCharge_CreateAndUpdateFailClosedEvenWhenRentGateOpen(string chargeId)
    {
        var stripe = new Mock<IStripeService>(MockBehavior.Strict);
        var controller = CreateController(stripe.Object, configuration: new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Stripe:RentPaymentsEnabled"] = "true" }).Build());
        var create = await controller.CreatePaymentIntent(new CreatePaymentIntentDto
        {
            LeaseId = 123, Amount = 50m, OperationId = Guid.NewGuid().ToString(), ChargeId = chargeId
        });
        var update = await controller.UpdatePaymentIntent(new UpdatePaymentIntentDto
        {
            LeaseId = 123, Amount = 50m, PaymentIntentId = "pi_existing", ChargeId = chargeId
        });
        create.Should().BeOfType<ObjectResult>().Which.StatusCode.Should().Be(503);
        update.Should().BeOfType<ObjectResult>().Which.StatusCode.Should().Be(503);
        stripe.VerifyNoOtherCalls();
    }

    [Theory]
    [InlineData("fee:19")]
    [InlineData("rent:123:2026-09-01")]
    public async Task CanonicalSelectedCharge_CreateAndUpdateForwardExactSelector(string chargeId)
    {
        var stripe = new Mock<IStripeService>(MockBehavior.Strict);
        stripe.Setup(x => x.CreatePaymentIntentAsync(123, 50m, It.IsAny<string>(), null, chargeId))
            .ReturnsAsync(ServiceResponse<CreatePaymentIntentResponseDto>.CreateSuccess(new CreatePaymentIntentResponseDto()));
        stripe.Setup(x => x.UpdatePaymentIntentAsync("pi_existing", 123, 50m, null, chargeId))
            .ReturnsAsync(ServiceResponse<CreatePaymentIntentResponseDto>.CreateSuccess(new CreatePaymentIntentResponseDto()));
        var controller = CreateController(stripe.Object, configuration: new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Stripe:RentPaymentsEnabled"] = "true" }).Build());
        (await controller.CreatePaymentIntent(new CreatePaymentIntentDto
        {
            LeaseId = 123, Amount = 50m, OperationId = Guid.NewGuid().ToString(), ChargeId = chargeId
        })).Should().BeOfType<OkObjectResult>();
        (await controller.UpdatePaymentIntent(new UpdatePaymentIntentDto
        {
            LeaseId = 123, Amount = 50m, PaymentIntentId = "pi_existing", ChargeId = chargeId
        })).Should().BeOfType<OkObjectResult>();
        stripe.VerifyAll();
    }

    [Theory]
    [InlineData("fee:19")]
    [InlineData("rent:123:2026-09-01")]
    public async Task GateClosed_DeniesSelectedCreateAndUpdateBeforeService(string chargeId)
    {
        var stripe = new Mock<IStripeService>(MockBehavior.Strict);
        var controller = CreateController(stripe.Object);
        (await controller.CreatePaymentIntent(new CreatePaymentIntentDto
        {
            LeaseId = 123, Amount = 50m, OperationId = Guid.NewGuid().ToString(), ChargeId = chargeId
        })).Should().BeOfType<ObjectResult>().Which.StatusCode.Should().Be(503);
        (await controller.UpdatePaymentIntent(new UpdatePaymentIntentDto
        {
            LeaseId = 123, Amount = 50m, PaymentIntentId = "pi_existing", ChargeId = chargeId
        })).Should().BeOfType<ObjectResult>().Which.StatusCode.Should().Be(503);
        stripe.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task LegacyNullCharge_WhenGateOpen_IsForwardedForCreateAndUpdate()
    {
        var stripe = new Mock<IStripeService>(MockBehavior.Strict);
        stripe.Setup(x => x.CreatePaymentIntentAsync(123, 50m, It.IsAny<string>(), "Rent", null))
            .ReturnsAsync(ServiceResponse<CreatePaymentIntentResponseDto>.CreateSuccess(new CreatePaymentIntentResponseDto()));
        stripe.Setup(x => x.UpdatePaymentIntentAsync("pi_existing", 123, 50m, "Rent", null))
            .ReturnsAsync(ServiceResponse<CreatePaymentIntentResponseDto>.CreateSuccess(new CreatePaymentIntentResponseDto()));
        var controller = CreateController(stripe.Object, configuration: new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Stripe:RentPaymentsEnabled"] = "true" }).Build());
        (await controller.CreatePaymentIntent(new CreatePaymentIntentDto
        {
            LeaseId = 123, Amount = 50m, OperationId = Guid.NewGuid().ToString(), Description = "Rent"
        })).Should().BeOfType<OkObjectResult>();
        (await controller.UpdatePaymentIntent(new UpdatePaymentIntentDto
        {
            LeaseId = 123, Amount = 50m, PaymentIntentId = "pi_existing", Description = "Rent"
        })).Should().BeOfType<OkObjectResult>();
        stripe.VerifyAll();
    }

    [Fact]
    public async Task OwnedOnboarding_AllowsUnapprovedSelfAccountWithoutApprovingRent()
    {
        var stripe = new Mock<IStripeService>();
        stripe.Setup(x => x.CreateLoginLinkAsync("acct_self"))
            .ReturnsAsync(ServiceResponse<string>.CreateSuccess("https://stripe.test/dashboard"));
        var user = new Mock<IUserService>();
        user.Setup(x => x.GetUserByIdAsync(42)).ReturnsAsync(ServiceResponse<LoadUserDto>.CreateSuccess(
            new LoadUserDto { Id = 42, StripeAccountId = "acct_self" }));
        var payee = new Mock<IStripeConnectedPayeeService>();
        payee.Setup(x => x.ResolveOwnedAccountForOnboardingAsync(42, 77, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new OwnedStripeAccount(42, "acct_self"));
        var controller = CreateController(stripe.Object, user.Object, payeeService: payee.Object);
        Authenticate(controller, 42);
        controller.HttpContext.Items["OrganizationId"] = 77L;

        (await controller.CreateLoginLink()).Should().BeOfType<OkObjectResult>();
        stripe.Verify(x => x.CreateLoginLinkAsync("acct_self"), Times.Once);
        payee.Verify(x => x.ResolveApprovedDestinationAsync(It.IsAny<long>(), It.IsAny<long>(),
            It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task CreatePaymentIntent_WhenEmergencyGateDefaultsClosed_ReturnsServiceUnavailable()
    {
        var stripeService = new Mock<IStripeService>();
        stripeService
            .Setup(service => service.CreatePaymentIntentAsync(123, 500m, It.IsAny<string>(), "Rent", null))
            .ReturnsAsync(new ServiceResponse<CreatePaymentIntentResponseDto>
            {
                Data = new CreatePaymentIntentResponseDto
                {
                    ClientSecret = "secret",
                    PaymentIntentId = "pi_123"
                }
            });
        var controller = CreateController(stripeService.Object);

        var result = await controller.CreatePaymentIntent(new CreatePaymentIntentDto
        {
            LeaseId = 123,
            Amount = 500m,
            Description = "Rent"
        });

        result.Should().BeOfType<ObjectResult>()
            .Which.StatusCode.Should().Be(503);
        stripeService.Verify(
            service => service.CreatePaymentIntentAsync(
                It.IsAny<long>(),
                It.IsAny<decimal>(),
                It.IsAny<string>(),
                It.IsAny<string?>(),
                It.IsAny<string?>()),
            Times.Never);
    }

    [Theory]
    [InlineData(nameof(StripeController.CreatePaymentIntent))]
    [InlineData(nameof(StripeController.UpdatePaymentIntent))]
    [InlineData(nameof(StripeController.ConfirmPayment))]
    [InlineData(nameof(StripeController.ConfirmPaymentAllocated))]
    public void RentPaymentMutation_RequiresTenantRole(string actionName)
    {
        var action = typeof(StripeController).GetMethod(actionName, BindingFlags.Instance | BindingFlags.Public);

        action.Should().NotBeNull();
        var authorize = action!.GetCustomAttributes<AuthorizeAttribute>().SingleOrDefault();
        authorize.Should().NotBeNull();
        authorize!.Roles.Should().Be("Tenant");
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task BrowserConfirmation_IsAcknowledgementOnly_AndNeverFinalizesAccounting(bool allocated)
    {
        var stripeService = new Mock<IStripeService>(MockBehavior.Strict);
        var controller = CreateController(stripeService.Object);
        var request = new ConfirmPaymentDto
        {
            PaymentIntentId = "pi_browser",
            LeaseId = 999,
            Amount = 123.45m,
            PaymentDate = DateTime.UtcNow
        };

        var result = allocated
            ? await controller.ConfirmPaymentAllocated(request)
            : await controller.ConfirmPayment(request);

        result.Should().BeOfType<ObjectResult>()
            .Which.StatusCode.Should().Be(202);
        stripeService.VerifyNoOtherCalls();
    }

    [Fact]
    public void ArbitraryExistingAccountLinking_HasNoRoutablePostAction()
    {
        var linkAction = typeof(StripeController)
            .GetMethods(BindingFlags.Instance | BindingFlags.Public)
            .SingleOrDefault(method => method
                .GetCustomAttributes<HttpPostAttribute>()
                .Any(attribute => attribute.Template == "link-account"));

        linkAction.Should().BeNull();
    }

    [Fact]
    public async Task SyncBankAccount_WhenExactUserOrganizationDestinationIsNotApproved_DoesNotReachExistingOrCreationPath()
    {
        var userService = new Mock<IUserService>();
        userService.Setup(x => x.GetCurrentUserIdAsync())
            .ReturnsAsync(ServiceResponse<long?>.CreateSuccess(42));
        userService.Setup(x => x.GetUserByIdAsync(42))
            .ReturnsAsync(ServiceResponse<LoadUserDto>.CreateSuccess(new LoadUserDto
            {
                Id = 42, StripeAccountId = "acct_exact"
            }));
        var organizationService = new Mock<IOrganizationService>();
        organizationService.Setup(x => x.GetCurrentUserOrganizationAsync(42))
            .ReturnsAsync(ServiceResponse<LoadOrganizationDto>.CreateSuccess(new LoadOrganizationDto { Id = 77 }));
        var bankRepository = new Mock<IBankAccountRepository>(MockBehavior.Strict);
        var payeeService = new Mock<IStripeConnectedPayeeService>();
        payeeService.Setup(x => x.ResolveApprovedDestinationAsync(42, 77, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ApprovedStripeDestination(42, "acct_exact"));
        payeeService.Setup(x => x.IsApprovedDestinationAsync(42, 77, "acct_exact", It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        var controller = CreateController(
            Mock.Of<IStripeService>(), userService.Object, organizationService.Object,
            Mock.Of<IBankAccountService>(), bankRepository.Object, payeeService.Object);
        Authenticate(controller, 42);
        controller.HttpContext.Items["OrganizationId"] = 77L;

        var result = await controller.SyncBankAccount();

        result.Should().BeOfType<ObjectResult>().Which.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
        bankRepository.Verify(x => x.GetBankAccountByOrganizationAndStripeAccountIdAsync(
            It.IsAny<long>(), It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task SyncBankAccount_WhenFreshScopedReadinessSuspendsPayee_DoesNotExposeExistingDestination()
    {
        var userService = new Mock<IUserService>();
        userService.Setup(x => x.GetCurrentUserIdAsync())
            .ReturnsAsync(ServiceResponse<long?>.CreateSuccess(42));
        userService.Setup(x => x.GetUserByIdAsync(42))
            .ReturnsAsync(ServiceResponse<LoadUserDto>.CreateSuccess(new LoadUserDto
            {
                Id = 42, StripeAccountId = "acct_exact"
            }));
        var organizationService = new Mock<IOrganizationService>();
        organizationService.Setup(x => x.GetCurrentUserOrganizationAsync(42))
            .ReturnsAsync(ServiceResponse<LoadOrganizationDto>.CreateSuccess(new LoadOrganizationDto { Id = 77 }));
        var payeeService = new Mock<IStripeConnectedPayeeService>();
        payeeService.Setup(x => x.ResolveApprovedDestinationAsync(42, 77, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ApprovedStripeDestination(42, "acct_exact"));
        payeeService.Setup(x => x.IsApprovedDestinationAsync(42, 77, "acct_exact", It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);
        var stripeService = new Mock<IStripeService>();
        stripeService.Setup(x => x.GetAccountStatusAsync("acct_exact", 42, 77))
            .ReturnsAsync(ServiceResponse<StripeAccountStatusDto>.CreateSuccess(new StripeAccountStatusDto
            {
                AccountId = "acct_exact",
                IsInternallyPayoutApproved = false,
                IsAccountReadyForRentTransfers = false,
                AccountReadinessReason = "Stripe requirements became due."
            }));
        var bankRepository = new Mock<IBankAccountRepository>(MockBehavior.Strict);
        var controller = CreateController(
            stripeService.Object, userService.Object, organizationService.Object,
            Mock.Of<IBankAccountService>(), bankRepository.Object, payeeService.Object);
        Authenticate(controller, 42);
        controller.HttpContext.Items["OrganizationId"] = 77L;

        var result = await controller.SyncBankAccount();

        result.Should().BeOfType<ObjectResult>().Which.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
        stripeService.Verify(x => x.GetAccountStatusAsync("acct_exact", 42, 77), Times.Once);
        stripeService.Verify(x => x.GetAccountStatusAsync(It.IsAny<string>()), Times.Never);
        bankRepository.Verify(x => x.GetBankAccountByOrganizationAndStripeAccountIdAsync(
            It.IsAny<long>(), It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task GetAccountStatus_UsesMiddlewareOrganizationAndItsApprovedPayee_NotActorsGlobalAccount()
    {
        var userService = new Mock<IUserService>();
        var organizationService = new Mock<IOrganizationService>(MockBehavior.Strict);
        var payeeService = new Mock<IStripeConnectedPayeeService>();
        payeeService.Setup(x => x.ResolveApprovedDestinationAsync(42, 77, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ApprovedStripeDestination(51, "acct_org_77"));
        var stripeService = new Mock<IStripeService>();
        stripeService.Setup(x => x.GetAccountStatusAsync("acct_org_77", 51, 77))
            .ReturnsAsync(ServiceResponse<StripeAccountStatusDto>.CreateSuccess(new StripeAccountStatusDto
            {
                AccountId = "acct_org_77",
                PayoutsEnabled = true,
                IsInternallyPayoutApproved = true,
                IsAccountReadyForRentTransfers = true
            }));
        var controller = CreateController(stripeService.Object, userService.Object, organizationService.Object,
            payeeService: payeeService.Object);
        Authenticate(controller, 42);
        controller.HttpContext.Items["OrganizationId"] = 77L;

        var result = await controller.GetAccountStatus();

        result.Should().BeOfType<ObjectResult>().Which.StatusCode.Should().Be(403);
        stripeService.Verify(x => x.GetAccountStatusAsync("acct_org_77", 51, 77), Times.Never);
        stripeService.Verify(x => x.GetAccountStatusAsync("acct_actor_global", 42, It.IsAny<long>()), Times.Never);
        organizationService.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task GetAccountStatus_WhenSelectedOrganizationHasNoApprovedDestination_ExposesNoOtherAccount()
    {
        var payeeService = new Mock<IStripeConnectedPayeeService>();
        payeeService.Setup(x => x.ResolveApprovedDestinationAsync(42, 88, It.IsAny<CancellationToken>()))
            .ReturnsAsync((ApprovedStripeDestination?)null);
        var stripeService = new Mock<IStripeService>(MockBehavior.Strict);
        var controller = CreateController(stripeService.Object, payeeService: payeeService.Object);
        Authenticate(controller, 42);
        controller.HttpContext.Items["OrganizationId"] = 88L;

        var result = await controller.GetAccountStatus();

        result.Should().BeOfType<ObjectResult>().Which.StatusCode.Should().Be(403);
        stripeService.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task CreateAccountManagementSession_ManagerCannotModifyAnotherOwnersDestination()
    {
        var userService = new Mock<IUserService>();
        userService.Setup(x => x.GetCurrentUserIdAsync())
            .ReturnsAsync(ServiceResponse<long?>.CreateSuccess(42));
        userService.Setup(x => x.GetUserByIdAsync(42))
            .ReturnsAsync(ServiceResponse<LoadUserDto>.CreateSuccess(new LoadUserDto
            {
                Id = 42, StripeAccountId = "acct_actor_other_org"
            }));
        var payeeService = new Mock<IStripeConnectedPayeeService>();
        payeeService.Setup(x => x.ResolveApprovedDestinationAsync(42, 77, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ApprovedStripeDestination(51, "acct_owner_org_77"));
        var stripeService = new Mock<IStripeService>(MockBehavior.Strict);
        var controller = CreateController(stripeService.Object, userService.Object, payeeService: payeeService.Object);
        Authenticate(controller, 42);
        controller.HttpContext.Items["OrganizationId"] = 77L;

        var result = await controller.CreateAccountManagementSession();

        result.Should().BeOfType<ObjectResult>().Which.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
        stripeService.VerifyNoOtherCalls();
        payeeService.Verify(x => x.IsApprovedDestinationAsync(
            It.IsAny<long>(), It.IsAny<long>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task CreateAccountManagementSession_OwnerUsesOnlySelectedOrganizationsExactApprovedDestination()
    {
        var userService = new Mock<IUserService>();
        userService.Setup(x => x.GetCurrentUserIdAsync())
            .ReturnsAsync(ServiceResponse<long?>.CreateSuccess(42));
        userService.Setup(x => x.GetUserByIdAsync(42))
            .ReturnsAsync(ServiceResponse<LoadUserDto>.CreateSuccess(new LoadUserDto
            {
                Id = 42, StripeAccountId = "acct_stale_global"
            }));
        var payeeService = new Mock<IStripeConnectedPayeeService>();
        payeeService.Setup(x => x.ResolveOwnedAccountForOnboardingAsync(42, 77, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new OwnedStripeAccount(42, "acct_selected_org_77"));
        var stripeService = new Mock<IStripeService>();
        stripeService.Setup(x => x.CreateAccountManagementSessionAsync("acct_selected_org_77"))
            .ReturnsAsync(ServiceResponse<AccountSessionDto>.CreateSuccess(new AccountSessionDto
            {
                ClientSecret = "session_secret"
            }));
        var controller = CreateController(stripeService.Object, userService.Object, payeeService: payeeService.Object);
        Authenticate(controller, 42);
        controller.HttpContext.Items["OrganizationId"] = 77L;

        var result = await controller.CreateAccountManagementSession();

        result.Should().BeOfType<OkObjectResult>();
        stripeService.Verify(x => x.CreateAccountManagementSessionAsync("acct_selected_org_77"), Times.Once);
        stripeService.Verify(x => x.CreateAccountManagementSessionAsync("acct_stale_global"), Times.Never);
    }

    [Theory]
    [InlineData("account-link")]
    [InlineData("login-link")]
    [InlineData("account-session")]
    [InlineData("sync-bank-account")]
    public async Task AccountChangingOperation_UsesSelectedOrganizationsOwnedApprovedDestination_NotGlobalAccount(
        string operation)
    {
        var userService = new Mock<IUserService>();
        userService.Setup(x => x.GetCurrentUserIdAsync())
            .ReturnsAsync(ServiceResponse<long?>.CreateSuccess(42));
        userService.Setup(x => x.GetUserByIdAsync(42))
            .ReturnsAsync(ServiceResponse<LoadUserDto>.CreateSuccess(new LoadUserDto
            {
                Id = 42,
                StripeAccountId = "acct_stale_global"
            }));
        var organizationService = new Mock<IOrganizationService>(MockBehavior.Strict);
        var payeeService = new Mock<IStripeConnectedPayeeService>();
        payeeService.Setup(x => x.ResolveOwnedAccountForOnboardingAsync(42, 77, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new OwnedStripeAccount(42, "acct_selected_org_77"));
        payeeService.Setup(x => x.IsApprovedDestinationAsync(
                42, 77, "acct_selected_org_77", It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);
        var stripeService = new Mock<IStripeService>();
        stripeService.Setup(x => x.CreateAccountLinkAsync(
                "acct_selected_org_77", It.IsAny<string>(), It.IsAny<string>(), "account_onboarding"))
            .ReturnsAsync(ServiceResponse<string>.CreateSuccess("https://stripe.test/onboard"));
        stripeService.Setup(x => x.CreateLoginLinkAsync("acct_selected_org_77"))
            .ReturnsAsync(ServiceResponse<string>.CreateSuccess("https://stripe.test/dashboard"));
        stripeService.Setup(x => x.CreateAccountSessionAsync("acct_selected_org_77"))
            .ReturnsAsync(ServiceResponse<AccountSessionDto>.CreateSuccess(new AccountSessionDto
            {
                ClientSecret = "session_secret"
            }));
        stripeService.Setup(x => x.GetAccountStatusAsync("acct_selected_org_77", 42, 77))
            .ReturnsAsync(ServiceResponse<StripeAccountStatusDto>.CreateSuccess(new StripeAccountStatusDto
            {
                AccountId = "acct_selected_org_77",
                IsAccountReadyForRentTransfers = false
            }));
        var controller = CreateController(
            stripeService.Object, userService.Object, organizationService.Object,
            payeeService: payeeService.Object);
        Authenticate(controller, 42);
        controller.HttpContext.Items["OrganizationId"] = 77L;

        var result = operation switch
        {
            "account-link" => await controller.CreateAccountLink(new CreateAccountLinkRequest()),
            "login-link" => await controller.CreateLoginLink(),
            "account-session" => await controller.CreateAccountSession(),
            "sync-bank-account" => await controller.SyncBankAccount(),
            _ => throw new ArgumentOutOfRangeException(nameof(operation))
        };

        if (operation == "sync-bank-account")
            result.Should().BeOfType<ObjectResult>().Which.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
        else
            result.Should().BeOfType<OkObjectResult>();

        if (operation != "sync-bank-account")
            payeeService.Verify(x => x.ResolveOwnedAccountForOnboardingAsync(
                42, 77, It.IsAny<CancellationToken>()), Times.Once);
        organizationService.VerifyNoOtherCalls();
        stripeService.Verify(x => x.CreateAccountLinkAsync(
            "acct_stale_global", It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        stripeService.Verify(x => x.CreateLoginLinkAsync("acct_stale_global"), Times.Never);
        stripeService.Verify(x => x.CreateAccountSessionAsync("acct_stale_global"), Times.Never);
        stripeService.Verify(x => x.GetAccountStatusAsync(
            "acct_stale_global", It.IsAny<long>(), It.IsAny<long>()), Times.Never);
    }

    [Theory]
    [InlineData("account-link")]
    [InlineData("login-link")]
    [InlineData("account-session")]
    [InlineData("sync-bank-account")]
    public async Task AccountChangingOperation_WhenApprovedDestinationBelongsToAnotherPayee_FailsClosed(
        string operation)
    {
        var userService = new Mock<IUserService>();
        userService.Setup(x => x.GetCurrentUserIdAsync())
            .ReturnsAsync(ServiceResponse<long?>.CreateSuccess(42));
        userService.Setup(x => x.GetUserByIdAsync(42))
            .ReturnsAsync(ServiceResponse<LoadUserDto>.CreateSuccess(new LoadUserDto
            {
                Id = 42,
                StripeAccountId = "acct_stale_global"
            }));
        var organizationService = new Mock<IOrganizationService>(MockBehavior.Strict);
        var payeeService = new Mock<IStripeConnectedPayeeService>();
        payeeService.Setup(x => x.ResolveApprovedDestinationAsync(42, 77, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ApprovedStripeDestination(51, "acct_other_owner_org_77"));
        var stripeService = new Mock<IStripeService>(MockBehavior.Strict);
        var controller = CreateController(
            stripeService.Object, userService.Object, organizationService.Object,
            payeeService: payeeService.Object);
        Authenticate(controller, 42);
        controller.HttpContext.Items["OrganizationId"] = 77L;

        var result = operation switch
        {
            "account-link" => await controller.CreateAccountLink(new CreateAccountLinkRequest()),
            "login-link" => await controller.CreateLoginLink(),
            "account-session" => await controller.CreateAccountSession(),
            "sync-bank-account" => await controller.SyncBankAccount(),
            _ => throw new ArgumentOutOfRangeException(nameof(operation))
        };

        result.Should().BeOfType<ObjectResult>().Which.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
        stripeService.VerifyNoOtherCalls();
        payeeService.Verify(x => x.IsApprovedDestinationAsync(
            It.IsAny<long>(), It.IsAny<long>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        organizationService.VerifyNoOtherCalls();
    }

    [Fact]
    public void PaymentTransactions_RequiresAuthenticatedOwnerOrManager()
    {
        var action = typeof(StripeController).GetMethod(nameof(StripeController.GetPaymentTransactions));

        action.Should().NotBeNull();
        typeof(StripeController).GetCustomAttribute<AuthorizeAttribute>()!.Roles.Should().BeNull();
        action!.GetCustomAttribute<AuthorizeAttribute>().Should().BeNull();
        action.GetCustomAttribute<RequireOrganizationRoleAttribute>()!.AllowedRoles
            .Should().Equal("Owner", "Manager");
    }

    [Theory]
    [InlineData(nameof(StripeController.CreateConnectAccount))]
    [InlineData(nameof(StripeController.GetAccountStatus))]
    [InlineData(nameof(StripeController.CreateAccountLink))]
    [InlineData(nameof(StripeController.CreateLoginLink))]
    [InlineData(nameof(StripeController.CreateAccountSession))]
    [InlineData(nameof(StripeController.CreateAccountManagementSession))]
    public void OwnedConnectEndpoint_RequiresActiveOrganizationRole(string actionName)
    {
        var action = typeof(StripeController).GetMethod(actionName)!;
        action.GetCustomAttribute<RequireOrganizationRoleAttribute>()!.AllowedRoles
            .Should().Equal("Owner", "Manager");
        action.GetCustomAttribute<RequireRentPaymentActionReadyAttribute>().Should().BeNull();
    }

    [Theory]
    [InlineData(nameof(StripeController.SyncBankAccount))]
    public void StripeConfigureAction_UsesOrganizationReadinessInsteadOfLegacyGlobalRole(string actionName)
    {
        var action = typeof(StripeController).GetMethod(actionName, BindingFlags.Instance | BindingFlags.Public);

        action.Should().NotBeNull();
        action!.GetCustomAttribute<AuthorizeAttribute>().Should().BeNull();
        action.GetCustomAttribute<RequireRentPaymentActionReadyAttribute>().Should().NotBeNull();
    }

    [Fact]
    public async Task PaymentTransactions_WithoutOrganizationContext_ReturnsForbidden()
    {
        var queryService = new Mock<IStripePaymentTransactionQueryService>(MockBehavior.Strict);
        var controller = CreateController(Mock.Of<IStripeService>(), transactionQueryService: queryService.Object);
        Authenticate(controller, 42);

        var result = await controller.GetPaymentTransactions(123);

        result.Should().BeOfType<ObjectResult>().Which.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
        queryService.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task PaymentTransactions_PassesExactOrganizationAndPropertyScopeToQueryService()
    {
        var expected = new List<StripePaymentTransactionDto>
        {
            new() { PaymentIntentId = "pi_scoped", PropertyId = 123, PropertyName = "Oak Terrace" }
        };
        var queryService = new Mock<IStripePaymentTransactionQueryService>(MockBehavior.Strict);
        queryService.Setup(service => service.ListAsync(77, 123, It.IsAny<CancellationToken>()))
            .ReturnsAsync(expected);
        var controller = CreateController(Mock.Of<IStripeService>(), transactionQueryService: queryService.Object);
        Authenticate(controller, 42);
        controller.HttpContext.Items["OrganizationId"] = 77L;

        var result = await controller.GetPaymentTransactions(123);

        result.Should().BeOfType<OkObjectResult>().Which.Value.Should().BeSameAs(expected);
        queryService.Verify(service => service.ListAsync(77, 123, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task PaymentTransactions_WhenStripeQueryFails_ReturnsBadGatewayInsteadOfEmptyHistory()
    {
        var queryService = new Mock<IStripePaymentTransactionQueryService>();
        queryService.Setup(service => service.ListAsync(77, null, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("Stripe unavailable"));
        var controller = CreateController(Mock.Of<IStripeService>(), transactionQueryService: queryService.Object);
        Authenticate(controller, 42);
        controller.HttpContext.Items["OrganizationId"] = 77L;

        var result = await controller.GetPaymentTransactions();

        result.Should().BeOfType<ObjectResult>().Which.StatusCode.Should().Be(StatusCodes.Status502BadGateway);
    }

    [Fact]
    public async Task CreateConnectAccount_WhenGlobalAccountIsNotApprovedForSelectedOrganization_DoesNotExposeIt()
    {
        var stripeService = new Mock<IStripeService>(MockBehavior.Strict);
        var userService = new Mock<IUserService>();
        userService.Setup(x => x.GetUserByIdAsync(42))
            .ReturnsAsync(ServiceResponse<LoadUserDto>.CreateSuccess(new LoadUserDto
            {
                Id = 42,
                Email = "landlord@example.test",
                StripeAccountId = "acct_other_organization"
            }));
        var preparationService = new Mock<IStripeConnectPreparationService>();
        preparationService.Setup(x => x.GetValidatedForHandoffAsync(42, 77, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new StripeConnectPreparationDto(
                1, 42, 77, "individual", "Oak Rentals", [123], "owner", true,
                DateTimeOffset.UtcNow, DateTimeOffset.UtcNow, DateTimeOffset.UtcNow));
        var payeeService = new Mock<IStripeConnectedPayeeService>();
        payeeService.Setup(x => x.ResolveApprovedDestinationAsync(42, 77, It.IsAny<CancellationToken>()))
            .ReturnsAsync((ApprovedStripeDestination?)null);
        var controller = CreateController(stripeService.Object, userService.Object,
            payeeService: payeeService.Object, connectPreparationService: preparationService.Object);
        Authenticate(controller, 42);
        controller.HttpContext.Items["OrganizationId"] = 77L;

        var result = await controller.CreateConnectAccount(new CreateConnectAccountRequest());

        result.Should().BeOfType<ObjectResult>().Which.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
        stripeService.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task CreateConnectAccount_PassesExactAuthorizedExistingAccountToService()
    {
        var stripeService = new Mock<IStripeService>(MockBehavior.Strict);
        stripeService.Setup(x => x.CreateConnectAccountAsync(42, "landlord@example.test", It.IsAny<string>(), "acct_approved"))
            .ReturnsAsync(ServiceResponse<CreateStripeAccountResponseDto>.CreateSuccess(new CreateStripeAccountResponseDto()));
        var userService = new Mock<IUserService>();
        userService.Setup(x => x.GetUserByIdAsync(42))
            .ReturnsAsync(ServiceResponse<LoadUserDto>.CreateSuccess(new LoadUserDto
            {
                Id = 42, Email = "landlord@example.test", StripeAccountId = "acct_approved"
            }));
        var preparationService = ValidPreparationService();
        var payeeService = new Mock<IStripeConnectedPayeeService>();
        payeeService.Setup(x => x.ResolveOwnedAccountForOnboardingAsync(42, 77, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new OwnedStripeAccount(42, "acct_approved"));
        var controller = CreateController(stripeService.Object, userService.Object,
            payeeService: payeeService.Object, connectPreparationService: preparationService.Object);
        Authenticate(controller, 42);
        controller.HttpContext.Items["OrganizationId"] = 77L;

        (await controller.CreateConnectAccount(new CreateConnectAccountRequest())).Should().BeOfType<OkObjectResult>();
        stripeService.VerifyAll();
    }

    [Fact]
    public async Task CreateConnectAccount_PassesNullToServiceOnlyForAuthorizedFirstCreation()
    {
        var stripeService = new Mock<IStripeService>(MockBehavior.Strict);
        stripeService.Setup(x => x.CreateConnectAccountAsync(42, "landlord@example.test", It.IsAny<string>(), null))
            .ReturnsAsync(ServiceResponse<CreateStripeAccountResponseDto>.CreateSuccess(new CreateStripeAccountResponseDto()));
        var userService = new Mock<IUserService>();
        userService.Setup(x => x.GetUserByIdAsync(42))
            .ReturnsAsync(ServiceResponse<LoadUserDto>.CreateSuccess(new LoadUserDto
            {
                Id = 42, Email = "landlord@example.test", StripeAccountId = null
            }));
        var preparationService = ValidPreparationService();
        var payeeService = new Mock<IStripeConnectedPayeeService>();
        payeeService.Setup(x => x.ResolveOwnedAccountForOnboardingAsync(42, 77, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new OwnedStripeAccount(42, null));
        var controller = CreateController(stripeService.Object, userService.Object,
            payeeService: payeeService.Object, connectPreparationService: preparationService.Object);
        Authenticate(controller, 42);
        controller.HttpContext.Items["OrganizationId"] = 77L;

        (await controller.CreateConnectAccount(new CreateConnectAccountRequest())).Should().BeOfType<OkObjectResult>();
        stripeService.VerifyAll();
    }

    [Fact]
    public async Task CreateConnectAccount_WithoutServerValidatedPreparation_DoesNotCreateStripeAccount()
    {
        var stripeService = new Mock<IStripeService>(MockBehavior.Strict);
        var userService = new Mock<IUserService>();
        userService.Setup(x => x.GetUserByIdAsync(42))
            .ReturnsAsync(ServiceResponse<LoadUserDto>.CreateSuccess(new LoadUserDto
            {
                Id = 42,
                Email = "landlord@example.test"
            }));
        var preparationService = new Mock<IStripeConnectPreparationService>();
        preparationService.Setup(x => x.GetValidatedForHandoffAsync(42, 77, It.IsAny<CancellationToken>()))
            .ReturnsAsync((StripeConnectPreparationDto?)null);
        var controller = CreateController(stripeService.Object, userService.Object,
            connectPreparationService: preparationService.Object);
        Authenticate(controller, 42);
        controller.HttpContext.Items["OrganizationId"] = 77L;

        var result = await controller.CreateConnectAccount(new CreateConnectAccountRequest());

        result.Should().BeOfType<ConflictObjectResult>();
        stripeService.VerifyNoOtherCalls();
    }

    private static Mock<IStripeConnectPreparationService> ValidPreparationService()
    {
        var service = new Mock<IStripeConnectPreparationService>();
        service.Setup(x => x.GetValidatedForHandoffAsync(42, 77, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new StripeConnectPreparationDto(
                1, 42, 77, "individual", "Oak Rentals", [123], "owner", true,
                DateTimeOffset.UtcNow, DateTimeOffset.UtcNow, DateTimeOffset.UtcNow));
        return service;
    }

    private static StripeController CreateController(
        IStripeService stripeService,
        IUserService? userService = null,
        IOrganizationService? organizationService = null,
        IBankAccountService? bankAccountService = null,
        IBankAccountRepository? bankAccountRepository = null,
        IStripeConnectedPayeeService? payeeService = null,
        IStripePaymentTransactionQueryService? transactionQueryService = null,
        IStripeConnectPreparationService? connectPreparationService = null,
        IConfiguration? configuration = null)
    {
        return new StripeController(
            stripeService,
            userService ?? Mock.Of<IUserService>(),
            organizationService ?? Mock.Of<IOrganizationService>(),
            bankAccountService ?? Mock.Of<IBankAccountService>(),
            bankAccountRepository ?? Mock.Of<IBankAccountRepository>(),
            Mock.Of<IUserRepository>(),
            Mock.Of<ILogger<StripeController>>(),
            configuration: configuration,
            stripeConnectedPayeeService: payeeService,
            stripePaymentTransactionQueryService: transactionQueryService,
            stripeConnectPreparationService: connectPreparationService);
    }

    private static void Authenticate(ControllerBase controller, long userId)
    {
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(
                    [new Claim(ClaimTypes.NameIdentifier, userId.ToString())], "test"))
            }
        };
    }
}
