using Azure.Storage.Blobs;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Dtos.LeaseGeneration;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.LeaseInstances;
using brownstone_hub_api.Repositories.Leases;
using brownstone_hub_api.Repositories.TenantDocuments;
using brownstone_hub_api.Services.LeaseDocumentService;
using brownstone_hub_api.Services.LeaseGenerationService;
using brownstone_hub_api.Services.LeaseFinalizationLock;
using brownstone_hub_api.Services.PolicyAIService;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Controllers;

public class LeaseGenerationControllerTests
{
    [Fact]
    public async Task FinishLeaseAgreement_WhenPdfGenerationFails_ReturnsNonSuccess()
    {
        const long organizationId = 8;
        const long leaseId = 50;
        const long instanceId = 60;
        var generation = SuccessfulFinish(leaseId, instanceId, organizationId);
        var documents = new Mock<ILeaseDocumentService>();
        documents.Setup(s => s.GeneratePdfAsync(instanceId, organizationId))
            .ReturnsAsync(ServiceResponse<byte[]>.CreateError("PDF failed", "renderer unavailable", statusCode: 502));

        var controller = CreateController(generation.Object, documents.Object);
        SetOrganization(controller, organizationId);

        var result = await controller.FinishLeaseAgreement(leaseId);

        result.Should().BeOfType<ObjectResult>().Which.StatusCode.Should().Be(502);
        documents.Verify(s => s.SaveDocumentToBlobAsync(
            It.IsAny<byte[]>(), It.IsAny<string>(), It.IsAny<long>(), It.IsAny<string>(), It.IsAny<long>()), Times.Never);
        generation.Verify(s => s.FinalizeLeaseInstanceAsync(It.IsAny<long>(), It.IsAny<long>()), Times.Never);
    }

    [Fact]
    public async Task FinishLeaseAgreement_WhenBlobSaveFails_ReturnsNonSuccess()
    {
        const long organizationId = 8;
        const long leaseId = 50;
        const long instanceId = 60;
        var generation = SuccessfulFinish(leaseId, instanceId, organizationId);
        var documents = new Mock<ILeaseDocumentService>();
        documents.Setup(s => s.GeneratePdfAsync(instanceId, organizationId))
            .ReturnsAsync(ServiceResponse<byte[]>.CreateSuccess([1, 2, 3]));
        documents.Setup(s => s.SaveDocumentToBlobAsync(
                It.IsAny<byte[]>(), It.IsAny<string>(), instanceId, "PDF", organizationId))
            .ReturnsAsync(ServiceResponse<string>.CreateError("Blob failed", "storage unavailable", statusCode: 503));

        var controller = CreateController(generation.Object, documents.Object);
        SetOrganization(controller, organizationId);

        var result = await controller.FinishLeaseAgreement(leaseId);

        result.Should().BeOfType<ObjectResult>().Which.StatusCode.Should().Be(503);
    }

    [Fact]
    public async Task FinishLeaseAgreement_WhenTenantPublicationFails_ReturnsNonSuccess()
    {
        const long organizationId = 8;
        const long leaseId = 50;
        const long instanceId = 60;
        var generation = SuccessfulFinish(leaseId, instanceId, organizationId);
        var documents = new Mock<ILeaseDocumentService>();
        documents.Setup(s => s.GeneratePdfAsync(instanceId, organizationId))
            .ReturnsAsync(ServiceResponse<byte[]>.CreateSuccess([1, 2, 3]));
        documents.Setup(s => s.SaveDocumentToBlobAsync(
                It.IsAny<byte[]>(), It.IsAny<string>(), instanceId, "PDF", organizationId))
            .ReturnsAsync(ServiceResponse<string>.CreateSuccess("https://example/lease.pdf"));

        var instances = new Mock<ILeaseInstanceRepository>();
        instances.Setup(r => r.GetLeaseInstanceByIdAsync(instanceId, organizationId))
            .ReturnsAsync(new LeaseInstance
            {
                Id = instanceId,
                LeaseId = leaseId,
                LeaseTemplateId = 1,
                Lease = new Lease
                {
                    Id = leaseId,
                    UnitId = 1,
                    OrganizationId = organizationId,
                    TenantLeases = [new TenantLease { Tenant = new Tenant { Id = 70, Firstname = "Test", Lastname = "Tenant" } }]
                }
            });
        var blobService = new Mock<BlobServiceClient>();
        blobService.Setup(b => b.GetBlobContainerClient("tenant-documents"))
            .Throws(new InvalidOperationException("tenant container unavailable"));

        var controller = CreateController(generation.Object, documents.Object, instances.Object, blobService.Object);
        SetOrganization(controller, organizationId);

        var result = await controller.FinishLeaseAgreement(leaseId);

        result.Should().BeOfType<ObjectResult>().Which.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task GetLeaseInstance_WithoutOrganizationContext_ReturnsForbidden()
    {
        var generation = new Mock<ILeaseGenerationService>();
        var controller = CreateController(generation.Object, Mock.Of<ILeaseDocumentService>());
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };

        var result = await controller.GetLeaseInstance(123);

        result.Should().BeOfType<ObjectResult>().Which.StatusCode.Should().Be(403);
        generation.Verify(s => s.GetLeaseInstanceByIdAsync(It.IsAny<long>(), It.IsAny<long>()), Times.Never);
    }

