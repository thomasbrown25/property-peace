using brownstone_hub_api.Dtos.Application;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Applications;
using brownstone_hub_api.Tests.Helpers;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace brownstone_hub_api.Tests.Repositories.Applications;

public sealed class ApplicationRepositoryModeTransitionTests
{
    [Theory]
    [InlineData(10L, false)] // directly selected short-term unit
    [InlineData(null, false)] // property-only application on short-term property
    [InlineData(null, true)] // property-only application on mixed-mode property
    public async Task CreateRejectsShortTermTargetsBeforePersisting(long? unitId, bool mixed)
    {
        await using var db = DbContextFactory.Create();
        db.Properties.Add(new Property { Id = 7, OrganizationId = 20 });
        db.Units.Add(new Unit { Id = 10, PropertyId = 7, OrganizationId = 20,
            RentalMode = mixed ? ERentalMode.LongTerm : ERentalMode.ShortTerm });
        if (mixed) db.Units.Add(new Unit { Id = 11, PropertyId = 7, OrganizationId = 20,
            RentalMode = ERentalMode.ShortTerm });
        await db.SaveChangesAsync();
        // An earlier service read (or tracked entity) may still say LongTerm.
        foreach (var unit in db.Units.Local) unit.RentalMode = ERentalMode.LongTerm;
        var repo = new ApplicationRepository(db, MapperFactory.Create(), NullLogger<ApplicationRepository>.Instance);
        await Assert.ThrowsAsync<InvalidOperationException>(() => repo.AddApplication(
            new AddRentalApplicationDto { PropertyId = 7, UnitId = unitId, Status = EApplicationStatus.Submitted }, 42, 20));
        db.ChangeTracker.Clear();
        Assert.False(await db.RentalApplications.AnyAsync());
    }

    [Theory]
    [InlineData(10L, 8L, 20L)] // a unit cannot be retargeted across properties
    [InlineData(10L, 7L, 21L)] // caller organization must own the property
    public async Task CreateRejectsMismatchedTarget(long unitId, long propertyId, long organizationId)
    {
        await using var db = DbContextFactory.Create();
        db.Properties.Add(new Property { Id = 7, OrganizationId = 20 });
        db.Properties.Add(new Property { Id = 8, OrganizationId = 20 });
        db.Units.Add(new Unit { Id = 10, PropertyId = 7, OrganizationId = 20, RentalMode = ERentalMode.LongTerm });
        await db.SaveChangesAsync();
        var repo = new ApplicationRepository(db, MapperFactory.Create(), NullLogger<ApplicationRepository>.Instance);
        await Assert.ThrowsAsync<InvalidOperationException>(() => repo.AddApplication(
            new AddRentalApplicationDto { PropertyId = propertyId, UnitId = unitId }, 42, organizationId));
        Assert.False(await db.RentalApplications.AnyAsync());
    }

    [Theory]
    [InlineData(10L)]
    [InlineData(null)]
    public async Task CreatePermitsLongTermTarget(long? unitId)
    {
        await using var db = DbContextFactory.Create();
        db.Properties.Add(new Property { Id = 7, OrganizationId = 20 });
        db.Units.Add(new Unit { Id = 10, PropertyId = 7, OrganizationId = 20, RentalMode = ERentalMode.LongTerm });
        await db.SaveChangesAsync();
        var repo = new ApplicationRepository(db, MapperFactory.Create(), NullLogger<ApplicationRepository>.Instance);
        var result = await repo.AddApplication(new AddRentalApplicationDto
            { PropertyId = 7, UnitId = unitId, FirstName = "Applicant", Status = EApplicationStatus.Submitted }, 42, 20);
        Assert.Equal(unitId, result.UnitId);
        Assert.True(await db.RentalApplications.AnyAsync(a => a.Id == result.Id));
    }

    [Fact]
    public void BothApplicationCreationPathsReportRepositoryModeConflict()
    {
        var root = new DirectoryInfo(AppContext.BaseDirectory);
        while (root != null && !System.IO.File.Exists(Path.Combine(root.FullName, "property-peace-api", "Services", "ApplicationService", "ApplicationService.cs"))) root = root.Parent;
        Assert.NotNull(root);
        var source = System.IO.File.ReadAllText(Path.Combine(root!.FullName, "property-peace-api", "Services", "ApplicationService", "ApplicationService.cs"));
        foreach (var method in new[] { "AddApplication(AddRentalApplicationDto", "SubmitPublicApplicationAsync(PublicApplicationSubmitDto" })
        {
            var start = source.IndexOf(method, StringComparison.Ordinal);
            Assert.True(start >= 0);
            var end = source.IndexOf("public async Task<", start + method.Length, StringComparison.Ordinal);
            var body = end < 0 ? source[start..] : source[start..end];
            Assert.Contains("catch (InvalidOperationException ex) when (ex.Message.StartsWith(\"Long-term application unavailable\"", body);
            Assert.Contains("409", body);
        }
    }

    [Fact]
    public void MutationUsesUnitLocksInsideTransactionUntilCommit()
    {
        var root = new DirectoryInfo(AppContext.BaseDirectory);
        while (root != null && !System.IO.File.Exists(Path.Combine(root.FullName, "property-peace-api", "Repositories", "Applications", "ApplicationRepository.cs"))) root = root.Parent;
        Assert.NotNull(root);
        var source = System.IO.File.ReadAllText(Path.Combine(root!.FullName, "property-peace-api", "Repositories", "Applications", "ApplicationRepository.cs"));
        var body = source[source.IndexOf("public async Task<LoadRentalApplicationDto> AddApplication(", StringComparison.Ordinal)..
            source.IndexOf("public async Task<LoadRentalApplicationDto?> GetApplicationById", StringComparison.Ordinal)];
        Assert.Contains("BeginTransactionAsync(IsolationLevel.Serializable)", body);
        Assert.Contains("RequireLongTermTargetAsync", body);
        Assert.True(body.IndexOf("RequireLongTermTargetAsync", StringComparison.Ordinal) < body.IndexOf("SaveChangesAsync", StringComparison.Ordinal));
        Assert.True(body.IndexOf("CommitAsync", StringComparison.Ordinal) > body.IndexOf("SaveChangesAsync", StringComparison.Ordinal));
        Assert.Contains("WITH (UPDLOCK, HOLDLOCK) WHERE Id = {0}", source);
        Assert.Contains("WITH (UPDLOCK, HOLDLOCK) WHERE PropertyId = {0}", source);
    }
}
