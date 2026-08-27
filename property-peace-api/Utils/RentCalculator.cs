using System;
using System.Collections.Generic;
using System.Linq;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Lease;
using brownstone_hub_api.Dtos.Payment;
using brownstone_hub_api.Dtos.RentCollection;
using brownstone_hub_api.Enums;
using Microsoft.EntityFrameworkCore;
using brownstone_hub_api.Utils;

namespace brownstone_hub_api.Utils
{
    public static class RentCalculator
    {
        public sealed record RentBalanceProjection(
            decimal CurrentMonthRentDue,
            decimal PriorPeriodOverdueRent,
            decimal OverdueAmount,
            decimal RentDue,
            bool IsOverdue,
            DateTime? CurrentMonthRentDueDate);

        private static readonly HashSet<string> BalanceCreditingStatuses = new(StringComparer.OrdinalIgnoreCase)
        {
            "Completed",
            "Paid"
        };

        private static IEnumerable<LoadPaymentDto> BalanceCreditingPayments(IEnumerable<LoadPaymentDto>? payments)
        {
            return payments?.Where(p => BalanceCreditingStatuses.Contains(p.Status ?? string.Empty)) ?? [];
        }

        private static IEnumerable<LoadPaymentDto> RentBalanceCreditingPayments(IEnumerable<LoadPaymentDto>? payments) =>
            BalanceCreditingPayments(payments).Where(payment => !payment.FeeId.HasValue && !payment.DepositId.HasValue);

        private static DateTime ResolveToday(string? timezone, DateTime? today) => today?.Date
            ?? (string.IsNullOrWhiteSpace(timezone) ? DateTime.Today : TimezoneHelper.GetLocalToday(timezone));

        private static int GetGraceDays(LoadLeaseDto lease) => lease.Fees?
            .Where(fee => fee.IsLateFee)
            .Select(fee => fee.AppliedAfterDays ?? fee.StartingAfterDays)
            .Where(days => days.HasValue)
            .Select(days => Math.Max(days!.Value, 0))
            .DefaultIfEmpty(0)
            .Min() ?? 0;

        public static List<RentFeeBalanceDto> GetUnpaidFeeBalances(LoadLeaseDto lease, IEnumerable<LoadPaymentDto>? payments)
        {
            var creditedByFee = BalanceCreditingPayments(payments)
                .Where(p => p.LeaseId == lease.Id && p.FeeId.HasValue)
                .GroupBy(p => p.FeeId!.Value)
                .ToDictionary(group => group.Key, group => group.Sum(p => p.Amount));

            return (lease.Fees ?? [])
                .Select(fee => new RentFeeBalanceDto
                {
                    FeeId = fee.Id,
                    Name = string.IsNullOrWhiteSpace(fee.Name) ? "Fee" : fee.Name.Trim(),
                    AmountDue = Math.Max(0m, fee.Amount - creditedByFee.GetValueOrDefault(fee.Id)),
                    DueDate = fee.DueDate
                })
                .Where(fee => fee.AmountDue > 0m)
                .OrderBy(fee => fee.DueDate)
                .ThenBy(fee => fee.Name)
                .ToList();
        }

        private static DateTime Max(DateTime a, DateTime b) => a > b ? a : b;
        private static DateTime Min(DateTime a, DateTime b) => a < b ? a : b;

        /// <summary>
        /// Gets the actual day of month for a given year/month based on RentDueDay.
        /// If RentDueDay is -1, returns the last day of the month.
        /// Otherwise, returns RentDueDay (clamped to valid range for the month).
        /// </summary>
        private static int GetActualDayOfMonth(int? rentDueDay, int year, int month)
        {
            if (!rentDueDay.HasValue)
                return 1; // Default to 1st if not set

            // -1 represents "last day of month"
            if (rentDueDay.Value == -1)
            {
                return DateTime.DaysInMonth(year, month);
            }

            // Clamp to valid range for the month
            var daysInMonth = DateTime.DaysInMonth(year, month);
            return Math.Min(rentDueDay.Value, daysInMonth);
        }

        // total expected rent between [from, to) (to is exclusive)
        public static decimal TotalExpected(List<LoadLeaseDto> leases, DateTime from, DateTime to)
        {
            decimal total = 0m;
            foreach (var l in leases)
                total += ExpectedForLease(l, from, to);
            return Math.Round(total, 2, MidpointRounding.ToEven);
        }

