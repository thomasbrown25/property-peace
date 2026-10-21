using System.Net;
using System.Net.Http;
using System.Text;
using brownstone_hub_api.Services.ShortStay.Ical;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Units;

public class AirbnbIcalFetcherTests
{
    private const string Url = "https://www.airbnb.com/calendar/ical/123456.ics?s=abcdef&t=xyz";
    private static readonly IPAddress Public = IPAddress.Parse("8.8.8.8");

    private sealed class FakeHandler(Func<HttpRequestMessage, HttpResponseMessage> respond) : HttpMessageHandler
    {
        public int Calls { get; private set; }
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Calls++;
            return Task.FromResult(respond(request));
        }
    }

    private static AirbnbIcalFetcher Create(FakeHandler handler, IPAddress[]? answers = null, Action? lookup = null) =>
        new((host, ct) => { lookup?.Invoke(); Assert.Equal("www.airbnb.com", host); return Task.FromResult(answers ?? [Public]); },
            (ip, port, ct) => throw new Xunit.Sdk.XunitException("Socket connection must not occur in fake HTTP tests"),
            _ => handler);

    [Theory]
    [InlineData("http://www.airbnb.com/calendar/ical/123.ics")]
    [InlineData("https://airbnb.com/calendar/ical/123.ics")]
    [InlineData("https://www.airbnb.com.evil.org/calendar/ical/123.ics")]
    [InlineData("https://user@www.airbnb.com/calendar/ical/123.ics")]
    [InlineData("https://www.airbnb.com:443/calendar/ical/123.ics")]
    [InlineData("https://www.airbnb.com/calendar/ical/123.ics#fragment")]
    [InlineData("https://www.airbnb.com/calendar/ical/abc.ics")]
    [InlineData("https://www.airbnb.com/calendar/ical/123.ics/extra")]
    [InlineData("https://www.airbnb.com/calendar/ical/%31%32%33.ics")]
    [InlineData("https://www.airbnb.com/calendar/ical/123.ics?s=%2f")]
    [InlineData("https://www.airbnb.com/calendar/ical/123.ics?x=1%0d%0aHost:evil")]
    [InlineData("https://www.airbnb.com./calendar/ical/123.ics")]
    [InlineData("https://127.0.0.1/calendar/ical/123.ics")]
    [InlineData("HTTPS://www.airbnb.com/calendar/ical/123.ics")]
    public async Task RejectsMalformedUrlsBeforeDns(string url)
    {
        var handler = new FakeHandler(_ => throw new Exception("Unexpected HTTP"));
        using var fetcher = Create(handler, lookup: () => throw new Exception("Unexpected DNS"));
        await Assert.ThrowsAsync<ArgumentException>(() => fetcher.FetchAsync(url));
        Assert.Equal(0, handler.Calls);
    }

    [Theory]
    [InlineData("127.0.0.1")]
    [InlineData("10.0.0.1")]
    [InlineData("172.16.0.1")]
    [InlineData("192.168.0.1")]
    [InlineData("169.254.169.254")]
    [InlineData("100.100.100.200")]
    [InlineData("0.0.0.0")]
    [InlineData("224.0.0.1")]
    [InlineData("198.51.100.1")]
    [InlineData("::1")]
    [InlineData("::")]
    [InlineData("ff02::1")]
    [InlineData("fe80::1")]
    [InlineData("fc00::1")]
    [InlineData("fd00::1")]
    [InlineData("fec0::1")]
    [InlineData("2001:db8::1")]
    [InlineData("2001:20::1")]
    [InlineData("2001::1")]
    [InlineData("2001:4::1")]
    [InlineData("2001:ff::1")]
    [InlineData("2001:100::1")]
    [InlineData("2001:1ff::1")]
    [InlineData("2002::1")]
    [InlineData("3fff::1")]
    [InlineData("::ffff:169.254.169.254")]
    [InlineData("::ffff:10.0.0.1")]
    public async Task RejectsAnyNonPublicDnsAnswer(string forbidden)
    {
        var handler = new FakeHandler(_ => throw new Exception("Unexpected HTTP"));
        using var fetcher = Create(handler, [Public, IPAddress.Parse(forbidden)]);
        await Assert.ThrowsAsync<HttpRequestException>(() => fetcher.FetchAsync(Url));
        Assert.Equal(0, handler.Calls);
    }

    [Theory]
    [InlineData("2001:200::1")]
    [InlineData("2003::1")]
    [InlineData("2606:4700:4700::1111")]
    [InlineData("2a00::1")]
    [InlineData("::ffff:8.8.8.8")]
    public async Task AcceptsPublicDnsAnswer(string address)
    {
        var handler = new FakeHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
            { Content = new ByteArrayContent([1, 2, 3]) });
        using var fetcher = Create(handler, [IPAddress.Parse(address)]);
        Assert.Equal(new byte[] { 1, 2, 3 }, await fetcher.FetchAsync(Url));
        Assert.Equal(1, handler.Calls);
    }

    [Fact]
    public async Task RejectsEmptyDnsAnswers()
    {
        var handler = new FakeHandler(_ => throw new Exception("Unexpected HTTP"));
        using var fetcher = Create(handler, []);
        await Assert.ThrowsAsync<HttpRequestException>(() => fetcher.FetchAsync(Url));
    }

    [Fact]
    public async Task FetchesBytesUsingExactValidatedUrl()
    {
        var data = Encoding.UTF8.GetBytes("BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n");
        var handler = new FakeHandler(request =>
        {
            Assert.Equal(HttpMethod.Get, request.Method);
            Assert.Equal(Url, request.RequestUri!.AbsoluteUri);
            Assert.Equal("identity", request.Headers.AcceptEncoding.Single().Value);
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new ByteArrayContent(data) };
        });
        using var fetcher = Create(handler);
        Assert.Equal(data, await fetcher.FetchAsync(Url));
        Assert.Equal(1, handler.Calls);
    }

    [Fact]
    public async Task TransportPinsVettedDnsAddressAndDisablesProxyRedirectsAndDecompression()
    {
        var calls = 0;
        var handler = new FakeHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
            { Content = new ByteArrayContent([1, 2, 3]) });
        using var fetcher = new AirbnbIcalFetcher(
            (_, _) => Task.FromResult(new[] { Public, IPAddress.Parse("2606:4700:4700::1111") }),
            (ip, port, _) =>
            {
                Assert.Equal(Public, ip);
                Assert.Equal(443, port);
                calls++;
                return ValueTask.FromResult<Stream>(new MemoryStream());
            },
            transport =>
            {
                var sockets = Assert.IsType<SocketsHttpHandler>(transport);
                Assert.False(sockets.UseProxy);
                Assert.False(sockets.AllowAutoRedirect);
                Assert.Equal(DecompressionMethods.None, sockets.AutomaticDecompression);
                using var stream = sockets.ConnectCallback!(null!, CancellationToken.None).GetAwaiter().GetResult();
                return handler;
            });
        Assert.Equal(new byte[] { 1, 2, 3 }, await fetcher.FetchAsync(Url));
        Assert.Equal(1, calls);
    }

    [Theory]
    [InlineData(HttpStatusCode.Found)]
    [InlineData(HttpStatusCode.MovedPermanently)]
    [InlineData(HttpStatusCode.TemporaryRedirect)]
    [InlineData(HttpStatusCode.PermanentRedirect)]
    public async Task RejectsRedirectWithoutSecondRequest(HttpStatusCode status)
    {
        var handler = new FakeHandler(_ => new HttpResponseMessage(status) { Headers = { Location = new Uri("http://169.254.169.254/latest/meta-data/") } });
        using var fetcher = Create(handler);
        await Assert.ThrowsAsync<HttpRequestException>(() => fetcher.FetchAsync(Url));
        Assert.Equal(1, handler.Calls);
    }

    [Fact]
    public async Task RejectsDeclaredAndStreamedOversizeAndCompressedResponses()
    {
        foreach (var mode in new[] { "declared", "streamed", "compressed" })
        {
            var handler = new FakeHandler(_ =>
            {
                var content = new ByteArrayContent(new byte[mode == "streamed" ? 1024 * 1024 + 1 : 1]);
                if (mode == "declared") content.Headers.ContentLength = 1024 * 1024 + 1;
                if (mode == "compressed") content.Headers.ContentEncoding.Add("gzip");
                return new HttpResponseMessage(HttpStatusCode.OK) { Content = content };
            });
            using var fetcher = Create(handler);
            await Assert.ThrowsAsync<HttpRequestException>(() => fetcher.FetchAsync(Url));
        }
    }
}
