using System;

namespace brownstone_hub_api.Utils
{
    public static class TimezoneHelper
    {
        /// <summary>
        /// Gets the current date in the user's local timezone.
        /// Returns DateTime.Today in the specified timezone.
        /// </summary>
        /// <param name="timezone">IANA timezone identifier (e.g., "America/New_York") or null/empty for UTC</param>
        /// <returns>Today's date in the user's timezone</returns>
        public static DateTime GetLocalToday(string? timezone)
        {
            if (string.IsNullOrWhiteSpace(timezone))
            {
                // Default to UTC if no timezone specified
                return DateTime.UtcNow.Date;
            }

            try
            {
                TimeZoneInfo timeZoneInfo;
                
                // Try to find the timezone directly (works on Linux/Mac and .NET 6+)
                try
                {
                    timeZoneInfo = TimeZoneInfo.FindSystemTimeZoneById(timezone);
                }
                catch
                {
                    // On Windows, IANA timezones might not be available directly
                    // Try common mappings
                    var windowsTimeZone = MapIanaToWindows(timezone);
                    if (windowsTimeZone != null)
                    {
                        timeZoneInfo = TimeZoneInfo.FindSystemTimeZoneById(windowsTimeZone);
                    }
                    else
                    {
                        // Fall back to UTC if we can't find the timezone
                        return DateTime.UtcNow.Date;
                    }
                }

                // Get current time in UTC
                var utcNow = DateTime.UtcNow;
                
                // Convert to user's local timezone
                var localTime = TimeZoneInfo.ConvertTimeFromUtc(utcNow, timeZoneInfo);
                
                // Return just the date part (midnight in local time)
                return localTime.Date;
            }
            catch (Exception)
            {
                // If timezone conversion fails, fall back to UTC
                return DateTime.UtcNow.Date;
            }
        }

        /// <summary>
        /// Converts a UTC DateTime to the user's local timezone.
        /// </summary>
        /// <param name="utcDateTime">UTC DateTime to convert</param>
        /// <param name="timezone">IANA timezone identifier (e.g., "America/New_York") or null/empty for UTC</param>
        /// <returns>DateTime in the user's local timezone</returns>
        public static DateTime ConvertToLocal(DateTime utcDateTime, string? timezone)
        {
            if (string.IsNullOrWhiteSpace(timezone))
            {
                return utcDateTime;
            }

            try
            {
                TimeZoneInfo timeZoneInfo;
                
                // Try to find the timezone directly
                try
                {
                    timeZoneInfo = TimeZoneInfo.FindSystemTimeZoneById(timezone);
                }
                catch
                {
                    // On Windows, try mapping
                    var windowsTimeZone = MapIanaToWindows(timezone);
                    if (windowsTimeZone != null)
                    {
                        timeZoneInfo = TimeZoneInfo.FindSystemTimeZoneById(windowsTimeZone);
                    }
                    else
                    {
                        return utcDateTime;
                    }
                }

                // Ensure input is treated as UTC
                var utcTime = DateTime.SpecifyKind(utcDateTime, DateTimeKind.Utc);
                
                // Convert to user's local timezone
                return TimeZoneInfo.ConvertTimeFromUtc(utcTime, timeZoneInfo);
            }
            catch (Exception)
            {
                // If timezone conversion fails, return original
                return utcDateTime;
            }
        }

        /// <summary>
        /// Gets the current date and time in the user's local timezone.
        /// </summary>
        /// <param name="timezone">IANA timezone identifier (e.g., "America/New_York") or null/empty for UTC</param>
        /// <returns>Current date and time in the user's timezone</returns>
        public static DateTime GetLocalNow(string? timezone)
        {
            if (string.IsNullOrWhiteSpace(timezone))
            {
                return DateTime.UtcNow;
            }

            try
            {
                TimeZoneInfo timeZoneInfo;
                
                // Try to find the timezone directly
                try
                {
                    timeZoneInfo = TimeZoneInfo.FindSystemTimeZoneById(timezone);
                }
                catch
                {
                    // On Windows, try mapping
                    var windowsTimeZone = MapIanaToWindows(timezone);
                    if (windowsTimeZone != null)
                    {
                        timeZoneInfo = TimeZoneInfo.FindSystemTimeZoneById(windowsTimeZone);
                    }
                    else
                    {
                        return DateTime.UtcNow;
                    }
                }

                // Get current time in UTC
                var utcNow = DateTime.UtcNow;
                
                // Convert to user's local timezone
                return TimeZoneInfo.ConvertTimeFromUtc(utcNow, timeZoneInfo);
            }
            catch (Exception)
            {
                // If timezone conversion fails, fall back to UTC
                return DateTime.UtcNow;
            }
        }

        /// <summary>
        /// Maps common IANA timezone identifiers to Windows timezone identifiers.
        /// This is a fallback for Windows systems that don't support IANA timezones directly.
        /// </summary>
        private static string? MapIanaToWindows(string ianaTimezone)
        {
            // Common mappings for US timezones
            return ianaTimezone switch
            {
                "America/New_York" => "Eastern Standard Time",
                "America/Chicago" => "Central Standard Time",
                "America/Denver" => "Mountain Standard Time",
                "America/Phoenix" => "US Mountain Standard Time",
                "America/Los_Angeles" => "Pacific Standard Time",
                "America/Anchorage" => "Alaskan Standard Time",
                "Pacific/Honolulu" => "Hawaiian Standard Time",
                "America/Toronto" => "Eastern Standard Time",
                "America/Vancouver" => "Pacific Standard Time",
                "Europe/London" => "GMT Standard Time",
                "Europe/Paris" => "W. Europe Standard Time",
                "Europe/Berlin" => "W. Europe Standard Time",
                "Asia/Tokyo" => "Tokyo Standard Time",
                "Asia/Shanghai" => "China Standard Time",
                "Australia/Sydney" => "AUS Eastern Standard Time",
                _ => null
            };
        }
    }
}
