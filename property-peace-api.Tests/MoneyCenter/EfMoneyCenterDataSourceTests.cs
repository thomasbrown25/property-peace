using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.MoneyCenter;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace brownstone_hub_api.Tests.MoneyCenter;

public sealed class EfMoneyCenterDataSourceTests
{
    [Fact]
    public async Task Load_UsesOnlyOrganizationOwnedOperationalModels_AndPreservesLossProjection()
    {
        await using var db = CreateContext();
        var ownedProperty = Property(10, 7, "Owned");
        var foreignProperty = Property(20, 8, "Foreign");
        var ownedUnit = Unit(100, 10, 7, ownedProperty);
        var foreignUnit = Unit(200, 20, 8, foreignProperty);
        var ownedLease = Lease(1000, 100, 7, ownedUnit);
        var foreignLease = Lease(2000, 200, 8, foreignUnit);

        db.AddRange(ownedProperty, foreignProperty, ownedUnit, foreignUnit, ownedLease, foreignLease);
        db.Payments.AddRange(
            Payment(1, 1000, 10, 7, 1000m, "Completed", "pi_owned"),
            Payment(2, 1000, 10, 7, -150m, "Completed", "pi_owned", "pi_owned:loss"),
            Payment(3, 1000, 10, 7, 200m, "Processing"),
            Payment(4, 2000, 20, 8, 900m, "Completed"));
        db.StripeRentPayments.Add(new StripeRentPayment
        {
            Id = 1, OperationId = "op", PaymentIntentId = "pi_owned", LeaseId = 1000,
            OrganizationId = 7, TenantUserId = 1, AmountCents = 100000, Currency = "usd",
            DestinationStripeAccountId = "acct", Status = StripeRentPaymentStatus.Reversed,
            RefundedAmountCents = 10000, DisputedAmountCents = 5000,
            CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow
        });
        db.Expenses.AddRange(
            Expense(11, 10, null, 7, true),
            Expense(12, 20, null, 8, true));
        db.FutureExpenses.AddRange(
            FutureExpense(21, 10, 100, 7),
            FutureExpense(22, 20, 200, 8));
        db.RecurringExpenses.AddRange(
            RecurringExpense(31, 10, 100, 7),
            RecurringExpense(32, 20, 200, 8));
        await db.SaveChangesAsync();

        var source = new EfMoneyCenterDataSource(db);
        var query = new MoneyCenterQuery(Utc(2026, 8, 1), Utc(2026, 9, 1), null, null);
        var data = await source.LoadAsync(7, query, default);

        data.Properties.Select(x => x.Id).Should().Equal(10);
        data.Units.Select(x => x.Id).Should().Equal(100);
        data.Leases.Select(x => x.Id).Should().Equal(1000);
        data.Payments.Select(x => x.Id).Should().BeEquivalentTo(new long[] { 1, 2, 3 });
        data.Expenses.Select(x => x.Id).Should().Equal(11);
        data.FutureExpenses.Select(x => x.Id).Should().Equal(21);
        data.RecurringExpenses.Select(x => x.Id).Should().Equal(31);

        data.Payments.Single(x => x.Id == 1).RefundedAmount.Should().Be(0,
            "the durable negative operational payment already carries the loss and must not be double-subtracted");
        data.Payments.Single(x => x.Id == 2).Amount.Should().Be(-150m);
        data.Payments.Single(x => x.Id == 1).NeedsSettlementAttention.Should().BeTrue();
    }

    [Fact]
    public async Task UnitScope_RequiresMatchingOrganizationAndProperty_AndFiltersEverySource()
    {
        await using var db = CreateContext();
        var property = Property(10, 7, "Owned");
        var otherProperty = Property(11, 7, "Other");
        var unit = Unit(100, 10, 7, property);
        var otherUnit = Unit(101, 11, 7, otherProperty);
        var lease = Lease(1000, 100, 7, unit);
        var otherLease = Lease(1001, 101, 7, otherUnit);
        db.AddRange(property, otherProperty, unit, otherUnit, lease, otherLease,
            Payment(1, 1000, 10, 7, 100m, "Completed"),
            Payment(2, 1001, 11, 7, 200m, "Completed"),
            Expense(11, 10, 100, 7, true), Expense(12, 10, null, 7, true),
            FutureExpense(21, 10, 100, 7), FutureExpense(22, 10, null, 7),
            RecurringExpense(31, 10, 100, 7), RecurringExpense(32, 10, null, 7));
        await db.SaveChangesAsync();
        var source = new EfMoneyCenterDataSource(db);

        (await source.UnitBelongsToOrganizationAsync(7, 100, 10, default)).Should().BeTrue();
        (await source.UnitBelongsToOrganizationAsync(7, 100, 11, default)).Should().BeFalse();
        (await source.UnitBelongsToOrganizationAsync(8, 100, null, default)).Should().BeFalse();

        var data = await source.LoadAsync(7,
            new MoneyCenterQuery(Utc(2026, 8, 1), Utc(2026, 9, 1), 10, 100), default);
        data.Payments.Select(x => x.Id).Should().Equal(1);
        data.Expenses.Select(x => x.Id).Should().Equal(11);
        data.FutureExpenses.Select(x => x.Id).Should().Equal(21);
        data.RecurringExpenses.Select(x => x.Id).Should().Equal(31);
    }