        // expected rent for a single lease over [from, to) with day-accurate proration
        public static decimal ExpectedForLease(LoadLeaseDto lease, DateTime from, DateTime to)
        {
            if (!lease.IsActive || !lease.RentAmount.HasValue || lease.RentAmount <= 0 ||
                !lease.StartDate.HasValue || !lease.EndDate.HasValue) return 0m;

            // Normalize to dates; treat EndDate as inclusive in business terms
            var leaseStart = lease.StartDate.Value.Date;
            var leaseEndExcl = lease.EndDate.Value.Date.AddDays(1);

            // If no overlap, nothing due
            var start = Max(leaseStart, from.Date);
            var end = Min(leaseEndExcl, to.Date);
            var overlapDays = (end - start).TotalDays;
            if (overlapDays <= 0) return 0m;

            // Proration by frequency
            switch ((lease.RentFrequency ?? "Monthly").Trim().ToLowerInvariant())
            {
                case "monthly":
                    return ProrateMonthly(lease.RentAmount ?? 0m, start, end);

                case "weekly":
                    return (decimal)overlapDays * ((lease.RentAmount ?? 0m) / 7m);

                case "biweekly":
                case "bi-weekly":
                case "fortnightly":
                    return (decimal)overlapDays * ((lease.RentAmount ?? 0m) / 14m);

                case "yearly":
                case "annually":
                    return ProrateYearly(lease.RentAmount ?? 0m, start, end);

                case "daily":
                    return (decimal)overlapDays * (lease.RentAmount ?? 0m);

                default:
                    return ProrateMonthly(lease.RentAmount ?? 0m, start, end);
            }
        }

        /// <summary>
        /// Finalized rent credits allocated to a reporting period. Credits satisfy the
        /// lease's oldest expected rent first, so a payment received this month for an
        /// older delinquent installment remains attributed to that older period.
        /// </summary>
        public static decimal CollectedForPeriod(
            LoadLeaseDto lease,
            IEnumerable<LoadPaymentDto>? payments,
            DateTime from,
            DateTime to)
        {
            if (!lease.StartDate.HasValue || to.Date <= from.Date)
                return 0m;

            var expectedForPeriod = ExpectedForLease(lease, from, to);
            if (expectedForPeriod <= 0m)
                return 0m;

            var expectedBeforePeriod = ExpectedForLease(lease, lease.StartDate.Value.Date, from.Date);
            var finalizedRentCredits = RentBalanceCreditingPayments(payments)
                .Where(payment => payment.LeaseId == lease.Id)
                .Sum(payment => payment.Amount);
            var creditsAvailableForPeriod = Math.Max(finalizedRentCredits - expectedBeforePeriod, 0m);

            return Math.Round(
                Math.Min(expectedForPeriod, creditsAvailableForPeriod),
                2,
                MidpointRounding.ToEven);
        }

        // calculate total outstanding (expected - collected)
        public static decimal TotalOutstanding(List<LoadLeaseDto> leases, List<LoadPaymentDto> payments)
        {
            if (leases == null || leases.Count == 0) return 0m;

            var validLeases = leases.Where(l => l.StartDate.HasValue && l.EndDate.HasValue).ToList();
            if (validLeases.Count == 0) return 0m;

            var leaseStart = validLeases.Min(l => l.StartDate!.Value.Date);
            var leaseEndExcl = validLeases.Max(l => l.EndDate!.Value.Date.AddDays(1));

            var expected = TotalExpected(leases, leaseStart, leaseEndExcl);
            var collected = BalanceCreditingPayments(payments).Sum(p => p.Amount);

            return Math.Round(Math.Max(expected - collected, 0m), 2, MidpointRounding.ToEven);
        }

        // calculate outstanding for a single lease (expected for entire lease period - collected)
        public static decimal OutstandingForLease(LoadLeaseDto lease, List<LoadPaymentDto> payments)
        {
            if (lease == null || !lease.IsActive || !lease.StartDate.HasValue || !lease.EndDate.HasValue) return 0m;

            var leaseStart = lease.StartDate.Value.Date;
            var leaseEndExcl = lease.EndDate.Value.Date.AddDays(1);

            // Calculate expected rent for the entire lease period using proration
            var expected = ExpectedForLease(lease, leaseStart, leaseEndExcl);

            // Get total payments for this lease
            var collected = BalanceCreditingPayments(payments).Where(p => p.LeaseId == lease.Id).Sum(p => p.Amount);

            return Math.Round(Math.Max(expected - collected, 0m), 2, MidpointRounding.ToEven);
        }

