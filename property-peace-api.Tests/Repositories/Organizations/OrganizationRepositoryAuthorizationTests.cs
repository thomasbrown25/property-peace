using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Organizations;
using brownstone_hub_api.Tests.Helpers;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Repositories.Organizations;

public sealed class OrganizationRepositoryAuthorizationTests : IDisposable
{
    private readonly Data.DataContext _context = DbContextFactory.Create();

    public void Dispose() => _context.Dispose();

    [Fact]
    public async Task GetCurrentUserOrganizationAsync_DoesNotUseCurrentOrganizationIdWithoutActiveMembership()
    {
        _context.Users.Add(new User
        {
            Id = 42, FirstName = "Test", LastName = "User", Email = "test@example.com",
            CurrentOrganizationId = 10
        });
        _context.Organizations.Add(new Organization
        {
            Id = 10, Name = "Stale", IsActive = true, IsDeleted = false
        });
        await _context.SaveChangesAsync();
        var repository = Repository();

        var result = await repository.GetCurrentUserOrganizationAsync(42);

        result.Should().BeNull();
    }

    [Fact]
    public async Task GetCurrentUserOrganizationAsync_ReturnsExactActiveMembershipInActiveOrganization()
    {
        _context.Users.Add(new User
        {
            Id = 42, FirstName = "Test", LastName = "User", Email = "test@example.com",
            CurrentOrganizationId = 10
        });
        _context.Organizations.Add(new Organization
        {
            Id = 10, Name = "Active", IsActive = true, IsDeleted = false
        });
        _context.OrganizationMembers.Add(new OrganizationMember
        {
            Id = 1, OrganizationId = 10, UserId = 42, Role = "Viewer", IsActive = true
        });
        await _context.SaveChangesAsync();
        var repository = Repository();

        var result = await repository.GetCurrentUserOrganizationAsync(42);

        result!.Id.Should().Be(10);
    }

    [Fact]
    public async Task GetOrganizationsByUserIdAsync_ReturnsOnlyActiveNondeletedOrganizationsForActiveMembership()
    {
        _context.Users.Add(new User
        {
            Id = 42, FirstName = "Test", LastName = "User", Email = "test@example.com"
        });
        _context.Organizations.AddRange(
            new Organization { Id = 10, Name = "Valid", IsActive = true, IsDeleted = false },
            new Organization { Id = 11, Name = "Inactive", IsActive = false, IsDeleted = false },
            new Organization { Id = 12, Name = "Deleted", IsActive = true, IsDeleted = true },
            new Organization { Id = 13, Name = "Inactive membership", IsActive = true, IsDeleted = false });
        _context.OrganizationMembers.AddRange(
            new OrganizationMember { Id = 1, OrganizationId = 10, UserId = 42, Role = "Viewer", IsActive = true },
            new OrganizationMember { Id = 2, OrganizationId = 11, UserId = 42, Role = "Viewer", IsActive = true },
            new OrganizationMember { Id = 3, OrganizationId = 12, UserId = 42, Role = "Viewer", IsActive = true },
            new OrganizationMember { Id = 4, OrganizationId = 13, UserId = 42, Role = "Viewer", IsActive = false });
        await _context.SaveChangesAsync();
        var repository = Repository();

        var result = await repository.GetOrganizationsByUserIdAsync(42);

        result.Select(x => x.Id).Should().Equal(10);
    }

    private OrganizationRepository Repository() =>
        new(_context, Mock.Of<ILogger<OrganizationRepository>>());
}
