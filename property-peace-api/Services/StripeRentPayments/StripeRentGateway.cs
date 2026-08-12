using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Stripe;

namespace brownstone_hub_api.Services.StripeRentPayments
{
    public sealed record StripeRentIntentRequest(
        long AmountCents,
        string Currency,
        string Description,
        string TransferGroup,
        string IdempotencyKey,
        IReadOnlyDictionary<string, string> Metadata);

    public sealed record StripeRentIntentResult(string PaymentIntentId, string ClientSecret);

    public sealed record StripeRentPaymentIntentState(bool Exists, string? Status);

    public sealed record StripeRentTransferRequest(
        long AmountCents,
        string Currency,
        string DestinationStripeAccountId,
        string SourceTransaction,
        string TransferGroup,
        string IdempotencyKey,
        IReadOnlyDictionary<string, string> Metadata);

    public sealed record StripeRentSourceState(bool Exists, bool Paid, bool Refunded, bool Disputed,
        string? FailureReason, string? PaymentIntentId, long? AmountCents, string? Currency,
        long? RefundedAmountCents = null);

    public sealed class StripeRentTransferDefinitiveException(string code, string message, Exception? innerException = null)
        : Exception(message, innerException)
    {
        public string Code { get; } = code;
    }

    public sealed class StripeRentTransferOperatorReviewException(string code, string message, Exception? innerException = null)
        : Exception(message, innerException)
    {
        public string Code { get; } = code;
    }

    public interface IStripeRentGateway
    {
        Task<StripeRentIntentResult> CreatePaymentIntentAsync(StripeRentIntentRequest request, CancellationToken cancellationToken = default);
        Task<StripeRentIntentResult> UpdatePaymentIntentAsync(string paymentIntentId, StripeRentIntentRequest request, CancellationToken cancellationToken = default);
        Task<string?> GetPaymentMethodTypeAsync(string paymentIntentId, CancellationToken cancellationToken = default);
        Task<StripeRentPaymentIntentState> GetPaymentIntentStateAsync(string paymentIntentId, CancellationToken cancellationToken = default);
        Task<StripeRentSourceState> GetSourceStateAsync(string chargeId, CancellationToken cancellationToken = default);
        Task<string> CreateTransferAsync(StripeRentTransferRequest request, CancellationToken cancellationToken = default);
        Task<string> CreateTransferReversalAsync(string transferId, long amountCents, string idempotencyKey, CancellationToken cancellationToken = default);
    }

    internal static class StripeRentPaymentMethodPolicy
    {
        public static IReadOnlyList<string> SupportedTypes { get; } = new[] { "card", "us_bank_account" };
    }

    public sealed class StripeRentGateway : IStripeRentGateway
    {
        private readonly IStripeClient _stripeClient;

        [ActivatorUtilitiesConstructor]
        public StripeRentGateway(IConfiguration configuration)
            : this(BuildStripeClient(configuration))
        {
        }

        public StripeRentGateway(IStripeClient stripeClient)
        {
            ArgumentNullException.ThrowIfNull(stripeClient);
            _stripeClient = stripeClient;
        }

        private static IStripeClient BuildStripeClient(IConfiguration configuration)
        {
            ArgumentNullException.ThrowIfNull(configuration);
            var apiKey = configuration["Stripe:SecretKey"];
            if (string.IsNullOrWhiteSpace(apiKey))
                throw new InvalidOperationException("Stripe:SecretKey is not configured.");
            return new StripeClient(apiKey);
        }

        public async Task<StripeRentIntentResult> CreatePaymentIntentAsync(StripeRentIntentRequest request, CancellationToken cancellationToken = default)
        {
            var intent = await new PaymentIntentService(_stripeClient).CreateAsync(BuildPaymentIntentCreateOptions(request),
                new RequestOptions { IdempotencyKey = request.IdempotencyKey }, cancellationToken);
            return new StripeRentIntentResult(intent.Id, intent.ClientSecret);
        }

        private static PaymentIntentCreateOptions BuildPaymentIntentCreateOptions(StripeRentIntentRequest request) => new()
        {
            Amount = request.AmountCents,
            Currency = request.Currency,
            Description = request.Description,
            PaymentMethodTypes = new List<string>(StripeRentPaymentMethodPolicy.SupportedTypes),
            TransferGroup = request.TransferGroup,
            Metadata = new Dictionary<string, string>(request.Metadata)
            // Intentionally no TransferData or ApplicationFeeAmount. Rent is charged on the platform.
        };

