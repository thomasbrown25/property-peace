using brownstone_hub_api.Dtos.Lease;
using brownstone_hub_api.Dtos.Payment;
using brownstone_hub_api.Utils;
using FluentAssertions;
using Xunit;

namespace brownstone_hub_api.Tests.Services.RentCollection;

public sealed class RentPaymentSummaryTests
{
    [Theory]
    [InlineData(6, 1190, 0, 1190, false)]
    [InlineData(7, 0, 1190, 1190, true)]
    [InlineData(9, 0, 1190, 1190, true)]
    public void RentBalance_MovesCurrentInstallmentToOverdueOnlyAfterGracePeriod(
        int augustDay,
        decimal expectedCurrentMonthRentDue,
        decimal expectedOverdue,
        decimal expectedRentDue,
        bool expectedIsOverdue)
    {
        var today = new DateTime(2026, 8, augustDay);
        var lease = ActiveMonthlyLease(new DateTime(2026, 7, 1), new DateTime(2027, 6, 30), 1_190m);
        lease.RentDueDay = 1;
        lease.Fees =
        [
            new LeaseFeeDto { Id = 10, LeaseId = lease.Id, IsLateFee = true, AppliedAfterDays = 5 }
        ];
        var payments = new List<LoadPaymentDto>
        {
            new() { LeaseId = lease.Id, Amount = 1_190m, Status = "Completed", PaymentDate = new DateTime(2026, 7, 1) }
        };

        var balance = RentCalculator.GetRentBalance(lease, payments, today: today);

        balance.CurrentMonthRentDue.Should().Be(expectedCurrentMonthRentDue);
        balance.OverdueAmount.Should().Be(expectedOverdue);
        balance.RentDue.Should().Be(expectedRentDue);
        balance.IsOverdue.Should().Be(expectedIsOverdue);
        RentCalculator.CalculateOverdueForLease(lease, payments, today: today).Should().Be(expectedOverdue);
        RentCalculator.GetAmountDueNow(lease, payments, today: today).Should().Be(expectedRentDue);
    }

    [Fact]
    public void RentBalance_AllocatesCreditsOldestFirst_AndNeverCountsFeesOrDepositsAsRent()
    {
        var today = new DateTime(2026, 8, 6);
        var lease = ActiveMonthlyLease(new DateTime(2026, 6, 1), new DateTime(2027, 5, 31), 1_000m);
        lease.RentDueDay = 1;
        lease.Fees =
        [
            new LeaseFeeDto { Id = 10, LeaseId = lease.Id, IsLateFee = true, AppliedAfterDays = 5 }
        ];
        var payments = new List<LoadPaymentDto>
        {
            new() { LeaseId = lease.Id, Amount = 1_500m, Status = "Completed" },
            new() { LeaseId = lease.Id, Amount = 500m, Status = "Completed", FeeId = 44 },
            new() { LeaseId = lease.Id, Amount = 500m, Status = "Completed", DepositId = 55 },
            new() { LeaseId = lease.Id, Amount = 500m, Status = "Failed" }
        };

        var balance = RentCalculator.GetRentBalance(lease, payments, today: today);

        balance.PriorPeriodOverdueRent.Should().Be(500m);
        balance.CurrentMonthRentDue.Should().Be(1_000m);
        balance.OverdueAmount.Should().Be(500m);
        balance.RentDue.Should().Be(1_500m);
        balance.IsOverdue.Should().BeTrue("unpaid prior periods are always overdue, including during current-month grace");
    }

    [Theory]
    [InlineData(1_000, 0)]
    [InlineData(1_500, 500)]
    [InlineData(2_000, 1_000)]
    public void CollectedForPeriod_AllocatesFinalizedRentCreditsToOldestMonthsFirst(
        decimal paymentAmount,
        decimal expectedAugustCollection)
    {
        var lease = ActiveMonthlyLease(new DateTime(2026, 7, 1), new DateTime(2027, 6, 30), 1_000m);
        var payments = new List<LoadPaymentDto>
        {
            new()
            {
                LeaseId = lease.Id,
                Amount = paymentAmount,
                Status = "Completed",
                PaymentDate = new DateTime(2026, 8, 15)
            }
        };

        var collectedForAugust = RentCalculator.CollectedForPeriod(
            lease,
            payments,
            new DateTime(2026, 8, 1),
            new DateTime(2026, 9, 1));

        collectedForAugust.Should().Be(expectedAugustCollection,
            "a payment received in August must first satisfy July's overdue installment");
    }

