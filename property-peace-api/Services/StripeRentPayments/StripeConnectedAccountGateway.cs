using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Stripe;
using System.Security.Cryptography;
using System.Text;

namespace brownstone_hub_api.Services.StripeRentPayments
{
    public sealed record StripePayoutBankSnapshot(
        string ExternalAccountId,
        string? Last4,
        string? BankName,
        string? AccountType,
        string? Currency,
        bool DefaultForCurrency,
        string? Fingerprint);

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
        bool ChargesEnabled = false,
        StripePayoutBankSnapshot? PayoutBank = null);

    public sealed record StripeConnectedAccountOnboardingResult(
        string AccountId,
        bool DetailsSubmitted,
        string OnboardingUrl);

    public interface IStripeConnectedAccountGateway
    {
        Task<StripeConnectedAccountSnapshot> GetSnapshotAsync(string stripeAccountId, CancellationToken cancellationToken = default);
        Task<StripeConnectedAccountOnboardingResult> CreateOnboardingAccountAsync(
            AccountCreateOptions accountOptions,
            string returnUrl,
            string idempotencyKey,
            CancellationToken cancellationToken = default) =>
            throw new NotSupportedException("Connected-account creation is not supported by this gateway.");
    }

    public sealed class StripeConnectedAccountGateway : IStripeConnectedAccountGateway
    {
        private readonly TimeProvider _timeProvider;
        private readonly Stripe.AccountService _accountService;
        private readonly Stripe.AccountExternalAccountService _externalAccountService;
        private readonly Stripe.AccountLinkService _accountLinkService;

        [ActivatorUtilitiesConstructor]
        public StripeConnectedAccountGateway(TimeProvider timeProvider, IConfiguration configuration)
            : this(timeProvider, BuildStripeClient(configuration))
        {
        }

        private static IStripeClient BuildStripeClient(IConfiguration configuration)
        {
            ArgumentNullException.ThrowIfNull(configuration);
            var apiKey = configuration["Stripe:SecretKey"];
            if (string.IsNullOrWhiteSpace(apiKey))
                throw new InvalidOperationException("Stripe:SecretKey is not configured.");
            return new StripeClient(apiKey);
        }

        public StripeConnectedAccountGateway(TimeProvider timeProvider, IStripeClient stripeClient)
        {
            ArgumentNullException.ThrowIfNull(stripeClient);
            _timeProvider = timeProvider;
            _accountService = new Stripe.AccountService(stripeClient);
            _externalAccountService = new Stripe.AccountExternalAccountService(stripeClient);
            _accountLinkService = new Stripe.AccountLinkService(stripeClient);
        }

        public async Task<StripeConnectedAccountOnboardingResult> CreateOnboardingAccountAsync(
            AccountCreateOptions accountOptions,
            string returnUrl,
            string idempotencyKey,
            CancellationToken cancellationToken = default)
        {
            var account = await _accountService.CreateAsync(
                accountOptions,
                new RequestOptions { IdempotencyKey = idempotencyKey },
                cancellationToken);

            const string stripeTransfersCapability = "stripe_balance.stripe_transfers";
            var connectedAccountOptions = new RequestOptions { StripeAccount = account.Id };
            try
            {
                var capability = await _accountService.Capabilities.GetAsync(
                    account.Id, stripeTransfersCapability, null, connectedAccountOptions, cancellationToken);
                if (capability.Status != "active" && capability.Requested != true)
                {
                    await _accountService.Capabilities.UpdateAsync(
                        account.Id,
                        stripeTransfersCapability,
                        new AccountCapabilityUpdateOptions { Requested = true },
                        connectedAccountOptions,
                        cancellationToken);
                }
            }
            catch (StripeException)
            {
                // Preserve the existing best-effort behavior; onboarding can continue and readiness remains fail closed.
            }

            var accountLink = await _accountLinkService.CreateAsync(new AccountLinkCreateOptions
            {
                Account = account.Id,
                RefreshUrl = returnUrl,
                ReturnUrl = returnUrl,
                Type = "account_onboarding"
            }, null, cancellationToken);

            return new StripeConnectedAccountOnboardingResult(
                account.Id,
                account.DetailsSubmitted,
                accountLink.Url);
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
            var payoutBank = externalAccounts
                .OfType<Stripe.BankAccount>()
                .Where(bankAccount =>
                    bankAccount.DefaultForCurrency == true
                    && string.Equals(bankAccount.Currency, "usd", StringComparison.OrdinalIgnoreCase))
                .OrderBy(bankAccount => bankAccount.Id, StringComparer.Ordinal)
                .Select(bankAccount => new StripePayoutBankSnapshot(
                    bankAccount.Id,
                    bankAccount.Last4,
                    bankAccount.BankName,
                    bankAccount.AccountType,
                    bankAccount.Currency,
                    bankAccount.DefaultForCurrency == true,
                    bankAccount.Fingerprint))
                .FirstOrDefault();

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
                account.ChargesEnabled,
                payoutBank);
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
