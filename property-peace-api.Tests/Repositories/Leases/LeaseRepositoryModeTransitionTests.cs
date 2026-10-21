using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Leases;
using brownstone_hub_api.Tests.Helpers;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace brownstone_hub_api.Tests.Repositories.Leases;

public sealed class LeaseRepositoryModeTransitionTests : IDisposable
{
    private readonly Data.DataContext _context = DbContextFactory.Create();
    public void Dispose() => _context.Dispose();

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task CompleteDraft_RejectsPersistedShortTermEvenWithStaleTrackedLongTerm(bool staleTrackedMode)
    {
        await Seed(draft: true);
        if (staleTrackedMode)
            _context.Units.Local.Single().RentalMode = ERentalMode.LongTerm;
        var repo = Repository();

        await Assert.ThrowsAsync<InvalidOperationException>(() => repo.CompleteDraft(3, 7));

        _context.ChangeTracker.Clear();
        (await _context.Leases.SingleAsync(l => l.Id == 3)).IsActive.Should().BeFalse();
        (await _context.LeaseAgreements.SingleAsync(a => a.LeaseId == 3)).IsDrafted.Should().BeTrue();
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task ReopenLease_RejectsPersistedShortTermEvenWithStaleTrackedLongTerm(bool staleTrackedMode)
    {
        await Seed(draft: false);
        if (staleTrackedMode)
            _context.Units.Local.Single().RentalMode = ERentalMode.LongTerm;
        var repo = Repository();

        var error = await Assert.ThrowsAsync<Exception>(() => repo.ReopenLease(3));
        error.InnerException.Should().BeOfType<InvalidOperationException>();

        _context.ChangeTracker.Clear();
        (await _context.Leases.SingleAsync(l => l.Id == 3)).IsActive.Should().BeFalse();
    }

    [Fact]
    public async Task CompleteDraft_AllowsLongTermAndFinalizesAgreement()
    {
        await Seed(draft: true);
        _context.Units.Local.Single().RentalMode = ERentalMode.LongTerm;
        await _context.SaveChangesAsync();

        await Repository().CompleteDraft(3, 7);

        _context.ChangeTracker.Clear();
        (await _context.Leases.SingleAsync(l => l.Id == 3)).IsActive.Should().BeTrue();
        (await _context.LeaseAgreements.SingleAsync(a => a.LeaseId == 3)).IsDrafted.Should().BeFalse();
    }

    [Fact]
    public async Task ReopenLease_AllowsLongTerm()
    {
        await Seed(draft: false);
        _context.Units.Local.Single().RentalMode = ERentalMode.LongTerm;
        await _context.SaveChangesAsync();

        await Repository().ReopenLease(3);

        _context.ChangeTracker.Clear();
        (await _context.Leases.SingleAsync(l => l.Id == 3)).IsActive.Should().BeTrue();
    }

    [Theory]
    [InlineData("CompleteDraft", "ValidateTermAsync")]
    [InlineData("ReopenLease", "lease.IsActive = true")]
    public void Mutation_AcquiresSqlServerUnitLockThenRereadsModeBeforeActivation(string method, string mutation)
    {
        var root = new DirectoryInfo(AppContext.BaseDirectory);
        while (root != null && !System.IO.File.Exists(Path.Combine(root.FullName, "property-peace-api", "Repositories", "Leases", "LeaseRepository.cs")))
            root = root.Parent;
        root.Should().NotBeNull();
        var source = System.IO.File.ReadAllText(Path.Combine(root!.FullName, "property-peace-api", "Repositories", "Leases", "LeaseRepository.cs"));
        var start = source.IndexOf($"public async Task<LoadLeaseDto> {method}(", StringComparison.Ordinal);
        start.Should().BeGreaterThanOrEqualTo(0);
        var end = source.IndexOf("public async Task<", start + 1, StringComparison.Ordinal);
        var body = source[start..(end < 0 ? source.Length : end)];
        var transaction = body.IndexOf("BeginTransactionAsync(IsolationLevel.Serializable)", StringComparison.Ordinal);
        var lockUnit = body.IndexOf("WITH (UPDLOCK, HOLDLOCK)", StringComparison.Ordinal);
        var reread = body.IndexOf("_context.Units.AsNoTracking()", StringComparison.Ordinal);
        var guard = body.IndexOf("currentMode != ERentalMode.LongTerm", StringComparison.Ordinal);
        var write = body.IndexOf(mutation, StringComparison.Ordinal);
        transaction.Should().BeGreaterThanOrEqualTo(0);
        lockUnit.Should().BeGreaterThan(transaction);
        body.IndexOf("var lease = await _context.Leases", StringComparison.Ordinal).Should().BeGreaterThan(lockUnit);
        reread.Should().BeGreaterThan(lockUnit);
        guard.Should().BeGreaterThan(reread);
        write.Should().BeGreaterThan(guard);
        body.Should().Contain("WHERE Id = {0}");
        body.Should().Contain("CommitAsync()");
    }

    private LeaseRepository Repository() => new(_context, NullLogger<LeaseRepository>.Instance, MapperFactory.Create());

    private async Task Seed(bool draft)
    {
        _context.Properties.Add(new Property { Id = 1, OrganizationId = 7, LandlordId = 2 });
        _context.Units.Add(new Unit { Id = 2, PropertyId = 1, OrganizationId = 7, RentalMode = ERentalMode.ShortTerm });
        _context.Leases.Add(new Lease
        {
            Id = 3, UnitId = 2, OrganizationId = 7, IsActive = false,
            StartDate = new DateTime(2026, 1, 1), EndDate = new DateTime(2026, 12, 31)
        });
        _context.LeaseAgreements.Add(new LeaseAgreement { LeaseId = 3, IsDrafted = draft });
        await _context.SaveChangesAsync();
    }
}
