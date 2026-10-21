using System.Net;
using System.Net.Http.Headers;
using System.Net.Sockets;
using System.Runtime.CompilerServices;
using System.Text.RegularExpressions;

[assembly: InternalsVisibleTo("property-peace-api.Tests")]

namespace brownstone_hub_api.Services.ShortStay.Ical;

public interface IAirbnbIcalFetcher
{
    Task<byte[]> FetchAsync(string url, CancellationToken cancellationToken = default);
}

/// <summary>Read-only, bounded fetch of an exact Airbnb calendar URL. Never use for arbitrary URLs.</summary>
public sealed class AirbnbIcalFetcher : IAirbnbIcalFetcher, IDisposable
{
    private const int MaxBytes = 1024 * 1024;
    private static readonly Regex AllowedUrl = new(@"\Ahttps://www\.airbnb\.com/calendar/ical/[0-9]+\.ics(?:\?[A-Za-z0-9_=&-]*)?\z",
        RegexOptions.CultureInvariant | RegexOptions.Compiled, TimeSpan.FromMilliseconds(100));
    private readonly Func<string, CancellationToken, Task<IPAddress[]>> _resolve;
    private readonly Func<IPAddress, int, CancellationToken, ValueTask<Stream>> _connect;
    private readonly Func<HttpMessageHandler, HttpMessageHandler> _handler;
    private readonly SemaphoreSlim _slots = new(4, 4);

    public AirbnbIcalFetcher() : this((host, ct) => Dns.GetHostAddressesAsync(host, ct), ConnectSocketAsync, handler => handler) { }

    // Test seam is internal: production callers cannot replace the DNS, socket, or HTTP security boundary.
    internal AirbnbIcalFetcher(Func<string, CancellationToken, Task<IPAddress[]>> resolve,
        Func<IPAddress, int, CancellationToken, ValueTask<Stream>> connect,
        Func<HttpMessageHandler, HttpMessageHandler> handler)
    {
        _resolve = resolve ?? throw new ArgumentNullException(nameof(resolve));
        _connect = connect ?? throw new ArgumentNullException(nameof(connect));
        _handler = handler ?? throw new ArgumentNullException(nameof(handler));
    }

    // Check original bytes before Uri canonicalization (userinfo, percent escapes, ports, and fragments are forbidden).
    public static bool IsValidUrl(string? url) => url is not null && url.Length <= 2048 && AllowedUrl.IsMatch(url);

    public async Task<byte[]> FetchAsync(string url, CancellationToken cancellationToken = default)
    {
        if (!IsValidUrl(url))
            throw new ArgumentException("Invalid Airbnb calendar URL.", nameof(url));

        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        deadline.CancelAfter(TimeSpan.FromSeconds(10));
        var ct = deadline.Token;
        await _slots.WaitAsync(ct).ConfigureAwait(false);
        try
        {
            IPAddress[] answers;
            try { answers = await _resolve("www.airbnb.com", ct).ConfigureAwait(false); }
            catch (OperationCanceledException) { throw; }
            catch (Exception) { throw new HttpRequestException("Calendar DNS lookup failed."); }
            if (answers is null || answers.Length == 0 || answers.Any(ip => !IsPublic(ip)))
                throw new HttpRequestException("Calendar DNS lookup returned an unsafe address.");

            // The only socket destination is one address from this already-vetted DNS snapshot; never
            // let HttpClient perform another resolution. Request URI retains hostname for TLS SNI/cert checks.
            var pinned = answers[0];
            using var sockets = new SocketsHttpHandler
            {
                UseProxy = false,
                AllowAutoRedirect = false,
                AutomaticDecompression = DecompressionMethods.None,
                ConnectTimeout = TimeSpan.FromSeconds(5),
                ConnectCallback = async (_, token) => await _connect(pinned, 443, token).ConfigureAwait(false)
            };
            using var client = new HttpClient(_handler(sockets), disposeHandler: true) { Timeout = Timeout.InfiniteTimeSpan };
            using var request = new HttpRequestMessage(HttpMethod.Get, new Uri(url, UriKind.Absolute));
            request.Headers.AcceptEncoding.Add(new StringWithQualityHeaderValue("identity"));
            try
            {
                using var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct).ConfigureAwait(false);
                if ((int)response.StatusCode is >= 300 and < 400)
                    throw new HttpRequestException("Calendar redirects are forbidden.");
                if (!response.IsSuccessStatusCode)
                    throw new HttpRequestException("Calendar request failed.");
                if (response.Content is null || response.Content.Headers.ContentEncoding.Count != 0 ||
                    response.Content.Headers.ContentLength > MaxBytes)
                    throw new HttpRequestException("Calendar response is unsupported or too large.");

                await using var input = await response.Content.ReadAsStreamAsync(ct).ConfigureAwait(false);
                using var output = new MemoryStream();
                var buffer = new byte[8192];
                int n;
                while ((n = await input.ReadAsync(buffer, ct).ConfigureAwait(false)) != 0)
                {
                    if (output.Length + n > MaxBytes) throw new HttpRequestException("Calendar response is too large.");
                    output.Write(buffer, 0, n);
                }
                return output.ToArray();
            }
            catch (HttpRequestException) { throw new HttpRequestException("Calendar fetch rejected or failed."); }
            catch (IOException) { throw new HttpRequestException("Calendar fetch failed."); }
        }
        finally { _slots.Release(); }
    }

    private static async ValueTask<Stream> ConnectSocketAsync(IPAddress ip, int port, CancellationToken ct)
    {
        var socket = new Socket(ip.AddressFamily, SocketType.Stream, ProtocolType.Tcp);
        try
        {
            await socket.ConnectAsync(ip, port, ct).ConfigureAwait(false);
            return new NetworkStream(socket, ownsSocket: true);
        }
        catch { socket.Dispose(); throw; }
    }

    private static bool IsPublic(IPAddress ip)
    {
        if (ip.IsIPv4MappedToIPv6) ip = ip.MapToIPv4();
        var b = ip.GetAddressBytes();
        if (ip.AddressFamily == AddressFamily.InterNetwork)
        {
            // Reject non-global, shared, link-local, documentation, benchmarking, multicast and future-use space.
            return b[0] != 0 && b[0] != 10 && b[0] != 127 && b[0] < 224 &&
                !(b[0] == 100 && b[1] is >= 64 and <= 127) &&
                !(b[0] == 169 && b[1] == 254) &&
                !(b[0] == 172 && b[1] is >= 16 and <= 31) &&
                !(b[0] == 192 && (b[1] == 168 || b[1] == 0 || (b[1] == 88 && b[2] == 99) || (b[1] == 0 && b[2] == 2))) &&
                !(b[0] == 198 && (b[1] is 18 or 19 || b[1] == 51 && b[2] == 100)) &&
                !(b[0] == 203 && b[1] == 0 && b[2] == 113);
        }
        // Only global-unicast IPv6, excluding the entire IETF special-purpose 2001::/23
        // (including reserved ranges), 6to4, and documentation allocations.
        return ip.AddressFamily == AddressFamily.InterNetworkV6 && (b[0] & 0xe0) == 0x20 &&
            !(b[0] == 0x20 && b[1] == 0x01 && (b[2] <= 0x01 || b[2] == 0x0d && b[3] == 0xb8)) &&
            !(b[0] == 0x20 && b[1] == 0x02) && !(b[0] == 0x3f && b[1] == 0xff);
    }

    public void Dispose() => _slots.Dispose();
}
