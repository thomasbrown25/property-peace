using brownstone_hub_api.Dtos.Lease;
using brownstone_hub_api.Dtos.Payment;
using brownstone_hub_api.Utils;
using FluentAssertions;
using Xunit;

namespace brownstone_hub_api.Tests.Services.RentCollection;

public sealed class RentPaymentSummaryTests
{
    [Fact]
    public void CurrentMonthRentDue_SeparatesThisMonthsRentFromOlderOverdueRent()
    {
        var today = DateTime.Today;
        var lease = ActiveMonthlyLease(today.AddMonths(-2), today.AddMonths(10), 1_190m);

        var currentRentDue = RentCalculator.GetCurrentMonthRentDue(lease, []);
        var priorOverdueRent = RentCalculator.GetPriorPeriodOverdueRent(lease, []);

        currentRentDue.Should().Be(1_190m);
        priorOverdueRent.Should().BeGreaterThan(0m);
        var overdueIncludingCurrentPeriod = RentCalculator.CalculateOverdueForLease(lease, []);
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
