using brownstone_hub_api.Domain.Screening;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace brownstone_hub_api.Services.Screening;

public static class ScreeningServiceCollectionExtensions
{
    /// <summary>
    /// Registers the tenant-screening orchestration graph with unavailable adapters for every
    /// external dependency. This permits startup and diagnostics while all screening operations
    /// remain fail closed until production adapters explicitly replace these registrations.
    /// </summary>
    public static IServiceCollection AddFailClosedTenantScreening(this IServiceCollection services, IConfiguration? configuration = null)
    {
        services.TryAddSingleton<TimeProvider>(TimeProvider.System);
        services.TryAddSingleton(new ScreeningWebhookProcessingOptions());

        var workerOptions = services.AddOptions<ScreeningHostedWorkerOptions>();
        if (configuration is not null)
            workerOptions.Bind(configuration.GetSection(ScreeningHostedWorkerOptions.SectionName));
        workerOptions
            .Validate(options => ScreeningHostedWorkerOptions.Validate(options) is null,
                "Screening hosted-worker options contain an unsafe or unbounded value.")
            .ValidateOnStart();

        services.TryAddScoped<IScreeningPropertyAuthority, ScreeningPropertyAuthority>();
        services.TryAddScoped<TenantScreeningService>();
        services.TryAddScoped<ITenantScreeningService>(provider => provider.GetRequiredService<TenantScreeningService>());
        services.TryAddScoped<ITenantScreeningDecisionService, TenantScreeningDecisionService>();
        services.TryAddScoped<IScreeningSupportElevationService, ScreeningSupportElevationService>();
        services.TryAddScoped<TenantScreeningAdverseActionService>();
        services.TryAddScoped<ITenantScreeningAdverseActionService>(provider =>
            provider.GetRequiredService<TenantScreeningAdverseActionService>());
        services.TryAddScoped<ITenantScreeningRetentionService, TenantScreeningRetentionService>();
        services.TryAddScoped<IScreeningIncidentRecorder, ScreeningIncidentRecorder>();
        services.TryAddScoped<IScreeningSchemaReadiness, ScreeningSchemaReadiness>();

        services.TryAddSingleton<IScreeningProviderGateway, UnavailableScreeningProviderGateway>();
        services.TryAddSingleton<IScreeningPolicyResolver, UnavailableScreeningPolicyResolver>();
        services.TryAddSingleton<IScreeningQuoteOptionsResolver, UnavailableScreeningQuoteOptionsResolver>();
        services.TryAddSingleton<IScreeningCallbackVerifier, UnavailableScreeningCallbackVerifier>();
        services.TryAddSingleton<IScreeningApplicantInvitationDelivery, UnavailableScreeningApplicantInvitationDelivery>();
        services.TryAddSingleton<IScreeningApplicantLinkFactory, UnavailableScreeningApplicantLinkFactory>();
        services.TryAddSingleton<IScreeningSupportAuthorization, DenyAllScreeningSupportAuthorization>();
        services.TryAddSingleton<IAdverseActionPolicyResolver, UnavailableAdverseActionPolicyResolver>();
        services.TryAddSingleton<IScreeningNoticeDelivery, UnavailableScreeningNoticeDelivery>();

        services.TryAddScoped<ScreeningWebhookInboxCycle>();
        services.TryAddScoped<ScreeningProviderPollingCycle>();
        services.TryAddScoped<ScreeningAdverseActionDeliveryCycle>();
        services.TryAddScoped<ScreeningRetentionCycle>();
        services.TryAddScoped<ScreeningCancellationRecoveryCycle>();
        services.TryAddScoped<ScreeningDisputeRecoveryCycle>();
        services.TryAddScoped<ScreeningReportAccessRecoveryCycle>();
        services.AddHostedService<ScreeningWebhookInboxBackgroundService>();
        services.AddHostedService<ScreeningProviderPollingBackgroundService>();
        services.AddHostedService<ScreeningAdverseActionDeliveryBackgroundService>();
        services.AddHostedService<ScreeningRetentionBackgroundService>();
        services.AddHostedService<ScreeningCancellationRecoveryBackgroundService>();
        services.AddHostedService<ScreeningDisputeRecoveryBackgroundService>();
        services.AddHostedService<ScreeningReportAccessRecoveryBackgroundService>();

        return services;
    }
}
