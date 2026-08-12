using brownstone_hub_api.Data;
using brownstone_hub_api.Domain.Screening;
using brownstone_hub_api.Dtos.Application;
using brownstone_hub_api.Dtos.BackgroundCheck;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Applications;
using brownstone_hub_api.Services.BackgroundCheckService;
using brownstone_hub_api.Services.Screening;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Screening;

public sealed class ScreeningContainmentAndDiTests
{
    private static readonly string[] ForbiddenApplicationScreeningNames =
    [
        "Ssn", "SocialSecurityNumber", "BackgroundCheckRequested", "BackgroundCheckRequestedAt",
        "BackgroundCheckProvider", "BackgroundCheckRequestId", "BackgroundCheckStatus", "BackgroundCheckCompletedAt",
        "CreditScore", "PassedCreditCheck", "PassedCriminalCheck", "PassedEvictionCheck", "PassedIncomeVerification",
        "BackgroundCheckReportUrl", "BackgroundCheckSummary", "BackgroundCheckOverallPass", "BackgroundCheckRejectionReason"
    ];

    [Fact]
    public void Active_application_contracts_and_entity_expose_no_ssn_or_legacy_screening_state()
    {
        foreach (var type in new[]
                 {
                     typeof(AddRentalApplicationDto), typeof(UpdateRentalApplicationDto),
                     typeof(LoadRentalApplicationDto), typeof(RentalApplication)
                 })
        {
            type.GetProperties().Select(x => x.Name).Should().NotIntersectWith(ForbiddenApplicationScreeningNames,
                $"{type.Name} must not bind, persist, or expose legacy screening data");
        }
    }

    [Fact]
    public void Provider_and_legacy_service_request_contracts_cannot_receive_ssn()
    {
        typeof(RentSpreeRequestDto).GetProperties().Select(x => x.Name)
            .Should().NotContain(x => x.Contains("Ssn", StringComparison.OrdinalIgnoreCase) ||
                                      x.Contains("SocialSecurity", StringComparison.OrdinalIgnoreCase));

        typeof(IBackgroundCheckService).GetMethods().SelectMany(x => x.GetParameters())
            .Should().NotContain(x => x.Name!.Contains("ssn", StringComparison.OrdinalIgnoreCase) ||
                                      x.ParameterType.GetProperties().Any(p =>
                                          p.Name.Contains("Ssn", StringComparison.OrdinalIgnoreCase) ||
                                          p.Name.Contains("SocialSecurity", StringComparison.OrdinalIgnoreCase)));
    }

    [Fact]
    public void Application_repository_writes_only_the_contained_update_contract()
    {
        var update = typeof(IApplicationRepository).GetMethod(nameof(IApplicationRepository.UpdateApplication));
        update.Should().NotBeNull();
        update!.GetParameters().Should().ContainSingle()
            .Which.ParameterType.Should().Be<UpdateRentalApplicationDto>();
        update.GetParameters()[0].ParameterType.GetProperties().Select(x => x.Name)
            .Should().NotIntersectWith(ForbiddenApplicationScreeningNames);
    }

    [Fact]
    public void Fail_closed_screening_graph_resolves_without_selecting_rentspree()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddDbContext<DataContext>(options => options.UseInMemoryDatabase(Guid.NewGuid().ToString()));
        services.AddSingleton(TimeProvider.System);
        services.AddFailClosedTenantScreening();

        using var provider = services.BuildServiceProvider(new ServiceProviderOptions { ValidateOnBuild = true, ValidateScopes = true });
        using var scope = provider.CreateScope();
        var scoped = scope.ServiceProvider;

        scoped.GetRequiredService<ITenantScreeningService>().Should().BeOfType<TenantScreeningService>();
        scoped.GetRequiredService<ITenantScreeningDecisionService>().Should().BeOfType<TenantScreeningDecisionService>();
        scoped.GetRequiredService<ITenantScreeningAdverseActionService>().Should().BeOfType<TenantScreeningAdverseActionService>();
        scoped.GetRequiredService<ITenantScreeningRetentionService>().Should().BeOfType<TenantScreeningRetentionService>();
        scoped.GetRequiredService<IScreeningIncidentRecorder>().Should().BeOfType<ScreeningIncidentRecorder>();
        scoped.GetRequiredService<ScreeningWebhookProcessingOptions>().Should().NotBeNull();
        scoped.GetRequiredService<IScreeningProviderGateway>().Should().BeOfType<UnavailableScreeningProviderGateway>();
        scoped.GetRequiredService<IScreeningPolicyResolver>().Should().BeOfType<UnavailableScreeningPolicyResolver>();
        scoped.GetRequiredService<IScreeningCallbackVerifier>().Should().BeOfType<UnavailableScreeningCallbackVerifier>();
        scoped.GetRequiredService<IScreeningApplicantInvitationDelivery>().Should().BeOfType<UnavailableScreeningApplicantInvitationDelivery>();
        scoped.GetRequiredService<IScreeningApplicantLinkFactory>().Should().BeOfType<UnavailableScreeningApplicantLinkFactory>();
        scoped.GetRequiredService<IAdverseActionPolicyResolver>().Should().BeOfType<UnavailableAdverseActionPolicyResolver>();
        scoped.GetRequiredService<IScreeningNoticeDelivery>().Should().BeOfType<UnavailableScreeningNoticeDelivery>();
        scoped.GetService<IRentSpreeService>().Should().BeNull("the new screening gateway must never fall back to RentSpree");
    }
}
