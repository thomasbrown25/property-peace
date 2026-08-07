using brownstone_hub_api.Config;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.SubscriptionService;
using Microsoft.Extensions.Options;

namespace brownstone_hub_api.Services.FeatureReadiness;

public interface IFeatureReadinessService
{
    Task<IReadOnlyList<FeatureReadinessDto>> GetAllAsync(long userId, long? organizationId);
    Task<FeatureReadinessDto> GetAsync(long userId, long? organizationId, string feature);
}

public sealed class FeatureReadinessService(
    IOptionsSnapshot<FeatureReadinessOptions> options,
    IConfiguration configuration,
    IFeatureGateService featureGateService,
    IUserRepository userRepository,
    ILogger<FeatureReadinessService> logger) : IFeatureReadinessService
{
    public async Task<IReadOnlyList<FeatureReadinessDto>> GetAllAsync(long userId, long? organizationId)
    {
        var results = new List<FeatureReadinessDto>(FeatureKeys.All.Count);
        foreach (var feature in FeatureKeys.All)
            results.Add(await GetAsync(userId, organizationId, feature));
        return results;
    }

    public async Task<FeatureReadinessDto> GetAsync(long userId, long? organizationId, string feature)
    {
        if (!FeatureKeys.All.Contains(feature, StringComparer.OrdinalIgnoreCase))
            return FeatureReadinessEvaluator.Evaluate(feature, FeatureReadinessState.Unavailable, false, false, false, false);

        try
        {
            var canonicalFeature = FeatureKeys.All.First(key => key.Equals(feature, StringComparison.OrdinalIgnoreCase));
            var user = await userRepository.GetUser(userId);
            var roles = user?.UserRoles.Select(userRole => userRole.Role?.RoleName).ToList() ?? [];
            var isStaff = roles.Any(role =>
                string.Equals(role, "Landlord", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase));
            var authorized = isStaff;
            var state = options.Value.GetState(canonicalFeature);
            // Aggregate readiness has no lease-scoped entitlement context. Do not infer tenant
            // payment access from a user subscription or globally enable rent movement.
            if (canonicalFeature == FeatureKeys.OnlineRentCollection &&
                state is FeatureReadinessState.Available or FeatureReadinessState.Pilot)
                state = FeatureReadinessState.Suspended;

            // The request's canonical organization is supplied explicitly by callers from
            // OrganizationContextMiddleware. Never fall back to the user's persisted current org:
            // one user can be a member of multiple organizations with different rollout status.
            var organizationReady = organizationId is > 0 &&
                                    (state != FeatureReadinessState.Pilot ||
                                     options.Value.IsPilotOrganization(canonicalFeature, organizationId.Value));
            var entitled = await featureGateService.HasPlanFeatureAccessAsync(userId, canonicalFeature);

            return FeatureReadinessEvaluator.Evaluate(
                canonicalFeature,
                state,
                entitled,
                organizationReady,
                IsProviderConfigured(canonicalFeature),
                authorized);
        }
        catch (Exception ex)
        {
            logger.LogError(ex,
                "Failed to evaluate readiness for feature {Feature}, user {UserId}, and organization {OrganizationId}",
                feature, userId, organizationId);
            return FeatureReadinessEvaluator.Evaluate(feature, FeatureReadinessState.Unavailable, false, false, false, false);
        }
    }

    private bool IsProviderConfigured(string feature) => feature switch
    {
        FeatureKeys.TenantScreening =>
            configuration.GetValue<bool>("RentSpree:EnableBackgroundChecks") &&
            HasValue("RentSpree:ApiKey") && HasValue("RentSpree:ApiSecret"),
        FeatureKeys.ListingSyndication => configuration.GetValue<bool>("FeatureProviders:ListingSyndication:Configured"),
        FeatureKeys.ESignature => HasValue("DocuSign:IntegrationKey") && HasValue("DocuSign:UserId") &&
                                  HasValue("DocuSign:AccountId") &&
                                  (HasReadableFile("DocuSign:PrivateKeyPath") || HasValue("DocuSign:PrivateKeyContent")),
        FeatureKeys.OnlineRentCollection => configuration.GetValue<bool>("Stripe:RentPaymentsEnabled") &&
                                                   HasValue("Stripe:SecretKey"),
        FeatureKeys.DedicatedSmsNumber => HasValue("Twilio:AccountSid") && HasValue("Twilio:AuthToken") &&
                                                 (HasValue("Twilio:FromPhoneNumber") || HasValue("Twilio:MessagingServiceSid")),
        FeatureKeys.Percy => HasValue("Anthropic:ApiKey") || HasValue("OpenAI:ApiKey"),
        _ => false,
    };

    private bool HasValue(string key)
    {
        var value = configuration[key];
        return !string.IsNullOrWhiteSpace(value) &&
               !value.Equals("[REDACTED]", StringComparison.OrdinalIgnoreCase) &&
               !value.Equals("changeme", StringComparison.OrdinalIgnoreCase);
    }

    private bool HasReadableFile(string key)
    {
        var path = configuration[key];
        if (string.IsNullOrWhiteSpace(path)) return false;

        try
        {
            using var stream = System.IO.File.Open(path, FileMode.Open, FileAccess.Read, FileShare.Read);
            return stream.CanRead;
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or ArgumentException or NotSupportedException)
        {
            return false;
        }
    }
}
