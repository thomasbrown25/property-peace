using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.LeaseInstances;
using brownstone_hub_api.Tests.Helpers;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace brownstone_hub_api.Tests.Repositories.LeaseInstances;

public class LeaseInstanceRepositoryTests : IDisposable
{
    private readonly Data.DataContext _context = DbContextFactory.Create();

    public void Dispose() => _context.Dispose();

    [Fact]
    public async Task InstanceQueries_AreIsolatedByOrganization()
    {
        _context.Properties.AddRange(
            new Property { Id = 1000, LandlordId = 1, OrganizationId = 1 },
            new Property { Id = 2000, LandlordId = 2, OrganizationId = 2 });
        _context.Units.AddRange(
            new Unit { Id = 100, PropertyId = 1000, OrganizationId = 1 },
            new Unit { Id = 200, PropertyId = 2000, OrganizationId = 2 });
        _context.LeaseTemplates.Add(new LeaseTemplate { Id = 1, Name = "Test" });
        _context.Leases.AddRange(
            new Lease { Id = 10, UnitId = 100, OrganizationId = 1 },
            new Lease { Id = 20, UnitId = 200, OrganizationId = 2 });
        _context.LeaseInstances.AddRange(
            new LeaseInstance { Id = 101, LeaseId = 10, LeaseTemplateId = 1, GeneratedBy = 1, IsFinalized = true },
            new LeaseInstance { Id = 202, LeaseId = 20, LeaseTemplateId = 1, GeneratedBy = 2, IsFinalized = true });
        await _context.SaveChangesAsync();

        var repository = new LeaseInstanceRepository(_context, NullLogger<LeaseInstanceRepository>.Instance);

        (await repository.GetLeaseInstanceByIdAsync(101, 2)).Should().BeNull();
        (await repository.GetLeaseInstancesByLeaseIdAsync(10, 2)).Should().BeEmpty();
        (await repository.GetFinalizedLeaseInstanceByLeaseIdAsync(10, 2)).Should().BeNull();

        (await repository.GetLeaseInstanceByIdAsync(101, 1)).Should().NotBeNull();
        (await repository.GetLeaseInstancesByLeaseIdAsync(10, 1)).Should().ContainSingle(i => i.Id == 101);
        (await repository.GetFinalizedLeaseInstanceByLeaseIdAsync(10, 1))!.Id.Should().Be(101);
    }

    [Fact]
    public async Task ReplaceStateDisclosureSnapshotAsync_AtomicallyOverwritesAllLegacyDisclosureValues()
    {
        _context.Leases.Add(new Lease { Id = 10, UnitId = 100, OrganizationId = 1 });
        _context.LeaseInstances.Add(new LeaseInstance { Id = 101, LeaseId = 10, LeaseTemplateId = 1, GeneratedBy = 1 });
        _context.LeaseVariables.AddRange(
            new LeaseVariable { LeaseInstanceId = 101, VariableKey = "State.RequiredDisclosures", VariableValue = "legacy unrestricted AI" },
            new LeaseVariable { LeaseInstanceId = 101, VariableKey = "State.RequiredDisclosureCitations", VariableValue = "legacy citations" },
            new LeaseVariable { LeaseInstanceId = 101, VariableKey = "State.Name", VariableValue = "legacy state" },
            new LeaseVariable { LeaseInstanceId = 101, VariableKey = "State.Note", VariableValue = "legacy unrestricted AI note" },
            new LeaseVariable { LeaseInstanceId = 101, VariableKey = "Lease.MonthlyRent", VariableValue = "$100" });
        await _context.SaveChangesAsync();
        var repository = new LeaseInstanceRepository(_context, NullLogger<LeaseInstanceRepository>.Instance);

        await repository.ReplaceStateDisclosureSnapshotAsync(101, [
            new LeaseVariable { VariableKey = "State.Name", VariableValue = "NC" },
            new LeaseVariable { VariableKey = "State.RequiredDisclosures", VariableValue = "verified quote" },
            new LeaseVariable { VariableKey = "State.RequiredDisclosureCitations", VariableValue = "verified citations" },
            new LeaseVariable { VariableKey = "State.RequiredDisclosureSnapshotUtc", VariableValue = "2026-07-25T00:00:00Z" }
        ], 1);

        var disclosureVariables = _context.LeaseVariables.Where(v => v.LeaseInstanceId == 101 && v.VariableKey.StartsWith("State.")).ToList();
        disclosureVariables.Should().HaveCount(4);
        disclosureVariables.Should().NotContain(v => v.VariableValue.Contains("legacy"));
        disclosureVariables.Should().NotContain(v => v.VariableKey == "State.Note");
        _context.LeaseVariables.Should().ContainSingle(v => v.VariableKey == "Lease.MonthlyRent");
    }

    [Fact]
    public async Task InstanceWrites_RejectCrossOrganizationAccess()
    {
        _context.Leases.Add(new Lease { Id = 10, UnitId = 100, OrganizationId = 1 });
        var existing = new LeaseInstance
        {
            Id = 101,
            LeaseId = 10,
            LeaseTemplateId = 1,
            GeneratedBy = 1
        };
        _context.LeaseInstances.Add(existing);
        await _context.SaveChangesAsync();

        var repository = new LeaseInstanceRepository(_context, NullLogger<LeaseInstanceRepository>.Instance);

        var create = () => repository.CreateLeaseInstanceAsync(new LeaseInstance
        {
            LeaseId = 10,
            LeaseTemplateId = 1,
            GeneratedBy = 2
        }, 2);
        var update = () => repository.UpdateLeaseInstanceAsync(existing, 2);
        var addVariables = () => repository.AddVariablesToInstanceAsync(
            existing.Id,
            [new LeaseVariable { VariableKey = "test", VariableValue = "value" }],
            2);
        var upsertDocument = () => repository.UpsertLeaseDocumentAsync(new LeaseDocument
        {
            LeaseInstanceId = existing.Id,
            DocumentType = "PDF",
            BlobName = "wrong-org",
            BlobUrl = "https://example/wrong-org"
        }, 2);

        await create.Should().ThrowAsync<InvalidOperationException>();
        await update.Should().ThrowAsync<InvalidOperationException>();
        await addVariables.Should().ThrowAsync<InvalidOperationException>();
        await upsertDocument.Should().ThrowAsync<InvalidOperationException>();
        _context.LeaseVariables.Should().BeEmpty();
        _context.LeaseDocuments.Should().BeEmpty();

    }
}
