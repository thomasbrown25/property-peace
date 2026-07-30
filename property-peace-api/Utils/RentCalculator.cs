using System;
using System.Collections.Generic;
using System.Linq;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Lease;
using brownstone_hub_api.Dtos.Payment;
using brownstone_hub_api.Enums;
using Microsoft.EntityFrameworkCore;
using brownstone_hub_api.Utils;

namespace brownstone_hub_api.Utils
{
    public static class RentCalculator
    {
        private static readonly HashSet<string> BalanceCreditingStatuses = new(StringComparer.OrdinalIgnoreCase)
        {
            "Completed",
            "Paid"
        };

        private static IEnumerable<LoadPaymentDto> BalanceCreditingPayments(IEnumerable<LoadPaymentDto>? payments)
        {
            return payments?.Where(p => BalanceCreditingStatuses.Contains(p.Status ?? string.Empty)) ?? [];
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
        public static decimal CalculateOverdue(IEnumerable<LoadLeaseDto> leases, List<LoadPaymentDto> payments, string? timezone = null)
        {
            decimal totalOverdue = 0;
            var today = string.IsNullOrWhiteSpace(timezone) ? DateTime.Today : TimezoneHelper.GetLocalToday(timezone);

            foreach (var lease in leases)
            {
                // Skip if lease hasn't started yet or missing required fields
                if (!lease.StartDate.HasValue || !lease.EndDate.HasValue || !lease.RentAmount.HasValue ||
                    !lease.RentDueDay.HasValue || lease.StartDate.Value > today || !lease.IsActive)
                    continue;

                // Determine how many months should have been paid up until today
                var effectiveEnd = today < lease.EndDate.Value ? today : lease.EndDate.Value;

                // Include current month only when today is strictly after the due day (overdue = today > dueDay)
                var actualDueDay = GetActualDayOfMonth(lease.RentDueDay, today.Year, today.Month);
                var currentDueDate = new DateTime(today.Year, today.Month, actualDueDay);
                var includeCurrentMonth = today > currentDueDate;

                var monthsElapsed = ((effectiveEnd.Year - lease.StartDate.Value.Year) * 12)
                                    + effectiveEnd.Month - lease.StartDate.Value.Month
                                    + (includeCurrentMonth ? 1 : 0);

                if (monthsElapsed < 0) monthsElapsed = 0;

                // Expected total rent up to now
                var expectedSoFar = monthsElapsed * lease.RentAmount.Value;

                // Total payments made for this lease
                var leasePayments = BalanceCreditingPayments(payments).Where(p => p.LeaseId == lease.Id).Sum(p => p.Amount);

                // Overdue = expected – paid
                var leaseOverdue = expectedSoFar - leasePayments;

                if (leaseOverdue > 0)
                    totalOverdue += leaseOverdue;
            }

            return totalOverdue;
        }



        // determine rent status for a lease given payments
        public static ERentStatus GetStatus(LoadLeaseDto lease, List<LoadPaymentDto> payments, string? timezone = null)
        {
            var today = string.IsNullOrWhiteSpace(timezone) ? DateTime.Today : TimezoneHelper.GetLocalToday(timezone);

            // If lease hasn't started yet, show as NotStarted regardless of IsActive
            if (!lease.StartDate.HasValue || lease.StartDate.Value > today)
                return ERentStatus.NotStarted;

            // If lease is not active and has started, it's archived
            if (!lease.IsActive)
                return ERentStatus.Archived;

            // Check for required nullable fields
            if (!lease.StartDate.HasValue || !lease.EndDate.HasValue || !lease.RentAmount.HasValue || !lease.RentDueDay.HasValue)
                return ERentStatus.Archived;

            var startOfMonth = new DateTime(today.Year, today.Month, 1);
            var endOfMonth = startOfMonth.AddMonths(1);

            // Expected rent for this lease this month
            var expectedThisMonth = ExpectedForLease(lease, startOfMonth, endOfMonth);

            // Total collected for this lease (all-time, including early payments). Only finalized payments credit the balance.
            var totalCollected = BalanceCreditingPayments(payments)
                .Where(p => p.LeaseId == lease.Id)
                .Sum(p => p.Amount);

            // Total expected through this month - use same logic as CalculateOverdueForLease
            var effectiveEnd = today < lease.EndDate.Value ? today : lease.EndDate.Value;

            // Calculate first due date
            // If rent due day matches lease start day, first payment is due on the lease start date
            // Otherwise, calculate based on rent due day relative to start date
            DateTime firstDueDate;
            if (lease.RentDueDay.Value == lease.StartDate.Value.Day)
            {
                // Rent due day matches start day - first payment is due on the lease start date
                firstDueDate = lease.StartDate.Value;
            }
            else
            {
                firstDueDate = new DateTime(lease.StartDate.Value.Year, lease.StartDate.Value.Month, lease.RentDueDay.Value);
                if (firstDueDate < lease.StartDate.Value)
                {
                    // If due day is before start date, first payment is next month
                    // (e.g., lease starts Jan 15, rent due on 1st -> first payment due Feb 1)
                    firstDueDate = firstDueDate.AddMonths(1);
                }
                // If due day is after start date, first payment is due on that date in the start month
                // (e.g., lease starts Jan 5, rent due on 10th -> first payment due Jan 10)
            }

            decimal expectedThroughThisMonth = 0m;

            // If we've reached the first due date, calculate expected rent
            if (today >= firstDueDate)
            {
                // Count months from first due date to effective end date
                var monthsFromFirstDue = ((effectiveEnd.Year - firstDueDate.Year) * 12)
                                        + effectiveEnd.Month - firstDueDate.Month;

                // Include current month if today is on or past the due day
                var currentMonthDueDay = GetActualDayOfMonth(lease.RentDueDay, today.Year, today.Month);
                var currentDueDate = new DateTime(today.Year, today.Month, currentMonthDueDay);
                if (today >= currentDueDate && currentDueDate >= firstDueDate)
                {
                    monthsFromFirstDue += 1;
                }

                // Special case: if first due date is today or in the past, and we're past the due day, ensure at least 1 month is expected
                if (today > firstDueDate && monthsFromFirstDue == 0)
                {
                    monthsFromFirstDue = 1;
                }

                if (monthsFromFirstDue < 0) monthsFromFirstDue = 0;

                expectedThroughThisMonth = monthsFromFirstDue * lease.RentAmount.Value;
            }

            // If tenant has paid enough to cover this month (even if paid early)
            if (totalCollected >= expectedThroughThisMonth)
                return ERentStatus.UpToDate;

            // Overdue only when today is strictly after the due day (today > dueDay, not >=)
            var thisMonthDueDay = GetActualDayOfMonth(lease.RentDueDay, today.Year, today.Month);
            var dueDateThisMonth = new DateTime(today.Year, today.Month, thisMonthDueDay);
            if (today <= dueDateThisMonth)
                return ERentStatus.UpcomingDue;

            // Otherwise they’re short and past due date
            return ERentStatus.Overdue;
        }


        public static decimal CalculateOverdueForLease(LoadLeaseDto lease, List<LoadPaymentDto> payments, string? timezone = null)
        {
            var today = string.IsNullOrWhiteSpace(timezone) ? DateTime.Today : TimezoneHelper.GetLocalToday(timezone);

            // Skip if lease hasn't started or archived or missing required fields
            if (!lease.StartDate.HasValue || !lease.EndDate.HasValue || !lease.RentAmount.HasValue ||
                !lease.RentDueDay.HasValue || lease.StartDate.Value > today || !lease.IsActive)
                return 0;
            var effectiveEnd = today < lease.EndDate.Value ? today : lease.EndDate.Value;

            // Calculate first due date
            // Get actual due day for the start month
            var startMonthDueDay = GetActualDayOfMonth(lease.RentDueDay, lease.StartDate.Value.Year, lease.StartDate.Value.Month);

            DateTime firstDueDate;
            if (startMonthDueDay == lease.StartDate.Value.Day)
            {
                // Rent due day matches start day - first payment is due on the lease start date
                firstDueDate = lease.StartDate.Value;
            }
            else
            {
                firstDueDate = new DateTime(lease.StartDate.Value.Year, lease.StartDate.Value.Month, startMonthDueDay);
                if (firstDueDate < lease.StartDate.Value)
                {
                    // If due day is before start date, first payment is next month
                    // (e.g., lease starts Jan 15, rent due on 1st -> first payment due Feb 1)
                    var nextMonthDueDay = GetActualDayOfMonth(lease.RentDueDay, firstDueDate.AddMonths(1).Year, firstDueDate.AddMonths(1).Month);
                    firstDueDate = new DateTime(firstDueDate.AddMonths(1).Year, firstDueDate.AddMonths(1).Month, nextMonthDueDay);
                }
                // If due day is after start date, first payment is due on that date in the start month
                // (e.g., lease starts Jan 5, rent due on 10th -> first payment due Jan 10)
            }

            // If we haven't reached the first due date yet, no rent is due
            if (today < firstDueDate)
                return 0;

            // Count months from first due date to effective end date
            var monthsFromFirstDue = ((effectiveEnd.Year - firstDueDate.Year) * 12)
                                    + effectiveEnd.Month - firstDueDate.Month;

            // Include current month only when today is strictly after the due day (overdue = today > dueDay)
            var currentMonthDueDay = GetActualDayOfMonth(lease.RentDueDay, today.Year, today.Month);
            var currentDueDate = new DateTime(today.Year, today.Month, currentMonthDueDay);
            if (today > currentDueDate && currentDueDate >= firstDueDate)
            {
                monthsFromFirstDue += 1;
            }

            // Special case: if first due date is today or in the past, and we're past the due day, ensure at least 1 month is expected
            if (today > firstDueDate && monthsFromFirstDue == 0)
            {
                monthsFromFirstDue = 1;
            }

            if (monthsFromFirstDue < 0) monthsFromFirstDue = 0;

            var expectedSoFar = monthsFromFirstDue * lease.RentAmount.Value;

            var leasePayments = BalanceCreditingPayments(payments).Where(p => p.LeaseId == lease.Id).Sum(p => p.Amount);

            var overdue = expectedSoFar - leasePayments;

            return overdue > 0 ? overdue : 0;
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
        /// Amount due now: overdue amount (strictly after due day) + current period rent when within 15-day charge window.
        /// </summary>
        public static decimal GetAmountDueNow(LoadLeaseDto lease, List<LoadPaymentDto> payments, string? timezone = null)
        {
            var overdue = CalculateOverdueForLease(lease, payments, timezone);
            var currentPeriodDue = GetCurrentPeriodDueAmount(lease, payments, timezone);
            return overdue + currentPeriodDue;
        }




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