        /// <summary>
        /// Calculates the overdue amount for a lease based on payments,
        /// prior months, and current month (if past due day).
        /// </summary>
        public static decimal CalculateOverdue(
            IEnumerable<LoadLeaseDto> leases,
            List<LoadPaymentDto> payments,
            string? timezone = null,
            DateTime? today = null) => leases.Sum(lease =>
                GetRentBalance(lease, payments, timezone, today).OverdueAmount);



        // determine rent status for a lease given payments
        public static ERentStatus GetStatus(
            LoadLeaseDto lease,
            List<LoadPaymentDto> payments,
            string? timezone = null,
            DateTime? today = null)
        {
            var localToday = ResolveToday(timezone, today);

            // If lease hasn't started yet, show as NotStarted regardless of IsActive
            if (!lease.StartDate.HasValue || lease.StartDate.Value.Date > localToday)
                return ERentStatus.NotStarted;

            // If lease is not active and has started, it's archived
            if (!lease.IsActive)
                return ERentStatus.Archived;

            if (!lease.StartDate.HasValue || !lease.EndDate.HasValue || !lease.RentAmount.HasValue || !lease.RentDueDay.HasValue)
                return ERentStatus.Archived;

            var balance = GetRentBalance(lease, payments, timezone, localToday);
            if (balance.IsOverdue)
                return ERentStatus.Overdue;
            return balance.RentDue > 0m ? ERentStatus.UpcomingDue : ERentStatus.UpToDate;
        }


        public static decimal CalculateOverdueForLease(
            LoadLeaseDto lease,
            List<LoadPaymentDto> payments,
            string? timezone = null,
            DateTime? today = null) => GetRentBalance(lease, payments, timezone, today).OverdueAmount;

        /// <summary>
        /// Canonical rent-only balance. Finalized rent credits are allocated to the oldest
        /// installment first. The current installment remains current through the complete
        /// configured grace days and moves to overdue only when localToday is later than the
        /// due date plus the earliest late-fee threshold.
        /// </summary>
        public static RentBalanceProjection GetRentBalance(
            LoadLeaseDto lease,
            List<LoadPaymentDto> payments,
            string? timezone = null,
            DateTime? today = null)
        {
            var localToday = ResolveToday(timezone, today);
            if (!lease.IsActive || !lease.StartDate.HasValue || !lease.EndDate.HasValue ||
                !lease.RentAmount.HasValue || lease.RentAmount.Value <= 0m || !lease.RentDueDay.HasValue ||
                lease.StartDate.Value.Date > localToday)
                return new(0m, 0m, 0m, 0m, false, null);

            var leaseStart = lease.StartDate.Value.Date;
            var leaseEnd = lease.EndDate.Value.Date;

            var firstDueDay = GetActualDayOfMonth(lease.RentDueDay, leaseStart.Year, leaseStart.Month);
            var firstDueDate = new DateTime(leaseStart.Year, leaseStart.Month, firstDueDay);
            if (firstDueDate < leaseStart)
            {
                var nextMonth = firstDueDate.AddMonths(1);
                firstDueDate = new DateTime(nextMonth.Year, nextMonth.Month,
                    GetActualDayOfMonth(lease.RentDueDay, nextMonth.Year, nextMonth.Month));
            }

            var rentCredits = RentBalanceCreditingPayments(payments)
                .Where(payment => payment.LeaseId == lease.Id)
                .Sum(payment => payment.Amount);
            var remainingCredits = rentCredits;
            var currentRentDue = 0m;
            var priorOverdue = 0m;
            var currentPeriodOverdue = 0m;
            DateTime? latestAccruedDueDate = null;

            // Allocate finalized rent credits oldest-first, then classify each unpaid accrued
            // installment by its own grace deadline. Future installments are not yet rent due.
            for (var dueDate = firstDueDate;
                 dueDate <= localToday && dueDate <= leaseEnd;
                 dueDate = NextMonthlyDueDate(dueDate, lease.RentDueDay))
            {
                latestAccruedDueDate = dueDate;
                var appliedCredit = Math.Min(remainingCredits, lease.RentAmount.Value);
                var unpaid = Math.Max(lease.RentAmount.Value - appliedCredit, 0m);
                remainingCredits -= appliedCredit;
                if (unpaid <= 0m)
                    continue;

                if (localToday > dueDate.AddDays(GetGraceDays(lease)))
                {
                    if (dueDate.Year == localToday.Year && dueDate.Month == localToday.Month)
                        currentPeriodOverdue += unpaid;
                    else
                        priorOverdue += unpaid;
                }
                else
                {
                    currentRentDue += unpaid;
                }
            }

            var overdue = priorOverdue + currentPeriodOverdue;
            var rentDue = overdue + currentRentDue;

            return new(
                currentRentDue,
                priorOverdue,
                overdue,
                rentDue,
                overdue > 0m,
                latestAccruedDueDate);
        }

