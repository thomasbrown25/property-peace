using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Leases;
using brownstone_hub_api.Repositories.Properties;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.NotificationService;
using brownstone_hub_api.Services.PaymentService;
using brownstone_hub_api.Services.StripeRentPayments;
using brownstone_hub_api.Services.StripeService;
using StripeServiceImpl = brownstone_hub_api.Services.StripeService.StripeService;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services;

public sealed class StripeServiceOrganizationAuthorizationTests
{
    [Theory]
    [InlineData(null, "acct_added_during_race")]
    [InlineData("acct_authorized", "acct_changed_during_race")]
    [InlineData("acct_authorized", null)]
    public async Task CreateConnectAccount_WhenReloadedGlobalAccountDoesNotExactlyMatchAuthorization_FailsClosed(
        string? authorizedAccountId,
        string? reloadedAccountId)
    {
        var users = new Mock<IUserRepository>(MockBehavior.Strict);
        users.Setup(repository => repository.GetUser(42))
            .ReturnsAsync(new User
            {
                Id = 42,
                Email = "landlord@example.test",
                StripeAccountId = reloadedAccountId
            });
        await using var context = new DataContext(new DbContextOptionsBuilder<DataContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var payees = new Mock<IStripeConnectedPayeeService>(MockBehavior.Strict);
        var gateway = new Mock<IStripeConnectedAccountGateway>(MockBehavior.Strict);
        var service = new StripeServiceImpl(
            users.Object,
            Mock.Of<ILeaseRepository>(),
            Mock.Of<IPropertyRepository>(),
            Mock.Of<IPaymentService>(),
            Mock.Of<INotificationService>(),
            context,
            new ConfigurationBuilder().AddInMemoryCollection().Build(),
            Mock.Of<ILogger<StripeServiceImpl>>(),
            Mock.Of<IHttpContextAccessor>(),
            Mock.Of<IStripeRentPaymentService>(),
            payees.Object,
            gateway.Object,
            TimeProvider.System);

        var result = await service.CreateConnectAccountAsync(
            42, "landlord@example.test", "https://app.test/return", authorizedAccountId);

        result.Success.Should().BeFalse();
        result.Message.Should().Contain("authorization changed");
        users.VerifyAll();
        payees.VerifyNoOtherCalls();
        gateway.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task CreateConnectAccount_ConcurrentFirstAccountCalls_CreateAndReturnOneAccount()
    {
        var users = new Mock<IUserRepository>(MockBehavior.Strict);
        users.Setup(repository => repository.GetUser(42))
            .ReturnsAsync(() => new User
            {
                Id = 42,
                Email = "landlord@example.test",
                StripeAccountId = null
            });
        await using var context = new DataContext(new DbContextOptionsBuilder<DataContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var payees = new Mock<IStripeConnectedPayeeService>(MockBehavior.Strict);
        payees.Setup(service => service.RegisterAsync(42, "acct_first", false, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new StripeConnectedPayeeReview());

        var createdByIdempotencyKey = new System.Collections.Concurrent.ConcurrentDictionary<string, StripeConnectedAccountOnboardingResult>();
        var creationCount = 0;
        var activeGatewayCalls = 0;
        var maxConcurrentGatewayCalls = 0;
        var gateway = new Mock<IStripeConnectedAccountGateway>(MockBehavior.Strict);
        gateway.Setup(service => service.CreateOnboardingAccountAsync(
                It.IsAny<Stripe.AccountCreateOptions>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<CancellationToken>()))
            .Returns(async (Stripe.AccountCreateOptions _, string _, string idempotencyKey, CancellationToken _) =>
            {
                var active = Interlocked.Increment(ref activeGatewayCalls);
                maxConcurrentGatewayCalls = Math.Max(maxConcurrentGatewayCalls, active);
                try
                {
                    await Task.Delay(30);
                    return createdByIdempotencyKey.GetOrAdd(idempotencyKey, _ =>
                    {
                        Interlocked.Increment(ref creationCount);
                        return new StripeConnectedAccountOnboardingResult(
                            "acct_first", false, "https://connect.stripe.test/first");
                    });
                }
                finally
                {
                    Interlocked.Decrement(ref activeGatewayCalls);
                }
            });

        var service = new StripeServiceImpl(
            users.Object,
            Mock.Of<ILeaseRepository>(),
            Mock.Of<IPropertyRepository>(),
            Mock.Of<IPaymentService>(),
            Mock.Of<INotificationService>(),
            context,
            new ConfigurationBuilder().AddInMemoryCollection().Build(),
            Mock.Of<ILogger<StripeServiceImpl>>(),
            Mock.Of<IHttpContextAccessor>(),
            Mock.Of<IStripeRentPaymentService>(),
            payees.Object,
            gateway.Object,
            TimeProvider.System);

        var calls = new[]
        {
            service.CreateConnectAccountAsync(42, "landlord@example.test", "https://app.test/return", null),
            service.CreateConnectAccountAsync(42, "landlord@example.test", "https://app.test/return", null)
        };
        var results = await Task.WhenAll(calls);

        results.Should().OnlyContain(result => result.Success);
        results.Select(result => result.Data!.AccountId).Should().OnlyContain(id => id == "acct_first");
        creationCount.Should().Be(1);
        createdByIdempotencyKey.Should().ContainSingle();
        maxConcurrentGatewayCalls.Should().Be(1);
        users.Verify(repository => repository.GetUser(42), Times.Exactly(2));
        payees.Verify(service => service.RegisterAsync(42, "acct_first", false, It.IsAny<CancellationToken>()), Times.Exactly(2));
    }
}
