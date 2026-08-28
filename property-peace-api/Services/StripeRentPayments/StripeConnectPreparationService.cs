using System.Text.RegularExpressions;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Stripe;
using brownstone_hub_api.Models;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.StripeRentPayments
{
    public interface IStripeConnectPreparationService
    {
        Task<StripeConnectPreparationDto?> GetAsync(long userId, long organizationId, CancellationToken cancellationToken);
        Task<StripeConnectPreparationDto?> GetValidatedForHandoffAsync(long userId, long organizationId,
            CancellationToken cancellationToken);
        Task<StripeConnectPreparationDto> SaveAsync(long userId, long organizationId,
            SaveStripeConnectPreparationRequest request, CancellationToken cancellationToken);
    }

    public sealed class StripeConnectPreparationService(DataContext db) : IStripeConnectPreparationService
    {
        private static readonly HashSet<string> OperatingTypes = new(StringComparer.Ordinal)
        {
            "individual", "business"
        };

        private static readonly HashSet<string> AuthorityRelationships = new(StringComparer.Ordinal)
        {
            "owner", "property-manager", "authorized-representative"
        };

        private static readonly Regex[] ProhibitedDisplayNamePatterns =
        [
            new(@"(?<!\d)\d{3}[ -]\d{2}[ -]\d{4}(?!\d)", RegexOptions.Compiled | RegexOptions.CultureInvariant),
            new(@"(?<!\d)\d{2}-\d{7}(?!\d)", RegexOptions.Compiled | RegexOptions.CultureInvariant),
            new(@"\b(?:ssn|social\s+security(?:\s+number)?|ein|tax(?:payer)?(?:\s+identification)?\s*(?:id|number))\b\s*(?:no\.?|number|#)?\s*[:=#-]?\s*(?=[A-Z0-9-]{6,}\b)(?=[A-Z0-9-]*\d)[A-Z0-9-]{6,}", RegexOptions.Compiled | RegexOptions.IgnoreCase | RegexOptions.CultureInvariant),
            new(@"(?<!\d)(?:\d[ -]?){12,19}(?!\d)", RegexOptions.Compiled | RegexOptions.CultureInvariant),
            new(@"\b(?:routing|bank\s+account|credit\s+card|debit\s+card|card)\s*(?:number|no\.?|#)?\s*[:=#-]?\s*(?:\d[ -]?){6,19}(?!\d)", RegexOptions.Compiled | RegexOptions.IgnoreCase | RegexOptions.CultureInvariant),
            new(@"\b(?:dob|date\s+of\s+birth|birth\s*date)\b\s*[:=#-]?\s*(?:\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{4}[/.-]\d{1,2}[/.-]\d{1,2})", RegexOptions.Compiled | RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)
        ];

        public async Task<StripeConnectPreparationDto?> GetAsync(long userId, long organizationId,
            CancellationToken cancellationToken)
        {
            ValidateScope(userId, organizationId);
            var preparation = await db.StripeConnectPreparations.AsNoTracking()
                .Include(x => x.Properties)
                .SingleOrDefaultAsync(x => x.UserId == userId && x.OrganizationId == organizationId, cancellationToken);
            return preparation == null ? null : ToDto(preparation);
        }

        public async Task<StripeConnectPreparationDto?> GetValidatedForHandoffAsync(long userId, long organizationId,
            CancellationToken cancellationToken)
        {
            var preparation = await GetAsync(userId, organizationId, cancellationToken);
            if (preparation == null) return null;
            if (!preparation.AuthorityAttested || preparation.AuthorityAttestedAt == null ||
                !OperatingTypes.Contains(preparation.OperatingType) ||
                !AuthorityRelationships.Contains(preparation.AuthorityRelationship) ||
                preparation.PropertyIds.Count == 0)
                throw new InvalidOperationException("The saved payout setup is incomplete.");

            var scopedPropertyCount = await db.Properties.AsNoTracking().CountAsync(
                x => preparation.PropertyIds.Contains(x.Id) && x.OrganizationId == organizationId && !x.IsDeleted,
                cancellationToken);
            if (scopedPropertyCount != preparation.PropertyIds.Count)
                throw new UnauthorizedAccessException("One or more saved properties are no longer available in this organization.");

            return preparation;
        }

        public async Task<StripeConnectPreparationDto> SaveAsync(long userId, long organizationId,
            SaveStripeConnectPreparationRequest request, CancellationToken cancellationToken)
        {
            ValidateScope(userId, organizationId);
            ArgumentNullException.ThrowIfNull(request);

            var operatingType = request.OperatingType?.Trim().ToLowerInvariant() ?? string.Empty;
            var displayName = request.DisplayName?.Trim() ?? string.Empty;
            var authorityRelationship = request.AuthorityRelationship?.Trim().ToLowerInvariant() ?? string.Empty;
            var propertyIds = (request.PropertyIds ?? []).Where(x => x > 0).Distinct().Order().ToArray();

            if (!OperatingTypes.Contains(operatingType))
                throw new ArgumentException("Operating type is invalid.");
            if (displayName.Length is < 1 or > 200 || displayName.Any(char.IsControl))
                throw new ArgumentException("Display name is invalid.");
            if (ProhibitedDisplayNamePatterns.Any(pattern => pattern.IsMatch(displayName)))
                throw new ArgumentException("Do not enter tax, identity, or bank account numbers in the display name.");
            if (!AuthorityRelationships.Contains(authorityRelationship))
                throw new ArgumentException("Authority relationship is invalid.");
            if (!request.AuthorityAttested)
                throw new ArgumentException("Property authority must be confirmed.");
            if (propertyIds.Length is < 1 or > 50 || propertyIds.Length != (request.PropertyIds?.Count ?? 0))
                throw new ArgumentException("Select between 1 and 50 unique properties.");

            var scopedPropertyCount = await db.Properties.CountAsync(
                x => propertyIds.Contains(x.Id) && x.OrganizationId == organizationId && !x.IsDeleted,
                cancellationToken);
            if (scopedPropertyCount != propertyIds.Length)
                throw new UnauthorizedAccessException("One or more selected properties are outside the current organization.");

            var now = DateTimeOffset.UtcNow;
            var preparation = await db.StripeConnectPreparations
                .Include(x => x.Properties)
                .SingleOrDefaultAsync(x => x.UserId == userId && x.OrganizationId == organizationId, cancellationToken);

            var isNewPreparation = preparation == null;
            if (isNewPreparation)
            {
                preparation = new StripeConnectPreparation
                {
                    UserId = userId,
                    OrganizationId = organizationId,
                    CreatedAt = now
                };
                db.StripeConnectPreparations.Add(preparation);
            }

            ApplyPreparation(preparation!, operatingType, displayName, authorityRelationship, propertyIds, now);

            try
            {
                await db.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateException ex) when (isNewPreparation && IsUniqueConstraintViolation(ex))
            {
                // A retry or second browser tab may win the initial insert. Reload and apply this request as an idempotent upsert.
                db.ChangeTracker.Clear();
                preparation = await db.StripeConnectPreparations.Include(x => x.Properties)
                    .SingleOrDefaultAsync(x => x.UserId == userId && x.OrganizationId == organizationId, cancellationToken);
                if (preparation == null) throw;
                ApplyPreparation(preparation, operatingType, displayName, authorityRelationship, propertyIds, now);
                await db.SaveChangesAsync(cancellationToken);
            }

            return ToDto(preparation!);
        }

        private void ApplyPreparation(StripeConnectPreparation preparation, string operatingType, string displayName,
            string authorityRelationship, IReadOnlyCollection<long> propertyIds, DateTimeOffset now)
        {
            var requestedIds = propertyIds.ToHashSet();
            var existingIds = preparation.Properties.Select(x => x.PropertyId).ToHashSet();
            var authorityScopeChanged = preparation.Id == 0 || !preparation.AuthorityAttested ||
                !string.Equals(preparation.AuthorityRelationship, authorityRelationship, StringComparison.Ordinal) ||
                !existingIds.SetEquals(requestedIds);

            preparation.OperatingType = operatingType;
            preparation.DisplayName = displayName;
            preparation.AuthorityRelationship = authorityRelationship;
            preparation.AuthorityAttested = true;
            if (authorityScopeChanged || preparation.AuthorityAttestedAt == null)
                preparation.AuthorityAttestedAt = now;
            preparation.UpdatedAt = now;

            var removed = preparation.Properties.Where(x => !requestedIds.Contains(x.PropertyId)).ToArray();
            db.StripeConnectPreparationProperties.RemoveRange(removed);
            foreach (var item in removed) preparation.Properties.Remove(item);
            existingIds = preparation.Properties.Select(x => x.PropertyId).ToHashSet();
            foreach (var propertyId in propertyIds.Where(x => !existingIds.Contains(x)))
                preparation.Properties.Add(new StripeConnectPreparationProperty { PropertyId = propertyId });
        }

        private static bool IsUniqueConstraintViolation(DbUpdateException exception) =>
            exception.InnerException is SqlException { Number: 2601 or 2627 };

        private static void ValidateScope(long userId, long organizationId)
        {
            if (userId <= 0) throw new UnauthorizedAccessException("Authenticated user context is required.");
            if (organizationId <= 0) throw new UnauthorizedAccessException("Organization context is required.");
        }

        private static StripeConnectPreparationDto ToDto(StripeConnectPreparation preparation) => new(
            preparation.Id,
            preparation.UserId,
            preparation.OrganizationId,
            preparation.OperatingType,
            preparation.DisplayName,
            preparation.Properties.Select(x => x.PropertyId).Order().ToArray(),
            preparation.AuthorityRelationship,
            preparation.AuthorityAttested,
            preparation.AuthorityAttestedAt,
            preparation.CreatedAt,
            preparation.UpdatedAt);

    }
}