        private static DateTime NextMonthlyDueDate(DateTime dueDate, int? rentDueDay)
        {
            var nextMonth = dueDate.AddMonths(1);
            return new DateTime(nextMonth.Year, nextMonth.Month,
                GetActualDayOfMonth(rentDueDay, nextMonth.Year, nextMonth.Month));
        }

        /// <summary>
        /// Current period rent amount that is "due" only when within 15 days of the next due date.
        /// Returns 0 if before the charge visibility window or if tenant has already paid through this period.
        /// </summary>
        public static decimal GetCurrentPeriodDueAmount(LoadLeaseDto lease, List<LoadPaymentDto> payments, string? timezone = null)
        {
            var today = string.IsNullOrWhiteSpace(timezone) ? DateTime.Today : TimezoneHelper.GetLocalToday(timezone);
            if (!lease.StartDate.HasValue || !lease.EndDate.HasValue || !lease.RentAmount.HasValue ||
                !lease.RentDueDay.HasValue || !lease.IsActive || lease.StartDate.Value > today)
                return 0m;

            var nextDueDate = CalculateNextDueDate(lease.StartDate.Value, lease.EndDate.Value, lease.RentDueDay, timezone);
            var chargeVisibleDate = nextDueDate.AddDays(-15);
            if (today < chargeVisibleDate)
                return 0m;

            var totalCollected = BalanceCreditingPayments(payments).Where(p => p.LeaseId == lease.Id).Sum(p => p.Amount);

            DateTime firstDueDate;
            var startMonthDueDay = GetActualDayOfMonth(lease.RentDueDay, lease.StartDate.Value.Year, lease.StartDate.Value.Month);
            if (startMonthDueDay == lease.StartDate.Value.Day)
                firstDueDate = lease.StartDate.Value;
            else
            {
                firstDueDate = new DateTime(lease.StartDate.Value.Year, lease.StartDate.Value.Month, startMonthDueDay);
                if (firstDueDate < lease.StartDate.Value)
                {
                    var nextMonthDueDay = GetActualDayOfMonth(lease.RentDueDay, firstDueDate.AddMonths(1).Year, firstDueDate.AddMonths(1).Month);
                    firstDueDate = new DateTime(firstDueDate.AddMonths(1).Year, firstDueDate.AddMonths(1).Month, nextMonthDueDay);
                }
            }

            if (today < firstDueDate || nextDueDate < firstDueDate)
                return 0m;

            // Number of periods from first due through the period whose due date is nextDueDate (inclusive)
            var periodsThroughNextDue = 1 + ((nextDueDate.Year - firstDueDate.Year) * 12) + nextDueDate.Month - firstDueDate.Month;
            if (periodsThroughNextDue < 0) periodsThroughNextDue = 0;
            var expectedThroughThisPeriod = periodsThroughNextDue * lease.RentAmount.Value;
            if (totalCollected >= expectedThroughThisPeriod)
                return 0m;

            return lease.RentAmount.Value;
        }

        /// <summary>
        /// Remaining rent for the due date in the current calendar month. This keeps the
        /// current month's rent separate from older overdue rent in payment summaries.
        /// </summary>
        public static decimal GetCurrentMonthRentDue(
            LoadLeaseDto lease,
            List<LoadPaymentDto> payments,
            string? timezone = null,
            DateTime? today = null) => GetRentBalance(lease, payments, timezone, today).CurrentMonthRentDue;

        public static DateTime? GetCurrentMonthRentDueDate(
            LoadLeaseDto lease,
            string? timezone = null,
            DateTime? today = null)
        {
            var localToday = ResolveToday(timezone, today);
            if (!lease.StartDate.HasValue || !lease.EndDate.HasValue || !lease.RentDueDay.HasValue ||
                !lease.RentAmount.HasValue || lease.RentAmount.Value <= 0m || !lease.IsActive ||
                lease.StartDate.Value.Date > localToday)
                return null;

            var dueDay = GetActualDayOfMonth(lease.RentDueDay, localToday.Year, localToday.Month);
            var dueDate = new DateTime(localToday.Year, localToday.Month, dueDay);
            return dueDate < lease.StartDate.Value.Date || dueDate > lease.EndDate.Value.Date ? null : dueDate;
        }