    [Fact]
    public void RentRecordDto_ExposesCanonicalRentDueFields()
    {
        typeof(brownstone_hub_api.Dtos.RentCollection.RentRecordDto).GetProperty("RentDue").Should().NotBeNull();
        typeof(brownstone_hub_api.Dtos.RentCollection.RentRecordDto).GetProperty("RentDueIsOverdue").Should().NotBeNull();
    }

    [Fact]
    public void CurrentMonthRentDue_SeparatesThisMonthsRentFromOlderOverdueRent()
    {
        var today = new DateTime(2026, 8, 15);
        var lease = ActiveMonthlyLease(today.AddMonths(-2), today.AddMonths(10), 1_190m);
        lease.RentDueDay = today.Day;

        var currentRentDue = RentCalculator.GetCurrentMonthRentDue(lease, [], today: today);
        var priorOverdueRent = RentCalculator.GetPriorPeriodOverdueRent(lease, [], today: today);

        currentRentDue.Should().Be(1_190m);
        priorOverdueRent.Should().BeGreaterThan(0m);
        var overdueIncludingCurrentPeriod = RentCalculator.CalculateOverdueForLease(lease, [], today: today);
        var currentDueDate = new DateTime(today.Year, today.Month, lease.RentDueDay!.Value);
        priorOverdueRent.Should().Be(today > currentDueDate
            ? overdueIncludingCurrentPeriod - currentRentDue
            : overdueIncludingCurrentPeriod);
    }

    [Fact]
    public void CurrentMonthRentDue_IsZeroWhenRentIsPaidThroughThisMonth()
    {
        var today = DateTime.Today;
        var lease = ActiveMonthlyLease(today.AddMonths(-2), today.AddMonths(10), 1_190m);
        var currentDueDate = new DateTime(today.Year, today.Month, lease.RentDueDay!.Value);
        var rentPaidThroughCurrentMonth = RentCalculator.CalculateOverdueForLease(lease, []);
        if (today <= currentDueDate)
            rentPaidThroughCurrentMonth += lease.RentAmount!.Value;
        var payments = new List<LoadPaymentDto>
        {
            new()
            {
                LeaseId = lease.Id,
                Amount = rentPaidThroughCurrentMonth,
                PaymentDate = today,
                Status = "Completed"
            }
        };

        RentCalculator.GetCurrentMonthRentDue(lease, payments).Should().Be(0m);
        RentCalculator.GetPriorPeriodOverdueRent(lease, payments).Should().Be(0m);
    }

    [Fact]
    public void CurrentMonthRentIsOverdue_OnlyAfterConfiguredGracePeriod()
    {
        var graceBoundary = new DateTime(2026, 8, 6);
        var dueDay = 1;
        var lease = ActiveMonthlyLease(graceBoundary.AddMonths(-2), graceBoundary.AddMonths(10), 1_190m);
        lease.RentDueDay = dueDay;
        lease.Fees =
        [
            new LeaseFeeDto
            {
                Id = 10,
                LeaseId = lease.Id,
                Name = "Late Fee",
                IsLateFee = true,
                LateFeeType = "OneTime",
                AppliedAfterDays = 5
            }
        ];

        RentCalculator.IsCurrentMonthRentOverdue(lease, [], today: graceBoundary).Should().BeFalse();
        RentCalculator.IsCurrentMonthRentOverdue(lease, [], today: graceBoundary.AddDays(1)).Should().BeTrue();
        RentCalculator.GetCurrentMonthRentDueDate(lease, today: graceBoundary).Should().Be(new DateTime(graceBoundary.Year, graceBoundary.Month, dueDay));
    }

