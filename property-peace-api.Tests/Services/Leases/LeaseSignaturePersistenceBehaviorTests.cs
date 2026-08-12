using AutoMapper;
using Azure;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Specialized;
using brownstone_hub_api.Dtos.Lease;
using brownstone_hub_api.Dtos.LeaseAgreement;
using brownstone_hub_api.Dtos.Tenant;
using brownstone_hub_api.Dtos.TenantDocument;
using brownstone_hub_api.Dtos.User;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Leases;
using brownstone_hub_api.Repositories.Properties;
using brownstone_hub_api.Services.ESignatureService;
using brownstone_hub_api.Services.LeaseService;
using brownstone_hub_api.Services.TenantDocumentService;
using brownstone_hub_api.Services.UserContextService;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Moq;
using System.Reflection;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Leases;

public sealed class LeaseSignaturePersistenceBehaviorTests
{
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")]
    [InlineData(" envelope-with-padding")]
    public async Task Landlord_only_provider_success_without_envelope_never_writes(string? envelopeId)
    {
        var repository = new Mock<ILeaseRepository>(MockBehavior.Strict);
        var lease = Lease();
        lease.LeaseAgreement!.DocuSignEnvelopeId = null;
        repository.Setup(x => x.GetLeaseById(7, 10, It.IsAny<CancellationToken>())).ReturnsAsync(lease);
        var provider = new Mock<IESignatureService>(MockBehavior.Strict);
        provider.Setup(x => x.SendForSignature(It.IsAny<SendLeaseForSignatureDto>(), It.IsAny<byte[]>(),
                "lease.pdf", It.IsAny<CancellationToken>()))
            .ReturnsAsync(ServiceResponse<SignatureEnvelopeDto>.CreateSuccess(new SignatureEnvelopeDto
            {
                EnvelopeId = envelopeId!
            }));
        var documents = new Mock<ITenantDocumentService>(MockBehavior.Strict);
        documents.Setup(x => x.GetLeaseAgreementByLeaseId(7)).ReturnsAsync(
            ServiceResponse<LoadTenantDocumentDto>.CreateSuccess(new LoadTenantDocumentDto
            {
                BlobName = "lease.pdf",
                FileName = "lease.pdf"
            }));
        var blob = new Mock<BlobClient>(MockBehavior.Strict);
        blob.Setup(x => x.ExistsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(Response.FromValue(true, Mock.Of<Response>()));
        blob.Setup(x => x.DownloadToAsync(It.IsAny<Stream>(), It.IsAny<CancellationToken>()))
            .Callback<Stream, CancellationToken>((stream, _) => stream.Write([1, 2, 3]))
            .ReturnsAsync(Mock.Of<Response>());
        var container = new Mock<BlobContainerClient>(MockBehavior.Strict);
        container.Setup(x => x.GetBlobClient("lease.pdf")).Returns(blob.Object);
        var blobs = new Mock<BlobServiceClient>(MockBehavior.Strict);
        blobs.Setup(x => x.GetBlobContainerClient("tenant-documents")).Returns(container.Object);

        var result = await Create(repository.Object, provider.Object, documents.Object, blobs.Object)
            .SignLandlordOnlyAsync(7, new SendLeaseForSignatureDto(), "https://example.test", CancellationToken.None);

        result.Success.Should().BeFalse();
        result.StatusCode.Should().Be(502);
        repository.Verify(x => x.PersistSentEnvelopeAsync(It.IsAny<long>(), It.IsAny<long>(), It.IsAny<string>(),
            It.IsAny<DateTime>(), It.IsAny<DateTime?>(), It.IsAny<CancellationToken>()), Times.Never);
        repository.Verify(x => x.UpdateLeaseSignature(It.IsAny<UpdateLeaseSignatureDto>(), It.IsAny<long>(),
            It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Cancel_returns_success_only_after_exact_envelope_is_persisted_cancelled()
    {
        var repository = new Mock<ILeaseRepository>(MockBehavior.Strict);
        repository.Setup(x => x.GetLeaseById(7, 10, It.IsAny<CancellationToken>())).ReturnsAsync(Lease());
        repository.Setup(x => x.PersistCancelledEnvelopeAsync(7, 10, "Exact-Envelope", It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);
        var provider = new Mock<IESignatureService>(MockBehavior.Strict);
        provider.Setup(x => x.CancelSignature("Exact-Envelope", "duplicate", It.IsAny<CancellationToken>()))
            .ReturnsAsync(ServiceResponse<bool>.CreateSuccess(true));

        var result = await Create(repository.Object, provider.Object).CancelLeaseSignatureAsync(7, "duplicate", CancellationToken.None);

        result.Success.Should().BeTrue();
        repository.VerifyAll();
        provider.VerifyAll();
    }

    [Fact]
    public async Task Cancel_persistence_failure_is_generic_and_never_returns_false_success()
    {
        var repository = new Mock<ILeaseRepository>(MockBehavior.Strict);
        repository.Setup(x => x.GetLeaseById(7, 10, It.IsAny<CancellationToken>())).ReturnsAsync(Lease());
        repository.Setup(x => x.PersistCancelledEnvelopeAsync(7, 10, "Exact-Envelope", It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("sensitive database detail"));
        var provider = new Mock<IESignatureService>(MockBehavior.Strict);
        provider.Setup(x => x.CancelSignature("Exact-Envelope", null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(ServiceResponse<bool>.CreateSuccess(true));

        var result = await Create(repository.Object, provider.Object).CancelLeaseSignatureAsync(7, null, CancellationToken.None);

        result.Success.Should().BeFalse();
        result.StatusCode.Should().Be(503);
        result.ToString().Should().NotContain("sensitive");
    }

    [Fact]
    public async Task Provider_cancel_failure_never_attempts_database_persistence()
    {
        var repository = new Mock<ILeaseRepository>(MockBehavior.Strict);
        repository.Setup(x => x.GetLeaseById(7, 10, It.IsAny<CancellationToken>())).ReturnsAsync(Lease());
        var provider = new Mock<IESignatureService>(MockBehavior.Strict);
        provider.Setup(x => x.CancelSignature("Exact-Envelope", null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(ServiceResponse<bool>.CreateError("provider secret", statusCode: 500));

        var result = await Create(repository.Object, provider.Object).CancelLeaseSignatureAsync(7, null, CancellationToken.None);

        result.Success.Should().BeFalse();
        result.StatusCode.Should().Be(502);
        repository.Verify(x => x.PersistCancelledEnvelopeAsync(It.IsAny<long>(), It.IsAny<long>(),
            It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Sync_provider_envelope_mismatch_stops_before_document_blob_and_repository_mutation()
    {
        var repository = new Mock<ILeaseRepository>(MockBehavior.Strict);
        var provider = new Mock<IESignatureService>(MockBehavior.Strict);
        provider.Setup(x => x.GetSignatureStatus("Exact-Envelope", It.IsAny<CancellationToken>()))
            .ReturnsAsync(ServiceResponse<SignatureStatusDto>.CreateSuccess(new SignatureStatusDto
            {
                EnvelopeId = "Different-Provider-Envelope",
                Status = "completed",
                CompletedAt = new DateTime(2026, 8, 10, 12, 0, 0, DateTimeKind.Utc)
            }));
        var blobs = new Mock<BlobServiceClient>(MockBehavior.Strict);
        var service = Create(repository.Object, provider.Object, blobs: blobs.Object);
        var method = typeof(LeaseService).GetMethod("SyncLeaseSignatureStatusCoreAsync",
            BindingFlags.Instance | BindingFlags.NonPublic);
        method.Should().NotBeNull();

        var task = (Task<ServiceResponse<SyncSignatureStatusResultDto>>)method!.Invoke(service,
            [Lease(), 10L, "current.landlord@example.com", "Current Landlord", CancellationToken.None])!;
        var result = await task;

        result.Success.Should().BeFalse();
        result.StatusCode.Should().Be(502);
        provider.Verify(x => x.GetSignedDocument(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        blobs.Verify(x => x.GetBlobContainerClient(It.IsAny<string>()), Times.Never);
        repository.Verify(x => x.ApplySignatureSyncAsync(It.IsAny<long>(), It.IsAny<long>(),
            It.IsAny<SignatureSyncUpdate>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    private static LoadLeaseDto Lease() => new()
    {
        Id = 7,
        IsActive = true,
        LeaseAgreement = new LoadLeaseAgreementDto
        {
            SignatureStatus = ESignatureStatus.Sent,
            DocuSignEnvelopeId = "Exact-Envelope"
        }
    };

    private static LeaseService Create(ILeaseRepository repository, IESignatureService provider,
        ITenantDocumentService? documents = null, BlobServiceClient? blobs = null)
    {
        var context = new DefaultHttpContext();
        context.Items["OrganizationId"] = 10L;
        var accessor = new Mock<IHttpContextAccessor>();
        accessor.SetupGet(x => x.HttpContext).Returns(context);
        var users = new Mock<IUserContextService>();
        users.Setup(x => x.GetCurrentUserAsync()).ReturnsAsync(new LoadUserDto
        {
            Id = 5,
            Firstname = "Current",
            Lastname = "Landlord",
            Email = "current.landlord@example.com",
            CurrentOrganizationId = 10,
            Organizations = [new OrganizationInfoDto { Id = 10, Role = "Owner" }]
        });
        return new LeaseService(repository, Mock.Of<IPropertyRepository>(), accessor.Object,
            Mock.Of<ILogger<LeaseService>>(), Mock.Of<IMapper>(), provider, documents, blobs, null, null, null,
            users.Object, null, null, null, null);
    }
}
