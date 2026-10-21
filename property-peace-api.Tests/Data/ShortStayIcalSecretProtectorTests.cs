using System.Security.Cryptography;
using brownstone_hub_api.Security;
using Xunit;

namespace brownstone_hub_api.Tests.ShortStay;

public sealed class ShortStayIcalSecretProtectorTests
{
    private static readonly string Secret = Convert.ToBase64String(Enumerable.Range(1, 32).Select(x => (byte)x).ToArray());

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("not-base64")]
    [InlineData("AQIDBA==")]
    public void Requires_explicit_32_byte_base64_secret(string? secret) =>
        Assert.Throws<InvalidOperationException>(() => new ShortStayIcalSecretProtector(secret));

    [Fact]
    public void Url_round_trips_with_random_nonce_and_authenticated_ciphertext()
    {
        var crypto = new ShortStayIcalSecretProtector(Secret);
        const string url = "https://example.test/feed?token=private";
        var first = crypto.EncryptUrl(url);
        var second = crypto.EncryptUrl(url);
        Assert.NotEqual(first, second);
        Assert.DoesNotContain("private", first);
        Assert.Equal(url, crypto.DecryptUrl(first));
        Assert.Equal(url, crypto.DecryptUrl(second));
        var bytes = Convert.FromBase64String(first);
        bytes[^1] ^= 0x01;
        Assert.Throws<CryptographicException>(() => crypto.DecryptUrl(Convert.ToBase64String(bytes)));
        Assert.Throws<CryptographicException>(() => crypto.DecryptUrl("garbage"));
        Assert.Throws<CryptographicException>(() => crypto.DecryptUrl(Convert.ToBase64String(new byte[] { 2, 3, 4 })));
        var other = new ShortStayIcalSecretProtector(Convert.ToBase64String(Enumerable.Repeat((byte)123, 32).ToArray()));
        Assert.Throws<CryptographicException>(() => other.DecryptUrl(first));
    }

    [Fact]
    public void Fingerprints_are_keyed_deterministic_and_domain_separated()
    {
        var first = new ShortStayIcalSecretProtector(Secret);
        var second = new ShortStayIcalSecretProtector(Secret);
        var other = new ShortStayIcalSecretProtector(Convert.ToBase64String(Enumerable.Repeat((byte)123, 32).ToArray()));
        const string url = "https://example.test/feed?token=private";
        Assert.Equal(first.FingerprintUrl(url), second.FingerprintUrl(url));
        Assert.NotEqual(first.FingerprintUrl(url), other.FingerprintUrl(url));
        Assert.NotEqual(first.FingerprintUrl(url), first.FingerprintEventIdentity(url, ""));
        Assert.NotEqual(first.FingerprintEventIdentity("ab", "c"), first.FingerprintEventIdentity("a", "bc"));
        Assert.DoesNotContain("private", first.FingerprintUrl(url));
    }
}
