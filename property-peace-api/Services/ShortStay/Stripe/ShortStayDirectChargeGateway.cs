using System.Text.RegularExpressions;
using Microsoft.Extensions.Configuration;
using Stripe;

namespace brownstone_hub_api.Services.ShortStayStripe;

public enum StripeGatewayMode { Test, Live }

// This is a provider-only boundary. A future authenticated reservation service must derive the
// account, quote and operation key from the persisted reservation; never bind these from a guest DTO.
public interface IShortStayDirectChargeGateway
{
    Task<ShortStayIntent> CreatePaymentIntentAsync(string accountId, long totalCents, string currency,
        string reservationCode, string idempotencyKey, CancellationToken cancellationToken = default);
    Task<ShortStayIntent> RetrieveAsync(string accountId, string paymentIntentId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ShortStayIntent>> SearchByReservationCodeAsync(string accountId, string reservationCode,
        CancellationToken cancellationToken = default) => throw new NotSupportedException();
    // Guest-only recovery. Never use from webhooks, refunds or background reconciliation.
    Task<ShortStayIntent> RetrieveForGuestPaymentAsync(string accountId, string paymentIntentId,
        long amountCents, string currency, string reservationCode, CancellationToken cancellationToken = default)
        => throw new NotSupportedException();
    Task<ShortStayIntent> CancelAsync(string accountId, string paymentIntentId, string idempotencyKey,
        CancellationToken cancellationToken = default);
    Task<ShortStayRefund> RefundAsync(string accountId, string paymentIntentId, long amountCents,
        string idempotencyKey, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ShortStayRefund>> ListRefundsAsync(string accountId, string paymentIntentId,
        CancellationToken cancellationToken = default) => throw new NotSupportedException();
}

// ClientSecret is populated only on create or the separately scoped guest-recovery call;
// generic retrieval/cancelation and webhook/reconciliation snapshots always redact it.
public sealed record ShortStayIntent(string PaymentIntentId, string? ClientSecret, long AmountCents,
    string Currency, string Status, string AccountId, string? ReservationCode = null);
public sealed record ShortStayRefund(string RefundId, string Status, long AmountCents, string AccountId,
    string? PaymentIntentId = null);

public sealed class ShortStayDirectChargeGateway : IShortStayDirectChargeGateway
{
    private static readonly Regex AccountPattern = new(@"\Aacct_[A-Za-z0-9]{16,}\z", RegexOptions.CultureInvariant);
    private static readonly Regex IntentPattern = new(@"\Api_[A-Za-z0-9]{16,}\z", RegexOptions.CultureInvariant);
    private static readonly Regex CodePattern = new(@"\A[A-Z0-9]{4,64}\z", RegexOptions.CultureInvariant);
    private static readonly Regex KeyPattern = new(@"\Ashortstay:[A-Za-z0-9:_-]{1,244}\z", RegexOptions.CultureInvariant);
    private readonly IStripeClient _client;

    // Explicit mode is mandatory: an acct_ identifier does not encode test/live mode. The
    // reservation service must independently verify account provenance in the matching mode.
    public ShortStayDirectChargeGateway(IStripeClient client, StripeGatewayMode mode)
    {
        _client = client ?? throw new ArgumentNullException(nameof(client));
        if (!Enum.IsDefined(mode)) throw new ArgumentOutOfRangeException(nameof(mode));
        var prefix = mode == StripeGatewayMode.Test ? "sk_test_" : "sk_live_";
        if (string.IsNullOrWhiteSpace(client.ApiKey) || !client.ApiKey.StartsWith(prefix, StringComparison.Ordinal))
            throw new InvalidOperationException("Stripe credential mode does not match the short-stay gateway mode.");
    }

    // Optional explicit factory for a future composition root; no global StripeConfiguration mutation.
    public static ShortStayDirectChargeGateway FromConfiguration(IConfiguration configuration, StripeGatewayMode mode)
    {
        ArgumentNullException.ThrowIfNull(configuration);
        var secret = configuration["Stripe:SecretKey"];
        if (string.IsNullOrWhiteSpace(secret)) throw new InvalidOperationException("Stripe credential unavailable.");
        return new ShortStayDirectChargeGateway(new StripeClient(secret), mode);
    }

    public async Task<ShortStayIntent> CreatePaymentIntentAsync(string accountId, long totalCents,
        string currency, string reservationCode, string idempotencyKey, CancellationToken cancellationToken = default)
    {
        ValidateAccount(accountId);
        ValidateAmount(totalCents);
        if (currency != "usd") throw new ArgumentException("Only USD is supported.", nameof(currency));
        if (reservationCode is null || !CodePattern.IsMatch(reservationCode))
            throw new ArgumentException("Invalid public reservation code.", nameof(reservationCode));
        ValidateKey(idempotencyKey);
        var intent = await new PaymentIntentService(_client).CreateAsync(new PaymentIntentCreateOptions
        {
            Amount = totalCents,
            Currency = "usd",
            PaymentMethodTypes = new List<string> { "card" },
            Metadata = new Dictionary<string, string> { ["reservation_code"] = reservationCode, ["version"] = "1" }
            // Direct charge: no transfer_data, transfer_group, application fee, customer or guest PII.
        }, new RequestOptions { StripeAccount = accountId, IdempotencyKey = idempotencyKey }, cancellationToken);
        if (string.IsNullOrWhiteSpace(intent.Id) || string.IsNullOrWhiteSpace(intent.ClientSecret) ||
            intent.Amount != totalCents || intent.Currency != "usd")
            throw new InvalidOperationException("Stripe intent response did not match the requested charge.");
        return Snapshot(intent, accountId, includeClientSecret: true);
    }

    public async Task<ShortStayIntent> RetrieveAsync(string accountId, string paymentIntentId, CancellationToken cancellationToken = default)
    {
        ValidateAccount(accountId);
        ValidateIntent(paymentIntentId);
        var intent = await new PaymentIntentService(_client).GetAsync(paymentIntentId,
            requestOptions: new RequestOptions { StripeAccount = accountId }, cancellationToken: cancellationToken);
        if (intent.Id != paymentIntentId) throw new InvalidOperationException("Stripe returned a different intent.");
        return Snapshot(intent, accountId);
    }

    // Stripe Search is eventually consistent: zero results never authorize release.
    public async Task<IReadOnlyList<ShortStayIntent>> SearchByReservationCodeAsync(string accountId,
        string reservationCode, CancellationToken cancellationToken = default)
    {
        ValidateAccount(accountId);
        if (reservationCode is null || !CodePattern.IsMatch(reservationCode))
            throw new ArgumentException("Invalid public reservation code.", nameof(reservationCode));
        var result = await new PaymentIntentService(_client).SearchAsync(new PaymentIntentSearchOptions
        {
            Query = $"metadata['reservation_code']:'{reservationCode}'", Limit = 2
        }, new RequestOptions { StripeAccount = accountId }, cancellationToken);
        if (result.HasMore || result.Data is null || result.Data.Count > 2)
            throw new InvalidOperationException("PaymentIntent search inventory incomplete or ambiguous.");
        return result.Data.Select(i => Snapshot(i, accountId)).ToArray();
    }

    public async Task<ShortStayIntent> RetrieveForGuestPaymentAsync(string accountId, string paymentIntentId,
        long amountCents, string currency, string reservationCode, CancellationToken cancellationToken = default)
    {
        ValidateAccount(accountId);
        ValidateIntent(paymentIntentId);
        ValidateAmount(amountCents);
        if (currency != "usd" || reservationCode is null || !CodePattern.IsMatch(reservationCode))
            throw new ArgumentException("Invalid guest payment scope.");
        var intent = await new PaymentIntentService(_client).GetAsync(paymentIntentId,
            requestOptions: new RequestOptions { StripeAccount = accountId }, cancellationToken: cancellationToken);
        if (intent.Id != paymentIntentId || intent.Amount != amountCents || intent.Currency != currency ||
            intent.Status != "requires_payment_method" || intent.Metadata?.GetValueOrDefault("reservation_code") != reservationCode ||
            intent.Metadata?.GetValueOrDefault("version") != "1" || string.IsNullOrWhiteSpace(intent.ClientSecret))
            throw new InvalidOperationException("Guest payment intent does not match its reservation.");
        return Snapshot(intent, accountId, includeClientSecret: true);
    }

    public async Task<ShortStayIntent> CancelAsync(string accountId, string paymentIntentId,
        string idempotencyKey, CancellationToken cancellationToken = default)
    {
        ValidateAccount(accountId);
        ValidateIntent(paymentIntentId);
        ValidateKey(idempotencyKey);
        var intent = await new PaymentIntentService(_client).CancelAsync(paymentIntentId,
            requestOptions: new RequestOptions { StripeAccount = accountId, IdempotencyKey = idempotencyKey },
            cancellationToken: cancellationToken);
        if (intent.Id != paymentIntentId) throw new InvalidOperationException("Stripe returned a different intent.");
        return Snapshot(intent, accountId);
    }

    public async Task<ShortStayRefund> RefundAsync(string accountId, string paymentIntentId, long amountCents,
        string idempotencyKey, CancellationToken cancellationToken = default)
    {
        ValidateAccount(accountId);
        ValidateIntent(paymentIntentId);
        ValidateAmount(amountCents);
        ValidateKey(idempotencyKey);
        var refund = await new RefundService(_client).CreateAsync(new RefundCreateOptions
        {
            PaymentIntent = paymentIntentId,
            Amount = amountCents
        }, new RequestOptions { StripeAccount = accountId, IdempotencyKey = idempotencyKey }, cancellationToken);
        if (string.IsNullOrWhiteSpace(refund.Id) || refund.Amount != amountCents)
            throw new InvalidOperationException("Stripe refund response did not match the request.");
        return new ShortStayRefund(refund.Id, refund.Status, refund.Amount, accountId);
    }

    public async Task<IReadOnlyList<ShortStayRefund>> ListRefundsAsync(string accountId, string paymentIntentId,
        CancellationToken cancellationToken = default)
    {
        ValidateAccount(accountId);
        ValidateIntent(paymentIntentId);
        var result = new List<ShortStayRefund>();
        await foreach (var refund in new RefundService(_client).ListAutoPagingAsync(
            new RefundListOptions { PaymentIntent = paymentIntentId, Limit = 100 },
            new RequestOptions { StripeAccount = accountId }, cancellationToken))
        {
            if (result.Count >= 100 || refund.PaymentIntentId != paymentIntentId || string.IsNullOrWhiteSpace(refund.Id))
                throw new InvalidOperationException("Refund inventory incomplete or inconsistent.");
            result.Add(new ShortStayRefund(refund.Id, refund.Status, refund.Amount, accountId, refund.PaymentIntentId));
        }
        return result;
    }

    private static ShortStayIntent Snapshot(PaymentIntent intent, string accountId, bool includeClientSecret = false)
    {
        if (string.IsNullOrWhiteSpace(intent.Id) || string.IsNullOrWhiteSpace(intent.Status))
            throw new InvalidOperationException("Incomplete Stripe intent response.");
        return new ShortStayIntent(intent.Id, includeClientSecret ? intent.ClientSecret : null,
            intent.Amount, intent.Currency, intent.Status, accountId,
            intent.Metadata?.GetValueOrDefault("reservation_code"));
    }

    private static void ValidateAccount(string value)
    {
        if (value is null || !AccountPattern.IsMatch(value)) throw new ArgumentException("Invalid connected account ID.", nameof(value));
    }
    private static void ValidateIntent(string value)
    {
        if (value is null || !IntentPattern.IsMatch(value)) throw new ArgumentException("Invalid PaymentIntent ID.", nameof(value));
    }
    private static void ValidateKey(string value)
    {
        if (value is null || value.Length > 255 || !KeyPattern.IsMatch(value))
            throw new ArgumentException("Invalid deterministic idempotency key.", nameof(value));
    }
    private static void ValidateAmount(long value)
    {
        if (value is < 50 or > 200_000) throw new ArgumentOutOfRangeException(nameof(value), "USD cents outside product limits.");
    }
}
