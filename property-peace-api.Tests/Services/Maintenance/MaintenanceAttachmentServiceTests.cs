using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.Maintenance;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Maintenance;

public sealed class MaintenanceAttachmentServiceTests
{
    private static readonly DateTimeOffset Now = new(2026, 8, 9, 12, 0, 0, TimeSpan.Zero);

    [Theory]
    [InlineData("photo.jpg", "image/jpeg", MaintenanceAttachmentMediaType.Photo)]
    [InlineData("photo.png", "image/png", MaintenanceAttachmentMediaType.Photo)]
    [InlineData("photo.webp", "image/webp", MaintenanceAttachmentMediaType.Photo)]
    [InlineData("clip.mp4", "video/mp4", MaintenanceAttachmentMediaType.Video)]
    [InlineData("clip.mov", "video/quicktime", MaintenanceAttachmentMediaType.Video)]
    public async Task Upload_AcceptsAllowlistedPhotoAndVideo_AndReturnsMetadataWithoutBlobUrl(string name, string contentType, MaintenanceAttachmentMediaType media)
    {
        await using var db = Db(); Seed(db);
        var storage = new FakeStorage();
        var result = await Service(db, Vendor, storage).UploadAsync(100, MaintenanceAttachmentPurpose.Completion, File(name, contentType, 32));
        result.Code.Should().Be(MaintenanceApiResultCode.Success);
        result.Value!.MediaType.Should().Be(media);
        result.Value.GetType().GetProperties().Should().NotContain(x => x.Name.Contains("Url", StringComparison.OrdinalIgnoreCase) || x.Name == "BlobName");
        storage.PutNames.Should().HaveCount(2);
        storage.PutNames[0].Should().StartWith("staging/");
    }

    [Fact]
    public async Task Upload_RejectsMismatchedType_Oversize_AndEleventhPerPurposeCycle()
    {
        await using var db = Db(); Seed(db);
        var storage = new FakeStorage(); var service = Service(db, Vendor, storage);
        (await service.UploadAsync(100, MaintenanceAttachmentPurpose.Completion, File("bad.exe", "image/jpeg", 1))).Code.Should().Be(MaintenanceApiResultCode.BadRequest);
        (await service.UploadAsync(100, MaintenanceAttachmentPurpose.Completion, File("large.jpg", "image/jpeg", 10 * 1024 * 1024 + 1))).Code.Should().Be(MaintenanceApiResultCode.BadRequest);
        for (var i = 0; i < 10; i++) db.MaintenanceAttachments.Add(Attachment(i));
        await db.SaveChangesAsync();
        var limit = await service.UploadAsync(100, MaintenanceAttachmentPurpose.Completion, File("next.jpg", "image/jpeg", 3));
        limit.Code.Should().Be(MaintenanceApiResultCode.Conflict);
        limit.ErrorCode.Should().Be("maintenance.attachment_limit");
    }

    [Fact]
    public async Task ListUploadDelete_EnforceRequestScopeAcrossOrganizations()
    {
        await using var db = Db(); Seed(db); db.MaintenanceAttachments.Add(Attachment(1)); await db.SaveChangesAsync();
        var storage = new FakeStorage(); var outsider = Service(db, new MaintenanceActor(999, false, true), storage);
        (await outsider.ListAsync(100)).Code.Should().Be(MaintenanceApiResultCode.NotFound);
        (await outsider.UploadAsync(100, MaintenanceAttachmentPurpose.Completion, File("x.jpg", "image/jpeg", 1))).Code.Should().Be(MaintenanceApiResultCode.NotFound);
        (await outsider.DeleteAsync(100, 1)).Code.Should().Be(MaintenanceApiResultCode.NotFound);
        storage.PutNames.Should().BeEmpty(); storage.DeleteNames.Should().BeEmpty();
    }

