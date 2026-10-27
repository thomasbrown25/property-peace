using brownstone_hub_api.Telemetry;
using Microsoft.ApplicationInsights.Channel;
using Microsoft.ApplicationInsights.DataContracts;
using Microsoft.ApplicationInsights.Extensibility;
using Xunit;

namespace brownstone_hub_api.Tests.Telemetry;

public class AirbnbCalendarTelemetryProcessorTests
{
    private const string Secret = "secret_calendar_token_123";
    private const string Feed = "https://www.airbnb.com/calendar/ical/123.ics?s=" + Secret;

    private sealed class CaptureProcessor : ITelemetryProcessor
    {
        public List<ITelemetry> Received { get; } = [];
        public void Process(ITelemetry telemetry) => Received.Add(telemetry);
    }

    [Theory]
    [InlineData("https://www.airbnb.com/calendar/ical/123.ics?s=secret_calendar_token_123", "GET https://example.com/")]
    [InlineData("https://example.com/", "GET HTTPS://WWW.AIRBNB.COM/CALENDAR/ICAL/123.ics?s=secret_calendar_token_123")]
    [InlineData("", "GET https://www.airbnb.com/calendar/ical/123.ics?s=secret_calendar_token_123")]
    public void DropsCalendarDependenciesRegardlessOfWhichFieldContainsUrl(string data, string name)
    {
        var capture = new CaptureProcessor();
        var dependency = new DependencyTelemetry { Data = data, Name = name };
        dependency.Properties["custom"] = Secret;

        new AirbnbCalendarTelemetryProcessor(capture).Process(dependency);

        Assert.Empty(capture.Received);
    }

    [Theory]
    [InlineData("https://www.airbnb.com.evil.org/calendar/ical/123.ics?s=secret_calendar_token_123")]
    [InlineData("https://airbnb.com/calendar/ical/123.ics?s=secret_calendar_token_123")]
    [InlineData("https://www.airbnb.com/rooms/123?s=secret_calendar_token_123")]
    [InlineData("https://example.com/calendar/ical/123.ics?s=secret_calendar_token_123")]
    public void ForwardsOtherDependenciesUnchanged(string url)
    {
        var capture = new CaptureProcessor();
        var dependency = new DependencyTelemetry { Data = url, Name = "GET other service" };

        new AirbnbCalendarTelemetryProcessor(capture).Process(dependency);

        Assert.Same(dependency, Assert.Single(capture.Received));
        Assert.Equal(url, dependency.Data);
    }

    [Fact]
    public void RedactsCalendarUrlsInTraceMessageAndPropertiesWithoutDroppingTrace()
    {
        var capture = new CaptureProcessor();
        var trace = new TraceTelemetry("Fetch failed: " + Feed + " and HTTPS://WWW.AIRBNB.COM/CALENDAR/ICAL/456.ics?t=" + Secret);
        trace.Properties["url"] = Feed;
        trace.Properties["failed: " + Feed] = "request";
        trace.Properties["unrelated"] = "safe";

        new AirbnbCalendarTelemetryProcessor(capture).Process(trace);

        Assert.Same(trace, Assert.Single(capture.Received));
        Assert.DoesNotContain(Secret, trace.Message);
        Assert.DoesNotContain(Feed, trace.Properties["url"]);
        Assert.All(trace.Properties, property =>
        {
            Assert.DoesNotContain(Secret, property.Key);
            Assert.DoesNotContain(Secret, property.Value);
        });
        Assert.Equal("safe", trace.Properties["unrelated"]);
        Assert.Contains("[redacted Airbnb calendar URL]", trace.Message);
    }

    private static IEnumerable<ITelemetry> LeakingTelemetry()
    {
        yield return new ExceptionTelemetry(new InvalidOperationException("Failure: " + Feed));
        yield return new ExceptionTelemetry(new InvalidOperationException("outer", new InvalidOperationException(Feed)));
        yield return new RequestTelemetry { Url = new Uri(Feed) };
        yield return new RequestTelemetry { Name = "GET " + Feed };
        var request = new RequestTelemetry();
        request.Properties["url"] = Feed;
        yield return request;
        request = new RequestTelemetry();
        request.Properties[Feed] = "value";
        yield return request;
        yield return new DependencyTelemetry { Target = Feed };
        var dependency = new DependencyTelemetry();
        dependency.Properties[Feed] = "value";
        yield return dependency;
        var evt = new EventTelemetry("safe");
        evt.Properties["url"] = Feed;
        yield return evt;
        yield return new PageViewTelemetry { Url = new Uri(Feed) };
        yield return new PageViewPerformanceTelemetry { Url = new Uri(Feed) };
        evt = new EventTelemetry("safe");
        evt.Context.Operation.Name = Feed;
        yield return evt;
        evt = new EventTelemetry("safe");
        evt.Context.GlobalProperties[Feed] = "value";
        yield return evt;
        yield return new AvailabilityTelemetry { Message = Feed };
        yield return new MetricTelemetry { Name = Feed };
        var trace = new TraceTelemetry("safe");
        trace.Context.User.Id = Feed;
        yield return trace;
    }

    [Fact]
    public void DropsTelemetryWithCalendarUrlAnywhere()
    {
        var capture = new CaptureProcessor();
        var processor = new AirbnbCalendarTelemetryProcessor(capture);
        foreach (var item in LeakingTelemetry())
            processor.Process(item);
        Assert.Empty(capture.Received);
    }

    [Fact]
    public void PassesUnrelatedEventUnchanged()
    {
        var capture = new CaptureProcessor();
        var evt = new EventTelemetry("safe");
        evt.Properties["status"] = "ok";
        new AirbnbCalendarTelemetryProcessor(capture).Process(evt);
        Assert.Same(evt, Assert.Single(capture.Received));
    }
}
