using Azure.Storage.Blobs;
using brownstone_hub_api.Dtos.Lease;
using brownstone_hub_api.Repositories.LeaseInstances;
using brownstone_hub_api.Repositories.Leases;
using brownstone_hub_api.Repositories.LeaseTemplates;
using brownstone_hub_api.Repositories.TenantDocuments;
using brownstone_hub_api.Services.LeaseAutoRenewService;
using brownstone_hub_api.Services.LeaseDocumentService;
using brownstone_hub_api.Services.LeaseGenerationService;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Leases;

public sealed class LeaseAutoRenewServiceTests
{
    private const long LeaseId = 42;
    private const long OrganizationId = 7;

    [Fact]
    public async Task ProcessAutoRenewalsAsync_ExtendsMonthToMonthLeaseAtFifteenDayThresholdWithoutReplacingIt()
    {
        var asOf = new DateTime(2026, 2, 13);
        var currentEnd = new DateTime(2026, 2, 28);
        var repository = CreateRepository(new LoadLeaseDto
        {
            Id = LeaseId,
            OrganizationId = OrganizationId,
            StartDate = new DateTime(2026, 1, 31),
            EndDate = currentEnd,
            LeaseLength = -1,
            AutoRenewLease = true,
            AutoRenewLeaseLength = -1
        });
        repository
            .Setup(r => r.ExtendMonthToMonthLeaseEndDateAsync(LeaseId, OrganizationId, currentEnd, new DateTime(2026, 3, 28)))
            .ReturnsAsync(true);

        await CreateService(repository.Object).ProcessAutoRenewalsAsync(asOf);

        repository.Verify(r => r.ExtendMonthToMonthLeaseEndDateAsync(LeaseId, OrganizationId, currentEnd, new DateTime(2026, 3, 28)), Times.Once);
        repository.Verify(r => r.EndLease(It.IsAny<long>()), Times.Never);
        repository.Verify(r => r.AddLease(It.IsAny<UpdateLeaseDto>(), It.IsAny<long?>()), Times.Never);
    }

    [Fact]
    public async Task ProcessAutoRenewalsAsync_DoesNotExtendMonthToMonthLeaseBeforeFifteenDayThreshold()
    {
        var asOf = new DateTime(2026, 7, 16);
        var repository = CreateRepository(new LoadLeaseDto
        {
            Id = LeaseId,
            OrganizationId = OrganizationId,
            StartDate = new DateTime(2026, 7, 1),
            EndDate = new DateTime(2026, 8, 1),
            LeaseLength = -1,
            AutoRenewLease = true,
            AutoRenewLeaseLength = -1
        });

        await CreateService(repository.Object).ProcessAutoRenewalsAsync(asOf);

        repository.Verify(r => r.ExtendMonthToMonthLeaseEndDateAsync(
            It.IsAny<long>(), It.IsAny<long>(), It.IsAny<DateTime>(), It.IsAny<DateTime>()), Times.Never);
        repository.Verify(r => r.EndLease(It.IsAny<long>()), Times.Never);
    }

    [Fact]
    public async Task ProcessAutoRenewalsAsync_PreservesFixedTermRenewalAtEndDate()
    {
        var endDate = new DateTime(2026, 8, 1);
        var repository = CreateRepository(new LoadLeaseDto
        {
            Id = LeaseId,
            OrganizationId = OrganizationId,
            UnitId = 12,
            StartDate = new DateTime(2025, 8, 1),
            EndDate = endDate,
            LeaseLength = 12,
            RentAmount = 1500m,
            AutoRenewLease = true,
            AutoRenewLeaseLength = 12
        });
        repository
            .Setup(r => r.AddLease(It.IsAny<UpdateLeaseDto>(), OrganizationId))
            .ReturnsAsync(new LoadLeaseDto { Id = 99 });

        await CreateService(repository.Object).ProcessAutoRenewalsAsync(endDate);

        repository.Verify(r => r.EndLease(LeaseId), Times.Once);
        repository.Verify(r => r.AddLease(
            It.Is<UpdateLeaseDto>(lease =>
                lease.StartDate == new DateTime(2026, 8, 2) &&
                lease.EndDate == new DateTime(2027, 8, 2) &&
                lease.LeaseLength == 12),
            OrganizationId), Times.Once);
        repository.Verify(r => r.CopyLeaseRelatedEntitiesToNewLeaseAsync(LeaseId, 99), Times.Once);
    }

    private static Mock<ILeaseRepository> CreateRepository(LoadLeaseDto lease)
    {
        var repository = new Mock<ILeaseRepository>();
        repository
            .Setup(r => r.GetLeasesEndingOnOrBeforeForAutoRenew(It.IsAny<DateTime>()))
            .ReturnsAsync([new LoadLeaseDto { Id = LeaseId, OrganizationId = OrganizationId }]);
        repository
            .Setup(r => r.GetLeaseById(LeaseId, OrganizationId))
            .ReturnsAsync(lease);
        return repository;
    }

    private static LeaseAutoRenewService CreateService(ILeaseRepository repository) => new(
        repository,
        Mock.Of<ILeaseGenerationService>(),
        Mock.Of<ILeaseDocumentService>(),
        Mock.Of<ILeaseInstanceRepository>(),
        Mock.Of<ILeaseTemplateRepository>(),
        Mock.Of<ITenantDocumentRepository>(),
        new BlobServiceClient(new Uri("https://example.blob.core.windows.net")),
        NullLogger<LeaseAutoRenewService>.Instance);
}
