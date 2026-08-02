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

    public interface IStripeRentGateway
    {
        Task<StripeRentIntentResult> CreatePaymentIntentAsync(StripeRentIntentRequest request, CancellationToken cancellationToken = default);
        Task<StripeRentIntentResult> UpdatePaymentIntentAsync(string paymentIntentId, StripeRentIntentRequest request, CancellationToken cancellationToken = default);
        Task<string?> GetPaymentMethodTypeAsync(string paymentIntentId, CancellationToken cancellationToken = default);
        Task<StripeRentSourceState> GetSourceStateAsync(string chargeId, CancellationToken cancellationToken = default);
        Task<string> CreateTransferAsync(StripeRentTransferRequest request, CancellationToken cancellationToken = default);
        Task<string> CreateTransferReversalAsync(string transferId, long amountCents, string idempotencyKey, CancellationToken cancellationToken = default);
    }

    public sealed class StripeRentGateway : IStripeRentGateway
    {
        public async Task<StripeRentIntentResult> CreatePaymentIntentAsync(StripeRentIntentRequest request, CancellationToken cancellationToken = default)
        {
            var intent = await new PaymentIntentService().CreateAsync(new PaymentIntentCreateOptions
            {
                Amount = request.AmountCents,
                Currency = request.Currency,
                Description = request.Description,
                AutomaticPaymentMethods = new PaymentIntentAutomaticPaymentMethodsOptions { Enabled = true },
                TransferGroup = request.TransferGroup,
                Metadata = new Dictionary<string, string>(request.Metadata)
                // Intentionally no TransferData or ApplicationFeeAmount. Rent is charged on the platform.
            }, new RequestOptions { IdempotencyKey = request.IdempotencyKey }, cancellationToken);
            return new StripeRentIntentResult(intent.Id, intent.ClientSecret);
        }

        public async Task<StripeRentIntentResult> UpdatePaymentIntentAsync(string paymentIntentId, StripeRentIntentRequest request, CancellationToken cancellationToken = default)
        {
            var intent = await new PaymentIntentService().UpdateAsync(paymentIntentId, new PaymentIntentUpdateOptions
            {
                Amount = request.AmountCents,
                Description = request.Description,
                Metadata = new Dictionary<string, string>(request.Metadata)
            }, new RequestOptions { IdempotencyKey = $"{request.IdempotencyKey}:update:{request.AmountCents}" }, cancellationToken);
            return new StripeRentIntentResult(intent.Id, intent.ClientSecret);
        }

        public async Task<string?> GetPaymentMethodTypeAsync(string paymentIntentId, CancellationToken cancellationToken = default)
        {
            var intent = await new PaymentIntentService().GetAsync(paymentIntentId,
                new PaymentIntentGetOptions { Expand = new List<string> { "latest_charge" } }, cancellationToken: cancellationToken);
            return intent.LatestCharge?.PaymentMethodDetails?.Type;
        }

        public async Task<StripeRentSourceState> GetSourceStateAsync(string chargeId, CancellationToken cancellationToken = default)
        {
            try
            {
                var charge = await new ChargeService().GetAsync(chargeId, cancellationToken: cancellationToken);
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
            var transfer = await new TransferService().CreateAsync(new TransferCreateOptions
            {
                Amount = request.AmountCents,
                Currency = request.Currency,
                Destination = request.DestinationStripeAccountId,
                SourceTransaction = request.SourceTransaction,
                TransferGroup = request.TransferGroup,
                Metadata = new Dictionary<string, string>(request.Metadata)
            }, new RequestOptions { IdempotencyKey = request.IdempotencyKey }, cancellationToken);
            return transfer.Id;
        }

        public async Task<string> CreateTransferReversalAsync(string transferId, long amountCents, string idempotencyKey, CancellationToken cancellationToken = default)
        {
            if (amountCents <= 0) throw new ArgumentOutOfRangeException(nameof(amountCents));
            var reversal = await new TransferReversalService().CreateAsync(transferId,
                new TransferReversalCreateOptions { Amount = amountCents }, new RequestOptions { IdempotencyKey = idempotencyKey }, cancellationToken);
            return reversal.Id;
        }
    }
}