    [Fact]
    public void PreviousCalendarMonthInstallment_StillHonorsGracePeriodAcrossMonthBoundary()
    {
        var lease = ActiveMonthlyLease(new DateTime(2026, 7, 31), new DateTime(2027, 7, 30), 1_190m);
        lease.RentDueDay = 31;
        lease.Fees =
        [
            new LeaseFeeDto
            {
                Id = 11,
                LeaseId = lease.Id,
                Name = "Late Fee",
                IsLateFee = true,
                LateFeeType = "OneTime",
                AppliedAfterDays = 5
            }
        ];

        var withinGrace = RentCalculator.GetRentBalance(lease, [], today: new DateTime(2026, 8, 4));
        var afterGrace = RentCalculator.GetRentBalance(lease, [], today: new DateTime(2026, 8, 6));

        withinGrace.RentDue.Should().Be(1_190m);
        withinGrace.OverdueAmount.Should().Be(0m);
        withinGrace.IsOverdue.Should().BeFalse();
        afterGrace.RentDue.Should().Be(1_190m);
        afterGrace.OverdueAmount.Should().Be(1_190m);
        afterGrace.IsOverdue.Should().BeTrue();
    }

    [Fact]
    public void CurrentMonthRentIsOverdue_RemainsFalseDuringConfiguredGracePeriod()
    {
        var today = new DateTime(2026, 8, 4);
        var lease = ActiveMonthlyLease(today.AddMonths(-2), today.AddMonths(10), 1_190m);
        lease.RentDueDay = 1;
        lease.Fees =
        [
            new LeaseFeeDto
            {
                Id = 10,
                LeaseId = lease.Id,
                Name = "Late Fee",
                IsLateFee = true,
                LateFeeType = "OneTime",
                AppliedAfterDays = 5
            }
        ];

        RentCalculator.IsCurrentMonthRentOverdue(lease, [], today: today).Should().BeFalse();
    }

    [Fact]
    public void CurrentMonthRentIsOverdue_UsesEarliestConfiguredLateFeeThreshold()
    {
        var today = new DateTime(2026, 8, 4);
        var lease = ActiveMonthlyLease(today.AddMonths(-2), today.AddMonths(10), 1_190m);
        lease.RentDueDay = 1;
        lease.Fees =
        [
            new LeaseFeeDto { Id = 10, LeaseId = lease.Id, Name = "One-time Late Fee", IsLateFee = true, AppliedAfterDays = 5 },
            new LeaseFeeDto { Id = 11, LeaseId = lease.Id, Name = "Daily Late Fee", IsLateFee = true, StartingAfterDays = 2 }
        ];

        RentCalculator.IsCurrentMonthRentOverdue(lease, [], today: today).Should().BeTrue();
    }

    [Fact]
    public void UnpaidFeeBalances_AreItemizedAndSubtractOnlyCreditingPayments()
    {
        var lease = ActiveMonthlyLease(DateTime.Today.AddMonths(-2), DateTime.Today.AddMonths(10), 1_190m);
        lease.Fees =
        [
            new LeaseFeeDto { Id = 11, LeaseId = lease.Id, Name = "Late Fee", Amount = 75m, DueDate = DateTime.Today.AddDays(-5) },
            new LeaseFeeDto { Id = 12, LeaseId = lease.Id, Name = "Pet Fee", Amount = 200m, DueDate = DateTime.Today.AddDays(5) }
        ];
        var payments = new List<LoadPaymentDto>
        {
            new() { LeaseId = lease.Id, FeeId = 11, Amount = 25m, Status = "Completed" },
            new() { LeaseId = lease.Id, FeeId = 12, Amount = 200m, Status = "Failed" }
        };

        var balances = RentCalculator.GetUnpaidFeeBalances(lease, payments);

        balances.Should().SatisfyRespectively(
            lateFee =>
            {
                lateFee.Name.Should().Be("Late Fee");
                lateFee.AmountDue.Should().Be(50m);
            },
            petFee =>
            {
                petFee.Name.Should().Be("Pet Fee");
                petFee.AmountDue.Should().Be(200m);
            });
    }

    private static LoadLeaseDto ActiveMonthlyLease(DateTime start, DateTime end, decimal rent) => new()
    {
        Id = 801,
        IsActive = true,
        StartDate = start,
        EndDate = end,
        RentAmount = rent,
        RentDueDay = Math.Min(DateTime.Today.Day, 15),
        RentFrequency = "Monthly"
    };
}
