using brownstone_hub_api.Models;
using FluentAssertions;
using Xunit;

namespace brownstone_hub_api.Tests
{
    public class ServiceResponseTests : IDisposable
    {
        public void Dispose()
        {
            ServiceResponseSettings.ShowDetailedErrors = true;
        }

        [Fact]
        public void CreateError_WhenDetailedErrorsAreDisabled_HidesErrorsObjectDetails()
        {
            ServiceResponseSettings.ShowDetailedErrors = false;

            var response = ServiceResponse<object>.CreateError(
                "Unable to purchase this SMS number right now.",
                "Provider returned error 123",
                "Inner provider exception",
                500);

            response.Success.Should().BeFalse();
            response.Message.Should().Be("Unable to purchase this SMS number right now.");
            response.StatusCode.Should().Be(500);
            response.Errors.Message.Should().BeNull();
            response.Errors.Details.Should().BeNull();
            response.Errors.InnerException.Should().BeNull();
        }

        [Fact]
        public void CreateError_WhenDetailedErrorsAreEnabled_IncludesErrorsObjectDetails()
        {
            ServiceResponseSettings.ShowDetailedErrors = true;

            var response = ServiceResponse<object>.CreateError(
                "Error generating PDF",
                "PDF template not found",
                "FileNotFoundException",
                500);

            response.Success.Should().BeFalse();
            response.Message.Should().Be("Error generating PDF");
            response.StatusCode.Should().Be(500);
            response.Errors.Message.Should().Be("Error generating PDF");
            response.Errors.Details.Should().Be("PDF template not found");
            response.Errors.InnerException.Should().Be("FileNotFoundException");
        }

        [Fact]
        public void CreateError_WhenDetailedErrorsAreSuppressed_HidesDetailsEvenWhenEnabled()
        {
            ServiceResponseSettings.ShowDetailedErrors = true;

            var response = ServiceResponse<object>.CreateError(
                "Twilio SMS failed",
                "Provider credentials rejected",
                "TwilioException",
                500,
                suppressDetailedErrors: true);

            response.Success.Should().BeFalse();
            response.Message.Should().Be("Twilio SMS failed");
            response.Errors.Message.Should().BeNull();
            response.Errors.Details.Should().BeNull();
            response.Errors.InnerException.Should().BeNull();
        }
    }
}
