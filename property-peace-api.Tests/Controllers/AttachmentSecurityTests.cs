using System.Reflection;
using System.Security.Claims;
using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.AttachmentAccess;
using brownstone_hub_api.Services.ImageService;
using brownstone_hub_api.Services.MaintenanceImageService;
using brownstone_hub_api.Services.ExpenseReceiptService;
using brownstone_hub_api.Services.AzureBlobService;
using brownstone_hub_api.Services.StorageService;
using brownstone_hub_api.Repositories.Images;
using brownstone_hub_api.Repositories.MaintenanceImages;
using brownstone_hub_api.Repositories.ExpenseReceipts;
using brownstone_hub_api.Dtos.Image;
using Azure.Storage.Blobs;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Configuration;
using Moq;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using brownstone_hub_api.Controllers;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace brownstone_hub_api.Tests.Controllers;

public sealed class AttachmentSecurityTests
{
    [Theory]
    [InlineData(false, 10, 1, 1, true)] // owner
    [InlineData(false, 10, 2, 1, false)] // other organization
    [InlineData(false, 10, 3, 1, false)] // unrelated member of same organization
    [InlineData(true, 10, 4, 1, true)] // submitting tenant
    [InlineData(true, 10, 5, 1, false)] // different tenant in same organization
    [InlineData(true, 10, 4, 2, false)] // mismatched selected organization
    public async Task MaintenanceScopeRequiresParentOwnershipAndActor(bool tenant, long requestId, long actorId, long selectedOrg, bool allowed)
    {
        await using var db = NewContext();
        Seed(db);
        var access = NewAccess(db, actorId, selectedOrg, tenant ? "Tenant" : "Landlord");
        (await access.CanAccessMaintenanceAsync(requestId)).Should().Be(allowed);
        (await access.CanAccessMaintenanceImageAsync(100)).Should().Be(allowed);
    }

    [Theory]
    [InlineData(1, 1, true)]
    [InlineData(2, 1, false)] // other organization owner
    [InlineData(3, 1, false)] // same organization, not authorized
    [InlineData(1, 2, false)] // selected other organization
    public async Task ReceiptScopeRequiresParentOwnershipAndBillingAuthority(long actorId, long selectedOrg, bool allowed)
    {
        await using var db = NewContext();
        Seed(db);
        var access = NewAccess(db, actorId, selectedOrg, "Landlord");
        (await access.CanAccessExpenseAsync(20)).Should().Be(allowed);
        (await access.CanAccessExpenseReceiptAsync(200)).Should().Be(allowed);
    }

    [Fact]
    public async Task CrossOrganizationParentIsRejectedDespiteLocalMembership()
    {
        await using var db = NewContext(); Seed(db);
        var owner = NewAccess(db, 1, 1, "Landlord");
        (await owner.CanAccessMaintenanceAsync(11)).Should().BeFalse();
        (await owner.CanAccessMaintenanceImageAsync(101)).Should().BeFalse();
        (await owner.CanAccessExpenseAsync(21)).Should().BeFalse();
        (await owner.CanAccessExpenseReceiptAsync(201)).Should().BeFalse();
    }

    [Fact]
    public async Task ManagerPermissionsGrantOnlyRelevantAttachments()
    {
        await using var db = NewContext(); Seed(db);
        db.OrganizationMembers.Add(new OrganizationMember { Id = 4, OrganizationId = 1, UserId = 7,
            Role = "Manager", IsActive = true, CanManageMaintenance = true });
        db.SaveChanges();
        var manager = NewAccess(db, 7, 1, "Landlord");
        (await manager.CanAccessMaintenanceAsync(10)).Should().BeTrue();
        (await manager.CanAccessExpenseAsync(20)).Should().BeFalse();
        db.OrganizationMembers.Single(m => m.UserId == 7).CanManageBilling = true;
        db.SaveChanges();
        (await manager.CanAccessExpenseAsync(20)).Should().BeTrue();
        db.OrganizationMembers.Single(m => m.UserId == 3).CanManageMaintenance = true;
        db.OrganizationMembers.Single(m => m.UserId == 3).CanManageBilling = true;
        db.SaveChanges();
        var viewer = NewAccess(db, 3, 1, "Landlord");
        (await viewer.CanAccessMaintenanceAsync(10)).Should().BeFalse();
        (await viewer.CanAccessExpenseAsync(20)).Should().BeFalse();
    }