    [Fact]
    public async Task FinishLeaseAgreement_AcquiresDistributedLockBeforeRecheckPublishAndFinalize()
    {
        const long organizationId = 8;
        const long leaseId = 50;
        const long instanceId = 60;
        var calls = new List<string>();
        var generation = SuccessfulFinish(leaseId, instanceId, organizationId);
        generation.Setup(s => s.FinishLeaseAgreementAsync(leaseId, organizationId))
            .Callback(() => calls.Add("recheck"))
            .ReturnsAsync(ServiceResponse<LoadLeaseInstanceDto>.CreateSuccess(
                new LoadLeaseInstanceDto { Id = instanceId, LeaseId = leaseId }));
        generation.Setup(s => s.FinalizeLeaseInstanceAsync(instanceId, organizationId))
            .Callback(() => calls.Add("finalize"))
            .ReturnsAsync(ServiceResponse<LoadLeaseInstanceDto>.CreateSuccess(
                new LoadLeaseInstanceDto { Id = instanceId, LeaseId = leaseId, IsFinalized = true }));
        var documents = new Mock<ILeaseDocumentService>();
        documents.Setup(s => s.GeneratePdfAsync(instanceId, organizationId))
            .Callback(() => calls.Add("publish"))
            .ReturnsAsync(ServiceResponse<byte[]>.CreateSuccess([1]));
        documents.Setup(s => s.SaveDocumentToBlobAsync(It.IsAny<byte[]>(), It.IsAny<string>(), instanceId, "PDF", organizationId))
            .ReturnsAsync(ServiceResponse<string>.CreateSuccess("https://example/lease.pdf"));
        var instances = new Mock<ILeaseInstanceRepository>();
        instances.Setup(r => r.GetLeaseInstanceByIdAsync(instanceId, organizationId))
            .ReturnsAsync(new LeaseInstance { Id = instanceId, LeaseId = leaseId, LeaseTemplateId = 1 });
        var distributedLock = new Mock<ILeaseFinalizationLock>();
        distributedLock.Setup(l => l.AcquireAsync(organizationId, leaseId, It.IsAny<CancellationToken>()))
            .Returns(() =>
            {
                calls.Add("lock");
                return Task.FromResult(Mock.Of<IAsyncDisposable>());
            });

        var controller = CreateController(generation.Object, documents.Object, instances.Object, distributedLock: distributedLock.Object);
        SetOrganization(controller, organizationId);

        (await controller.FinishLeaseAgreement(leaseId)).Should().BeOfType<OkObjectResult>();
        calls.Should().Equal("lock", "recheck", "publish", "finalize");
    }