    [Fact]
    public async Task CompletionEvidence_CanBeDownloadedByScopedActor_AndCannotBeDeletedAfterSubmission()
    {
        await using var db = Db(); Seed(db); var attachment = Attachment(0); db.MaintenanceAttachments.Add(attachment);
        db.MaintenanceCompletions.Add(new MaintenanceCompletion { Id = 9, MaintenanceRequestId = 100, MaintenanceWorkOrderId = 1,
            CompletionEvidenceReference = "attachments:1", ResolutionNotes = "fixed", FinalCost = 1 });
        await db.SaveChangesAsync();
        var storage = new FakeStorage(); storage.Blobs[attachment.BlobName] = new byte[] { 0xFF, 0xD8, 0xFF };
        var service = Service(db, Vendor, storage);
        var download = await service.DownloadAsync(100, 1);
        var deletion = await service.DeleteAsync(100, 1);
        download.Code.Should().Be(MaintenanceApiResultCode.Success);
        deletion.Code.Should().Be(MaintenanceApiResultCode.Conflict);
        deletion.ErrorCode.Should().Be("maintenance.attachment_immutable");
    }

    [Fact]
    public async Task UploadAndDelete_CreateActorAwareDurableAuditOutbox_AndLifecycleFreezesPurpose()
    {
        await using var db = Db(); Seed(db);
        var request = await db.MaintenanceRequests.FindAsync(100L);
        request!.Status = EMaintenanceStatus.InProgress;
        await db.SaveChangesAsync();
        var service = Service(db, Vendor, new FakeStorage());

        var uploaded = await service.UploadAsync(100, MaintenanceAttachmentPurpose.Completion, File("proof.jpg", "image/jpeg", 32));
        var activity = await db.MaintenanceActivityEvents.SingleAsync();
        activity.ActorUserId.Should().Be(70);
        activity.EventType.Should().Be("attachment.uploaded");
        (await db.MaintenanceTimelineOutboxes.SingleAsync()).MaintenanceActivityEventId.Should().Be(activity.Id);

        request.Status = EMaintenanceStatus.AwaitingTenant;
        await db.SaveChangesAsync();
        var frozen = await service.DeleteAsync(100, uploaded.Value!.Id);
        frozen.ErrorCode.Should().Be("maintenance.attachment_immutable");
    }

    [Fact]
    public async Task Upload_WhenRelationalFinalizationFailsAfterBlobPut_RemainsDurablyRecoverable()
    {
        var storage = new FakeStorage();
        var failure = new FailAfterStorageInterceptor(storage, failDelete: false);
        await using var db = Db(Guid.NewGuid().ToString(), failure); Seed(db);

        await FluentActions.Invoking(() => Service(db, Vendor, storage)
            .UploadAsync(100, MaintenanceAttachmentPurpose.Completion, File("proof.jpg", "image/jpeg", 32)))
            .Should().ThrowAsync<InvalidOperationException>();

        db.ChangeTracker.Clear();
        var pending = await db.MaintenanceAttachments.SingleAsync();
        pending.LifecycleState.Should().Be(MaintenanceAttachmentLifecycleState.PendingUpload);
        pending.StagingBlobName.Should().NotBeNull();
        storage.Blobs.Should().ContainKey(pending.StagingBlobName!);
        (await Service(db, Vendor, storage).ListAsync(100)).Value.Should().BeEmpty();

        (await Service(db, Vendor, storage).ProcessPendingLifecycleAsync()).Should().Be(1);
        (await db.MaintenanceAttachments.SingleAsync()).LifecycleState.Should().Be(MaintenanceAttachmentLifecycleState.Active);
        (await db.MaintenanceActivityEvents.SingleAsync()).EventType.Should().Be("attachment.uploaded");
    }

    [Fact]
    public async Task Delete_MarksPendingBeforePhysicalDelete_AndCompletesIdempotently()
    {
        var storage = new FakeStorage();
        await using var db = Db(); Seed(db);
        var attachment = Attachment(0);
        storage.Blobs[attachment.BlobName] = [0xFF, 0xD8, 0xFF];
        db.MaintenanceAttachments.Add(attachment);
        await db.SaveChangesAsync();

        (await Service(db, Vendor, storage).DeleteAsync(100, attachment.Id)).Code.Should().Be(MaintenanceApiResultCode.Success);
        (await Service(db, Vendor, storage).ListAsync(100)).Value.Should().BeEmpty();
        db.MaintenanceAttachments.Should().BeEmpty();
        storage.DeleteNames.Should().ContainSingle(attachment.BlobName);
        (await db.MaintenanceActivityEvents.SingleAsync()).EventType.Should().Be("attachment.deleted");
    }

