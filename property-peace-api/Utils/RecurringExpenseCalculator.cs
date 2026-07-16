using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Utils
{
    public static class RecurringExpenseCalculator
    {
        /// <summary>
        /// Calculates the next occurrence date for a recurring expense based on frequency and day of period.
        /// </summary>
        /// <param name="frequency">The frequency (Monthly, Quarterly, Yearly)</param>
        /// <param name="dayOfPeriod">Day of period (1-31 for monthly, 1-3 for quarterly, 1-12 for yearly)</param>
        /// <param name="startDate">The start date of the recurring expense</param>
        /// <param name="lastGeneratedDate">The last date an expense was generated (null if none)</param>
        /// <param name="endDate">Optional end date (null if no end)</param>
        /// <returns>The next occurrence date, or null if past end date or invalid</returns>
        public static DateTime? CalculateNextOccurrence(
            ERecurringFrequency frequency,
            int dayOfPeriod,
            DateTime startDate,
            DateTime? lastGeneratedDate = null,
            DateTime? endDate = null)
        {
            var today = DateTime.Today;
            var referenceDate = lastGeneratedDate ?? startDate.Date;
            var nextDate = referenceDate;

            switch (frequency)
            {
                case ERecurringFrequency.Monthly:
                    // Move to next month
                    nextDate = referenceDate.AddMonths(1);
                    // Set day of month (handle months with fewer days)
                    var daysInMonth = DateTime.DaysInMonth(nextDate.Year, nextDate.Month);
                    var dayToSet = Math.Min(dayOfPeriod, daysInMonth);
                    nextDate = new DateTime(nextDate.Year, nextDate.Month, dayToSet);
                    break;

                case ERecurringFrequency.Quarterly:
                    // Move to next quarter (3 months)
                    nextDate = referenceDate.AddMonths(3);
                    
                    // For quarterly, use the first month of the quarter (Jan, Apr, Jul, Oct)
                    // Quarters: Q1 (Jan-Mar), Q2 (Apr-Jun), Q3 (Jul-Sep), Q4 (Oct-Dec)
                    var quarterStartMonth = ((nextDate.Month - 1) / 3) * 3 + 1; // First month of quarter
                    
                    // Set the day of month (handle months with fewer days)
                    var daysInQuarterMonth = DateTime.DaysInMonth(nextDate.Year, quarterStartMonth);
                    var quarterDayToSet = Math.Min(dayOfPeriod, daysInQuarterMonth);
                    nextDate = new DateTime(nextDate.Year, quarterStartMonth, quarterDayToSet);
                    break;

                case ERecurringFrequency.Yearly:
                    // Move to next year, keep same month and day
                    nextDate = referenceDate.AddYears(1);
                    // Set the day of month (handle leap years)
                    var daysInYearMonth = DateTime.DaysInMonth(nextDate.Year, nextDate.Month);
                    var yearDayToSet = Math.Min(dayOfPeriod, daysInYearMonth);
                    nextDate = new DateTime(nextDate.Year, nextDate.Month, yearDayToSet);
                    break;

                default:
                    return null;
            }

            // If next date is before today, calculate further ahead
            if (nextDate < today)
            {
                return CalculateNextOccurrence(frequency, dayOfPeriod, startDate, nextDate, endDate);
            }

            // Check if past end date
            if (endDate.HasValue && nextDate > endDate.Value)
            {
                return null;
            }

            return nextDate;
        }

        /// <summary>
        /// Calculates all occurrence dates between start and end date (or today if no end date).
        /// </summary>
        public static List<DateTime> CalculateAllOccurrences(
            ERecurringFrequency frequency,
            int dayOfPeriod,
            DateTime startDate,
            DateTime? endDate = null,
            DateTime? lastGeneratedDate = null)
        {
            var occurrences = new List<DateTime>();
            var currentDate = startDate.Date;
            var maxDate = endDate ?? DateTime.Today;

            while (currentDate <= maxDate)
            {
                occurrences.Add(currentDate);
                var next = CalculateNextOccurrence(frequency, dayOfPeriod, startDate, currentDate, endDate);
                if (!next.HasValue || next.Value > maxDate)
                    break;
                currentDate = next.Value;
            }

            return occurrences;
        }

        /// <summary>
        /// Gets the number of days until the next occurrence.
        /// </summary>
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
    }
}