    [Fact]
    public async Task FinalizeLeaseInstance_LoadsScopedInstanceThenLocksBeforeRecheckPublishAndFinalize()
    {
        const long organizationId = 8;
        const long leaseId = 50;
        const long instanceId = 60;
        var calls = new List<string>();
        var instances = new Mock<ILeaseInstanceRepository>();
        instances.Setup(r => r.GetLeaseInstanceByIdAsync(instanceId, organizationId))
            .Callback(() => calls.Add(calls.Count == 0 ? "initial" : "artifact-load"))
            .ReturnsAsync(new LeaseInstance { Id = instanceId, LeaseId = leaseId, LeaseTemplateId = 1 });
        var generation = new Mock<ILeaseGenerationService>();
        generation.Setup(s => s.PrepareLeaseInstanceForFinalizationAsync(instanceId, organizationId))
            .Callback(() => calls.Add("recheck"))
            .ReturnsAsync(ServiceResponse<LoadLeaseInstanceDto>.CreateSuccess(
                new LoadLeaseInstanceDto { Id = instanceId, LeaseId = leaseId }));
        generation.Setup(s => s.FinalizeLeaseInstanceAsync(instanceId, organizationId))
            .Callback(() => calls.Add("finalize"))
            .ReturnsAsync(ServiceResponse<LoadLeaseInstanceDto>.CreateSuccess(
                new LoadLeaseInstanceDto { Id = instanceId, LeaseId = leaseId, IsFinalized = true }));
        var documents = new Mock<ILeaseDocumentService>();
        documents.Setup(s => s.GeneratePdfAsync(instanceId, organizationId))
            .Callback(() => calls.Add("publish"))
            .ReturnsAsync(ServiceResponse<byte[]>.CreateSuccess([1]));
        documents.Setup(s => s.SaveDocumentToBlobAsync(It.IsAny<byte[]>(), It.IsAny<string>(), instanceId, "PDF", organizationId))
            .ReturnsAsync(ServiceResponse<string>.CreateSuccess("https://example/lease.pdf"));
        var distributedLock = new Mock<ILeaseFinalizationLock>();
        distributedLock.Setup(l => l.AcquireAsync(organizationId, leaseId, It.IsAny<CancellationToken>()))
            .Returns(() =>
            {
                calls.Add("lock");
                return Task.FromResult(Mock.Of<IAsyncDisposable>());
            });
        var controller = CreateController(generation.Object, documents.Object, instances.Object, distributedLock: distributedLock.Object);
        SetOrganization(controller, organizationId);

        (await controller.FinalizeLeaseInstance(instanceId)).Should().BeOfType<OkObjectResult>();

        calls.Should().Equal("initial", "lock", "recheck", "publish", "artifact-load", "finalize");
    }

    private static LeaseGenerationController CreateController(
        ILeaseGenerationService generation,
        ILeaseDocumentService documents,
        ILeaseInstanceRepository? instances = null,
        BlobServiceClient? blobService = null,
        ILeaseFinalizationLock? distributedLock = null) => new(
            generation,
            documents,
            Mock.Of<IPolicyAIService>(),
            instances ?? Mock.Of<ILeaseInstanceRepository>(),
            Mock.Of<ILeaseRepository>(),
            Mock.Of<ITenantDocumentRepository>(),
            blobService ?? new BlobServiceClient(new Uri("https://example.blob.core.windows.net")),
            distributedLock ?? CreateDistributedLock(),
            NullLogger<LeaseGenerationController>.Instance);

    private static ILeaseFinalizationLock CreateDistributedLock()
    {
        var leaseLock = new Mock<ILeaseFinalizationLock>();
        leaseLock.Setup(l => l.AcquireAsync(It.IsAny<long>(), It.IsAny<long>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Mock.Of<IAsyncDisposable>());
        return leaseLock.Object;
    }

    private static Mock<ILeaseGenerationService> SuccessfulFinish(long leaseId, long instanceId, long organizationId)
    {
        var generation = new Mock<ILeaseGenerationService>();
        generation.Setup(s => s.FinishLeaseAgreementAsync(leaseId, organizationId))
            .ReturnsAsync(ServiceResponse<LoadLeaseInstanceDto>.CreateSuccess(
                new LoadLeaseInstanceDto { Id = instanceId, LeaseId = leaseId, IsFinalized = false }));
        return generation;
    }

    private static void SetOrganization(LeaseGenerationController controller, long organizationId)
    {
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };
        controller.HttpContext.Items["OrganizationId"] = organizationId;
    }
}
