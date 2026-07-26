using brownstone_hub_api.Dtos.Lease;
using brownstone_hub_api.Dtos.Property;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.LeaseInstances;
using brownstone_hub_api.Repositories.Leases;
using brownstone_hub_api.Repositories.LeaseTemplates;
using brownstone_hub_api.Repositories.Properties;
using brownstone_hub_api.Repositories.Tenants;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.LeaseGenerationService;
using brownstone_hub_api.Services.OpenAIService;
using brownstone_hub_api.Tests.Helpers;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.LeaseGeneration;

public class LeaseGenerationServiceTests
{
    [Fact]
    public async Task FinishLeaseAgreement_PropagatesDisclosureFailureAndDoesNotFinalize()
    {
        const long organizationId = 7;
        const long leaseId = 42;
        var lease = new LoadLeaseDto { Id = leaseId, OrganizationId = organizationId, PropertyId = 8 };
        var property = new LoadPropertyDto { Id = 8, OrganizationId = organizationId, State = "NC" };
        var instances = new Mock<ILeaseInstanceRepository>();
        instances.Setup(x => x.CreateLeaseInstanceAsync(It.IsAny<LeaseInstance>(), organizationId))
            .ReturnsAsync((LeaseInstance value, long _) => { value.Id = 101; return value; });
        var leases = new Mock<ILeaseRepository>();
        leases.Setup(x => x.GetLeaseById(leaseId, organizationId)).ReturnsAsync(lease);
        var properties = new Mock<IPropertyRepository>();
        properties.Setup(x => x.GetPropertyById(8)).ReturnsAsync(property);
        var tenants = new Mock<ITenantRepository>();
        tenants.Setup(x => x.GetTenantsByLeaseId(leaseId)).ReturnsAsync([]);
        var templates = new Mock<ILeaseTemplateRepository>();
        var template = new LeaseTemplate { Id = 3, Version = "1.0", IsDefaultForLandlord = true, TemplateStructure = "{}" };
        templates.Setup(x => x.GetTemplatesByOrganizationAsync(organizationId)).ReturnsAsync([template]);
        templates.Setup(x => x.GetTemplateByIdAsync(3, organizationId)).ReturnsAsync(template);
        var disclosures = new Mock<IStateRequiredDisclosureService>();
        disclosures.Setup(x => x.GenerateAsync("NC", It.IsAny<CancellationToken>()))
            .ReturnsAsync(ServiceResponse<StateRequiredDisclosureResult>.CreateError(
                "State disclosure corpus unavailable", "No trustworthy corpus", statusCode: 422));
        var context = new DefaultHttpContext();
        context.Items["UserId"] = 5L;

        var service = new LeaseGenerationService(
            instances.Object, leases.Object, properties.Object, tenants.Object, templates.Object,
            Mock.Of<IUserRepository>(), new HttpContextAccessor { HttpContext = context }, Mock.Of<IOpenAIService>(),
            disclosures.Object, NullLogger<LeaseGenerationService>.Instance, MapperFactory.Create());

        var result = await service.FinishLeaseAgreementAsync(leaseId, organizationId);

        result.Success.Should().BeFalse();
        result.Message.Should().Be("State disclosure corpus unavailable");
        result.StatusCode.Should().Be(422);
        instances.Verify(x => x.UpdateLeaseInstanceAsync(It.IsAny<LeaseInstance>(), It.IsAny<long>()), Times.Never);
    }

