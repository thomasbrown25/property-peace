using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Utils
{
    public static class TimeRoundingHelper
    {
        /// <summary>
        /// Rounds time (in hours) based on the specified increment and method
        /// </summary>
        /// <param name="hours">Raw hours to round</param>
        /// <param name="incrementMinutes">Rounding increment in minutes (e.g., 15 for 15-minute increments)</param>
        /// <param name="method">Rounding method (RoundUp, RoundDown, RoundNearest)</param>
        /// <returns>Rounded hours</returns>
        public static decimal RoundTime(decimal hours, int incrementMinutes, ETimeRoundingMethod method)
        {
            if (incrementMinutes <= 0)
                return hours; // No rounding if increment is 0 or negative

            // Convert hours to total minutes
            decimal totalMinutes = hours * 60;

            // Calculate the increment in minutes
            decimal increment = incrementMinutes;

            decimal roundedMinutes;

            switch (method)
            {
                case ETimeRoundingMethod.RoundUp:
                    // Always round up to the next increment
                    roundedMinutes = Math.Ceiling(totalMinutes / increment) * increment;
                    break;

                case ETimeRoundingMethod.RoundDown:
                    // Always round down to the previous increment
                    roundedMinutes = Math.Floor(totalMinutes / increment) * increment;
                    break;

                case ETimeRoundingMethod.RoundNearest:
                    // Round to the nearest increment
                    roundedMinutes = Math.Round(totalMinutes / increment, MidpointRounding.AwayFromZero) * increment;
                    break;

                default:
                    roundedMinutes = totalMinutes;
                    break;
            }

            // Convert back to hours
            return roundedMinutes / 60;
        }

        /// <summary>
        /// Rounds a TimeSpan based on the specified increment and method
        /// </summary>
        public static TimeSpan RoundTimeSpan(TimeSpan timeSpan, int incrementMinutes, ETimeRoundingMethod method)
        {
            decimal hours = (decimal)timeSpan.TotalHours;
            decimal roundedHours = RoundTime(hours, incrementMinutes, method);
            return TimeSpan.FromHours((double)roundedHours);
        }

        /// <summary>
        /// Calculates hours between two DateTime values, then rounds
        /// </summary>
        public static decimal CalculateAndRoundHours(DateTime startTime, DateTime endTime, int incrementMinutes, ETimeRoundingMethod method)
        {
            if (endTime < startTime)
                return 0;

            TimeSpan duration = endTime - startTime;
            decimal rawHours = (decimal)duration.TotalHours;
            return RoundTime(rawHours, incrementMinutes, method);
        }
    }
}
