using brownstone_hub_api.Dtos.Lease;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Leases;
using brownstone_hub_api.Tests.Helpers;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;
using FileEntity = brownstone_hub_api.Models.File;

namespace brownstone_hub_api.Tests.Repositories.Leases;

public sealed class LeaseArchiveTests
{
    private static async Task<(Data.DataContext Db, LeaseRepository Repository)> SeedAsync()
    {
        var db = DbContextFactory.Create();
        var property = new Property { Id = 1, LandlordId = 99, OrganizationId = 10, Name = "Home", StreetAddress = "1 Main" };
        property.Units.Add(new Unit { Id = 1, PropertyId = 1, Property = property, OrganizationId = 10, Name = "A", IsOccupied = true });
        db.Properties.Add(property);
        db.Leases.Add(new Lease { Id = 1, UnitId = 1, OrganizationId = 10, IsActive = true,
            AutoRenewLease = true, CreateChecklistOnStartDate = true,
            StartDate = DateTime.Today.AddDays(-1), EndDate = DateTime.Today.AddMonths(1) });
        db.Tenants.Add(new Tenant { Id = 1, Firstname = "Resident", Lastname = "One", OrganizationId = 10, UserId = 42 });
        db.TenantLeases.Add(new TenantLease { TenantId = 1, LeaseId = 1 });
        db.TenantDocuments.Add(new TenantDocument { Id = 1, LeaseId = 1, OrganizationId = 10, BlobName = "lease-document", BlobUrl = "blob" });
        db.Files.Add(new FileEntity { Id = 1, LeaseId = 1, OrganizationId = 10, BlobName = "file", BlobUrl = "blob" });
        db.Checklists.Add(new Checklist { Id = 1, LeaseId = 1, PropertyId = 1, LandlordId = 99, Title = "Move in" });
        db.Payments.Add(new Payment { Id = 1, LeaseId = 1, PropertyId = 1, OrganizationId = 10, Amount = 50, PaymentDate = DateTime.Today });
        await db.SaveChangesAsync();
        return (db, new LeaseRepository(db, NullLogger<LeaseRepository>.Instance, MapperFactory.Create()));
    }

    [Fact]
    public async Task ArchiveWithoutFlags_HidesLeaseButKeepsDocumentsChecklistsAndPayments()
    {
        var (db, repository) = await SeedAsync();
        using (db)
        {
            await repository.DeleteLease(1, 10);
            (await repository.HasLeaseRecordsForUnit(1, 10)).Should().BeTrue();
            (await repository.HasLeaseRecordsForUnit(1, 20)).Should().BeFalse();
            db.ChangeTracker.Clear();
            var lease = await db.Leases.SingleAsync();
            lease.IsDeleted.Should().BeTrue();
            lease.DeletedAt.Should().NotBeNull();
            lease.IsActive.Should().BeFalse();
            lease.AutoRenewLease.Should().BeFalse();
            lease.CreateChecklistOnStartDate.Should().BeFalse();
            (await db.Units.SingleAsync()).IsOccupied.Should().BeFalse();
            (await db.Payments.SingleAsync()).LeaseId.Should().Be(1);
            (await db.Tenants.SingleAsync()).IsDeleted.Should().BeFalse();
            (await db.TenantLeases.SingleAsync()).LeaseId.Should().Be(1);
            (await db.TenantDocuments.SingleAsync()).IsDeleted.Should().BeFalse();
            (await db.Files.SingleAsync()).IsDeleted.Should().BeFalse();
            (await db.Checklists.SingleAsync()).LeaseId.Should().Be(1);
            (await repository.GetLeasesByOrganizationId(10, false)).Should().BeEmpty();
            (await repository.GetLeasesByPropertyId(1, false, 10)).Should().BeEmpty();
            (await repository.GetLeasesByTenantUserId(42)).Should().BeEmpty();
            (await repository.GetLeaseById(1, 10)).Should().BeNull();
            await Assert.ThrowsAsync<KeyNotFoundException>(() => repository.DeleteLease(1, 10));
        }
    }

    [Fact]
    public async Task SelectedCleanup_SoftDeletesAllLeaseDocumentsAndRemovesOnlyLinkedChecklists()
    {
        var (db, repository) = await SeedAsync();
        using (db)
        {
            db.Checklists.Add(new Checklist { Id = 2, PropertyId = 1, LandlordId = 99, Title = "Unlinked", CounterpartChecklistId = 1 });
            await db.SaveChangesAsync();
            await repository.DeleteLease(1, 10, new DeleteLeaseOptionsDto { DeleteLeaseDocuments = true, DeleteChecklists = true });
            db.ChangeTracker.Clear();
            (await db.TenantDocuments.SingleAsync()).IsDeleted.Should().BeTrue();
            (await db.Files.SingleAsync()).IsDeleted.Should().BeTrue();
            (await db.Checklists.SingleAsync()).CounterpartChecklistId.Should().BeNull();
            (await db.Payments.SingleAsync()).LeaseId.Should().Be(1);
            (await db.Tenants.SingleAsync()).IsDeleted.Should().BeFalse();
            (await db.TenantLeases.SingleAsync()).LeaseId.Should().Be(1);
        }
    }

    [Fact]
    public async Task WrongOrganization_CannotArchiveOrCleanupOtherOrganizationsLease()
    {
        var (db, repository) = await SeedAsync();
        using (db)
        {
            await Assert.ThrowsAsync<KeyNotFoundException>(() => repository.DeleteLease(1, 20,
                new DeleteLeaseOptionsDto { DeleteLeaseDocuments = true, DeleteChecklists = true }));
            (await db.Leases.SingleAsync()).IsDeleted.Should().BeFalse();
            (await db.TenantDocuments.SingleAsync()).IsDeleted.Should().BeFalse();
            (await db.Checklists.CountAsync()).Should().Be(1);
        }
    }
}
