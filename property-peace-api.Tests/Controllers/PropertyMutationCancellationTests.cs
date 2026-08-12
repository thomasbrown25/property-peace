using brownstone_hub_api.Controllers;
using brownstone_hub_api.Dtos.Property;
using brownstone_hub_api.Services.PropertyService;
using Microsoft.AspNetCore.Http;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Controllers;

public sealed class PropertyMutationCancellationTests
{
    [Fact]
    public async Task Controller_passes_request_cancellation_to_property_service()
    {
        var service = new Mock<IPropertyService>();
        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();
        service.Setup(x => x.AddOrUpdateProperty(
                It.IsAny<UpdatePropertyDto>(), It.IsAny<List<IFormFile>>(), cancellation.Token))
            .ThrowsAsync(new OperationCanceledException(cancellation.Token));
        var controller = new PropertyController(service.Object);

        var exception = await Assert.ThrowsAsync<OperationCanceledException>(() =>
            controller.AddOrUpdateProperty("{}", [], cancellation.Token));

        Assert.Equal(cancellation.Token, exception.CancellationToken);
        service.Verify(x => x.AddOrUpdateProperty(
            It.IsAny<UpdatePropertyDto>(), It.IsAny<List<IFormFile>>(), cancellation.Token), Times.Once);
    }

    [Fact]
    public void Property_service_threads_token_through_atomic_initial_unit_creation_and_rethrows_cancellation()
    {
        var sourcePath = Path.Combine(
            FindRepositoryRoot(), "property-peace-api", "Services", "PropertyService", "PropertyService.cs");
        var source = File.ReadAllText(sourcePath);

        Assert.Contains("_mutationCoordinator.ExecuteAsync(", source);
        Assert.Contains("_unitRepository.AddUnit(", source);
        Assert.Contains("_unitRepository.BulkCreateUnits(", source);
        Assert.Contains("catch (OperationCanceledException)", source);
        Assert.DoesNotContain("_unitService.AddOrUpdateUnit", source);
        Assert.DoesNotContain("_unitService.BulkCreateUnits", source);
    }

    private static string FindRepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null)
        {
            if (Directory.Exists(Path.Combine(directory.FullName, "property-peace-api")))
            {
                return directory.FullName;
            }

            directory = directory.Parent;
        }

        throw new DirectoryNotFoundException("Could not locate repository root.");
    }
}