    [Fact]
    public async Task PendingLifecycle_AfterOneItemFails_StillPersistsLaterItemsWithoutFalseCompletion()
    {
        await using var db = Db(); Seed(db);
        var missing = Attachment(0);
        var recoverable = Attachment(1);
        missing.LifecycleState = MaintenanceAttachmentLifecycleState.PendingUpload;
        recoverable.LifecycleState = MaintenanceAttachmentLifecycleState.PendingUpload;
        db.MaintenanceAttachments.AddRange(missing, recoverable);
        await db.SaveChangesAsync();
        var storage = new FakeStorage();
        storage.Blobs[recoverable.BlobName] = [0xFF, 0xD8, 0xFF];

        var completed = await Service(db, Vendor, storage).ProcessPendingLifecycleAsync();

        completed.Should().Be(1);
        db.ChangeTracker.Clear();
        (await db.MaintenanceAttachments.FindAsync(missing.Id))!.LifecycleState
            .Should().Be(MaintenanceAttachmentLifecycleState.PendingUpload);
        (await db.MaintenanceAttachments.FindAsync(recoverable.Id))!.LifecycleState
            .Should().Be(MaintenanceAttachmentLifecycleState.Active);
    }

    [Fact]
    public void AttachmentModel_IndexesLifecycleWithinTheSerializedLimitScope()
    {
        using var db = Db();
        var entity = db.Model.FindEntityType(typeof(MaintenanceAttachment))!;
        entity.GetIndexes().Should().Contain(index => index.Properties.Select(property => property.Name)
            .SequenceEqual(new[] { "MaintenanceRequestId", "Purpose", "ResolutionCycle", "LifecycleState" }));
    }

