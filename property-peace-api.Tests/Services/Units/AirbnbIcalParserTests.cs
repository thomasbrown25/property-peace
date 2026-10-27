using System.Text;
using brownstone_hub_api.Services.ShortStay.Ical;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Units;

public class AirbnbIcalParserTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 20, 12, 0, 0, TimeSpan.Zero);
    private const string Zone = "America/New_York";
    private static byte[] Feed(params string[] events) => Encoding.UTF8.GetBytes("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n" + string.Join("", events) + "END:VCALENDAR\r\n");
    private static string Event(string uid, string start, string end, string extra = "") => $"BEGIN:VEVENT\r\nUID:{uid}\r\nDTSTART{start}\r\nDTEND{end}\r\n{extra}END:VEVENT\r\n";
    private static IReadOnlyList<ImportedIcalEvent> Parse(byte[] bytes) => AirbnbIcalParser.Parse(bytes, Zone, Now);

    [Fact] public void EmptyCalendarIsDistinctFromInvalidCalendar()
    {
        Assert.Empty(Parse(Feed()));
        Assert.Throws<InvalidDataException>(() => Parse(Encoding.UTF8.GetBytes("nonsense")));
    }

    [Fact] public void DateOnlyEndIsExclusiveAndUidIsPreserved()
    {
        var item = Assert.Single(Parse(Feed(Event("booking-42", ";VALUE=DATE:20261020", ";VALUE=DATE:20261023", "SUMMARY:Do not import guest\r\n"))));
        Assert.Equal(new ImportedIcalEvent("booking-42", null, new(2026, 10, 20), new(2026, 10, 23)), item);
    }

    [Fact] public void UtcTzidAndFloatingTimesUsePropertyNightsAcrossDst()
    {
        var events = Parse(Feed(
            Event("utc", ":20270314T043000Z", ":20270314T050000Z"),
            Event("tzid", ";TZID=America/Los_Angeles:20271107T013000", ";TZID=America/Los_Angeles:20271107T180000"),
            Event("floating", ":20270313T230000", ":20270314T000000")));
        Assert.Equal(new DateOnly(2027, 3, 13), events[0].StartDate);
        Assert.Equal(new DateOnly(2027, 3, 14), events[0].EndDate);
        Assert.Equal(new DateOnly(2027, 11, 7), events[1].StartDate);
        Assert.Equal(new DateOnly(2027, 11, 8), events[1].EndDate);
        Assert.Equal(new DateOnly(2027, 3, 13), events[2].StartDate);
        Assert.Equal(new DateOnly(2027, 3, 14), events[2].EndDate);
    }

    [Theory]
    [InlineData("RRULE:FREQ=DAILY")]
    [InlineData("RDATE:20261025")]
    [InlineData("EXDATE:20261025")]
    [InlineData("RECURRENCE-ID:20261025")]
    [InlineData("EXRULE:FREQ=DAILY")]
    public void RecurrenceAnywhereRejectsWholeFeed(string recurrence)
    {
        var valid = Event("valid", ";VALUE=DATE:20261020", ";VALUE=DATE:20261021");
        var unsupported = Event("unsupported", ";VALUE=DATE:20261021", ";VALUE=DATE:20261022", recurrence + "\r\n");
        Assert.Throws<InvalidDataException>(() => Parse(Feed(valid, unsupported)));
    }

    [Fact] public void FoldedRecurrenceIsAlsoRejected()
    {
        Assert.Throws<InvalidDataException>(() => Parse(Feed(Event("u", ":20261020T120000Z", ":20261021T120000Z", "RRULE:FREQ=DAILY;\r\n COUNT=2\r\n"))));
    }

    [Theory]
    [InlineData("STATUS:CANCELLED")]
    [InlineData("status:cancelled")]
    [InlineData("TRANSP:TRANSPARENT")]
    [InlineData("transp:transparent")]
    [InlineData("METHOD:CANCEL")]
    public void UnsupportedEventSemanticsRejectWholeFeedAfterValidEvent(string property)
    {
        var valid = Event("valid", ";VALUE=DATE:20261020", ";VALUE=DATE:20261021");
        var unsupported = Event("unsupported", ";VALUE=DATE:20261021", ";VALUE=DATE:20261022", property + "\r\n");
        Assert.Throws<InvalidDataException>(() => Parse(Feed(valid, unsupported)));
    }

    [Fact] public void CalendarCancelMethodRejectsWholeFeed()
    {
        var valid = Event("valid", ";VALUE=DATE:20261020", ";VALUE=DATE:20261021");
        var bytes = Encoding.UTF8.GetBytes("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nmethod:cancel\r\n" + valid + "END:VCALENDAR\r\n");
        Assert.Throws<InvalidDataException>(() => Parse(bytes));
    }

    [Fact] public void ConfirmedOpaquePublishedEventRemainsOccupied()
    {
        var item = Event("booked", ";VALUE=DATE:20261020", ";VALUE=DATE:20261021", "STATUS:CONFIRMED\r\nTRANSP:OPAQUE\r\n");
        var bytes = Encoding.UTF8.GetBytes("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nMETHOD:PUBLISH\r\n" + item + "END:VCALENDAR\r\n");
        Assert.Equal("booked", Assert.Single(Parse(bytes)).SourceUid);
    }

    [Fact] public void FoldedCancellationOutsideHorizonStillRejectsWholeFeed()
    {
        var valid = Event("valid", ";VALUE=DATE:20261020", ";VALUE=DATE:20261021");
        var canceled = Event("old", ";VALUE=DATE:20200101", ";VALUE=DATE:20200102", "STATUS:CAN\r\n CELLED\r\n");
        Assert.Throws<InvalidDataException>(() => Parse(Feed(valid, canceled)));
    }

    [Fact] public void ConflictingDuplicateUidRejectsWholeFeed()
    {
        var first = Event("same", ";VALUE=DATE:20261020", ";VALUE=DATE:20261021");
        var conflicting = Event("same", ";VALUE=DATE:20261025", ";VALUE=DATE:20261027", "STATUS:CANCELLED\r\n");
        Assert.Throws<InvalidDataException>(() => Parse(Feed(first, conflicting)));
        Assert.Throws<InvalidDataException>(() => Parse(Feed(first, Event("same", ";VALUE=DATE:20261025", ";VALUE=DATE:20261027"))));
    }

    [Fact] public void LimitsAndDuplicatesRejectEntireFeed()
    {
        Assert.Throws<InvalidDataException>(() => Parse(new byte[AirbnbIcalParser.MaxBytes + 1]));
        var item = Event("same", ";VALUE=DATE:20261020", ";VALUE=DATE:20261021");
        Assert.Throws<InvalidDataException>(() => Parse(Feed(item, item)));
        Assert.Throws<InvalidDataException>(() => Parse(Feed(Enumerable.Range(0, AirbnbIcalParser.MaxEvents + 1).Select(i => Event($"{i}", ";VALUE=DATE:20261020", ";VALUE=DATE:20261021")).ToArray())));
    }

    [Fact] public void HorizonFiltersAndClipsAndResultIsReadOnly()
    {
        var events = Parse(Feed(Event("old", ";VALUE=DATE:20260101", ";VALUE=DATE:20260102"),
            Event("overlap", ";VALUE=DATE:20260901", ";VALUE=DATE:20260922")));
        var value = Assert.Single(events);
        Assert.Equal(new DateOnly(2026, 9, 20), value.StartDate);
        Assert.Equal(new DateOnly(2026, 9, 22), value.EndDate);
        Assert.Throws<NotSupportedException>(() => ((IList<ImportedIcalEvent>)events).Add(value));
    }

    [Theory]
    [InlineData(";TZID=Mars/Olympus_Mons:20261020T120000")]
    [InlineData(":20270314T023000")]
    [InlineData(";VALUE=DATE:20261320")]
    public void MalformedOrUnknownTimeRejectsFeed(string start)
    {
        Assert.Throws<InvalidDataException>(() => Parse(Feed(Event("u", start, ";VALUE=DATE:20261023"))));
    }

    [Fact] public void GapTimeAndUnknownPropertyZoneReject()
    {
        Assert.Throws<InvalidDataException>(() => Parse(Feed(Event("u", ":20270314T023000", ":20270314T040000"))));
        Assert.Throws<InvalidDataException>(() => AirbnbIcalParser.Parse(Feed(), "Mars/Olympus_Mons", Now));
    }

    [Fact] public void FoldUsesConservativeOffsetsAndRejectsReversedInstants()
    {
        var item = Assert.Single(Parse(Feed(Event("fold", ":20271107T013000", ":20271107T013000"))));
        Assert.Equal(new DateOnly(2027, 11, 7), item.StartDate);
        Assert.Equal(new DateOnly(2027, 11, 8), item.EndDate);
        Assert.Throws<InvalidDataException>(() => Parse(Feed(Event("reversed", ":20271107T030000", ":20271107T020000"))));
    }

    [Fact] public void EmptyLineAndMixedDateTypesRejectEntireFeed()
    {
        Assert.Throws<InvalidDataException>(() => Parse(Feed(Event("u", ";VALUE=DATE:20261020", ":20261023T120000Z"))));
        Assert.Throws<InvalidDataException>(() => Parse(Encoding.UTF8.GetBytes("BEGIN:VCALENDAR\n\nEND:VCALENDAR\n")));
    }

    [Fact] public void StandardTimezoneComponentDoesNotOverrideIanaRules()
    {
        var bytes = Encoding.UTF8.GetBytes("BEGIN:VCALENDAR\r\nBEGIN:VTIMEZONE\r\nTZID:America/New_York\r\nBEGIN:STANDARD\r\nDTSTART:20261101T020000\r\nEND:STANDARD\r\nEND:VTIMEZONE\r\n" +
            Event("u", ";TZID=America/New_York:20270313T230000", ";TZID=America/New_York:20270314T000000") + "END:VCALENDAR\r\n");
        Assert.Equal(new DateOnly(2027, 3, 14), Assert.Single(Parse(bytes)).EndDate);
    }
}
