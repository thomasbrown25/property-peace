using brownstone_hub_api.Dtos.AICopilot;
using brownstone_hub_api.Services.PercyActions;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;

namespace brownstone_hub_api.Services.AICopilotService
{
    public partial class AICopilotService
    {
        private const string TenantContactScope = "tenant-contacts";
        private const string TenantContactRoute = "/landlord/leases?tab=tenants";

        private sealed record TenantContactRow(
            long Id,
            string FirstName,
            string LastName,
            string? Email,
            string? Phone,
            string? PropertyName,
            string? UnitName,
            bool HasActiveLease)
        {
            public string Name => $"{FirstName} {LastName}".Trim();
        }

        private sealed record TenantContactRead(
            PercyChatResponseDto Response,
            List<PercySourceDto> Sources,
            List<string?> AllowedDisplayValues);

        private enum TenantContactField
        {
            All,
            Email,
            Phone
        }

        private static bool TryParseTenantContactRequest(
            string message, out string? tenantName, out TenantContactField requestedField)
        {
            tenantName = null;
            requestedField = TenantContactField.All;
            const RegexOptions options = RegexOptions.IgnoreCase | RegexOptions.CultureInvariant;
            const string nameToken = @"[\p{L}][\p{L}\p{M}'’.-]*";
            const string contactField = @"(?<field>email|e-mail|phone(?:\s+number)?|contact(?:\s+(?:information|info|details))?)";

            if (!Regex.IsMatch(message, $@"\b{contactField}\b", options))
                return false;

            var tenantPrefix = Regex.Match(message,
                $@"\btenant\s+(?<name>{nameToken}(?:\s+{nameToken}){{0,3}}?)(?:'s|’s)?\s+{contactField}\b",
                options);
            var fieldForName = Regex.Match(message,
                $@"\b{contactField}\s+(?:details?\s+)?for\s+(?:tenant\s+|resident\s+)?(?<name>{nameToken}(?:\s+{nameToken}){{0,3}})\b",
                options);
            var possessive = Regex.Match(message,
                $@"(?:^|\b(?:what\s+is|what['’]?s|show|find|give\s+me|(?:can|could|would)\s+you\s+(?:show|find|tell\s+me)|please\s+(?:show|find))\s+)(?<name>{nameToken}(?:\s+{nameToken}){{0,3}})['’]s\s+{contactField}\b",
                options);
            var match = tenantPrefix.Success ? tenantPrefix : fieldForName.Success ? fieldForName : possessive;
            if (match.Success)
            {
                tenantName = Regex.Replace(match.Groups["name"].Value, @"\s+", " ").Trim();
                tenantName = Regex.Replace(tenantName,
                    @"^(?:(?:what\s+is|what['’]?s|show|find|give\s+me|(?:can|could|would)\s+you\s+(?:show|find|tell\s+me)|please\s+(?:show|find))\s+)+",
                    string.Empty, options);
                tenantName = Regex.Replace(tenantName, "['’]s$", string.Empty, options);
                requestedField = ParseTenantContactField(match.Groups["field"].Value);
                return tenantName.Length > 0;
            }

            return Regex.IsMatch(message,
                @"\b(?:(?:show|list)\s+(?:all\s+|my\s+)?(?:tenant|resident)s?(?:\s+contacts?)?|(?:tenant|resident)\s+(?:contact\s+)?(?:directory|list))\b",
                options);
        }

        private static TenantContactField ParseTenantContactField(string value) =>
            value.StartsWith("email", StringComparison.OrdinalIgnoreCase) ||
            value.StartsWith("e-mail", StringComparison.OrdinalIgnoreCase)
                ? TenantContactField.Email
                : value.StartsWith("phone", StringComparison.OrdinalIgnoreCase)
                    ? TenantContactField.Phone
                    : TenantContactField.All;