        public async Task<StripeRentIntentResult> UpdatePaymentIntentAsync(string paymentIntentId, StripeRentIntentRequest request, CancellationToken cancellationToken = default)
        {
            var intent = await new PaymentIntentService(_stripeClient).UpdateAsync(paymentIntentId, new PaymentIntentUpdateOptions
            {
                Amount = request.AmountCents,
                Description = request.Description,
                Metadata = new Dictionary<string, string>(request.Metadata)
            }, new RequestOptions { IdempotencyKey = $"{request.IdempotencyKey}:update:{request.AmountCents}" }, cancellationToken);
            return new StripeRentIntentResult(intent.Id, intent.ClientSecret);
        }

        public async Task<string?> GetPaymentMethodTypeAsync(string paymentIntentId, CancellationToken cancellationToken = default)
        {
            var intent = await new PaymentIntentService(_stripeClient).GetAsync(paymentIntentId,
                new PaymentIntentGetOptions { Expand = new List<string> { "latest_charge" } }, cancellationToken: cancellationToken);
            return intent.LatestCharge?.PaymentMethodDetails?.Type;
        }

        public async Task<StripeRentPaymentIntentState> GetPaymentIntentStateAsync(string paymentIntentId,
            CancellationToken cancellationToken = default)
        {
            try
            {
                var intent = await new PaymentIntentService(_stripeClient).GetAsync(paymentIntentId,
                    cancellationToken: cancellationToken);
                return new StripeRentPaymentIntentState(true, intent.Status);
            }
            catch (StripeException ex) when (ex.StripeError?.Code == "resource_missing")
            {
                return new StripeRentPaymentIntentState(false, null);
            }
        }

        public async Task<StripeRentSourceState> GetSourceStateAsync(string chargeId, CancellationToken cancellationToken = default)
        {
            try
            {
                var charge = await new ChargeService(_stripeClient).GetAsync(chargeId, cancellationToken: cancellationToken);
                return new StripeRentSourceState(true, charge.Paid, charge.Refunded, charge.Disputed,
                    charge.FailureMessage, charge.PaymentIntentId, charge.Amount, charge.Currency,
                    charge.AmountRefunded);
            }
            catch (StripeException ex) when (ex.StripeError?.Code == "resource_missing")
            {
                return new StripeRentSourceState(false, false, false, false,
                    "Stripe source charge was not found.", null, null, null);
            }
        }

        public async Task<string> CreateTransferAsync(StripeRentTransferRequest request, CancellationToken cancellationToken = default)
        {
            try
            {
                var transfer = await new TransferService(_stripeClient).CreateAsync(BuildTransferCreateOptions(request),
                    new RequestOptions { IdempotencyKey = request.IdempotencyKey }, cancellationToken);
                return transfer.Id;
            }
            catch (StripeException ex) when (RequiresTransferOperatorReview(ex.StripeError))
            {
                // A parameter mismatch proves only that this replay was rejected; the original request
                // under the key may still have succeeded. Never rotate automatically or risk a duplicate.
                var code = ex.StripeError?.Code ?? ex.StripeError?.Type ?? "idempotency_reconciliation_required";
                throw new StripeRentTransferOperatorReviewException(code, ex.Message, ex);
            }
            catch (StripeException ex) when (IsDefinitiveTransferFailure(ex.StripeError))
            {
                // Stripe definitively rejected this request and cached the no-transfer response.
                var code = ex.StripeError?.Code ?? "definitive_transfer_rejection";
                throw new StripeRentTransferDefinitiveException(code, ex.Message, ex);
            }
        }

        internal static bool IsDefinitiveTransferFailure(StripeError? error) =>
            string.Equals(error?.Code, "balance_insufficient", StringComparison.Ordinal);

        internal static bool RequiresTransferOperatorReview(StripeError? error) =>
            !string.Equals(error?.Code, "idempotency_key_in_use", StringComparison.Ordinal)
            && string.Equals(error?.Type, "idempotency_error", StringComparison.Ordinal);

        private static TransferCreateOptions BuildTransferCreateOptions(StripeRentTransferRequest request) => new()
        {
            Amount = request.AmountCents,
            Currency = request.Currency,
            Destination = request.DestinationStripeAccountId,
            SourceTransaction = request.SourceTransaction,
            // Stripe inherits the source charge's transfer group. Sending it again is rejected.
            Metadata = new Dictionary<string, string>(request.Metadata)
        };

        public async Task<string> CreateTransferReversalAsync(string transferId, long amountCents, string idempotencyKey, CancellationToken cancellationToken = default)
        {
            if (amountCents <= 0) throw new ArgumentOutOfRangeException(nameof(amountCents));
            var reversal = await new TransferReversalService(_stripeClient).CreateAsync(transferId,
                new TransferReversalCreateOptions { Amount = amountCents }, new RequestOptions { IdempotencyKey = idempotencyKey }, cancellationToken);
            return reversal.Id;
        }
    }
}
