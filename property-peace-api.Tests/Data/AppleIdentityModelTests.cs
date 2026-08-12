using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace brownstone_hub_api.Tests.Schema;

public class AppleIdentityModelTests
{
    [Fact]
    public void UserAppleId_IsNullableAndHasFilteredUniqueIndex()
    {
        var options = new DbContextOptionsBuilder<DataContext>()
            .UseInMemoryDatabase($"apple-model-{Guid.NewGuid()}")
            .Options;
        using var context = new DataContext(options);

        var userType = context.Model.FindEntityType(typeof(User));
        var appleId = userType!.FindProperty(nameof(User.AppleId));
        var index = userType.GetIndexes()
            .SingleOrDefault(candidate => candidate.Properties.Count == 1 && candidate.Properties[0] == appleId);

        appleId.Should().NotBeNull();
        appleId!.IsNullable.Should().BeTrue();
        index.Should().NotBeNull();
        index!.IsUnique.Should().BeTrue();
        index.GetFilter().Should().Be("[AppleId] IS NOT NULL");
    }
}
