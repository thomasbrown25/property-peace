using brownstone_hub_api.Dtos.TenantDocument;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.TenantDocuments;
using brownstone_hub_api.Tests.Helpers;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace brownstone_hub_api.Tests.Repositories.TenantDocuments;

public sealed class TenantDocumentRepositoryTests : IDisposable
{
    private readonly Data.DataContext _context = DbContextFactory.Create();

    public void Dispose() => _context.Dispose();

    [Fact]
    public async Task UpsertLeaseAgreement_RejectsTenantOrLeaseOutsideOrganization()
    {
        _context.Leases.Add(new Lease { Id = 10, UnitId = 1, OrganizationId = 1 });
        _context.Tenants.Add(new Tenant
        {
            Id = 20, Firstname = "Wrong", Lastname = "Org", Email = "wrong@example.com", OrganizationId = 2
        });
        _context.TenantLeases.Add(new TenantLease { LeaseId = 10, TenantId = 20 });
        await _context.SaveChangesAsync();
        var repository = new TenantDocumentRepository(
            _context, MapperFactory.Create(), NullLogger<TenantDocumentRepository>.Instance);

        var action = () => repository.UpsertLeaseAgreementAsync(Document(10, 20, "first.pdf"), 1);

        await action.Should().ThrowAsync<InvalidOperationException>();
        _context.TenantDocuments.Should().BeEmpty();
    }

    [Fact]
    public async Task UpsertLeaseAgreement_ReloadedWinnerPathHasSameUpdateSemantics()
    {
        _context.Leases.Add(new Lease { Id = 10, UnitId = 1, OrganizationId = 1 });
        _context.Tenants.Add(new Tenant
        {
            Id = 20, Firstname = "Right", Lastname = "Org", Email = "right@example.com", OrganizationId = 1
        });
        _context.TenantLeases.Add(new TenantLease { LeaseId = 10, TenantId = 20 });
        _context.TenantDocuments.Add(new TenantDocument
        {
            Id = 30, TenantId = 20, LeaseId = 10, OrganizationId = 1,
            DocumentType = ETenantDocumentType.LeaseAgreement, FileName = "winner.pdf",
            BlobName = "winner", BlobUrl = "https://example/winner", RefId = 20
        });
        await _context.SaveChangesAsync();
        var repository = new TenantDocumentRepository(
            _context, MapperFactory.Create(), NullLogger<TenantDocumentRepository>.Instance);

        var result = await repository.UpsertLeaseAgreementAsync(Document(10, 20, "latest.pdf"), 1);

        result.Id.Should().Be(30);
        result.FileName.Should().Be("latest.pdf");
        _context.TenantDocuments.Should().ContainSingle();
        _context.TenantDocuments.Single().BlobName.Should().Be("latest");
    }

    private static AddTenantDocumentDto Document(long leaseId, long tenantId, string fileName) => new()
    {
        LeaseId = leaseId,
        TenantId = tenantId,
        DocumentType = ETenantDocumentType.LeaseAgreement,
        FileName = fileName,
        BlobName = Path.GetFileNameWithoutExtension(fileName),
        BlobUrl = $"https://example/{fileName}"
    };
}