        private async Task<TenantContactRead> ReadTenantContactsAsync(
            long organizationId, string? requestedName, TenantContactField requestedField,
            CancellationToken cancellationToken)
        {
            var query = _dataContext.Tenants.AsNoTracking()
                .Where(tenant => tenant.OrganizationId == organizationId && !tenant.IsDeleted);

            if (!string.IsNullOrWhiteSpace(requestedName))
            {
                var normalizedName = requestedName.Trim().ToLowerInvariant();
                query = query.Where(tenant =>
                    (tenant.Firstname + " " + tenant.Lastname).ToLower() == normalizedName ||
                    tenant.Firstname.ToLower() == normalizedName ||
                    tenant.Lastname.ToLower() == normalizedName);
            }

            var rows = await query
                .OrderBy(tenant => tenant.Lastname)
                .ThenBy(tenant => tenant.Firstname)
                .ThenBy(tenant => tenant.Id)
                .Take(PercyDataBoundary.MaxItems + 1)
                .Select(tenant => new TenantContactRow(
                    tenant.Id,
                    tenant.Firstname,
                    tenant.Lastname,
                    requestedField == TenantContactField.Phone ? null : tenant.Email,
                    requestedField == TenantContactField.Email ? null : tenant.PhoneNumber,
                    tenant.Unit != null && tenant.Unit.OrganizationId == organizationId &&
                        tenant.Unit.Property.OrganizationId == organizationId
                        ? tenant.Unit.Property.Name
                        : null,
                    tenant.Unit != null && tenant.Unit.OrganizationId == organizationId &&
                        tenant.Unit.Property.OrganizationId == organizationId
                        ? tenant.Unit.Name
                        : null,
                    tenant.TenantLeases.Any(link => link.Lease.OrganizationId == organizationId &&
                        link.Lease.Unit.OrganizationId == organizationId &&
                        link.Lease.Unit.Property.OrganizationId == organizationId &&
                        link.Lease.IsActive && !link.Lease.IsDeleted)))
                .ToListAsync(cancellationToken);

            var visibleRows = rows.Take(PercyDataBoundary.MaxItems).ToList();
            var response = string.IsNullOrWhiteSpace(requestedName)
                ? BuildTenantDirectoryResponse(visibleRows, rows.Count > PercyDataBoundary.MaxItems)
                : BuildNamedTenantContactResponse(requestedName.Trim(), visibleRows, rows.Count > PercyDataBoundary.MaxItems);
            var sourceRows = visibleRows.Count == 1 ? visibleRows : [];
            var sources = sourceRows.Count == 1
                ? new List<PercySourceDto> { TenantContactSource(includeRecordReference: true) }
                : new List<PercySourceDto> { TenantContactSource() };
            var allowedValues = visibleRows.SelectMany(row => new[]
                {
                    row.Name, row.Email, row.Phone, row.PropertyName, row.UnitName
                })
                .Where(value => !string.IsNullOrWhiteSpace(value))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Cast<string?>()
                .ToList();
            return new TenantContactRead(response, sources, allowedValues);
        }

        private static PercyChatResponseDto BuildTenantDirectoryResponse(
            IReadOnlyList<TenantContactRow> rows, bool hasMore)
        {
            var content = rows.Count == 0
                ? "I couldn't find any current tenants in this organization."
                : hasMore
                    ? $"Here are the first {rows.Count} tenant contacts in this organization."
                    : $"Here {(rows.Count == 1 ? "is" : "are")} {rows.Count} tenant {(rows.Count == 1 ? "contact" : "contacts")} in this organization.";
            return new PercyChatResponseDto
            {
                Content = content,
                ActivityLabel = "Tenant contacts",
                ActivityStatus = hasMore ? $"First {rows.Count} contacts" : $"{rows.Count} contacts",
                Items = rows.Select(TenantContactItem).ToList()
            };
        }

        private static PercyChatResponseDto BuildNamedTenantContactResponse(
            string requestedName, IReadOnlyList<TenantContactRow> rows, bool hasMore)
        {
            if (rows.Count == 0)
                return new PercyChatResponseDto
                {
                    Content = $"I couldn't find a current tenant named {requestedName} in this organization.",
                    ActivityLabel = "Tenant contacts",
                    ActivityStatus = "No matching tenant"
                };

            if (rows.Count == 1 && !hasMore)
            {
                var row = rows[0];
                return new PercyChatResponseDto
                {
                    Content = $"{row.Name}: {TenantContact(row.Email, row.Phone)}.",
                    ActivityLabel = "Tenant contact",
                    ActivityStatus = "1 matching tenant",
                    Items = [TenantContactItem(row)]
                };
            }

            return new PercyChatResponseDto
            {
                Content = $"I found multiple tenants named {requestedName}: {string.Join(", ", rows.Select(row => row.Name))}. Please use a full name so I don't guess.",
                ActivityLabel = "Tenant contacts",
                ActivityStatus = hasMore ? $"More than {rows.Count} matching tenants" : $"{rows.Count} matching tenants",
                Items = rows.Select(row => new PercyResultItemDto
                {
                    Title = row.Name,
                    Detail = TenantLocationAndStatus(row)
                }).ToList()
            };
        }

        private static PercyResultItemDto TenantContactItem(TenantContactRow row) => new()
        {
            Title = row.Name,
            Detail = TenantLocationAndStatus(row),
            Value = TenantContact(row.Email, row.Phone)
        };

        private static string TenantLocationAndStatus(TenantContactRow row)
        {
            var parts = new List<string>();
            if (!string.IsNullOrWhiteSpace(row.PropertyName)) parts.Add(row.PropertyName.Trim());
            if (!string.IsNullOrWhiteSpace(row.UnitName)) parts.Add(row.UnitName.Trim());
            parts.Add(row.HasActiveLease ? "Active" : "No active lease");
            return string.Join(" · ", parts);
        }

        private static PercySourceDto TenantContactSource(bool includeRecordReference = false) => new()
        {
            Kind = TenantContactScope,
            Label = "Tenant contacts",
            WorkflowRoute = TenantContactRoute,
            RecordReference = includeRecordReference ? $"tenant_{Guid.NewGuid():N}" : null,
            RetrievedAtUtc = DateTime.UtcNow
        };
    }
}