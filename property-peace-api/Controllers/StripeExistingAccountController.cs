using System.Security.Claims;
using System.Text.Json;
using brownstone_hub_api.Attributes;
using brownstone_hub_api.Filters;
using brownstone_hub_api.Helpers;
using brownstone_hub_api.Services.StripeRentPayments;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Stripe;

namespace brownstone_hub_api.Controllers;

[ApiController]
[Authorize]
[RequireOrganizationRole("Owner", "Manager")]
[RequireStripeConnectSetupReady]
[Route("api/stripe/existing-account")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class StripeExistingAccountController(
    IConfiguration configuration,
    StripeConnectOAuth oauth,
    IStripeConnectOAuthReplayStore replayStore,
    IStripeConnectedPayeeService payees,
    IStripeConnectPreparationService preparation,
    IStripeConnectedAccountGateway accounts) : ControllerBase
{
    [HttpPost("authorize")]
    public async Task<IActionResult> Begin(CancellationToken cancellationToken)
    {
        var scope = await ValidateScopeAsync(cancellationToken);
        if (scope.Error != null) return scope.Error;
        var authorizationUrl = oauth.CreateAuthorizationUrl(scope.UserId, scope.OrganizationId);
        return authorizationUrl == null ? OAuthUnavailable() : Ok(new { authorizationUrl });
    }

    [HttpPost("complete")]
    public async Task<IActionResult> Complete([FromBody] StripeOAuthReturn request, CancellationToken cancellationToken)
    {
        var scope = await ValidateScopeAsync(cancellationToken);
        if (scope.Error != null) return scope.Error;
        var nonce = oauth.ValidateState(request.State, scope.UserId, scope.OrganizationId);
        if (nonce == null) return BadRequest(new { message = "Stripe authorization expired or belongs to a different session. Start again in the original organization." });
        if (request.Error == "access_denied") return Ok(new { connected = false, cancelled = true });
        if (!string.IsNullOrEmpty(request.Error) || request.Code is not { Length: > 3 and <= 256 } code ||
            !code.All(character => char.IsAsciiLetterOrDigit(character) || character is '_' or '-'))
            return BadRequest(new { message = "Stripe did not return a valid authorization. Start again from Online Rent Payments." });

        try
        {
            if (!await replayStore.TryConsumeAsync(code, nonce, cancellationToken))
                return Conflict(new { message = "This Stripe authorization was already used. Refresh your Stripe status or start again." });

            var accountId = await oauth.ExchangeCodeAsync(code, cancellationToken);
            if (accountId == null)
                return BadRequest(new { message = "Stripe could not authorize this account. Start again and choose an eligible Stripe account." });

            var account = await accounts.GetSnapshotAsync(accountId, cancellationToken);
            if (account.StripeAccountId != accountId || !account.IsStripeManagedDirectCharge ||
                !string.Equals(account.Country, "US", StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { message = "Choose a U.S. Stripe account with the full Stripe Dashboard that is eligible for Property Peace rent payments." });

            // Membership or payout preparation can change while Stripe is responding.
            var revalidated = await ValidateScopeAsync(cancellationToken);
            if (revalidated.Error != null) return revalidated.Error;
            await payees.RegisterInitialAccountAsync(scope.UserId, accountId, account.DetailsSubmitted, cancellationToken);
            return Ok(new { connected = true });
        }
        catch (InvalidOperationException)
        {
            return Conflict(new { message = "This account could not be linked to the current landlord. Refresh your Stripe status or choose another account." });
        }
        catch (Exception ex) when (ex is StripeException or HttpRequestException or JsonException or DbUpdateException ||
                                   ex is OperationCanceledException && !cancellationToken.IsCancellationRequested)
        {
            return StatusCode(StatusCodes.Status502BadGateway,
                new { message = "We couldn't complete the Stripe connection. Start again from Online Rent Payments." });
        }
    }

    private IActionResult OAuthUnavailable() => StatusCode(StatusCodes.Status503ServiceUnavailable,
        new { message = "Connecting an existing Stripe account is unavailable in this environment." });

    private async Task<(long UserId, long OrganizationId, IActionResult? Error)> ValidateScopeAsync(CancellationToken cancellationToken)
    {
        if (User.Identity?.IsAuthenticated != true ||
            !long.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("userId"), out var userId) ||
            userId <= 0 || User.HasClaim(claim => claim.Type == "impersonation_session_id") ||
            string.Equals(User.FindFirstValue("is_impersonating"), "true", StringComparison.OrdinalIgnoreCase))
            return (0, 0, StatusCode(StatusCodes.Status403Forbidden, new { message = "An authenticated landlord is required." }));

        var organizationId = this.GetCurrentOrganizationIdOrForbid();
        if (organizationId is not > 0 || configuration.GetValue<bool>("ShortStayCollection:RequireIdentityBeforeConnect"))
            return (0, 0, StatusCode(StatusCodes.Status403Forbidden, new { message = "Stripe setup is unavailable for this organization." }));
        if (!oauth.IsConfigured) return (0, 0, OAuthUnavailable());

        var owned = await payees.ResolveOwnedAccountForOnboardingAsync(userId, organizationId.Value, cancellationToken);
        if (owned == null || owned.UserId != userId)
            return (0, 0, StatusCode(StatusCodes.Status403Forbidden, new { message = "Stripe setup is unavailable for this organization." }));
        if (!string.IsNullOrWhiteSpace(owned.StripeAccountId))
            return (0, 0, Conflict(new { message = "This landlord already has a connected Stripe account." }));

        try
        {
            if (await preparation.GetValidatedForHandoffAsync(userId, organizationId.Value, cancellationToken) != null)
                return (userId, organizationId.Value, null);
        }
        catch (Exception ex) when (ex is InvalidOperationException or UnauthorizedAccessException)
        {
            // A draft can become invalid when one of its properties is removed or reassigned.
        }
        return (0, 0, Conflict(new { message = "Complete and save the payout setup before continuing to Stripe." }));
    }
}

public sealed record StripeOAuthReturn(string? Code, string? State, string? Error);
