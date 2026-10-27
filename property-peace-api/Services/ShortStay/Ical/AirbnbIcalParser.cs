using System.Globalization;
using System.Text;

namespace brownstone_hub_api.Services.ShortStay.Ical;

/// <summary>A deliberately strict, bounded read-only VEVENT importer. Recurring feeds are unsupported.</summary>
public static class AirbnbIcalParser
{
    public const int MaxBytes = 1024 * 1024;
    public const int MaxEvents = 1000;
    private static readonly UTF8Encoding Utf8 = new(false, true);
    private static readonly string[] RecurrenceProperties = ["RRULE", "RDATE", "EXDATE", "RECURRENCE-ID", "EXRULE"];

    public static IReadOnlyList<ImportedIcalEvent> Parse(ReadOnlySpan<byte> bytes, string propertyIanaTimeZone, DateTimeOffset now)
    {
        if (bytes.Length > MaxBytes) throw Invalid("Feed exceeds 1 MB.");
        TimeZoneInfo zone;
        try
        {
            if (string.IsNullOrWhiteSpace(propertyIanaTimeZone) || !TimeZoneInfo.TryConvertIanaIdToWindowsId(propertyIanaTimeZone, out _))
                throw Invalid("Invalid property IANA time zone.");
            zone = TimeZoneInfo.FindSystemTimeZoneById(propertyIanaTimeZone);
        }
        catch (TimeZoneNotFoundException) { throw Invalid("Unknown property time zone."); }
        catch (InvalidTimeZoneException) { throw Invalid("Invalid property time zone."); }

        string text;
        try { text = Utf8.GetString(bytes); }
        catch (DecoderFallbackException) { throw Invalid("Invalid UTF-8."); }
        if (text.StartsWith('\uFEFF')) text = text[1..];
        if (text.Contains('\r') && text.Replace("\r\n", "").Contains('\r')) throw Invalid("Bare carriage return.");
        var physicalLines = text.Split('\n');
        var lines = new List<string>();
        for (var i = 0; i < physicalLines.Length; i++)
        {
            var physical = physicalLines[i];
            var line = physical.TrimEnd('\r');
            if (line.Length > 65536) throw Invalid("Line too long.");
            if (line.StartsWith(' ') || line.StartsWith('\t'))
            {
                if (lines.Count == 0) throw Invalid("Orphan continuation.");
                lines[^1] += line[1..];
                if (lines[^1].Length > 65536) throw Invalid("Unfolded line too long.");
            }
            else if (line.Length != 0 || i != physicalLines.Length - 1) lines.Add(line);
        }
        // The only permitted empty physical line is the final newline.
        if (lines.Count < 2 || lines[0] != "BEGIN:VCALENDAR" || lines[^1] != "END:VCALENDAR") throw Invalid("Invalid calendar envelope.");
        var localToday = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(now, zone).DateTime);
        var min = localToday.AddDays(-30);
        var maxExclusive = localToday.AddYears(2).AddDays(1);
        var result = new List<ImportedIcalEvent>();
        var uids = new HashSet<string>(StringComparer.Ordinal);
        var component = "";
        var eventCount = 0;
        string? uid = null, start = null, end = null;
        string? startParams = null, endParams = null;
        foreach (var line in lines.Skip(1).SkipLast(1))
        {
            if (line.Length == 0) throw Invalid("Empty calendar line.");
            if (line.StartsWith("BEGIN:", StringComparison.OrdinalIgnoreCase))
            {
                var name = line[6..].ToUpperInvariant();
                if (component == "VTIMEZONE" && name is "STANDARD" or "DAYLIGHT")
                {
                    component = "VTIMEZONE/" + name;
                    continue;
                }
                if (component.Length != 0 || name is not ("VEVENT" or "VTIMEZONE")) throw Invalid("Unexpected nested component.");
                component = name;
                if (name == "VEVENT")
                {
                    if (++eventCount > MaxEvents) throw Invalid("Too many events.");
                    uid = start = end = startParams = endParams = null;
                }
                continue;
            }
            if (line.StartsWith("END:", StringComparison.OrdinalIgnoreCase))
            {
                if (component.StartsWith("VTIMEZONE/", StringComparison.Ordinal))
                {
                    if (!line[4..].Equals(component[10..], StringComparison.OrdinalIgnoreCase)) throw Invalid("Mismatched component.");
                    component = "VTIMEZONE";
                    continue;
                }
                if (component.Length == 0 || !line[4..].Equals(component, StringComparison.OrdinalIgnoreCase)) throw Invalid("Mismatched component.");
                if (component == "VEVENT")
                {
                    if (string.IsNullOrWhiteSpace(uid) || start is null || end is null) throw Invalid("Missing UID or dates.");
                    if (!uids.Add(uid)) throw Invalid("Duplicate UID.");
                    var (startDate, startDateOnly, startInstant) = ParseDate(start, startParams!, zone, true);
                    var (endDate, endDateOnly, endInstant) = ParseDate(end, endParams!, zone, false);
                    if (startDateOnly != endDateOnly || endDate <= startDate ||
                        (startInstant.HasValue && endInstant <= startInstant)) throw Invalid("Invalid event interval.");
                    if (startDate < maxExclusive && endDate > min)
                    {
                        result.Add(new ImportedIcalEvent(uid, null,
                            startDate < min ? min : startDate, endDate > maxExclusive ? maxExclusive : endDate));
                    }
                }
                component = "";
                continue;
            }
            var colon = line.IndexOf(':');
            if (colon < 1) throw Invalid("Malformed calendar property.");
            var header = line[..colon];
            var semicolon = header.IndexOf(';');
            var namePart = (semicolon < 0 ? header : header[..semicolon]).ToUpperInvariant();
            if (RecurrenceProperties.Contains(namePart)) throw Invalid("Recurrence is unsupported; feed rejected.");
            var value = line[(colon + 1)..];
            // These properties can retract an earlier booking or mark it as non-blocking.
            // Never convert them to occupied nights (even for an event outside the horizon).
            if ((namePart == "STATUS" && value.Equals("CANCELLED", StringComparison.OrdinalIgnoreCase)) ||
                (namePart == "TRANSP" && value.Equals("TRANSPARENT", StringComparison.OrdinalIgnoreCase)) ||
                (namePart == "METHOD" && value.Equals("CANCEL", StringComparison.OrdinalIgnoreCase)))
                throw Invalid("Cancelled or transparent calendar semantics are unsupported; feed rejected.");
            if (component != "VEVENT") continue;
            var parameters = semicolon < 0 ? "" : header[(semicolon + 1)..];
            switch (namePart)
            {
                case "UID":
                    if (uid is not null || parameters.Length != 0) throw Invalid("Duplicate or parameterized UID.");
                    uid = value;
                    break;
                case "DTSTART":
                    if (start is not null) throw Invalid("Duplicate DTSTART.");
                    start = value; startParams = parameters;
                    break;
                case "DTEND":
                    if (end is not null) throw Invalid("Duplicate DTEND.");
                    end = value; endParams = parameters;
                    break;
                case "DURATION":
                    throw Invalid("DURATION is unsupported.");
            }
        }
        if (component.Length != 0) throw Invalid("Unclosed component.");
        return Array.AsReadOnly(result.ToArray());
    }

    private static (DateOnly Date, bool DateOnly, DateTimeOffset? Instant) ParseDate(string value, string parameters, TimeZoneInfo propertyZone, bool start)
    {
        string? tzid = null;
        var dateOnly = false;
        if (parameters.Length != 0)
        {
            foreach (var parameter in parameters.Split(';'))
            {
                var pair = parameter.Split('=', 2);
                if (pair.Length != 2) throw Invalid("Malformed date parameter.");
                if (pair[0].Equals("TZID", StringComparison.OrdinalIgnoreCase) && tzid is null) tzid = pair[1];
                else if (pair[0].Equals("VALUE", StringComparison.OrdinalIgnoreCase) && pair[1].Equals("DATE", StringComparison.OrdinalIgnoreCase) && !dateOnly) dateOnly = true;
                else throw Invalid("Unsupported date parameter.");
            }
        }
        if (dateOnly || (parameters.Length == 0 && value.Length == 8))
        {
            if (tzid is not null || value.Length != 8 || !DateOnly.TryParseExact(value, "yyyyMMdd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
                throw Invalid("Invalid date-only value.");
            return (date, true, null);
        }
        var utc = value.EndsWith('Z');
        var timeText = utc ? value[..^1] : value;
        if (timeText.Length != 15 || !DateTime.TryParseExact(timeText, "yyyyMMdd'T'HHmmss", CultureInfo.InvariantCulture,
                DateTimeStyles.None, out var time)) throw Invalid("Invalid date-time value.");
        if (utc && tzid is not null) throw Invalid("TZID on UTC value.");
        TimeZoneInfo eventZone = propertyZone;
        if (tzid is not null)
        {
            try
            {
                if (!TimeZoneInfo.TryConvertIanaIdToWindowsId(tzid, out _)) throw Invalid("Invalid IANA TZID.");
                eventZone = TimeZoneInfo.FindSystemTimeZoneById(tzid);
            }
            catch (TimeZoneNotFoundException) { throw Invalid("Unknown TZID."); }
            catch (InvalidTimeZoneException) { throw Invalid("Invalid TZID."); }
        }
        DateTimeOffset instant;
        if (utc) instant = new DateTimeOffset(DateTime.SpecifyKind(time, DateTimeKind.Utc));
        else
        {
            if (eventZone.IsInvalidTime(time)) throw Invalid("Nonexistent local time.");
            // At a fall-back fold, choose the earliest start / latest end to avoid missing occupied nights.
            var offset = eventZone.IsAmbiguousTime(time)
                ? (start ? eventZone.GetAmbiguousTimeOffsets(time).Max() : eventZone.GetAmbiguousTimeOffsets(time).Min())
                : eventZone.GetUtcOffset(time);
            instant = new DateTimeOffset(time, offset);
        }
        var local = TimeZoneInfo.ConvertTime(instant, propertyZone).DateTime;
        var day = DateOnly.FromDateTime(local);
        if (!start && local.TimeOfDay != TimeSpan.Zero) day = day.AddDays(1);
        return (day, false, instant);
    }

    private static InvalidDataException Invalid(string reason) => new($"Invalid iCal feed: {reason}");
}

public sealed record ImportedIcalEvent(string SourceUid, string? RecurrenceKey, DateOnly StartDate, DateOnly EndDate);
