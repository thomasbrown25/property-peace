using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Utils
{
    public static class RecurringExpenseCalculator
    {
        private const int MaxOccurrenceResults = 10_000;

        public static DateTime? CalculateNextOccurrence(
            ERecurringFrequency frequency,
            int dayOfPeriod,
            DateTime startDate,
            DateTime? lastGeneratedDate = null,
            DateTime? endDate = null)
        {
            if (!Enum.IsDefined(frequency) || dayOfPeriod is < 1 or > 31)
                return null;

            var today = DateTime.Today;
            var referenceDate = lastGeneratedDate ?? startDate.Date;
            var nextDate = Advance(frequency, dayOfPeriod, referenceDate, 1);
            if (!nextDate.HasValue) return null;

            // Jump directly to the current period. Recursing once per missed period lets an
            // attacker-controlled ancient date exhaust the process stack.
            if (nextDate.Value < today)
            {
                var periods = frequency switch
                {
                    ERecurringFrequency.Monthly => MonthsBetween(nextDate.Value, today),
                    ERecurringFrequency.Quarterly => MonthsBetween(nextDate.Value, today) / 3,
                    ERecurringFrequency.Yearly => today.Year - nextDate.Value.Year,
                    _ => 0
                };
                nextDate = Advance(frequency, dayOfPeriod, nextDate.Value, Math.Max(1, periods));
                if (!nextDate.HasValue) return null;
                if (nextDate.Value < today)
                    nextDate = Advance(frequency, dayOfPeriod, nextDate.Value, 1);
                if (!nextDate.HasValue) return null;
            }

            if (endDate.HasValue && nextDate.Value > endDate.Value)
                return null;

            return nextDate.Value;
        }

        public static List<DateTime> CalculateAllOccurrences(
            ERecurringFrequency frequency,
            int dayOfPeriod,
            DateTime startDate,
            DateTime? endDate = null,
            DateTime? lastGeneratedDate = null)
        {
            if (!Enum.IsDefined(frequency) || dayOfPeriod is < 1 or > 31)
                return [];

            var occurrences = new List<DateTime>();
            var currentDate = (lastGeneratedDate ?? startDate).Date;
            var maxDate = endDate ?? DateTime.Today;

            while (currentDate <= maxDate && occurrences.Count < MaxOccurrenceResults)
            {
                occurrences.Add(currentDate);
                var next = Advance(frequency, dayOfPeriod, currentDate, 1);
                if (!next.HasValue || next.Value <= currentDate || next.Value > maxDate)
                    break;
                currentDate = next.Value;
            }

            return occurrences;
        }

        public static int? DaysUntilNextOccurrence(
            ERecurringFrequency frequency,
            int dayOfPeriod,
            DateTime startDate,
            DateTime? lastGeneratedDate = null,
            DateTime? endDate = null)
        {
            var nextOccurrence = CalculateNextOccurrence(frequency, dayOfPeriod, startDate, lastGeneratedDate, endDate);
            if (!nextOccurrence.HasValue)
                return null;

            var daysUntil = (nextOccurrence.Value - DateTime.Today).Days;
            return daysUntil >= 0 ? daysUntil : null;
        }

        private static int MonthsBetween(DateTime from, DateTime to) =>
            checked((to.Year - from.Year) * 12 + to.Month - from.Month);

        private static DateTime? Advance(ERecurringFrequency frequency, int dayOfPeriod, DateTime referenceDate, int periods)
        {
            try
            {
                var months = frequency switch
                {
                    ERecurringFrequency.Monthly => periods,
                    ERecurringFrequency.Quarterly => checked(periods * 3),
                    ERecurringFrequency.Yearly => checked(periods * 12),
                    _ => 0
                };
                if (months <= 0) return null;

                var advanced = referenceDate.AddMonths(months);
                var month = frequency == ERecurringFrequency.Quarterly
                    ? ((advanced.Month - 1) / 3) * 3 + 1
                    : advanced.Month;
                var day = Math.Min(dayOfPeriod, DateTime.DaysInMonth(advanced.Year, month));
                return new DateTime(advanced.Year, month, day, 0, 0, 0, referenceDate.Kind);
            }
            catch (ArgumentOutOfRangeException)
            {
                return null;
            }
            catch (OverflowException)
            {
                return null;
            }
        }
    }
}