    private static DataContext NewContext() => new(new DbContextOptionsBuilder<DataContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private static void Seed(DataContext db)
    {
        db.Properties.AddRange(new Property { Id = 1, OrganizationId = 1, LandlordId = 1 },
            new Property { Id = 2, OrganizationId = 2, LandlordId = 2 });
        db.MaintenanceRequests.AddRange(new MaintenanceRequest { Id = 10, OrganizationId = 1, PropertyId = 1, SubmittedByUserId = 4 },
            new MaintenanceRequest { Id = 11, OrganizationId = 2, PropertyId = 2, SubmittedByUserId = 6 });
        db.Expenses.AddRange(new Expense { Id = 20, OrganizationId = 1, PropertyId = 1, LandlordId = 1 },
            new Expense { Id = 21, OrganizationId = 2, PropertyId = 2, LandlordId = 2 });
        db.MaintenanceImages.AddRange(new MaintenanceImage { Id = 100, RefId = 10, BlobName = "a", BlobUrl = "a" },
            new MaintenanceImage { Id = 101, RefId = 11, BlobName = "b", BlobUrl = "b" });
        db.ExpenseReceipts.AddRange(new ExpenseReceipt { Id = 200, RefId = 20, BlobName = "c", BlobUrl = "c" },
            new ExpenseReceipt { Id = 201, RefId = 21, BlobName = "d", BlobUrl = "d" });
        db.OrganizationMembers.AddRange(
            new OrganizationMember { Id = 1, OrganizationId = 1, UserId = 1, Role = "Owner", IsActive = true },
            new OrganizationMember { Id = 2, OrganizationId = 2, UserId = 2, Role = "Owner", IsActive = true },
            new OrganizationMember { Id = 3, OrganizationId = 1, UserId = 3, Role = "Viewer", IsActive = true });
        db.SaveChanges();
    }

    private static AttachmentAccessService NewAccess(DataContext db, long actorId, long organizationId, string role)
    {
        var context = new DefaultHttpContext();
        context.Items["OrganizationId"] = organizationId;
        context.User = new ClaimsPrincipal(new ClaimsIdentity(new[] {
            new Claim(ClaimTypes.NameIdentifier, actorId.ToString()), new Claim(ClaimTypes.Role, role)
        }, "test"));
        return new AttachmentAccessService(db, new HttpContextAccessor { HttpContext = context });
    }

    [Theory]
    [InlineData(false, 2)] // foreign organization
    [InlineData(false, 3)] // local viewer
    [InlineData(true, 5)]  // local tenant who did not submit
    public async Task DeniedMaintenanceOperationsNeverReachImageRepositoryOrBlob(bool tenant, long actorId)
    {
        await using var db = NewContext(); Seed(db);
        var access = NewAccess(db, actorId, 1, tenant ? "Tenant" : "Landlord");
        var blobs = new Mock<BlobServiceClient>();
        var sas = new Mock<IAzureBlobService>();
        var repository = new Mock<IImageRepository<MaintenanceImage, LoadImageDto, AddImageDto>>();
        var service = new ImageService<MaintenanceImage, LoadImageDto, AddImageDto>(blobs.Object, sas.Object, repository.Object,
            NullLogger<ImageService<MaintenanceImage, LoadImageDto, AddImageDto>>.Instance, Mock.Of<IStorageService>(),
            new HttpContextAccessor(), "maintenance-images", access);
        (await service.AddImages(10, [])).StatusCode.Should().Be(404);
        (await service.GetImagesByRefId(10)).StatusCode.Should().Be(404);
        (await service.DeleteImageById(100)).StatusCode.Should().Be(404);
        (await service.DeleteImagesByRefId(10)).StatusCode.Should().Be(404);
        (await service.DeleteImage("a")).StatusCode.Should().Be(404);
        repository.VerifyNoOtherCalls(); blobs.VerifyNoOtherCalls(); sas.VerifyNoOtherCalls();
    }

    [Theory]
    [InlineData(2)] // foreign organization
    [InlineData(3)] // local viewer
    public async Task DeniedReceiptOperationsNeverReachImageRepositoryOrBlob(long actorId)
    {
        await using var db = NewContext(); Seed(db);
        var access = NewAccess(db, actorId, 1, "Landlord");
        var blobs = new Mock<BlobServiceClient>();
        var sas = new Mock<IAzureBlobService>();
        var repository = new Mock<IImageRepository<ExpenseReceipt, LoadImageDto, AddImageDto>>();
        var service = new ImageService<ExpenseReceipt, LoadImageDto, AddImageDto>(blobs.Object, sas.Object, repository.Object,
            NullLogger<ImageService<ExpenseReceipt, LoadImageDto, AddImageDto>>.Instance, Mock.Of<IStorageService>(),
            new HttpContextAccessor(), "expense-receipts", access);
        (await service.AddImages(20, [])).StatusCode.Should().Be(404);
        (await service.GetImagesByRefId(20)).StatusCode.Should().Be(404);
        (await service.DeleteImageById(200)).StatusCode.Should().Be(404);
        (await service.DeleteImagesByRefId(20)).StatusCode.Should().Be(404);
        (await service.DeleteImage("c")).StatusCode.Should().Be(404);
        repository.VerifyNoOtherCalls(); blobs.VerifyNoOtherCalls(); sas.VerifyNoOtherCalls();
    }

    [Theory]
    [InlineData(false, 2)]
    [InlineData(true, 5)]
    public async Task SpecializedDeletionRejectsBeforeRepositoryAndBlob(bool maintenance, long actorId)
    {
        await using var db = NewContext(); Seed(db);
        var access = NewAccess(db, actorId, 1, maintenance ? "Tenant" : "Landlord");
        var blobs = new Mock<BlobServiceClient>();
        var sas = new Mock<IAzureBlobService>();
        if (maintenance)
        {
            var repo = new Mock<IMaintenanceImageRepository>();
            var service = new MaintenanceImageService(blobs.Object, sas.Object, repo.Object,
                Mock.Of<IConfiguration>(), NullLogger<MaintenanceImageService>.Instance, access);
            (await service.DeleteMaintenanceImage(100)).StatusCode.Should().Be(404);
            repo.VerifyNoOtherCalls();
        }
        else
        {
            var repo = new Mock<IExpenseReceiptRepository>();
            var service = new ExpenseReceiptService(blobs.Object, sas.Object, repo.Object,
                Mock.Of<IConfiguration>(), NullLogger<ExpenseReceiptService>.Instance, access);
            (await service.DeleteExpenseReceipt(200)).StatusCode.Should().Be(404);
            repo.VerifyNoOtherCalls();
        }
        blobs.VerifyNoOtherCalls(); sas.VerifyNoOtherCalls();
    }

    [Theory]
    [InlineData(true, 5)] // same-org tenant who did not submit
    [InlineData(false, 3)] // same-org viewer cannot see receipts
    public async Task SpecializedReadAndUploadRejectBeforeRepositoryAndBlob(bool maintenance, long actorId)
    {
        await using var db = NewContext(); Seed(db);
        var access = NewAccess(db, actorId, 1, maintenance ? "Tenant" : "Landlord");
        var blobs = new Mock<BlobServiceClient>();
        var sas = new Mock<IAzureBlobService>();
        if (maintenance)
        {
            var repo = new Mock<IMaintenanceImageRepository>();
            var service = new MaintenanceImageService(blobs.Object, sas.Object, repo.Object,
                Mock.Of<IConfiguration>(), NullLogger<MaintenanceImageService>.Instance, access);
            (await service.AddMaintenanceImages(10, [])).StatusCode.Should().Be(404);
            (await service.GetMaintenanceImages(10)).StatusCode.Should().Be(404);
            repo.VerifyNoOtherCalls();
        }
        else
        {
            var repo = new Mock<IExpenseReceiptRepository>();
            var service = new ExpenseReceiptService(blobs.Object, sas.Object, repo.Object,
                Mock.Of<IConfiguration>(), NullLogger<ExpenseReceiptService>.Instance, access);
            (await service.AddExpenseReceipts(20, [])).StatusCode.Should().Be(404);
            (await service.GetExpenseReceipts(20)).StatusCode.Should().Be(404);
            repo.VerifyNoOtherCalls();
        }
        blobs.VerifyNoOtherCalls(); sas.VerifyNoOtherCalls();
    }

    [Fact]
    public void CrashRouteIsNotMappedButNormalDebugRouteRemains()
    {
        typeof(DebugController).GetCustomAttribute<RouteAttribute>()!.Template.Should().Be("api/[controller]");
        typeof(DebugController).GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
            .SelectMany(method => method.GetCustomAttributes<HttpGetAttribute>().Select(route => route.Template))
            .Should().NotContain("crash").And.Contain("throw-500");
    }
}