    private static MaintenanceAttachment Attachment(int i) => new()
    {
        Id = i + 1, MaintenanceRequestId = 100, Purpose = MaintenanceAttachmentPurpose.Completion, ResolutionCycle = 1,
        MediaType = MaintenanceAttachmentMediaType.Photo, FileName = $"{i}.jpg", ContentType = "image/jpeg", SizeBytes = 1,
        BlobName = $"private/{Guid.NewGuid():N}.jpg", UploadedByUserId = 70, CreatedAtUtc = Now,
        LifecycleState = MaintenanceAttachmentLifecycleState.Active
    };
    private static IFormFile File(string name, string contentType, int size)
    {
        var bytes = new byte[size];
        if (size >= 3 && contentType == "image/jpeg") { bytes[0] = 0xFF; bytes[1] = 0xD8; bytes[2] = 0xFF; }
        if (size >= 8 && contentType == "image/png") new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }.CopyTo(bytes, 0);
        if (size >= 12 && contentType == "image/webp") { System.Text.Encoding.ASCII.GetBytes("RIFF").CopyTo(bytes, 0); System.Text.Encoding.ASCII.GetBytes("WEBP").CopyTo(bytes, 8); }
        if (size >= 12 && contentType.StartsWith("video/")) System.Text.Encoding.ASCII.GetBytes("ftyp").CopyTo(bytes, 4);
        return new FormFile(new MemoryStream(bytes), 0, size, "file", name) { Headers = new HeaderDictionary(), ContentType = contentType };
    }
    private static readonly MaintenanceActor Vendor = new(70, false, false, true);
    private static MaintenanceAttachmentService Service(DataContext db, MaintenanceActor actor, FakeStorage storage,
        IMaintenanceTransactionSideEffects? sideEffects = null) =>
        new(db, new Actor(actor), storage, new FixedTime(Now), sideEffects ?? new MaintenanceTransactionSideEffects());
    private static DataContext Db(string? name = null, params IInterceptor[] interceptors) => new(new DbContextOptionsBuilder<DataContext>()
        .UseInMemoryDatabase(name ?? Guid.NewGuid().ToString()).AddInterceptors(interceptors).Options);
    private static void Seed(DataContext db)
    {
        db.Properties.Add(new Property { Id = 40, LandlordId = 61, OrganizationId = 60, Name = "Home" });
        db.Units.Add(new Unit { Id = 50, PropertyId = 40, Name = "1A" });
        db.Tenants.Add(new Tenant { Id = 20, UserId = 10, Firstname = "T", Lastname = "U", OrganizationId = 60 });
        db.Leases.Add(new Lease { Id = 30, UnitId = 50, OrganizationId = 60, IsActive = true, IsDeleted = false });
        db.TenantLeases.Add(new TenantLease { TenantId = 20, LeaseId = 30 });
        db.Vendors.Add(new Vendor { Id = 700, LandlordId = 61, OrganizationId = 60, PortalUserId = 70, Name = "Vendor", IsActive = true });
        db.MaintenanceRequests.Add(new MaintenanceRequest { Id = 100, PropertyId = 40, UnitId = 50, OrganizationId = 60, SubmittedByUserId = 10, Title = "Leak", Description = "Leak", UnitName = "1A", Status = EMaintenanceStatus.InProgress, AssignedToType = EAssignedToType.Vendor, AssignedToUserId = 70, VendorId = 700, ResolutionCycle = 1 });
        db.SaveChanges();
    }
    private sealed class Actor(MaintenanceActor actor) : IMaintenanceActorAccessor { public Task<MaintenanceActor?> GetCurrentAsync(CancellationToken cancellationToken = default) => Task.FromResult<MaintenanceActor?>(actor); }
    private sealed class FixedTime(DateTimeOffset now) : TimeProvider { public override DateTimeOffset GetUtcNow() => now; }
    private sealed class FakeStorage : IMaintenanceAttachmentStorage
    {
        public List<string> PutNames { get; } = []; public List<string> DeleteNames { get; } = []; public Dictionary<string, byte[]> Blobs { get; } = [];
        public async Task PutAsync(string blobName, Stream content, string contentType, CancellationToken cancellationToken = default) { PutNames.Add(blobName); using var memory = new MemoryStream(); await content.CopyToAsync(memory, cancellationToken); Blobs[blobName] = memory.ToArray(); }
        public Task<Stream> OpenReadAsync(string blobName, CancellationToken cancellationToken = default) => Task.FromResult<Stream>(new MemoryStream(Blobs[blobName]));
        public Task DeleteAsync(string blobName, CancellationToken cancellationToken = default) { DeleteNames.Add(blobName); Blobs.Remove(blobName); return Task.CompletedTask; }
        public Task<bool> ExistsAsync(string blobName, CancellationToken cancellationToken = default) => Task.FromResult(Blobs.ContainsKey(blobName));
        public Task<int> ScavengeStagingAsync(DateTimeOffset olderThanUtc, IReadOnlySet<string> retainedBlobNames,
            CancellationToken cancellationToken = default) => Task.FromResult(0);
    }

    private sealed class FailAfterStorageInterceptor(FakeStorage storage, bool failDelete) : SaveChangesInterceptor
    {
        private bool failed;
        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData eventData,
            InterceptionResult<int> result, CancellationToken cancellationToken = default)
        {
            if (!failed && (failDelete
                    ? storage.DeleteNames.Count > 0 && eventData.Context!.ChangeTracker.Entries<MaintenanceAttachment>().Any(x => x.State == EntityState.Deleted)
                    : storage.PutNames.Count > 0 && eventData.Context!.ChangeTracker.Entries<MaintenanceAttachment>().Any(x => x.State == EntityState.Modified)))
            {
                failed = true;
                throw new InvalidOperationException("simulated relational finalization failure");
            }
            return base.SavingChangesAsync(eventData, result, cancellationToken);
        }
    }
}
