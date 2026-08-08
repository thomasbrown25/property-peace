using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Timeline;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.Timelines;
using brownstone_hub_api.Tests.Helpers;
using FluentAssertions;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Timelines;

public sealed class ConversationContextServiceTests : IDisposable
{
    private readonly DataContext _context = DbContextFactory.Create();

    public void Dispose() => _context.Dispose();

    [Fact]
    public async Task AddLinks_AllowsMultipleTypedRows_WhenTargetsShareOrganizationAndHierarchy()
    {
        SeedHierarchy();
        var service = new ConversationContextService(_context);

        var links = await service.AddLinksAsync(100, 10,
        [
            new ConversationContextTarget { PropertyId = 20 },
            new ConversationContextTarget { UnitId = 30 },
            new ConversationContextTarget { LeaseId = 40 }
        ]);

        links.Should().HaveCount(3);
        links.Should().OnlyContain(x => x.TargetCount == 1);
    }

    [Fact]
    public async Task AddLinks_RejectsZeroOrMultipleTargets_CrossOrganization_AndUnrelatedHierarchy()
    {
        SeedHierarchy();
        _context.Properties.Add(new Property { Id = 21, LandlordId = 2, OrganizationId = 200 });
        _context.Units.Add(new Unit { Id = 31, PropertyId = 21, OrganizationId = 200 });
        _context.Properties.Add(new Property { Id = 22, LandlordId = 2, OrganizationId = 100 });
        _context.Units.Add(new Unit { Id = 32, PropertyId = 22, OrganizationId = 100 });
        await _context.SaveChangesAsync();
        var service = new ConversationContextService(_context);

        Func<Task> zeroTargets = () => service.AddLinksAsync(100, 10, [new ConversationContextTarget()]);
        Func<Task> multipleTargets = () => service.AddLinksAsync(100, 10, [new ConversationContextTarget { PropertyId = 20, UnitId = 30 }]);
        Func<Task> crossOrganization = () => service.AddLinksAsync(100, 10, [new ConversationContextTarget { PropertyId = 21 }]);
        Func<Task> unrelatedHierarchy = () => service.AddLinksAsync(100, 10,
        [
            new ConversationContextTarget { PropertyId = 20 },
            new ConversationContextTarget { UnitId = 32 }
        ]);

        await zeroTargets.Should().ThrowAsync<ArgumentException>().WithMessage("*exactly one*");
        await multipleTargets.Should().ThrowAsync<ArgumentException>().WithMessage("*exactly one*");
        await crossOrganization.Should().ThrowAsync<InvalidOperationException>().WithMessage("*organization*");
        await unrelatedHierarchy.Should().ThrowAsync<InvalidOperationException>().WithMessage("*hierarchy*");
    }

    private void SeedHierarchy()
    {
        _context.Users.Add(new User { Id = 2, SettingId = 2, Email = "owner@example.com" });
        _context.Conversations.Add(new Conversation { Id = 10, Title = "Context", LandlordId = 2, OrganizationId = 100 });
        _context.Properties.Add(new Property { Id = 20, LandlordId = 2, OrganizationId = 100 });
        _context.Units.Add(new Unit { Id = 30, PropertyId = 20, OrganizationId = 100 });
        _context.Leases.Add(new Lease { Id = 40, UnitId = 30, OrganizationId = 100 });
        _context.SaveChanges();
    }
}
