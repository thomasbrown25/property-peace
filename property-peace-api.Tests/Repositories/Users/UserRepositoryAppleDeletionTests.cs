using AutoMapper;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Tests.Helpers;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Repositories.Users;

public class UserRepositoryAppleDeletionTests
{
    [Fact]
    public async Task DeleteUser_ClearsAppleIdentityAndAnonymizesPersonalData()
    {
        await using var context = DbContextFactory.Create();
        var user = new User
        {
            Id = 1,
            Email = "owner@privaterelay.appleid.com",
            FirstName = "Pat",
            LastName = "Owner",
            PhoneNumber = "+15555550123",
            ProfileImageUrl = "https://example.test/avatar.png",
            GoogleId = "google-user-123",
            AppleId = "apple-user-123",
            PasswordHash = [1, 2, 3],
            PasswordSalt = [4, 5, 6],
            UserRoles = []
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();
        var repository = new UserRepository(
            context,
            new HttpContextAccessor(),
            NullLogger<UserRepository>.Instance,
            Mock.Of<IMapper>());

        await repository.DeleteUser(user);

        user.IsDeleted.Should().BeTrue();
        user.DeletedAt.Should().NotBeNull();
        user.Email.Should().StartWith("deleted_1_").And.EndWith("@deleted.local");
        user.FirstName.Should().Be("Deleted");
        user.LastName.Should().Be("User");
        user.PhoneNumber.Should().BeNull();
        user.ProfileImageUrl.Should().BeNull();
        user.GoogleId.Should().BeNull();
        user.AppleId.Should().BeNull();
        user.PasswordHash.Should().BeNull();
        user.PasswordSalt.Should().BeNull();
    }
}