    [Fact]
    public async Task FinalizeLeaseInstance_FailsClosedWhenPlaceholderValidationErrors()
    {
        const long organizationId = 7;
        var instance = new LeaseInstance
        {
            Id = 101, LeaseId = 42, LeaseTemplateId = 3, GeneratedBy = 5,
            Variables =
            [
                new LeaseVariable { VariableKey = "Lease.StartDate", VariableValue = "08/01/2026" },
                new LeaseVariable { VariableKey = "Lease.EndDate", VariableValue = "07/31/2027" },
                new LeaseVariable { VariableKey = "Lease.MonthlyRent", VariableValue = "¤1,500.00" },
                new LeaseVariable { VariableKey = "Lease.SecurityDeposit", VariableValue = "¤0.00" },
                new LeaseVariable { VariableKey = "Lease.RentDueDay", VariableValue = "1" },
                new LeaseVariable { VariableKey = "State.RequiredDisclosures", VariableValue = "quote" },
                new LeaseVariable { VariableKey = "State.RequiredDisclosureCitations", VariableValue = "[]" },
                new LeaseVariable { VariableKey = "State.RequiredDisclosureSnapshotUtc", VariableValue = "now" }
            ]
        };
        var instances = new Mock<ILeaseInstanceRepository>();
        instances.Setup(x => x.GetLeaseInstanceByIdAsync(101, organizationId)).ReturnsAsync(instance);
        var templates = new Mock<ILeaseTemplateRepository>();
        templates.SetupSequence(x => x.GetTemplateByIdAsync(3, organizationId))
            .ReturnsAsync(new LeaseTemplate { Id = 3, TemplateStructure = "{}" })
            .ThrowsAsync(new InvalidOperationException("template store unavailable"));
        var service = new LeaseGenerationService(
            instances.Object, Mock.Of<ILeaseRepository>(), Mock.Of<IPropertyRepository>(), Mock.Of<ITenantRepository>(),
            templates.Object, Mock.Of<IUserRepository>(), new HttpContextAccessor(), Mock.Of<IOpenAIService>(),
            Mock.Of<IStateRequiredDisclosureService>(), NullLogger<LeaseGenerationService>.Instance, MapperFactory.Create());

        var result = await service.FinalizeLeaseInstanceAsync(101, organizationId);

        result.Success.Should().BeFalse();
        result.Message.Should().MatchRegex("(?i)validating placeholders");
        instances.Verify(x => x.UpdateLeaseInstanceAsync(It.IsAny<LeaseInstance>(), It.IsAny<long>()), Times.Never);
        instance.IsFinalized.Should().BeFalse();
    }

