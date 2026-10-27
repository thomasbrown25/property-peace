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

    [Fact]
    public async Task MyDocuments_ReturnsOnlyOwnedNonPrivateDocumentsInSelectedOrganization()
    {
        _context.Users.Add(new User { Id = 100, Email = "owner@example.com" });
        _context.Properties.AddRange(
            new Property { Id = 1, Name = "Home", LandlordId = 100, OrganizationId = 1 },
            new Property { Id = 2, Name = "Other", LandlordId = 100, OrganizationId = 2 });
        _context.Units.AddRange(new Unit { Id = 1, PropertyId = 1 }, new Unit { Id = 2, PropertyId = 2 });
        _context.Leases.AddRange(
            new Lease { Id = 10, UnitId = 1, OrganizationId = 1 },
            new Lease { Id = 11, UnitId = 1, OrganizationId = 1 },
            new Lease { Id = 20, UnitId = 2, OrganizationId = 2 });
        _context.Tenants.AddRange(
            new Tenant { Id = 30, UserId = 200, Firstname = "Me", Lastname = "Here", Email = "me@example.com", OrganizationId = 1 },
            new Tenant { Id = 31, UserId = 201, Firstname = "Other", Lastname = "Person", Email = "other@example.com", OrganizationId = 1 },
            new Tenant { Id = 32, UserId = 200, Firstname = "Me", Lastname = "Elsewhere", Email = "me2@example.com", OrganizationId = 2 });
        _context.TenantLeases.AddRange(
            new TenantLease { LeaseId = 10, TenantId = 30 },
            new TenantLease { LeaseId = 10, TenantId = 31 },
            new TenantLease { LeaseId = 11, TenantId = 31 },
            new TenantLease { LeaseId = 20, TenantId = 32 });
        _context.TenantDocuments.AddRange(
            Doc(1, 30, 10, 1), Doc(2, null, 10, 1),
            Doc(3, 31, 10, 1), Doc(4, 30, 11, 1),
            Doc(5, null, 11, 1), Doc(6, 30, 10, 1, isPrivate: true),
            Doc(7, 32, 20, 2), Doc(8, null, 20, 2),
            Doc(9, 30, null, 1), Doc(10, null, 10, 2));
        await _context.SaveChangesAsync();
        var repository = new TenantDocumentRepository(_context, MapperFactory.Create(), NullLogger<TenantDocumentRepository>.Instance);

        var result = await repository.GetMyTenantDocuments(1, 200);

        result.Select(d => d.Id).Should().BeEquivalentTo(new long[] { 1, 2, 9 });
        (await repository.GetMyUploadTenantId(1, 200)).Should().Be(30);
        (await repository.GetMyUploadTenantId(1, 201)).Should().Be(31);
        (await repository.GetMyUploadTenantId(2, 201)).Should().BeNull();
        (await repository.GetMyLeaseIds(1, 200)).Should().BeEquivalentTo(new long[] { 10 });
    }

    private static TenantDocument Doc(long id, long? tenantId, long? leaseId, long organizationId, bool isPrivate = false) => new()
    {
        Id = id, TenantId = tenantId, LeaseId = leaseId, OrganizationId = organizationId,
        IsPrivate = isPrivate, FileName = $"{id}.pdf", BlobName = $"{id}", RefId = tenantId ?? leaseId ?? 0
    };

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
