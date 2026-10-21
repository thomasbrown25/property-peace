using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Listing;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Listings;
using brownstone_hub_api.Repositories.Amenities;
using brownstone_hub_api.Repositories.Features;
using brownstone_hub_api.Tests.Helpers;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Repositories.Listings;

public sealed class ListingRepositoryModeTransitionTests : IDisposable
{
    private readonly DataContext _db = DbContextFactory.Create();
    public void Dispose() => _db.Dispose();
    private ListingRepository Repository() => new(_db, NullLogger<ListingRepository>.Instance,
        MapperFactory.Create(), Mock.Of<IAmenityRepository>(), Mock.Of<IFeatureRepository>());

    [Fact]
    public async Task Stale_tracked_long_term_mode_cannot_publish_persisted_short_term_unit()
    {
        Seed(false);
        _db.Listings.Add(new Listing { Id = 17, PropertyId = 7, UnitId = 10,
            OrganizationId = 20, CreatedBy = 42, Status = EListingStatus.Draft });
        await _db.SaveChangesAsync();
        _db.Units.Local.Single().RentalMode = ERentalMode.LongTerm;
        await Assert.ThrowsAnyAsync<Exception>(() => Repository().UpdateListing(new UpdateListingDto
            { Id = 17, Status = EListingStatus.Active }));
        _db.ChangeTracker.Clear();
        Assert.Equal(EListingStatus.Draft, _db.Listings.Single().Status);
    }

    [Fact]
    public async Task Long_term_unit_can_update_listing()
    {
        Seed(false);
        _db.Units.Single().RentalMode = ERentalMode.LongTerm;
        _db.Listings.Add(new Listing { Id = 17, PropertyId = 7, UnitId = 10,
            OrganizationId = 20, CreatedBy = 42, Status = EListingStatus.Draft });
        await _db.SaveChangesAsync();
        await Repository().UpdateListing(new UpdateListingDto { Id = 17, Status = EListingStatus.Active });
        _db.ChangeTracker.Clear();
        Assert.Equal(EListingStatus.Active, _db.Listings.Single().Status);
    }

    [Fact]
    public void Sql_server_mutations_use_serializable_unit_locks_and_service_transaction()
    {
        var root = new DirectoryInfo(AppContext.BaseDirectory);
        while (root != null && !System.IO.File.Exists(Path.Combine(root.FullName, "property-peace-api", "Repositories", "Listings", "ListingRepository.cs")))
            root = root.Parent;
        Assert.NotNull(root);
        var source = System.IO.File.ReadAllText(Path.Combine(root!.FullName, "property-peace-api", "Repositories", "Listings", "ListingRepository.cs"));
        var helper = source[source.IndexOf("private async Task RequireLongTermUnitsAsync", StringComparison.Ordinal)..
            source.IndexOf("public async Task<LoadListingDto> CreateListing", StringComparison.Ordinal)];
        Assert.Contains("WITH (UPDLOCK, HOLDLOCK) WHERE Id = {0}", helper);
        Assert.Contains("WITH (UPDLOCK, HOLDLOCK) WHERE PropertyId = {0}", helper);
        Assert.True(helper.IndexOf("WITH (UPDLOCK, HOLDLOCK)", StringComparison.Ordinal) <
            helper.IndexOf("_context.Units.AsNoTracking()", StringComparison.Ordinal));
        Assert.Contains("BeginTransactionAsync(IsolationLevel.Serializable)", source);
        foreach (var method in new[] { "CreateListing", "UpdateListing" })
        {
            var start = source.IndexOf($"public async Task<LoadListingDto> {method}(", StringComparison.Ordinal);
            var body = source[start..source.IndexOf("catch (Exception ex)", start, StringComparison.Ordinal)];
            Assert.True(body.IndexOf("RequireLongTermUnitsAsync", StringComparison.Ordinal) <
                body.IndexOf("SaveChangesAsync", StringComparison.Ordinal));
            Assert.Contains("CommitAsync()", body);
        }
        var service = System.IO.File.ReadAllText(Path.Combine(root.FullName, "property-peace-api", "Services", "ListingService", "ListingService.cs"));
        Assert.Contains("BeginTransactionAsync(IsolationLevel.Serializable)", service);
    }

    [Theory]
    [InlineData(true, false)]
    [InlineData(false, false)]
    [InlineData(false, true)]
    public async Task Create_rechecks_persisted_mode_at_mutation_boundary(bool specificUnit, bool mixedProperty)
    {
        Seed(mixedProperty);
        await Assert.ThrowsAnyAsync<Exception>(() => Repository().CreateListing(
            new CreateListingDto { PropertyId = 7, UnitId = specificUnit ? 10 : null }, 20, 42));
        Assert.Empty(_db.Listings);
    }

    [Theory]
    [InlineData(true, false)]
    [InlineData(false, false)]
    [InlineData(false, true)]
    public async Task Update_and_publish_recheck_persisted_mode(bool specificUnit, bool mixedProperty)
    {
        Seed(mixedProperty);
        _db.Listings.Add(new Listing { Id = 17, PropertyId = 7, UnitId = specificUnit ? 10 : null,
            OrganizationId = 20, CreatedBy = 42, Status = EListingStatus.Draft });
        await _db.SaveChangesAsync();
        foreach (var status in new EListingStatus?[] { null, EListingStatus.Active })
            await Assert.ThrowsAnyAsync<Exception>(() => Repository().UpdateListing(new UpdateListingDto
                { Id = 17, Status = status, MarketingDescription = "changed" }));
        _db.ChangeTracker.Clear();
        Assert.Equal(EListingStatus.Draft, _db.Listings.Single().Status);
        Assert.Null(_db.Listings.Single().MarketingDescription);
    }

    private void Seed(bool mixed)
    {
        _db.Properties.Add(new Property { Id = 7, OrganizationId = 20 });
        _db.Units.Add(new Unit { Id = 10, PropertyId = 7, OrganizationId = 20,
            RentalMode = mixed ? ERentalMode.LongTerm : ERentalMode.ShortTerm });
        if (mixed) _db.Units.Add(new Unit { Id = 11, PropertyId = 7, OrganizationId = 20,
            RentalMode = ERentalMode.ShortTerm });
        _db.SaveChanges();
    }
}
