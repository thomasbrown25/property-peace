using brownstone_hub_api.Helpers;
using FluentAssertions;
using Xunit;

namespace brownstone_hub_api.Tests.Helpers
{
    public class PasswordValidatorTests
    {
        [Theory]
        [InlineData("Password1!")]
        [InlineData("Password1?")]
        [InlineData("Passw0rd_")]
        public void ValidatePassword_ReturnsValid_WhenPasswordMatchesFrontendRules(string password)
        {
            var result = PasswordValidator.ValidatePassword(password);

            result.IsValid.Should().BeTrue(result.ErrorMessage);
        }

        [Theory]
        [InlineData("PASSWORD1!", "lowercase")]
        [InlineData("Password!", "number")]
        [InlineData("Password1", "special character")]
        [InlineData("Password1/", "special character")]
        public void ValidatePassword_ReturnsFailure_WhenPasswordDoesNotMatchFrontendRules(string password, string expectedMessage)
        {
            var result = PasswordValidator.ValidatePassword(password);

            result.IsValid.Should().BeFalse();
            result.ErrorMessage.Should().Contain(expectedMessage);
        }
    }
}
