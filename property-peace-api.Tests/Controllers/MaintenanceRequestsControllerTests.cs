using brownstone_hub_api.Controllers;
using brownstone_hub_api.Dtos.Maintenance;
using brownstone_hub_api.Dtos.MaintenanceRequest;
using brownstone_hub_api.Services.Maintenance;
using brownstone_hub_api.Middleware;
using FluentAssertions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using System.Reflection;
using Xunit;

namespace brownstone_hub_api.Tests.Controllers;

public sealed class MaintenanceRequestsControllerTests
{
    [Theory]
    [InlineData(nameof(MaintenanceRequestsController.List))]
    [InlineData(nameof(MaintenanceRequestsController.Get))]
    [InlineData(nameof(MaintenanceRequestsController.Create))]
    [InlineData(nameof(MaintenanceRequestsController.Troubleshoot))]
    [InlineData(nameof(MaintenanceRequestsController.RecordTroubleshootingOutcome))]
    [InlineData(nameof(MaintenanceRequestsController.ConfirmAppointment))]
    [InlineData(nameof(MaintenanceRequestsController.CancelAppointment))]
    [InlineData(nameof(MaintenanceRequestsController.ConfirmCompletion))]
    [InlineData(nameof(MaintenanceRequestsController.ReopenCompletion))]
    [InlineData(nameof(MaintenanceRequestsController.ListAttachments))]
    [InlineData(nameof(MaintenanceRequestsController.UploadAttachment))]
    [InlineData(nameof(MaintenanceRequestsController.DeleteAttachment))]
    [InlineData(nameof(MaintenanceRequestsController.DownloadAttachment))]
    public void TenantMaintenanceRoute_UsesLeaseValidatedOrganization(string action) =>
        typeof(MaintenanceRequestsController).GetMethod(action)!
            .GetCustomAttribute<TenantSelfOrganizationAttribute>()!.AllowWithoutOrganization.Should().BeFalse();

    [Theory]
    [InlineData(nameof(MaintenanceRequestsController.Acknowledge))]
    [InlineData(nameof(MaintenanceRequestsController.ChangeStatus))]
    [InlineData(nameof(MaintenanceRequestsController.Assign))]
    [InlineData(nameof(MaintenanceRequestsController.ApproveEstimate))]
    [InlineData(nameof(MaintenanceRequestsController.IssueWorkOrder))]
    [InlineData(nameof(MaintenanceRequestsController.StaffCloseCompletion))]
    [InlineData(nameof(MaintenanceRequestsController.CostProjection))]
    public void ManagerOnlyMaintenanceRoute_DoesNotInheritTenantLeaseAuthority(string action) =>
        typeof(MaintenanceRequestsController).GetMethod(action)!
            .GetCustomAttribute<TenantSelfOrganizationAttribute>().Should().BeNull();

    [Fact]
    public async Task LegacySingularCreateAndUnsafeReads_AreGone_AndNeverInvokeBypassService()
    {
        var legacy = new Mock<brownstone_hub_api.Services.MaintenanceRequestService.IMaintenanceRequestService>();
        var controller = new MaintenanceRequestController(legacy.Object);

        var create = await controller.AddMaintenanceRequest("{}", []);
        var byId = await controller.GetMaintenanceRequestById(42);
        var byProperty = await controller.GetMaintenanceRequestsByPropertyId(7);
        var byUnit = await controller.GetMaintenanceRequestsByUnitId(9);
        var tenantMessage = await controller.GenerateTenantMessage(42);

        foreach (var result in new[] { create, byId, byProperty, byUnit, tenantMessage })
            result.Should().BeOfType<ObjectResult>().Which.StatusCode.Should().Be(StatusCodes.Status410Gone);
        legacy.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task LegacySingularPut_IsGone_AndCannotInvokeBypassService()
    {
        var legacy = new Mock<brownstone_hub_api.Services.MaintenanceRequestService.IMaintenanceRequestService>();
        var controller = new MaintenanceRequestController(legacy.Object);

        var result = await controller.UpdateMaintenanceRequest(42, new UpdateMaintenanceRequestDto());

        result.Should().BeOfType<ObjectResult>().Which.StatusCode.Should().Be(410);
        legacy.Verify(x => x.UpdateMaintenanceRequest(It.IsAny<long>(), It.IsAny<UpdateMaintenanceRequestDto>()), Times.Never);
    }

    [Fact]
    public void Contract_UsesPluralRouteAndExposesOnlyNamedTransitions()
    {
        typeof(MaintenanceRequestsController).GetCustomAttributes(typeof(RouteAttribute), true)
            .Cast<RouteAttribute>().Single().Template.Should().Be("api/maintenance-requests");
        typeof(MaintenanceRequestsController).GetCustomAttributes(typeof(AuthorizeAttribute), true).Should().ContainSingle();

        var methods = typeof(MaintenanceRequestsController).GetMethods()
            .Where(method => method.DeclaringType == typeof(MaintenanceRequestsController)).ToArray();
        methods.Should().Contain(method => method.GetCustomAttributes(typeof(HttpPostAttribute), true).Cast<HttpPostAttribute>().Any(x => x.Template == "{id:long}/acknowledge"));
        methods.Should().Contain(method => method.GetCustomAttributes(typeof(HttpPostAttribute), true).Cast<HttpPostAttribute>().Any(x => x.Template == "{id:long}/percy/troubleshooting"));
        methods.Should().Contain(method => method.GetCustomAttributes(typeof(HttpPostAttribute), true).Cast<HttpPostAttribute>().Any(x => x.Template == "{id:long}/percy/troubleshooting/{stepId:long}/outcome"));
        methods.Should().Contain(method => method.GetCustomAttributes(typeof(HttpGetAttribute), true).Cast<HttpGetAttribute>().Any(x => string.IsNullOrEmpty(x.Template)));
        typeof(MaintenanceRequestsController).GetCustomAttributes(typeof(AuthorizeAttribute), true).Cast<AuthorizeAttribute>().Single().Roles
            .Should().Contain("Vendor");
        methods.Should().NotContain(method => method.GetCustomAttributes(typeof(HttpPutAttribute), true).Any());
    }

    [Theory]
    [InlineData(MaintenanceApiResultCode.NotFound, 404)]
    [InlineData(MaintenanceApiResultCode.BadRequest, 400)]
    [InlineData(MaintenanceApiResultCode.Conflict, 409)]
    [InlineData(MaintenanceApiResultCode.Unauthorized, 401)]
    public async Task Detail_MapsServiceFailuresWithoutLeakingScope(MaintenanceApiResultCode code, int status)
    {
        var service = new Mock<IMaintenanceRequestApiService>();
        service.Setup(x => x.GetAsync(42, It.IsAny<CancellationToken>()))
            .ReturnsAsync(MaintenanceApiResult<MaintenanceRequestDetailDto>.Error(code, "safe message"));
        var controller = new MaintenanceRequestsController(service.Object);

        var result = await controller.Get(42, CancellationToken.None);

        result.Should().BeAssignableTo<ObjectResult>().Which.StatusCode.Should().Be(status);
    }
}
