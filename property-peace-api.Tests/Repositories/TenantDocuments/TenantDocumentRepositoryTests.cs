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
    public void LeaseUploadPrivacy_DefaultsPrivateAndIsMappedToResponse()
    {
        typeof(brownstone_hub_api.Controllers.TenantDocumentController)
            .GetMethod(nameof(brownstone_hub_api.Controllers.TenantDocumentController.UploadDocuments))!
            .GetParameters().Last().DefaultValue.Should().Be(true);
        typeof(brownstone_hub_api.Controllers.TenantDocumentController)
            .GetMethod(nameof(brownstone_hub_api.Controllers.TenantDocumentController.UploadLeaseDocument))!
            .GetParameters().Last().DefaultValue.Should().Be(true);
        typeof(brownstone_hub_api.Services.TenantDocumentService.ITenantDocumentService)
            .GetMethod(nameof(brownstone_hub_api.Services.TenantDocumentService.ITenantDocumentService.AddLeaseDocuments))!
            .GetParameters().Last().DefaultValue.Should().Be(true);
        MapperFactory.Create().Map<LoadTenantDocumentDto>(new TenantDocument { IsPrivate = true })
            .IsPrivate.Should().BeTrue();
    }

    [Fact]
    public async Task LeaseUploadPrivacy_PersistsAndReturnsVisibilityForLeaseLevelDocuments()
    {
        var repo = new TenantDocumentRepository(_context, MapperFactory.Create(), NullLogger<TenantDocumentRepository>.Instance);
        var privateDocument = new AddTenantDocumentDto
        {
            LeaseId = 10, FileName = "private.pdf", BlobName = "private", BlobUrl = "https://example/private",
            IsPrivate = true
        };
        var sharedDocument = new AddTenantDocumentDto
        {
            LeaseId = 10, FileName = "shared.pdf", BlobName = "shared", BlobUrl = "https://example/shared",
            IsPrivate = false
        };
        (await repo.AddTenantDocument(privateDocument, 1)).IsPrivate.Should().BeTrue();
        (await repo.AddTenantDocument(sharedDocument, 1)).IsPrivate.Should().BeFalse();
        _context.ChangeTracker.Clear();
        var saved = _context.TenantDocuments.ToList();
        saved.Single(d => d.FileName == "private.pdf").IsPrivate.Should().BeTrue();
        saved.Single(d => d.FileName == "shared.pdf").IsPrivate.Should().BeFalse();
    }

    [Fact]
    public async Task TenantReads_RequireOwnTenantOrSharedLeaseDocumentAndExactOrganization()
    {
        _context.Users.Add(new User { Id = 100, Email = "owner@example.com" });
        _context.Properties.Add(new Property { Id = 1, Name = "Home", LandlordId = 100, OrganizationId = 1 });
        _context.Units.Add(new Unit { Id = 1, PropertyId = 1 });
        _context.Leases.Add(new Lease { Id = 10, UnitId = 1, OrganizationId = 1 });
        _context.Tenants.AddRange(
            new Tenant { Id = 30, UserId = 200, Firstname = "Me", Lastname = "Here", Email = "me@example.com", OrganizationId = 1 },
            new Tenant { Id = 31, UserId = 201, Firstname = "Other", Lastname = "Here", Email = "other@example.com", OrganizationId = 1 });
        _context.TenantLeases.AddRange(new TenantLease { LeaseId = 10, TenantId = 30 }, new TenantLease { LeaseId = 10, TenantId = 31 });
        _context.TenantDocuments.AddRange(
            Doc(1, 30, 10, 1), Doc(2, 31, 10, 1), Doc(3, null, 10, 1),
            Doc(4, null, 10, 1, isPrivate: true), Doc(5, 30, 10, 2),
            Doc(6, 30, 10, 1, isPrivate: true));
        await _context.SaveChangesAsync();
        var repo = new TenantDocumentRepository(_context, MapperFactory.Create(), NullLogger<TenantDocumentRepository>.Instance);

        (await repo.GetTenantDocumentById(1, 1, 200, true)).Should().NotBeNull();
        foreach (var id in new long[] { 2, 4, 5, 6 })
            (await repo.GetTenantDocumentById(id, 1, 200, true)).Should().BeNull();
        (await repo.GetTenantDocumentById(3, 1, 200, true)).Should().NotBeNull();
        (await repo.GetTenantDocumentById(3, null, 200, true)).Should().BeNull();
        (await repo.GetTenantDocumentsByTenantId(30, 1, 200, true)).Select(d => d.Id)
            .Should().BeEquivalentTo(new long[] { 1, 3 });
        (await repo.GetTenantDocumentsByTenantId(30, 1, 201, true)).Should().BeEmpty();
        (await repo.GetTenantDocumentsByTenantId(30, null, 200, true)).Should().BeEmpty();
        (await repo.GetLeaseAgreementByLeaseId(10, 1, 200, true)).Should().BeNull();
        (await repo.GetTenantDocumentById(4, 1, null, false)).Should().NotBeNull();
    }

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
