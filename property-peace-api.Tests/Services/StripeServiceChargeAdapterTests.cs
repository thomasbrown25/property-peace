using System.Security.Claims;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Lease;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Leases;
using brownstone_hub_api.Repositories.Properties;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.NotificationService;
using brownstone_hub_api.Services.PaymentService;
using brownstone_hub_api.Services.StripeRentPayments;
using brownstone_hub_api.Services.StripeService;
using brownstone_hub_api.Tests.Services.StripeRentPayments;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using StripeServiceImpl = brownstone_hub_api.Services.StripeService.StripeService;

namespace brownstone_hub_api.Tests.Services;

public sealed class StripeServiceChargeAdapterTests
{
    private static StripeServiceImpl Adapter(DataContext db, IStripeRentPaymentService rent, long organizationId = 9)
    {
        var http = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, "7")], "test"))
        };
        http.Items["OrganizationId"] = organizationId;
        var leases = new Mock<ILeaseRepository>();
        leases.Setup(x => x.GetLeaseById(44, organizationId))
            .ReturnsAsync(new LoadLeaseDto { Id = 44 });
        return new StripeServiceImpl(Mock.Of<IUserRepository>(), leases.Object,
            Mock.Of<IPropertyRepository>(), Mock.Of<IPaymentService>(), Mock.Of<INotificationService>(),
            db, new ConfigurationBuilder().Build(), Mock.Of<ILogger<StripeServiceImpl>>(),
            new HttpContextAccessor { HttpContext = http }, rent,
            Mock.Of<IStripeConnectedPayeeService>(), Mock.Of<IStripeConnectedAccountGateway>(), TimeProvider.System);
    }

    [Theory]
    [InlineData("fee:19")]
    [InlineData("rent:44:2026-09-01")]
    [InlineData(null)]
    public async Task SignedTenantCreate_ForwardsExactChargeAndScopedIdentity(string? chargeId)
    {
        await using var db = StripeRentPaymentFlowTests.CreateContext();
        await StripeRentPaymentFlowTests.SeedLeaseAsync(db, 44, 9);
        await StripeRentPaymentFlowTests.SeedLeaseDestinationAsync(db, 44, 9, "acct_snapshot");
        var rent = new Mock<IStripeRentPaymentService>(MockBehavior.Strict);
        rent.Setup(x => x.CreateAsync(It.Is<CreateStripeRentPaymentCommand>(c =>
                c.LeaseId == 44 && c.OrganizationId == 9 && c.TenantUserId == 7
                && c.OperationId == "operation" && c.AmountCents == 5000
                && c.DestinationStripeAccountId == "acct_snapshot" && c.ChargeId == chargeId),
            It.IsAny<CancellationToken>()))
            .ReturnsAsync(new StripeRentPaymentClientResult("pi_created", "secret"));
        var result = await Adapter(db, rent.Object).CreatePaymentIntentAsync(44, 50m, "operation", null, chargeId);
        result.Success.Should().BeTrue(result.Message);
        result.Data!.PaymentIntentId.Should().Be("pi_created");
        rent.VerifyAll();
    }

    [Theory]
    [InlineData("fee:19")]
    [InlineData("rent:44:2026-09-01")]
    [InlineData(null)]
    public async Task SignedTenantUpdate_ForwardsExactChargeAndTenant(string? chargeId)
    {
        await using var db = StripeRentPaymentFlowTests.CreateContext();
        var rent = new Mock<IStripeRentPaymentService>(MockBehavior.Strict);
        rent.Setup(x => x.UpdateAsync(It.Is<UpdateStripeRentPaymentCommand>(c =>
                c.PaymentIntentId == "pi_existing" && c.LeaseId == 44 && c.TenantUserId == 7
                && c.AmountCents == 5000 && c.ChargeId == chargeId), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new StripeRentPaymentClientResult("pi_existing", "secret"));
        var result = await Adapter(db, rent.Object).UpdatePaymentIntentAsync("pi_existing", 44, 50m, null, chargeId);
        result.Success.Should().BeTrue(result.Message);
        rent.VerifyAll();
    }

    [Fact]
    public async Task AdapterToRentService_RejectsCrossLeaseFeeAndReplayMismatchBeforeStripe()
    {
        await using var db = StripeRentPaymentFlowTests.CreateContext();
        await StripeRentPaymentFlowTests.SeedLeaseAsync(db, 44, 9);
        await StripeRentPaymentFlowTests.SeedLeaseDestinationAsync(db, 44, 9, "acct_snapshot");
        db.LeaseFees.Add(new LeaseFee { Id = 19, LeaseId = 45, OrganizationId = 9,
            Name = "Other lease", Amount = 50m, DueDate = DateTime.UtcNow });
        db.StripeRentPayments.Add(new StripeRentPayment
        {
            OperationId = "replay", PaymentIntentId = "pi_bound", LeaseId = 44,
            OrganizationId = 9, TenantUserId = 7, AmountCents = 5000, Currency = "usd",
            DestinationStripeAccountId = "acct_snapshot", ChargeId = "fee:20",
            Status = StripeRentPaymentStatus.Created
        });
        await db.SaveChangesAsync();
        var gateway = new Mock<IStripeRentGateway>(MockBehavior.Strict);
        var rent = StripeRentPaymentFlowTests.CreateService(db, gateway.Object, true);
        var adapter = Adapter(db, rent);

        (await adapter.CreatePaymentIntentAsync(44, 50m, "new-operation", null, "fee:19"))
            .Success.Should().BeFalse("the fee belongs to another lease");
        (await adapter.CreatePaymentIntentAsync(44, 50m, "replay", null, "fee:19"))
            .Success.Should().BeFalse("the operation is bound to another charge");
        (await adapter.UpdatePaymentIntentAsync("pi_bound", 44, 50m, null, "fee:19"))
            .Success.Should().BeFalse("the intent is bound to another charge");
        gateway.VerifyNoOtherCalls();
    }

    [Theory]
    [InlineData("fee:0")]
    [InlineData("fee:019")]
    [InlineData("fee:abc")]
    [InlineData("deposit:pooled:44")]
    [InlineData("rent:45:2026-09-01")]
    [InlineData("rent:44:2026-9-01")]
    [InlineData("rent:044:2026-09-01")]
    [InlineData("rent:44:2026-02-30")]
    [InlineData("")]
    public async Task UnsupportedSelector_DeniedBeforeRentServiceForBothMethods(string chargeId)
    {
        await using var db = StripeRentPaymentFlowTests.CreateContext();
        var rent = new Mock<IStripeRentPaymentService>(MockBehavior.Strict);
        var adapter = Adapter(db, rent.Object);
        (await adapter.CreatePaymentIntentAsync(44, 50m, "operation", null, chargeId)).Success.Should().BeFalse();
        (await adapter.UpdatePaymentIntentAsync("pi_existing", 44, 50m, null, chargeId)).Success.Should().BeFalse();
        rent.VerifyNoOtherCalls();
    }
}