    [Fact]
    public async Task Load_PreservesHistoricalTransactionsAfterPropertyAndLeaseAreArchived()
    {
        await using var db = CreateContext();
        var property = Property(10, 7, "Archived");
        property.IsDeleted = true;
        var unit = Unit(100, 10, 7, property);
        var lease = Lease(1000, 100, 7, unit);
        lease.IsDeleted = true;
        db.AddRange(property, unit, lease,
            Payment(1, 1000, 10, 7, 100m, "Completed"),
            Expense(11, 10, 100, 7, true));
        await db.SaveChangesAsync();
        var source = new EfMoneyCenterDataSource(db);

        var data = await source.LoadAsync(7, new MoneyCenterQuery(Utc(2026, 8, 1), Utc(2026, 9, 1), null, null), default);

        data.Properties.Select(x => x.Id).Should().Contain(10);
        data.Payments.Select(x => x.Id).Should().Contain(1);
        data.Expenses.Select(x => x.Id).Should().Contain(11);
        data.Leases.Should().BeEmpty("archived leases must not create current rent due");
    }

    [Fact]
    public async Task Load_SubtractsOnlyTheSettlementLossNotAlreadyRepresentedByDurableAdjustments()
    {
        await using var db = CreateContext();
        var property = Property(10, 7, "Owned");
        var unit = Unit(100, 10, 7, property);
        var lease = Lease(1000, 100, 7, unit);
        db.AddRange(property, unit, lease,
            Payment(1, 1000, 10, 7, 1000m, "Completed", "pi_partial"),
            Payment(2, 1000, 10, 7, -100m, "Completed", "pi_partial", "pi_partial:loss"));
        db.StripeRentPayments.Add(new StripeRentPayment
        {
            Id = 1, OperationId = "op-partial", PaymentIntentId = "pi_partial", LeaseId = 1000,
            OrganizationId = 7, TenantUserId = 1, AmountCents = 100000, Currency = "usd",
            DestinationStripeAccountId = "acct", Status = StripeRentPaymentStatus.Reversed,
            RefundedAmountCents = 10000, DisputedAmountCents = 5000,
            CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();

        var data = await new EfMoneyCenterDataSource(db).LoadAsync(7,
            new MoneyCenterQuery(Utc(2026, 8, 1), Utc(2026, 9, 1), null, null), default);

        var original = data.Payments.Single(x => x.Id == 1);
        (original.RefundedAmount + original.UnrecoveredDisputeAmount).Should().Be(50m);
        data.Payments.Sum(x => x.Amount - x.RefundedAmount - x.UnrecoveredDisputeAmount).Should().Be(850m);
    }

    private static DataContext CreateContext() => new(new DbContextOptionsBuilder<DataContext>()
        .UseInMemoryDatabase($"money-center-{Guid.NewGuid()}").Options);

    private static Property Property(long id, long organizationId, string name) => new()
    {
        Id = id, OrganizationId = organizationId, LandlordId = organizationId, Name = name,
        StreetAddress = name, ContactEmail = "owner@example.test", ContactPhone = "555"
    };

    private static Unit Unit(long id, long propertyId, long organizationId, Property property) => new()
    {
        Id = id, Name = $"Unit {id}", PropertyId = propertyId, Property = property, OrganizationId = organizationId
    };

    private static Lease Lease(long id, long unitId, long organizationId, Unit unit) => new()
    {
        Id = id, UnitId = unitId, Unit = unit, OrganizationId = organizationId,
        StartDate = new DateTime(2026, 1, 1), EndDate = new DateTime(2026, 12, 31),
        RentAmount = 1000m, RentFrequency = "Monthly", RentDueDay = 1
    };

    private static Payment Payment(long id, long leaseId, long propertyId, long organizationId,
        decimal amount, string status, string? intent = null, string? reference = null) => new()
    {
        Id = id, LeaseId = leaseId, PropertyId = propertyId, OrganizationId = organizationId,
        Amount = amount, PaymentDate = new DateTime(2026, 8, 2), Status = status,
        StripePaymentIntentId = intent, Reference = reference
    };

    private static Expense Expense(long id, long propertyId, long? unitId, long organizationId, bool paid) => new()
    {
        Id = id, LandlordId = organizationId, PropertyId = propertyId, UnitId = unitId,
        OrganizationId = organizationId, Name = $"Expense {id}", Category = "Repairs", Amount = 10m,
        ExpenseDate = new DateTime(2026, 8, 3), IsPaid = paid, PaidDate = paid ? new DateTime(2026, 8, 4) : null
    };

    private static FutureExpense FutureExpense(long id, long propertyId, long? unitId, long organizationId) => new()
    {
        Id = id, LandlordId = organizationId, PropertyId = propertyId, UnitId = unitId,
        OrganizationId = organizationId, Name = $"Future {id}", Category = "Utilities", Amount = 20m,
        DueDate = new DateTime(2026, 8, 15)
    };

    private static RecurringExpense RecurringExpense(long id, long propertyId, long? unitId, long organizationId) => new()
    {
        Id = id, LandlordId = organizationId, PropertyId = propertyId, UnitId = unitId,
        OrganizationId = organizationId, Name = $"Recurring {id}", Category = "Utilities", Amount = 20m,
        StartDate = new DateTime(2026, 1, 1), NextOccurrenceDate = new DateTime(2026, 8, 15),
        Frequency = brownstone_hub_api.Enums.ERecurringFrequency.Monthly
    };

    private static DateTimeOffset Utc(int year, int month, int day) =>
        new(year, month, day, 0, 0, 0, TimeSpan.Zero);
}
