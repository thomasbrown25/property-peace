using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using brownstone_hub_api.Security;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace brownstone_hub_api.Tests.Security;

public sealed class OrganizationAuthorityResolverTests
{
    private const long UserId = 42;
    private const long OrganizationId = 71;

    [Theory]
    [InlineData(false, true, false)]
    [InlineData(true, false, false)]
    [InlineData(true, true, true)]
    public async Task ResolveActiveMemberAsync_AtomicallyRequiresActiveMemberAndOrganization(
        bool memberIsActive,
        bool organizationIsActive,
        bool organizationIsDeleted)
    {
        await using var db = CreateContext();
        Seed(db, memberIsActive, organizationIsActive, organizationIsDeleted);
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        var resolver = new OrganizationAuthorityResolver(db);

        var result = await resolver.ResolveActiveMemberAsync(UserId, OrganizationId);

        result.Should().BeNull();
        db.ChangeTracker.Entries().Should().BeEmpty("authority reads must be no-tracking");
    }

    [Fact]
    public async Task ResolveActiveMemberAsync_UsesExactUserAndOrganizationAndReturnsNoTrackedMember()
    {
        await using var db = CreateContext();
        Seed(db, memberIsActive: true, organizationIsActive: true, organizationIsDeleted: false);
        db.OrganizationMembers.Add(new OrganizationMember
        {
            Id = 2,
            UserId = 999,
            OrganizationId = OrganizationId,
            Role = "Owner",
            IsActive = true
        });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        var resolver = new OrganizationAuthorityResolver(db);

        var result = await resolver.ResolveActiveMemberAsync(UserId, OrganizationId);

        result.Should().NotBeNull();
        result!.UserId.Should().Be(UserId);
        db.ChangeTracker.Entries().Should().BeEmpty();
    }

    [Fact]
    public async Task ResolveActiveMemberAsync_PropagatesCancellation()
    {
        await using var db = CreateContext();
        var resolver = new OrganizationAuthorityResolver(db);
        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();

        var action = () => resolver.ResolveActiveMemberAsync(UserId, OrganizationId, cancellation.Token);

        await action.Should().ThrowAsync<OperationCanceledException>();
    }

    [Fact]
    public async Task ResolveActiveMemberAsync_PropagatesStoreFailure()
    {
        var db = CreateContext();
        var resolver = new OrganizationAuthorityResolver(db);
        await db.DisposeAsync();

        var action = () => resolver.ResolveActiveMemberAsync(UserId, OrganizationId);

        await action.Should().ThrowAsync<ObjectDisposedException>();
    }

    private static DataContext CreateContext() => new(
        new DbContextOptionsBuilder<DataContext>()
            .UseInMemoryDatabase($"organization-authority-{Guid.NewGuid()}")
            .Options);

    private static void Seed(
        DataContext db,
        bool memberIsActive,
        bool organizationIsActive,
        bool organizationIsDeleted)
    {
        var organization = new Organization
        {
            Id = OrganizationId,
            Name = "Test Organization",
            IsActive = organizationIsActive,
            IsDeleted = organizationIsDeleted
        };
        db.Organizations.Add(organization);
        db.OrganizationMembers.Add(new OrganizationMember
        {
            Id = 1,
            UserId = UserId,
            OrganizationId = OrganizationId,
            Organization = organization,
            Role = "Owner",
            IsActive = memberIsActive
        });
    }
}
