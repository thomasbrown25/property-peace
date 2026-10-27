using System.Collections;
using System.Reflection;
using System.Text.RegularExpressions;
using Microsoft.ApplicationInsights.Channel;
using Microsoft.ApplicationInsights.DataContracts;
using Microsoft.ApplicationInsights.Extensibility;

namespace brownstone_hub_api.Telemetry;

/// <summary>Keep secret Airbnb iCal query tokens out of outbound Application Insights telemetry.</summary>
public sealed class AirbnbCalendarTelemetryProcessor(ITelemetryProcessor next) : ITelemetryProcessor
{
    // Match the exact hostname and calendar path, not lookalike domains or other Airbnb endpoints.
    private static readonly Regex CalendarUrl = new(
        @"https?://www\.airbnb\.com/calendar/ical/[^\s""'<>\\]*",
        RegexOptions.Compiled | RegexOptions.CultureInvariant | RegexOptions.IgnoreCase,
        TimeSpan.FromMilliseconds(100));
    private const string Redacted = "[redacted Airbnb calendar URL]";

    public void Process(ITelemetry telemetry)
    {
        // Preserve trace messages where possible, but never forward a trace whose other
        // serializable fields (including context) still contain the feed URL.
        if (telemetry is TraceTelemetry trace)
        {
            trace.Message = Redact(trace.Message);
            foreach (var key in trace.Properties.Keys.ToArray())
            {
                var value = Redact(trace.Properties[key]);
                var safeKey = Redact(key);
                if (safeKey != key) trace.Properties.Remove(key);
                trace.Properties[safeKey] = value;
            }
        }

        // Inspect the SDK's public data graph, not ToString(): exception ToString()
        // itself can contain the secret, and logging it would create a second leak.
        // Unknown telemetry/extensions and inspection failures fail closed.
        try
        {
            if (ContainsCalendarUrlInData(telemetry, new HashSet<object>(ReferenceEqualityComparer.Instance)))
                return;
        }
        catch
        {
            return;
        }

        next.Process(telemetry);
    }

    private static bool ContainsCalendarUrlInData(object? value, HashSet<object> visited)
    {
        if (value is null) return false;
        if (value is string text) return CalendarUrl.IsMatch(text);
        if (value is Uri uri) return CalendarUrl.IsMatch(uri.OriginalString);
        if (value.GetType().IsValueType) return false;
        if (!visited.Add(value)) return false;

        if (value is Exception exception)
            return ContainsCalendarUrlInData(exception.Message, visited) ||
                   ContainsCalendarUrlInData(exception.StackTrace, visited) ||
                   ContainsCalendarUrlInData(exception.Source, visited) ||
                   ContainsCalendarUrlInData(exception.Data, visited) ||
                   ContainsCalendarUrlInData(exception.InnerException, visited);

        if (value is IDictionary dictionary)
        {
            foreach (DictionaryEntry entry in dictionary)
                if (ContainsCalendarUrlInData(entry.Key, visited) ||
                    ContainsCalendarUrlInData(entry.Value, visited)) return true;
            return false;
        }

        if (value is IEnumerable sequence)
        {
            foreach (var entry in sequence)
                if (ContainsCalendarUrlInData(entry, visited)) return true;
            return false;
        }

        // Only walk SDK types; never invoke arbitrary application object getters.
        if (value.GetType().Assembly != typeof(TraceTelemetry).Assembly)
            return true;

        foreach (var property in value.GetType().GetProperties(BindingFlags.Public | BindingFlags.Instance))
        {
            if (property.GetIndexParameters().Length != 0) continue;
            object? field;
            try { field = property.GetValue(value); }
            catch (TargetInvocationException ex) when (ex.InnerException is KeyNotFoundException)
            {
                // Some SDK convenience getters (e.g. RequestTelemetry.HttpMethod)
                // throw when the backing property is absent; the dictionary is scanned.
                continue;
            }
            if (ContainsCalendarUrlInData(field, visited)) return true;
        }
        return false;
    }

    private static string Redact(string value) => CalendarUrl.Replace(value, Redacted);
}
