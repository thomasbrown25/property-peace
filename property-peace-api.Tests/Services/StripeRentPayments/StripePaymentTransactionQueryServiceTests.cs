using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.StripeRentPayments;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.StripeRentPayments;

public sealed class StripePaymentTransactionQueryServiceTests
{
    [Fact]
    public async Task ListAsync_UsesCompleteDurableLedgerWithoutCallingStripePerRow()
    {
        await using var db = new DataContext(new DbContextOptionsBuilder<DataContext>()
            .UseInMemoryDatabase($"stripe-payment-transactions-{Guid.NewGuid()}")
            .Options);
        var property = new Property { Id = 10, OrganizationId = 77, Name = "Oak Terrace" };
        var unit = new Unit { Id = 20, PropertyId = property.Id, Property = property, Name = "2A" };
        var lease = new Lease { Id = 30, UnitId = unit.Id, Unit = unit, OrganizationId = 77 };
        db.StripeRentPayments.AddRange(Enumerable.Range(1, 251).Select(index => new StripeRentPayment
        {
            Id = index,
            OperationId = $"operation-{index}",
            PaymentIntentId = $"pi_{index}",
            LeaseId = lease.Id,
            Lease = lease,
            OrganizationId = 77,
            TenantUserId = 42,
            AmountCents = 10_000 + index,
            Currency = "usd",
            PaymentMethodType = "us_bank_account",
            Status = StripeRentPaymentStatus.Held,
            HeldAt = DateTimeOffset.UtcNow.AddDays(-index),
            CreatedAt = DateTimeOffset.UtcNow.AddDays(-index),
            UpdatedAt = DateTimeOffset.UtcNow.AddDays(-index)
        }));
        await db.SaveChangesAsync();
        var stripeGateway = new Mock<IStripeRentGateway>(MockBehavior.Strict);
        var service = new StripePaymentTransactionQueryService(db);

        var result = await service.ListAsync(77, null);

        result.Should().HaveCount(251);
        result.Should().OnlyContain(row => row.PropertyId == 10 && row.Currency == "usd");
        result.Should().Contain(row => row.PaymentIntentId == "pi_251" && row.AmountCents == 10_251);
        stripeGateway.VerifyNoOtherCalls();
    }
}
