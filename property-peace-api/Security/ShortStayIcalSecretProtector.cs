using System.Buffers.Binary;
using System.Security.Cryptography;
using System.Text;

namespace brownstone_hub_api.Security;

/// <summary>
/// Credential-bearing iCal URLs are encrypted before persistence. Configure an explicit, stable
/// 32-byte random base64 master secret from a secret manager; losing it makes saved feeds unreadable.
/// Do not log the secret, plaintext URLs, or raw event identities. Key rotation requires re-encryption.
/// </summary>
public sealed class ShortStayIcalSecretProtector
{
    private const byte Version = 1;
    private const int NonceSize = 12;
    private const int TagSize = 16;
    private readonly byte[] _encryptionKey;
    private readonly byte[] _urlFingerprintKey;
    private readonly byte[] _eventFingerprintKey;

    public ShortStayIcalSecretProtector(string? base64Secret)
    {
        byte[] master;
        try
        {
            master = Convert.FromBase64String(base64Secret ?? string.Empty);
        }
        catch (FormatException)
        {
            throw new InvalidOperationException("A 32-byte base64 iCal secret must be configured.");
        }
        if (master.Length != 32)
            throw new InvalidOperationException("A 32-byte base64 iCal secret must be configured.");
        try
        {
            // Independent, labelled PRF subkeys prevent the fingerprints from sharing the AEAD key.
            _encryptionKey = Derive(master, "property-peace/ical/url-aes-gcm/v1");
            _urlFingerprintKey = Derive(master, "property-peace/ical/url-hmac/v1");
            _eventFingerprintKey = Derive(master, "property-peace/ical/event-hmac/v1");
        }
        finally
        {
            CryptographicOperations.ZeroMemory(master);
        }
    }

    private static byte[] Derive(byte[] master, string label) =>
        HMACSHA256.HashData(master, Encoding.UTF8.GetBytes(label));

    // Base64 envelope: version (1), random nonce (12), authentication tag (16), ciphertext.
    public string EncryptUrl(string url)
    {
        ArgumentException.ThrowIfNullOrEmpty(url);
        var plaintext = Encoding.UTF8.GetBytes(url);
        try
        {
            var envelope = new byte[1 + NonceSize + TagSize + plaintext.Length];
            envelope[0] = Version;
            var nonce = envelope.AsSpan(1, NonceSize);
            RandomNumberGenerator.Fill(nonce);
            using var aes = new AesGcm(_encryptionKey, TagSize);
            aes.Encrypt(nonce, plaintext, envelope.AsSpan(1 + NonceSize + TagSize),
                envelope.AsSpan(1 + NonceSize, TagSize));
            return Convert.ToBase64String(envelope);
        }
        finally
        {
            CryptographicOperations.ZeroMemory(plaintext);
        }
    }

    public string DecryptUrl(string envelopeBase64)
    {
        byte[] envelope;
        try
        {
            envelope = Convert.FromBase64String(envelopeBase64);
        }
        catch (Exception ex) when (ex is FormatException or ArgumentNullException)
        {
            throw new CryptographicException("Invalid iCal credential envelope.");
        }
        if (envelope.Length <= 1 + NonceSize + TagSize || envelope[0] != Version)
            throw new CryptographicException("Invalid iCal credential envelope.");
        var plaintext = new byte[envelope.Length - 1 - NonceSize - TagSize];
        try
        {
            using var aes = new AesGcm(_encryptionKey, TagSize);
            aes.Decrypt(envelope.AsSpan(1, NonceSize), envelope.AsSpan(1 + NonceSize + TagSize),
                envelope.AsSpan(1 + NonceSize, TagSize), plaintext);
            return Encoding.UTF8.GetString(plaintext);
        }
        catch (CryptographicException)
        {
            throw new CryptographicException("Invalid iCal credential envelope.");
        }
        finally
        {
            CryptographicOperations.ZeroMemory(plaintext);
        }
    }

    public string FingerprintUrl(string url)
    {
        ArgumentException.ThrowIfNullOrEmpty(url);
        return Convert.ToHexString(HMACSHA256.HashData(_urlFingerprintKey, Encoding.UTF8.GetBytes(url)));
    }

    // Persist these keys in UidKey / RecurrenceKey; never persist untrusted raw ICS identifiers.
    public string FingerprintEventIdentity(string uid, string recurrenceId)
    {
        ArgumentException.ThrowIfNullOrEmpty(uid);
        ArgumentNullException.ThrowIfNull(recurrenceId);
        var uidBytes = Encoding.UTF8.GetBytes(uid);
        var recurrenceBytes = Encoding.UTF8.GetBytes(recurrenceId);
        var input = new byte[4 + uidBytes.Length + recurrenceBytes.Length];
        BinaryPrimitives.WriteInt32BigEndian(input, uidBytes.Length);
        uidBytes.CopyTo(input, 4);
        recurrenceBytes.CopyTo(input, 4 + uidBytes.Length);
        return Convert.ToHexString(HMACSHA256.HashData(_eventFingerprintKey, input));
    }
}