        public static bool IsCurrentMonthRentOverdue(
            LoadLeaseDto lease,
            List<LoadPaymentDto> payments,
            string? timezone = null,
            DateTime? today = null)
        {
            var balance = GetRentBalance(lease, payments, timezone, today);
            return balance.OverdueAmount > balance.PriorPeriodOverdueRent;
        }

        /// <summary>Unpaid rent from installments before the current calendar month.</summary>
        public static decimal GetPriorPeriodOverdueRent(
            LoadLeaseDto lease,
            List<LoadPaymentDto> payments,
            string? timezone = null,
            DateTime? today = null) => GetRentBalance(lease, payments, timezone, today).PriorPeriodOverdueRent;

        /// <summary>Total accrued rent balance, excluding fees and deposits.</summary>
        public static decimal GetAmountDueNow(
            LoadLeaseDto lease,
            List<LoadPaymentDto> payments,
            string? timezone = null,
            DateTime? today = null) => GetRentBalance(lease, payments, timezone, today).RentDue;




        private static decimal ProrateMonthly(decimal monthlyRent, DateTime start, DateTime endExcl)
        {
            decimal sum = 0m;
            var cursor = new DateTime(start.Year, start.Month, 1);
            while (cursor < endExcl)
            {
                var monthStart = Max(cursor, start);
                var monthEndExcl = Min(cursor.AddMonths(1), endExcl);

                var daysInMonth = DateTime.DaysInMonth(cursor.Year, cursor.Month);
                var daysCovered = (monthEndExcl - monthStart).TotalDays;

                if (daysCovered > 0)
                    sum += monthlyRent * (decimal)daysCovered / daysInMonth;

                cursor = cursor.AddMonths(1);
            }
            return sum;
        }

        public static DateTime CalculateNextDueDate(DateTime leaseStart, DateTime leaseEnd, int? rentDueDay, string? timezone = null)
        {
            var today = string.IsNullOrWhiteSpace(timezone) ? DateTime.Today : TimezoneHelper.GetLocalToday(timezone);

            // If lease hasn't started yet → first due date
            if (today < leaseStart)
            {
                var startMonthDueDay = GetActualDayOfMonth(rentDueDay, leaseStart.Year, leaseStart.Month);
                var firstDue = new DateTime(leaseStart.Year, leaseStart.Month, startMonthDueDay);
                if (firstDue < leaseStart)
                {
                    // Move to next month
                    var nextMonthDueDay = GetActualDayOfMonth(rentDueDay, firstDue.AddMonths(1).Year, firstDue.AddMonths(1).Month);
                    return new DateTime(firstDue.AddMonths(1).Year, firstDue.AddMonths(1).Month, nextMonthDueDay);
                }
                return firstDue;
            }

            // Start with this month's due date
            var thisMonthDueDay = GetActualDayOfMonth(rentDueDay, today.Year, today.Month);
            var candidate = new DateTime(today.Year, today.Month, thisMonthDueDay);

            // If due date already passed this month → push to next month
            if (today > candidate)
            {
                var nextMonthDueDay = GetActualDayOfMonth(rentDueDay, candidate.AddMonths(1).Year, candidate.AddMonths(1).Month);
                candidate = new DateTime(candidate.AddMonths(1).Year, candidate.AddMonths(1).Month, nextMonthDueDay);
            }

            // If it goes beyond lease end → cap at lease end
            if (candidate > leaseEnd)
                return leaseEnd;

            return candidate;
        }


        private static decimal ProrateYearly(decimal annualRent, DateTime start, DateTime endExcl)
        {
            decimal sum = 0m;
            var cursor = new DateTime(start.Year, 1, 1);
            while (cursor < endExcl)
            {
                var yearStart = Max(cursor, start);
                var yearEndExcl = Min(cursor.AddYears(1), endExcl);

                var daysInYear = DateTime.IsLeapYear(cursor.Year) ? 366m : 365m;
                var daysCovered = (yearEndExcl - yearStart).TotalDays;

                if (daysCovered > 0)
                    sum += annualRent * (decimal)daysCovered / daysInYear;

                cursor = cursor.AddYears(1);
            }
            return sum;
        }