    [Fact]
    public async Task PrepareLeaseInstance_RejectsMissingSubstantiveTermsBeforeDisclosureOrFinalization()
    {
        const long organizationId = 7;
        var instance = new LeaseInstance { Id = 101, LeaseId = 42, LeaseTemplateId = 3, GeneratedBy = 5, Variables = [] };
        var instances = new Mock<ILeaseInstanceRepository>();
        instances.Setup(x => x.GetLeaseInstanceByIdAsync(101, organizationId)).ReturnsAsync(instance);
        var disclosures = new Mock<IStateRequiredDisclosureService>();
        var service = new LeaseGenerationService(
            instances.Object, Mock.Of<ILeaseRepository>(), Mock.Of<IPropertyRepository>(), Mock.Of<ITenantRepository>(),
            Mock.Of<ILeaseTemplateRepository>(), Mock.Of<IUserRepository>(), new HttpContextAccessor(), Mock.Of<IOpenAIService>(),
            disclosures.Object, NullLogger<LeaseGenerationService>.Instance, MapperFactory.Create());

        var result = await service.PrepareLeaseInstanceForFinalizationAsync(101, organizationId);

        result.Success.Should().BeFalse();
        result.StatusCode.Should().Be(422);
        result.Errors!.Details.Should().MatchRegex("(?i)start date");
        disclosures.Verify(x => x.GenerateAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        instances.Verify(x => x.MarkFinalizedAsync(It.IsAny<long>(), It.IsAny<long>()), Times.Never);
    }

    [Fact]
    public async Task PrepareLeaseInstance_AcceptsZeroDepositAndExplicitNegativePolicies()
    {
        const long organizationId = 7;
        var instance = new LeaseInstance
        {
            Id = 101, LeaseId = 42, LeaseTemplateId = 3, GeneratedBy = 5,
            Variables =
            [
                new LeaseVariable { VariableKey = "Lease.StartDate", VariableValue = "08/01/2026" },
                new LeaseVariable { VariableKey = "Lease.EndDate", VariableValue = "07/31/2027" },
                new LeaseVariable { VariableKey = "Lease.MonthlyRent", VariableValue = "¤1,500.00" },
                new LeaseVariable { VariableKey = "Lease.SecurityDeposit", VariableValue = "¤0.00" },
                new LeaseVariable { VariableKey = "Lease.RentDueDay", VariableValue = "1" },
                new LeaseVariable { VariableKey = "Pets.Allowed", VariableValue = "No" },
                new LeaseVariable { VariableKey = "Smoking.Policy", VariableValue = "No smoking is permitted." },
                new LeaseVariable { VariableKey = "State.RequiredDisclosures", VariableValue = "quote" },
                new LeaseVariable { VariableKey = "State.RequiredDisclosureCitations", VariableValue = "[]" },
                new LeaseVariable { VariableKey = "State.RequiredDisclosureSnapshotUtc", VariableValue = "now" }
            ]
        };
        var template = new LeaseTemplate { Id = 3, TemplateStructure = "{{Pets.Allowed}} {{Smoking.Policy}}" };
        var instances = new Mock<ILeaseInstanceRepository>();
        instances.Setup(x => x.GetLeaseInstanceByIdAsync(101, organizationId)).ReturnsAsync(instance);
        var templates = new Mock<ILeaseTemplateRepository>();
        templates.Setup(x => x.GetTemplateByIdAsync(3, organizationId)).ReturnsAsync(template);
        var service = new LeaseGenerationService(
            instances.Object, Mock.Of<ILeaseRepository>(), Mock.Of<IPropertyRepository>(), Mock.Of<ITenantRepository>(),
            templates.Object, Mock.Of<IUserRepository>(), new HttpContextAccessor(), Mock.Of<IOpenAIService>(),
            Mock.Of<IStateRequiredDisclosureService>(), NullLogger<LeaseGenerationService>.Instance, MapperFactory.Create());

        var result = await service.PrepareLeaseInstanceForFinalizationAsync(101, organizationId);

        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task FinishLeaseAgreement_ReusesCanonicalFinalizedInstance()
    {
        const long organizationId = 7;
        const long leaseId = 42;
        var canonical = new LeaseInstance
        {
            Id = 99,
            LeaseId = leaseId,
            LeaseTemplateId = 3,
            TemplateVersion = "1.0",
            GeneratedBy = 5,
            IsDraft = false,
            IsFinalized = true,
            FinalizedAt = DateTime.UtcNow
        };

        var instances = new Mock<ILeaseInstanceRepository>();
        instances.Setup(r => r.GetFinalizedLeaseInstanceByLeaseIdAsync(leaseId, organizationId))
            .ReturnsAsync(canonical);
        var leases = new Mock<ILeaseRepository>();
        leases.Setup(r => r.GetLeaseById(leaseId, organizationId))
            .ReturnsAsync(new LoadLeaseDto { Id = leaseId, OrganizationId = organizationId });

        var service = new LeaseGenerationService(
            instances.Object,
            leases.Object,
            Mock.Of<IPropertyRepository>(),
            Mock.Of<ITenantRepository>(),
            Mock.Of<ILeaseTemplateRepository>(),
            Mock.Of<IUserRepository>(),
            new HttpContextAccessor(),
            Mock.Of<IOpenAIService>(),
            Mock.Of<IStateRequiredDisclosureService>(),
            NullLogger<LeaseGenerationService>.Instance,
            MapperFactory.Create());

        var first = await service.FinishLeaseAgreementAsync(leaseId, organizationId);
        var retry = await service.FinishLeaseAgreementAsync(leaseId, organizationId);

        first.Success.Should().BeTrue();
        retry.Success.Should().BeTrue();
        first.Data!.Id.Should().Be(canonical.Id);
        retry.Data!.Id.Should().Be(canonical.Id);
        instances.Verify(r => r.CreateLeaseInstanceAsync(It.IsAny<LeaseInstance>(), It.IsAny<long>()), Times.Never);
        instances.Verify(r => r.UpdateLeaseInstanceAsync(It.IsAny<LeaseInstance>(), It.IsAny<long>()), Times.Never);
    }
}
