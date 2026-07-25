using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Nodes;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.User;
using brownstone_hub_api.Services.UserService;
using Fido2NetLib;
using Fido2NetLib.Objects;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/passkey")]
    public class PasskeyController(
        IFido2 fido2,
        DataContext dataContext,
        IUserService userService,
        ILogger<PasskeyController> logger) : ControllerBase
    {
        private const string RegistrationCeremony = "registration";
        private const string AuthenticationCeremony = "authentication";
        private static readonly TimeSpan RecentAuthenticationWindow = TimeSpan.FromMinutes(5);
        private static readonly TimeSpan CeremonyLifetime = TimeSpan.FromMinutes(5);

        private readonly IFido2 _fido2 = fido2;
        private readonly DataContext _dataContext = dataContext;
        private readonly IUserService _userService = userService;
        private readonly ILogger<PasskeyController> _logger = logger;

        [Authorize]
        [HttpGet]
        public async Task<ActionResult<IReadOnlyList<PasskeySummaryDto>>> List(CancellationToken cancellationToken)
        {
            var user = await GetCurrentUserAsync();
            if (user == null) return Unauthorized();

            var passkeys = await _dataContext.PasskeyCredentials
                .AsNoTracking()
                .Where(x => x.UserId == user.Id)
                .OrderByDescending(x => x.CreatedAt)
                .Select(x => new PasskeySummaryDto(x.Id, x.Name, x.CreatedAt, x.LastUsedAt, x.IsBackedUp))
                .ToListAsync(cancellationToken);

            return Ok(passkeys);
        }

        [Authorize]
        [HttpPost("registration/options")]
        public async Task<ActionResult<PasskeyOptionsDto>> RegistrationOptions(CancellationToken cancellationToken)
        {
            if (!HasRecentAuthentication())
                return Unauthorized(new { Message = "Please confirm your session again before adding a passkey." });

            var user = await GetCurrentUserAsync();
            if (user == null) return Unauthorized();

            await RemoveExpiredCeremoniesAsync(cancellationToken);

            var existingCredentials = await _dataContext.PasskeyCredentials
                .AsNoTracking()
                .Where(x => x.UserId == user.Id)
                .Select(x => x.CredentialId)
                .ToListAsync(cancellationToken);

            var fidoUser = new Fido2User
            {
                Id = BitConverter.GetBytes(user.Id),
                Name = user.Email,
                DisplayName = string.Join(' ', new[] { user.Firstname, user.Lastname }.Where(x => !string.IsNullOrWhiteSpace(x)))
            };
            if (string.IsNullOrWhiteSpace(fidoUser.DisplayName)) fidoUser.DisplayName = user.Email;

            var options = _fido2.RequestNewCredential(new RequestNewCredentialParams
            {
                User = fidoUser,
                ExcludeCredentials = existingCredentials
                    .Select(x => new PublicKeyCredentialDescriptor(Convert.FromBase64String(x)))
                    .ToList(),
                AuthenticatorSelection = new AuthenticatorSelection
                {
                    ResidentKey = ResidentKeyRequirement.Required,
                    UserVerification = UserVerificationRequirement.Required
                },
                AttestationPreference = AttestationConveyancePreference.None
            });
            var optionsJson = options.ToJson();

            var ceremony = new PasskeyCeremony
            {
                Type = RegistrationCeremony,
                UserId = user.Id,
                OptionsJson = optionsJson,
                ExpiresAt = DateTime.UtcNow.Add(CeremonyLifetime)
            };
            _dataContext.PasskeyCeremonies.Add(ceremony);
            await _dataContext.SaveChangesAsync(cancellationToken);

            return Ok(new PasskeyOptionsDto(ceremony.Id, ParseWebAuthnOptions(optionsJson)));
        }

        [Authorize]
        [HttpPost("registration/verify")]
        public async Task<ActionResult<PasskeySummaryDto>> VerifyRegistration(
            [FromBody] PasskeyRegistrationRequest request,
            CancellationToken cancellationToken)
        {
            if (!HasRecentAuthentication())
                return Unauthorized(new { Message = "Please confirm your session again before adding a passkey." });

            var user = await GetCurrentUserAsync();
            if (user == null) return Unauthorized();

            var ceremony = await ConsumeCeremonyAsync(request.CeremonyId, RegistrationCeremony, user.Id, cancellationToken);
            if (ceremony == null) return BadRequest(new { message = "This passkey setup request expired. Please try again." });

            try
            {
                var options = CredentialCreateOptions.FromJson(ceremony.OptionsJson);
                var attestationResponse = ParseWebAuthnResponse<AuthenticatorAttestationRawResponse>(request.Response);
                var credential = await _fido2.MakeNewCredentialAsync(new MakeNewCredentialParams
                {
                    AttestationResponse = attestationResponse,
                    OriginalOptions = options,
                    IsCredentialIdUniqueToUserCallback = async (args, ct) =>
                    {
                        var hash = HashCredentialId(args.CredentialId);
                        return !await _dataContext.PasskeyCredentials.AnyAsync(x => x.CredentialIdHash == hash, ct);
                    }
                }, cancellationToken);

                var passkey = new PasskeyCredential
                {
                    UserId = user.Id,
                    CredentialId = Convert.ToBase64String(credential.Id),
                    CredentialIdHash = HashCredentialId(credential.Id),
                    PublicKey = credential.PublicKey,
                    UserHandle = credential.User.Id,
                    SignatureCounter = credential.SignCount,
                    AaGuid = credential.AaGuid,
                    Name = NormalizeName(request.Name),
                    IsBackupEligible = credential.IsBackupEligible,
                    IsBackedUp = credential.IsBackedUp,
                    CreatedAt = DateTime.UtcNow
                };

                _dataContext.PasskeyCredentials.Add(passkey);
                await _dataContext.SaveChangesAsync(cancellationToken);

                return Ok(new PasskeySummaryDto(passkey.Id, passkey.Name, passkey.CreatedAt, null, passkey.IsBackedUp));
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Passkey registration failed for user {UserId}", user.Id);
                return BadRequest(new { message = "The passkey could not be verified. Please try again." });
            }
        }

        [AllowAnonymous]
        [HttpPost("authentication/options")]
        public async Task<ActionResult<PasskeyOptionsDto>> AuthenticationOptions(CancellationToken cancellationToken)
        {
            await RemoveExpiredCeremoniesAsync(cancellationToken);

            var options = _fido2.GetAssertionOptions(new GetAssertionOptionsParams
            {
                AllowedCredentials = [],
                UserVerification = UserVerificationRequirement.Required
            });
            var optionsJson = options.ToJson();

            var ceremony = new PasskeyCeremony
            {
                Type = AuthenticationCeremony,
                OptionsJson = optionsJson,
                ExpiresAt = DateTime.UtcNow.Add(CeremonyLifetime)
            };
            _dataContext.PasskeyCeremonies.Add(ceremony);
            await _dataContext.SaveChangesAsync(cancellationToken);

            return Ok(new PasskeyOptionsDto(ceremony.Id, ParseWebAuthnOptions(optionsJson)));
        }

        [AllowAnonymous]
        [HttpPost("authentication/verify")]
        public async Task<ActionResult<ServiceResponse<LoadUserDto>>> VerifyAuthentication(
            [FromBody] PasskeyAuthenticationRequest request,
            CancellationToken cancellationToken)
        {
            var ceremony = await ConsumeCeremonyAsync(request.CeremonyId, AuthenticationCeremony, null, cancellationToken);
            if (ceremony == null) return BadRequest(new { message = "This sign-in request expired. Please try again." });

            try
            {
                var assertionResponse = ParseWebAuthnResponse<AuthenticatorAssertionRawResponse>(request.Response);
                var credentialIdHash = HashCredentialId(assertionResponse.RawId);
                var passkey = await _dataContext.PasskeyCredentials
                    .Include(x => x.User)
                    .SingleOrDefaultAsync(x => x.CredentialIdHash == credentialIdHash, cancellationToken);

                if (passkey == null || passkey.User.IsDeleted || passkey.User.IsSuspended)
                {
                    return Unauthorized(new { message = "Passkey sign-in failed." });
                }

                var expectedCredentialId = Convert.FromBase64String(passkey.CredentialId);
                var options = AssertionOptions.FromJson(ceremony.OptionsJson);
                var result = await _fido2.MakeAssertionAsync(new MakeAssertionParams
                {
                    AssertionResponse = assertionResponse,
                    OriginalOptions = options,
                    StoredPublicKey = passkey.PublicKey,
                    StoredSignatureCounter = checked((uint)passkey.SignatureCounter),
                    IsUserHandleOwnerOfCredentialIdCallback = (args, _) => Task.FromResult(
                        args.CredentialId.SequenceEqual(expectedCredentialId) &&
                        args.UserHandle.SequenceEqual(passkey.UserHandle))
                }, cancellationToken);

                passkey.SignatureCounter = result.SignCount;
                passkey.LastUsedAt = DateTime.UtcNow;
                passkey.IsBackedUp = result.IsBackedUp;
                passkey.User.LastLogin = DateTime.Now;
                passkey.User.LoginCount++;
                await _dataContext.SaveChangesAsync(cancellationToken);

                var session = await _userService.CreateRefreshSession(passkey.UserId);
                SetRefreshTokenCookie(session.RefreshToken, session.RefreshTokenExpiresAt);

                return Ok(new ServiceResponse<LoadUserDto>
                {
                    Success = true,
                    Data = session.User,
                    Message = "Passkey sign-in successful"
                });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Passkey authentication failed");
                return Unauthorized(new { message = "Passkey sign-in failed." });
            }
        }

        [Authorize]
        [HttpDelete("{id:long}")]
        public async Task<IActionResult> Delete(long id, CancellationToken cancellationToken)
        {
            if (!HasRecentAuthentication())
                return Unauthorized(new { Message = "Please confirm your session again before removing a passkey." });

            var user = await GetCurrentUserAsync();
            if (user == null) return Unauthorized();

            var passkey = await _dataContext.PasskeyCredentials
                .SingleOrDefaultAsync(x => x.Id == id && x.UserId == user.Id, cancellationToken);
            if (passkey == null) return NotFound(new { message = "Passkey not found." });

            _dataContext.PasskeyCredentials.Remove(passkey);
            await _dataContext.SaveChangesAsync(cancellationToken);
            return NoContent();
        }

        private bool HasRecentAuthentication()
        {
            var issuedAtValue = User.FindFirst("iat")?.Value;
            if (!long.TryParse(issuedAtValue, out var issuedAtSeconds)) return false;

            var age = DateTimeOffset.UtcNow - DateTimeOffset.FromUnixTimeSeconds(issuedAtSeconds);
            return age >= TimeSpan.Zero && age <= RecentAuthenticationWindow;
        }

        private async Task<LoadUserDto?> GetCurrentUserAsync()
        {
            var response = await _userService.LoadUser();
            return response.Success ? response.Data : null;
        }

        private async Task<PasskeyCeremony?> ConsumeCeremonyAsync(
            Guid ceremonyId,
            string type,
            long? userId,
            CancellationToken cancellationToken)
        {
            var ceremony = await _dataContext.PasskeyCeremonies.SingleOrDefaultAsync(x =>
                x.Id == ceremonyId && x.Type == type && x.UserId == userId, cancellationToken);

            if (ceremony == null) return null;

            _dataContext.PasskeyCeremonies.Remove(ceremony);
            await _dataContext.SaveChangesAsync(cancellationToken);
            return ceremony.ExpiresAt > DateTime.UtcNow ? ceremony : null;
        }

        private async Task RemoveExpiredCeremoniesAsync(CancellationToken cancellationToken)
        {
            var expired = await _dataContext.PasskeyCeremonies
                .Where(x => x.ExpiresAt <= DateTime.UtcNow)
                .OrderBy(x => x.ExpiresAt)
                .Take(100)
                .ToListAsync(cancellationToken);
            if (expired.Count == 0) return;

            _dataContext.PasskeyCeremonies.RemoveRange(expired);
            await _dataContext.SaveChangesAsync(cancellationToken);
        }

        private static string HashCredentialId(byte[] credentialId) =>
            Convert.ToHexString(SHA256.HashData(credentialId));

        private static JsonElement ParseWebAuthnOptions(string optionsJson)
        {
            using var document = JsonDocument.Parse(optionsJson);
            return document.RootElement.Clone();
        }

        private static T ParseWebAuthnResponse<T>(JsonElement response)
        {
            var payload = JsonNode.Parse(response.GetRawText()) as JsonObject
                ?? throw new JsonException("The WebAuthn response must be a JSON object.");

            // Browsers correctly return the WebAuthn protocol value "public-key". Normalize it
            // to the enum's numeric value before Fido2 deserialization so ASP.NET's JSON model
            // binding cannot reject the hyphenated protocol string.
            if (payload["type"]?.GetValue<string>() == "public-key")
                payload["type"] = (int)PublicKeyCredentialType.PublicKey;

            return payload.Deserialize<T>()
                ?? throw new JsonException("The WebAuthn response could not be parsed.");
        }

        private static string NormalizeName(string? name)
        {
            var normalized = string.IsNullOrWhiteSpace(name) ? "Passkey" : name.Trim();
            return normalized.Length <= 100 ? normalized : normalized[..100];
        }

        private void SetRefreshTokenCookie(string refreshToken, DateTime expiresAt)
        {
            Response.Cookies.Append("refreshToken", refreshToken, new CookieOptions
            {
                HttpOnly = true,
                Secure = Request.IsHttps,
                SameSite = Request.IsHttps ? SameSiteMode.None : SameSiteMode.Lax,
                Expires = expiresAt,
                Path = "/api/user"
            });
        }
    }

    public sealed record PasskeyOptionsDto(Guid CeremonyId, JsonElement Options);
    public sealed record PasskeySummaryDto(long Id, string Name, DateTime CreatedAt, DateTime? LastUsedAt, bool IsBackedUp);
    public sealed record PasskeyRegistrationRequest(Guid CeremonyId, JsonElement Response, string? Name);
    public sealed record PasskeyAuthenticationRequest(Guid CeremonyId, JsonElement Response);
}