        /// <summary>
        /// Gets the outstanding balance for a tenant based on tenantId + leaseId.
        /// </summary>
        public static async Task<decimal> GetOutstandingForTenantAsync(
            DataContext context,
            long? leaseId)
        {
            if (leaseId == null) return 0m;

            // Load lease
            var lease = await context.Leases
                .AsNoTracking()
                .FirstOrDefaultAsync(l => l.Id == leaseId.Value);

            if (lease == null || lease.IsDeleted || !lease.RentAmount.HasValue || lease.RentAmount <= 0 ||
                !lease.StartDate.HasValue || !lease.EndDate.HasValue)
                return 0m;

            // Load payments for this lease
            var payments = await context.Payments
                .AsNoTracking()
                .Where(p => p.LeaseId == leaseId.Value
                    && (p.Status == "Completed" || p.Status == "PartiallyRefunded"
                        || p.Status == "Refunded" || p.Status == "Disputed")
                    && p.FeeId == null
                    && p.DepositId == null)
                .Select(p => new LoadPaymentDto
                {
                    Id = p.Id,
                    LeaseId = p.LeaseId,
                    Amount = p.Amount,
                    PaymentDate = p.PaymentDate
                })
                .ToListAsync();

            // Expected rent from start until today
            var today = DateTime.Today;
            var expected = ExpectedForLease(new LoadLeaseDto
            {
                Id = lease.Id,
                StartDate = lease.StartDate,
                EndDate = lease.EndDate,
                RentAmount = lease.RentAmount,
                RentFrequency = lease.RentFrequency,
                IsActive = !lease.IsDeleted
            }, lease.StartDate.Value, today);

            // Total paid
            var paid = payments.Sum(p => p.Amount);

            return Math.Max(expected - paid, 0m);
        }

        public static decimal GetOutstandingForLease(LoadLeaseDto lease, List<LoadPaymentDto> payments)
        {
            if (lease == null || !lease.StartDate.HasValue || !lease.EndDate.HasValue || !lease.RentAmount.HasValue)
                return 0;

            var today = DateTime.Today;

            // Figure out how many billing periods have elapsed since lease start
            int monthsElapsed = ((today.Year - lease.StartDate.Value.Year) * 12) + today.Month - lease.StartDate.Value.Month;

            if (monthsElapsed < 0) monthsElapsed = 0;

            // Expected rent depends on frequency
            decimal expected = lease.RentAmount.Value * monthsElapsed;

            // If lease ended already, cap the expected rent
            if (lease.EndDate.Value < today)
            {
                int totalMonths = ((lease.EndDate.Value.Year - lease.StartDate.Value.Year) * 12) + lease.EndDate.Value.Month - lease.StartDate.Value.Month + 1;
                expected = lease.RentAmount.Value * totalMonths;
            }

            // Payments received
            decimal collected = BalanceCreditingPayments(payments).Sum(p => p.Amount);

            // Outstanding balance
            return Math.Max(expected - collected, 0);
        }

        /// <summary>
        /// Returns the ordered list of rent due dates for a lease from first due through lease end.
        /// Used to pair rent payments with due dates for on-time/late classification.
        /// </summary>
        public static List<DateTime> GetRentDueDatesForLease(DateTime startDate, DateTime endDate, int? rentDueDay)
        {
            if (!rentDueDay.HasValue) return [];
            var startMonthDueDay = GetActualDayOfMonth(rentDueDay, startDate.Year, startDate.Month);
            DateTime firstDueDate;
            if (startMonthDueDay == startDate.Day)
            {
                firstDueDate = startDate.Date;
            }
            else
            {
                firstDueDate = new DateTime(startDate.Year, startDate.Month, startMonthDueDay);
                if (firstDueDate < startDate)
                {
                    var nextMonthDueDay = GetActualDayOfMonth(rentDueDay, firstDueDate.AddMonths(1).Year, firstDueDate.AddMonths(1).Month);
                    firstDueDate = new DateTime(firstDueDate.AddMonths(1).Year, firstDueDate.AddMonths(1).Month, nextMonthDueDay);
                }
            }
            var dueDates = new List<DateTime>();
            var cursor = firstDueDate;
            var endDateDate = endDate.Date;
            while (cursor <= endDateDate)
            {
                dueDates.Add(cursor);
                var nextMonthDueDay = GetActualDayOfMonth(rentDueDay, cursor.AddMonths(1).Year, cursor.AddMonths(1).Month);
                cursor = new DateTime(cursor.AddMonths(1).Year, cursor.AddMonths(1).Month, nextMonthDueDay);
            }
            return dueDates;
        }
    }
}
