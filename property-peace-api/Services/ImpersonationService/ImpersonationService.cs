using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Impersonation;
using brownstone_hub_api.Services.UserService;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace brownstone_hub_api.Services.ImpersonationService
{
    public interface IImpersonationService
    {
        Task<ImpersonationTokenDto> StartAsync(StartImpersonationDto request, ClaimsPrincipal principal, string? ipAddress, string? userAgent);
        Task<ImpersonationStatusDto> GetStatusAsync(ClaimsPrincipal principal);
        Task<ImpersonationTokenDto> RefreshAsync(string refreshToken, string? ipAddress, string? userAgent);
        Task<(StopImpersonationDto Response, string RefreshToken, DateTime RefreshTokenExpiresAt)> StopAsync(ClaimsPrincipal principal, string actorRefreshToken, string? ipAddress, string? userAgent);
        Task<bool> ValidateAccessTokenSessionAsync(ClaimsPrincipal principal);
    }

    public sealed class ImpersonationException(int statusCode, string message) : Exception(message)
    {
        public int StatusCode { get; } = statusCode;
    }

    public class ImpersonationService(
        DataContext dataContext,
        IUserService userService,
        IConfiguration configuration,
        ImpersonationConnectionRegistry connectionRegistry) : IImpersonationService
    {
        private const int SessionMinutes = 30;
        private const int AccessTokenMinutes = 15;
        private readonly DataContext _dataContext = dataContext;
        private readonly IUserService _userService = userService;
        private readonly IConfiguration _configuration = configuration;
        private readonly ImpersonationConnectionRegistry _connectionRegistry = connectionRegistry;

        public async Task<ImpersonationTokenDto> StartAsync(
            StartImpersonationDto request,
            ClaimsPrincipal principal,
            string? ipAddress,
            string? userAgent)
        {
            var actor = await FindOrdinaryActorAsync(principal);
            if (actor == null || !IsActive(actor) || !HasRole(actor, "Admin"))
            {
                await AuditAsync(null, actor?.Id, null, "start", "rejected", "Actor is not an active application-role Admin.", ipAddress, userAgent);
                throw new ImpersonationException(StatusCodes.Status403Forbidden, "Only an active application-role Admin may impersonate a user.");
            }

            if (string.IsNullOrWhiteSpace(request.Reason))
            {
                await AuditAsync(null, actor.Id, null, "start", "rejected", "A reason was not supplied.", ipAddress, userAgent);
                throw new ImpersonationException(StatusCodes.Status400BadRequest, "A reason is required.");
            }

            var target = await UserWithRoles(request.TargetUserId);
            if (target == null)
            {
                await AuditAsync(null, actor.Id, null, "start", "rejected", $"Target user {request.TargetUserId} was not found.", ipAddress, userAgent);
                throw new ImpersonationException(StatusCodes.Status404NotFound, "Target user was not found.");
            }

            if (target.Id == actor.Id || !IsActive(target) || HasRole(target, "Admin"))
            {
                await AuditAsync(null, actor.Id, target.Id, "start", "rejected", "Target must be a different, active, non-Admin user.", ipAddress, userAgent);
                throw new ImpersonationException(StatusCodes.Status400BadRequest, "Target must be a different, active, non-Admin user.");
            }

            var now = DateTime.UtcNow;
            var session = new ImpersonationSession
            {
                ActorUserId = actor.Id,
                TargetUserId = target.Id,
                Reason = request.Reason.Trim(),
                SupportReference = string.IsNullOrWhiteSpace(request.SupportReference) ? null : request.SupportReference.Trim(),
                StartedAt = now,
                ExpiresAt = now.AddMinutes(SessionMinutes)
            };
            var refreshToken = GenerateRefreshToken(session.Id);
            session.RefreshTokenHash = Hash(refreshToken);

            // Fully prepare the response before persisting an active session/success audit. A mapping or
            // signing failure must not leave an active session that the caller never received.
            var response = await CreateTokenResponse(session, target, refreshToken);
            _dataContext.ImpersonationSessions.Add(session);
            AddAudit(session.Id, actor.Id, target.Id, "start", "succeeded", null, ipAddress, userAgent);
            await _dataContext.SaveChangesAsync();

            return response;
        }

        public async Task<ImpersonationStatusDto> GetStatusAsync(ClaimsPrincipal principal)
        {
            var session = await GetClaimedSessionAsync(principal);
            if (!await IsSessionValidAsync(session))
            {
                throw new ImpersonationException(StatusCodes.Status401Unauthorized, "Impersonation session is stopped, expired, or invalid.");
            }

            return ToStatus(session!);
        }

        public async Task<ImpersonationTokenDto> RefreshAsync(string refreshToken, string? ipAddress, string? userAgent)
        {
            if (!TryGetSessionId(refreshToken, out var sessionId))
            {
                throw new ImpersonationException(StatusCodes.Status401Unauthorized, "Impersonation refresh token is invalid.");
            }

            var session = await _dataContext.ImpersonationSessions.SingleOrDefaultAsync(item => item.Id == sessionId);
            if (session == null)
            {
                throw new ImpersonationException(StatusCodes.Status401Unauthorized, "Impersonation refresh token is invalid.");
            }

            if (!CryptographicOperations.FixedTimeEquals(
                    Convert.FromHexString(session.RefreshTokenHash),
                    Convert.FromHexString(Hash(refreshToken))))
            {
                var suppliedHash = Hash(refreshToken);
                if (session.PreviousRefreshTokenHash != null &&
                    CryptographicOperations.FixedTimeEquals(Convert.FromHexString(session.PreviousRefreshTokenHash), Convert.FromHexString(suppliedHash)))
                {
                    session.StoppedAt ??= DateTime.UtcNow;
                    session.StopReason ??= "refresh-token-reuse";
                    AddAudit(session.Id, session.ActorUserId, session.TargetUserId, "refresh", "rejected", "A previously consumed refresh token was reused; session revoked.", ipAddress, userAgent);
                    await _dataContext.SaveChangesAsync();
                    _connectionRegistry.AbortSession(session.Id);
                    throw new ImpersonationException(StatusCodes.Status401Unauthorized, "Impersonation refresh token is invalid.");
                }

                // A random token containing a real session id is not evidence of reuse. Deny and audit it,
                // but do not let an attacker revoke the victim's session.
                AddAudit(session.Id, session.ActorUserId, session.TargetUserId, "refresh", "rejected", "Refresh token hash did not match the current token.", ipAddress, userAgent);
                await _dataContext.SaveChangesAsync();
                throw new ImpersonationException(StatusCodes.Status401Unauthorized, "Impersonation refresh token is invalid.");
            }

            if (!await IsSessionValidAsync(session))
            {
                AddAudit(session.Id, session.ActorUserId, session.TargetUserId, "refresh", "rejected", "Session is stopped, expired, or users are no longer eligible.", ipAddress, userAgent);
                await _dataContext.SaveChangesAsync();
                throw new ImpersonationException(StatusCodes.Status401Unauthorized, "Impersonation session is stopped, expired, or invalid.");
            }

            var target = await UserWithRoles(session.TargetUserId) ?? throw new ImpersonationException(StatusCodes.Status401Unauthorized, "Target user is unavailable.");
            var replacement = GenerateRefreshToken(session.Id);
            var replacementHash = Hash(replacement);
            var priorHash = session.RefreshTokenHash;

            // Prepare mapping and signing before consuming the single-use token. If preparation fails, the
            // current token remains usable and no successful refresh is audited.
            var response = await CreateTokenResponse(session, target, replacement);

            // The conditional rotation and its success audit are one database transaction. If the audit
            // insert fails, disposal rolls the token update back so the caller's token is not consumed.
            var refreshTransaction = await _dataContext.Database.BeginTransactionAsync();
            try
            {
                var rotated = await _dataContext.ImpersonationSessions
                    .Where(item => item.Id == session.Id && item.RefreshTokenHash == priorHash && item.StoppedAt == null && item.ExpiresAt > DateTime.UtcNow)
                    .ExecuteUpdateAsync(update => update
                        .SetProperty(item => item.PreviousRefreshTokenHash, priorHash)
                        .SetProperty(item => item.RefreshTokenHash, replacementHash));
                if (rotated != 1)
                {
                    await refreshTransaction.RollbackAsync();
                    await refreshTransaction.DisposeAsync();
                    refreshTransaction = null;
                    await AuditAsync(session.Id, session.ActorUserId, session.TargetUserId, "refresh", "rejected", "Refresh token was no longer current when rotation was attempted.", ipAddress, userAgent);
                    throw new ImpersonationException(StatusCodes.Status401Unauthorized, "Impersonation refresh token is invalid or no longer current.");
                }

                AddAudit(session.Id, session.ActorUserId, session.TargetUserId, "refresh", "succeeded", null, ipAddress, userAgent);
                await _dataContext.SaveChangesAsync();
                await refreshTransaction.CommitAsync();
            }
            finally
            {
                if (refreshTransaction != null) await refreshTransaction.DisposeAsync();
            }
            return response;
        }

        public async Task<(StopImpersonationDto Response, string RefreshToken, DateTime RefreshTokenExpiresAt)> StopAsync(
            ClaimsPrincipal principal, string actorRefreshToken, string? ipAddress, string? userAgent)
        {
            var session = await GetClaimedSessionAsync(principal);
            if (!await IsSessionValidAsync(session))
            {
                await AuditAsync(
                    session?.Id ?? ClaimedSessionId(principal),
                    session?.ActorUserId ?? ParseUserId(principal.FindFirstValue("actor_user_id")),
                    session?.TargetUserId ?? ParseUserId(principal.FindFirstValue("userId") ?? principal.FindFirstValue(ClaimTypes.NameIdentifier)),
                    "stop", "rejected", "Session was already stopped, expired, or invalid.", ipAddress, userAgent);
                throw new ImpersonationException(StatusCodes.Status401Unauthorized, "Impersonation session is stopped, expired, or invalid.");
            }

            // The bearer and original actor's ordinary HttpOnly refresh session are independent factors.
            Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction? transaction =
                await _dataContext.Database.BeginTransactionAsync();
            try
            {
                var actorSession = await _userService.RotateRefreshSessionForUser(actorRefreshToken, session!.ActorUserId);
                if (actorSession == null)
                {
                    await transaction.RollbackAsync();
                    await transaction.DisposeAsync();
                    transaction = null;
                    _dataContext.ChangeTracker.Clear();
                    await AuditAsync(session.Id, session.ActorUserId, session.TargetUserId, "stop", "rejected", "Original actor refresh session was absent, invalid, or belonged to another user.", ipAddress, userAgent);
                    throw new ImpersonationException(StatusCodes.Status401Unauthorized, "The original administrator session is required to stop impersonation.");
                }

                var stoppedAt = DateTime.UtcNow;
                var stopped = await _dataContext.ImpersonationSessions
                    .Where(item => item.Id == session.Id && item.StoppedAt == null && item.ExpiresAt > stoppedAt)
                    .ExecuteUpdateAsync(update => update
                        .SetProperty(item => item.StoppedAt, stoppedAt)
                        .SetProperty(item => item.StopReason, "actor-stopped"));
                if (stopped != 1)
                {
                    await transaction.RollbackAsync();
                    await transaction.DisposeAsync();
                    transaction = null;
                    _dataContext.ChangeTracker.Clear();
                    await AuditAsync(session.Id, session.ActorUserId, session.TargetUserId, "stop", "rejected", "Session was concurrently stopped or expired.", ipAddress, userAgent);
                    throw new ImpersonationException(StatusCodes.Status401Unauthorized, "Impersonation session is no longer active.");
                }

                AddAudit(session.Id, session.ActorUserId, session.TargetUserId, "stop", "succeeded", null, ipAddress, userAgent);
                await _dataContext.SaveChangesAsync();
                await transaction.CommitAsync();
                _connectionRegistry.AbortSession(session.Id);

                return (new StopImpersonationDto
                {
                    AccessToken = actorSession.User.JWTToken,
                    User = actorSession.User
                }, actorSession.RefreshToken, actorSession.RefreshTokenExpiresAt);
            }
            finally
            {
                if (transaction != null) await transaction.DisposeAsync();
            }
        }

        public async Task<bool> ValidateAccessTokenSessionAsync(ClaimsPrincipal principal)
        {
            if (!string.Equals(principal.FindFirstValue("is_impersonating"), "true", StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }

            var session = await GetClaimedSessionAsync(principal);
            if (!await IsSessionValidAsync(session)) return false;

            return principal.FindFirstValue("actor_user_id") == session!.ActorUserId.ToString()
                && (principal.FindFirstValue("userId") ?? principal.FindFirstValue(ClaimTypes.NameIdentifier)) == session.TargetUserId.ToString();
        }

        private async Task<User?> FindOrdinaryActorAsync(ClaimsPrincipal principal)
        {
            if (string.Equals(principal.FindFirstValue("is_impersonating"), "true", StringComparison.OrdinalIgnoreCase)) return null;
            var stableId = principal.FindFirstValue("userId") ?? principal.FindFirstValue(ClaimTypes.NameIdentifier);
            if (long.TryParse(stableId, out var actorId)) return await UserWithRoles(actorId);

            // Backward compatibility for ordinary JWTs issued before stable numeric identity claims existed.
            var email = principal.FindFirstValue(JwtRegisteredClaimNames.Sub);
            return string.IsNullOrWhiteSpace(email)
                ? null
                : await _dataContext.Users.Include(user => user.UserRoles).ThenInclude(userRole => userRole.Role)
                    .SingleOrDefaultAsync(user => user.Email == email);
        }

        private Task<User?> UserWithRoles(long userId) =>
            _dataContext.Users.Include(user => user.UserRoles).ThenInclude(userRole => userRole.Role)
                .SingleOrDefaultAsync(user => user.Id == userId);

        private async Task<ImpersonationSession?> GetClaimedSessionAsync(ClaimsPrincipal principal)
        {
            return Guid.TryParse(principal.FindFirstValue("impersonation_session_id"), out var id)
                ? await _dataContext.ImpersonationSessions.SingleOrDefaultAsync(session => session.Id == id)
                : null;
        }

        private async Task<bool> IsSessionValidAsync(ImpersonationSession? session)
        {
            if (session == null || session.StoppedAt != null || session.ExpiresAt <= DateTime.UtcNow) return false;
            var actor = await UserWithRoles(session.ActorUserId);
            var target = await UserWithRoles(session.TargetUserId);
            return actor != null && target != null && IsActive(actor) && IsActive(target)
                && HasRole(actor, "Admin") && !HasRole(target, "Admin") && actor.Id != target.Id;
        }

        private async Task<ImpersonationTokenDto> CreateTokenResponse(ImpersonationSession session, User target, string refreshToken)
        {
            var loaded = await _userService.GetUserByIdAsync(target.Id);
            if (!loaded.Success || loaded.Data == null)
            {
                throw new ImpersonationException(StatusCodes.Status500InternalServerError, "Unable to load the effective user.");
            }

            var accessExpiresAt = DateTime.UtcNow.AddMinutes(AccessTokenMinutes);
            if (accessExpiresAt > session.ExpiresAt) accessExpiresAt = session.ExpiresAt;
            loaded.Data.JWTToken = CreateAccessToken(session, target, accessExpiresAt);
            return new ImpersonationTokenDto
            {
                SessionId = session.Id,
                AccessToken = loaded.Data.JWTToken,
                AccessTokenExpiresAt = accessExpiresAt,
                RefreshToken = refreshToken,
                SessionExpiresAt = session.ExpiresAt,
                User = loaded.Data
            };
        }

        private string CreateAccessToken(ImpersonationSession session, User target, DateTime expiresAt)
        {
            var claims = new List<Claim>
            {
                new(JwtRegisteredClaimNames.Sub, target.Email),
                new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
                new(JwtRegisteredClaimNames.Iat, DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(), ClaimValueTypes.Integer64),
                new(ClaimTypes.NameIdentifier, target.Id.ToString()),
                new("userId", target.Id.ToString()),
                new(ClaimTypes.Name, $"{target.FirstName} {target.LastName}".Trim()),
                new("actor_user_id", session.ActorUserId.ToString()),
                new("impersonation_session_id", session.Id.ToString()),
                new("is_impersonating", "true", ClaimValueTypes.Boolean)
            };
            claims.AddRange(target.UserRoles.Select(userRole => new Claim(ClaimTypes.Role, userRole.Role.RoleName)));

            var key = Convert.FromBase64String(_configuration["JwtSettings:SecretKey"] ?? throw new InvalidOperationException("JWT SecretKey is not configured"));
            if (key.Length < 32) throw new InvalidOperationException("JWT secret must be at least 32 bytes.");
            var token = new JwtSecurityToken(
                _configuration["JwtSettings:Issuer"],
                _configuration["JwtSettings:Audience"],
                claims,
                expires: expiresAt,
                signingCredentials: new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256));
            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        private static bool IsActive(User user) => !user.IsDeleted && !user.IsSuspended;
        private static bool HasRole(User user, string role) => user.UserRoles.Any(userRole => string.Equals(userRole.Role.RoleName, role, StringComparison.OrdinalIgnoreCase));
        private static string GenerateRefreshToken(Guid sessionId) => $"{sessionId:N}.{Convert.ToHexString(RandomNumberGenerator.GetBytes(32))}";
        private static string Hash(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
        private static bool TryGetSessionId(string token, out Guid id)
        {
            id = default;
            if (string.IsNullOrWhiteSpace(token)) return false;
            var separator = token.IndexOf('.');
            return separator > 0 && Guid.TryParseExact(token[..separator], "N", out id);
        }

        private static Guid? ClaimedSessionId(ClaimsPrincipal principal) =>
            Guid.TryParse(principal.FindFirstValue("impersonation_session_id"), out var id) ? id : null;

        private static long? ParseUserId(string? value) => long.TryParse(value, out var id) ? id : null;

        private static ImpersonationStatusDto ToStatus(ImpersonationSession session) => new()
        {
            SessionId = session.Id,
            ActorUserId = session.ActorUserId,
            TargetUserId = session.TargetUserId,
            Reason = session.Reason,
            SupportReference = session.SupportReference,
            StartedAt = session.StartedAt,
            ExpiresAt = session.ExpiresAt,
            IsActive = session.StoppedAt == null && session.ExpiresAt > DateTime.UtcNow
        };

        private void AddAudit(Guid? sessionId, long? actorId, long? targetId, string action, string result, string? detail, string? ip, string? userAgent)
        {
            _dataContext.ImpersonationAuditRecords.Add(new ImpersonationAuditRecord
            {
                ImpersonationSessionId = sessionId,
                ActorUserId = actorId,
                TargetUserId = targetId,
                Action = action,
                Result = result,
                Detail = detail,
                IpAddress = Truncate(ip, 64),
                UserAgent = Truncate(userAgent, 512),
                OccurredAt = DateTime.UtcNow
            });
        }

        private async Task AuditAsync(Guid? sessionId, long? actorId, long? targetId, string action, string result, string? detail, string? ip, string? userAgent)
        {
            AddAudit(sessionId, actorId, targetId, action, result, detail, ip, userAgent);
            await _dataContext.SaveChangesAsync();
        }

        private static string? Truncate(string? value, int max) => string.IsNullOrWhiteSpace(value) ? null : value[..Math.Min(value.Length, max)];
    }
}
