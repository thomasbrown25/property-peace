using Stripe;
using System.Security.Cryptography;
using System.Text;

namespace brownstone_hub_api.Services.StripeRentPayments
{
    public sealed record StripeConnectedAccountSnapshot(
        string StripeAccountId,
        DateTimeOffset RetrievedAt,
        bool DetailsSubmitted,
        bool PayoutsEnabled,
        bool TransfersActive,
        string? TransferCapabilityStatus,
        IReadOnlyCollection<string> CurrentlyDue,
        IReadOnlyCollection<string> PastDue,
        string? DisabledReason,
        string? ExternalAccountFingerprint,
        string? PayoutSchedulePolicy = null,
        bool InstantPayoutMethodsAvailable = false,
        bool ChargesEnabled = false);

    public interface IStripeConnectedAccountGateway
    {
        Task<StripeConnectedAccountSnapshot> GetSnapshotAsync(string stripeAccountId, CancellationToken cancellationToken = default);
    }

    public sealed class StripeConnectedAccountGateway : IStripeConnectedAccountGateway
    {
        private readonly TimeProvider _timeProvider;
        private readonly Stripe.AccountService _accountService;
        private readonly Stripe.AccountExternalAccountService _externalAccountService;

        public StripeConnectedAccountGateway(TimeProvider timeProvider, IStripeClient? stripeClient = null)
        {
            _timeProvider = timeProvider;
            _accountService = stripeClient is null
                ? new Stripe.AccountService()
                : new Stripe.AccountService(stripeClient);
            _externalAccountService = stripeClient is null
                ? new Stripe.AccountExternalAccountService()
                : new Stripe.AccountExternalAccountService(stripeClient);
        }

        public async Task<StripeConnectedAccountSnapshot> GetSnapshotAsync(string stripeAccountId, CancellationToken cancellationToken = default)
        {
            var account = await _accountService.GetAsync(stripeAccountId, null, null, cancellationToken);
            var externalAccounts = new List<IExternalAccount>();

            // Account.external_accounts is only an embedded first page. Read the collection endpoint
            // to ensure changes after that page, including payout debit cards, affect the snapshot.
            await foreach (var externalAccount in _externalAccountService.ListAutoPagingAsync(
                stripeAccountId,
                new AccountExternalAccountListOptions { Limit = 100 },
                null,
                cancellationToken))
            {
                externalAccounts.Add(externalAccount);
            }

            return FromAccount(account, _timeProvider.GetUtcNow(), externalAccounts);
        }

        public static StripeConnectedAccountSnapshot FromAccount(Stripe.Account account, DateTimeOffset retrievedAt)
        {
            ArgumentNullException.ThrowIfNull(account);

            if (account.ExternalAccounts is null)
            {
                throw new InvalidOperationException(
                    "Cannot create a connected-account snapshot without an external-account list.");
            }

            if (account.ExternalAccounts.HasMore)
            {
                throw new InvalidOperationException(
                    "Cannot create a connected-account snapshot from a partial external-account list.");
            }

            return FromAccount(account, retrievedAt, account.ExternalAccounts.Data ?? []);
        }

        public static StripeConnectedAccountSnapshot FromAccount(
            Stripe.Account account,
            DateTimeOffset retrievedAt,
            IReadOnlyCollection<IExternalAccount> externalAccounts)
        {
            ArgumentNullException.ThrowIfNull(account);
            ArgumentNullException.ThrowIfNull(externalAccounts);

            var transferStatus = account.Capabilities?.Transfers;
            var fingerprintMaterial = externalAccounts
                .Select(GetFingerprintMaterial)
                .OrderBy(x => x, StringComparer.Ordinal)
                .ToArray();
            var fingerprint = fingerprintMaterial.Length == 0
                ? null
                : Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(string.Join("\n", fingerprintMaterial))));
            var instantPayoutMethodsAvailable = externalAccounts.Any(HasInstantPayoutMethod);

            return new StripeConnectedAccountSnapshot(
                account.Id,
                retrievedAt,
                account.DetailsSubmitted,
                account.PayoutsEnabled,
                string.Equals(transferStatus, "active", StringComparison.OrdinalIgnoreCase),
                transferStatus,
                account.Requirements?.CurrentlyDue?.ToArray() ?? [],
                account.Requirements?.PastDue?.ToArray() ?? [],
                account.Requirements?.DisabledReason,
                fingerprint,
                account.Settings?.Payouts?.Schedule?.Interval,
                instantPayoutMethodsAvailable,
                account.ChargesEnabled);
        }

        private static string GetFingerprintMaterial(IExternalAccount externalAccount) => externalAccount switch
        {
            Stripe.BankAccount bankAccount => string.Join('|',
                "bank_account",
                bankAccount.Id,
                bankAccount.Fingerprint,
                bankAccount.Currency,
                bankAccount.DefaultForCurrency,
                bankAccount.Status,
                NormalizePayoutMethods(bankAccount.AvailablePayoutMethods)),
            Stripe.Card card => string.Join('|',
                "card",
                card.Id,
                card.Fingerprint,
                card.Currency,
                card.DefaultForCurrency,
                card.Status,
                card.Funding,
                NormalizePayoutMethods(card.AvailablePayoutMethods)),
            _ => throw new InvalidOperationException(
                $"Unsupported Stripe external-account type '{externalAccount.GetType().FullName}'.")
        };

        private static bool HasInstantPayoutMethod(IExternalAccount externalAccount) => externalAccount switch
        {
            Stripe.BankAccount bankAccount => ContainsInstant(bankAccount.AvailablePayoutMethods),
            Stripe.Card card => ContainsInstant(card.AvailablePayoutMethods),
            _ => throw new InvalidOperationException(
                $"Unsupported Stripe external-account type '{externalAccount.GetType().FullName}'.")
        };

        private static bool ContainsInstant(IEnumerable<string>? payoutMethods) =>
            payoutMethods?.Any(method => string.Equals(method, "instant", StringComparison.OrdinalIgnoreCase)) == true;

        private static string NormalizePayoutMethods(IEnumerable<string>? payoutMethods) => string.Join(',',
            payoutMethods is null
                ? Enumerable.Empty<string>()
                : payoutMethods.OrderBy(method => method, StringComparer.OrdinalIgnoreCase));
    }
}
