using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.Maintenance;
using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Maintenance;

public sealed class MaintenanceTransactionDurabilityTests
{
    private static readonly DateTimeOffset Now = new(2026, 8, 9, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task Upload_WhenCommandFails_RollsBackReceiptAndMetadata_AndCompensatesStagingBlob()
    {
        await using var fixture = await SqliteFixture.CreateAsync();
        var storage = new Storage();
        var effects = new MaintenanceTransactionSideEffects();
        var executor = new MaintenanceCommandExecutor(fixture.Db, new Actor(), new Clock(), effects);
        var pending = Attachment(MaintenanceAttachmentLifecycleState.PendingUpload);
        pending.StagingBlobName = "staging/proof.jpg";

        await FluentActions.Invoking(() => executor.ExecuteAsync<long>("upload-key", "attachment.upload", "payload", async ct =>
        {
            await storage.PutAsync(pending.StagingBlobName, new MemoryStream([0xFF, 0xD8, 0xFF]), "image/jpeg", ct);
            effects.OnRollback(token => storage.DeleteAsync(pending.StagingBlobName, token));
            fixture.Db.MaintenanceAttachments.Add(pending);
            await fixture.Db.SaveChangesAsync(ct);
            throw new InvalidOperationException("receipt serialization/commit path failed");
        })).Should().ThrowAsync<InvalidOperationException>();

        fixture.Db.ChangeTracker.Clear();
        fixture.Db.MaintenanceCommandReceipts.Should().BeEmpty();
        fixture.Db.MaintenanceAttachments.Should().BeEmpty();
        storage.Blobs.Should().BeEmpty("the staged upload is a rollback compensation");
        storage.Deleted.Should().ContainSingle("staging/proof.jpg");
    }

    [Fact]
    public async Task Delete_DoesNotTouchBlobBeforeCommit_AndCommittedPendingDeletionIsFinalized()
    {
        await using var fixture = await SqliteFixture.CreateAsync();
        var attachment = Attachment(MaintenanceAttachmentLifecycleState.Active);
        fixture.Db.MaintenanceAttachments.Add(attachment);
        await fixture.Db.SaveChangesAsync();
        var storage = new Storage();
        storage.Blobs[attachment.BlobName] = [0xFF, 0xD8, 0xFF];
        var effects = new MaintenanceTransactionSideEffects();
        var executor = new MaintenanceCommandExecutor(fixture.Db, new Actor(), new Clock(), effects);

        await FluentActions.Invoking(() => executor.ExecuteAsync<bool>("delete-fail", "attachment.delete", "payload", async ct =>
        {
            var row = await fixture.Db.MaintenanceAttachments.SingleAsync(ct);
            row.LifecycleState = MaintenanceAttachmentLifecycleState.PendingDeletion;
            await fixture.Db.SaveChangesAsync(ct);
            effects.AfterCommit(token => FinalizeDeleteAsync(fixture.Db, storage, row.Id, row.BlobName, token));
            storage.Deleted.Should().BeEmpty("physical deletion is post-commit only");
            throw new InvalidOperationException("command failed");
        })).Should().ThrowAsync<InvalidOperationException>();

        fixture.Db.ChangeTracker.Clear();
        (await fixture.Db.MaintenanceAttachments.SingleAsync()).LifecycleState.Should().Be(MaintenanceAttachmentLifecycleState.Active);
        storage.Blobs.Should().ContainKey(attachment.BlobName);
        storage.Deleted.Should().BeEmpty();

        var result = await executor.ExecuteAsync<bool>("delete-ok", "attachment.delete", "payload", async ct =>
        {
            var row = await fixture.Db.MaintenanceAttachments.SingleAsync(ct);
            row.LifecycleState = MaintenanceAttachmentLifecycleState.PendingDeletion;
            await fixture.Db.SaveChangesAsync(ct);
            effects.AfterCommit(token => FinalizeDeleteAsync(fixture.Db, storage, row.Id, row.BlobName, token));
            return MaintenanceApiResult<bool>.Success(true);
        });

        result.Code.Should().Be(MaintenanceApiResultCode.Success);
        fixture.Db.ChangeTracker.Clear();
        fixture.Db.MaintenanceAttachments.Should().BeEmpty();
        storage.Blobs.Should().NotContainKey(attachment.BlobName);
        storage.Deleted.Should().ContainSingle(attachment.BlobName);
        fixture.Db.MaintenanceCommandReceipts.Should().ContainSingle(x => x.Operation == "attachment.delete");
    }

    private static async Task FinalizeDeleteAsync(DataContext db, Storage storage, long id, string blobName, CancellationToken ct)
    {
        await storage.DeleteAsync(blobName, ct);
        await db.MaintenanceAttachments.Where(x => x.Id == id &&
            x.LifecycleState == MaintenanceAttachmentLifecycleState.PendingDeletion).ExecuteDeleteAsync(ct);
    }

    private static MaintenanceAttachment Attachment(MaintenanceAttachmentLifecycleState state) => new()
    {
        Id = 1, MaintenanceRequestId = 100, Purpose = MaintenanceAttachmentPurpose.Completion,
        ResolutionCycle = 1, MediaType = MaintenanceAttachmentMediaType.Photo, FileName = "proof.jpg",
        ContentType = "image/jpeg", SizeBytes = 3, BlobName = "60/100/completion/1/proof.jpg",
        UploadedByUserId = 70, CreatedAtUtc = Now, LifecycleState = state
    };

    private sealed class Actor : IMaintenanceActorAccessor
    {
        public Task<MaintenanceActor?> GetCurrentAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult<MaintenanceActor?>(new(70, false, false, true));
    }
    private sealed class Clock : TimeProvider { public override DateTimeOffset GetUtcNow() => Now; }

    private sealed class Storage
    {
        public Dictionary<string, byte[]> Blobs { get; } = [];
        public List<string> Deleted { get; } = [];
        public async Task PutAsync(string blobName, Stream content, string contentType, CancellationToken cancellationToken = default)
        {
            using var memory = new MemoryStream();
            await content.CopyToAsync(memory, cancellationToken);
            Blobs[blobName] = memory.ToArray();
        }
        public Task DeleteAsync(string blobName, CancellationToken cancellationToken = default)
        {
            Deleted.Add(blobName); Blobs.Remove(blobName); return Task.CompletedTask;
        }
    }

    private sealed class SqliteFixture : IAsyncDisposable
    {
        private readonly SqliteConnection connection;
        public DataContext Db { get; }
        private SqliteFixture(SqliteConnection connection, DataContext db) { this.connection = connection; Db = db; }
        public static async Task<SqliteFixture> CreateAsync()
        {
            var connection = new SqliteConnection("Data Source=:memory:");
            await connection.OpenAsync();
            await using (var command = connection.CreateCommand())
            {
                command.CommandText = """
                    CREATE TABLE MaintenanceCommandReceipts (
                        Id INTEGER PRIMARY KEY AUTOINCREMENT, ActorUserId INTEGER NOT NULL, Operation TEXT NOT NULL,
                        IdempotencyKeyHash TEXT NOT NULL, RequestHash TEXT NOT NULL, ResponseJson TEXT NULL,
                        CreatedAtUtc TEXT NOT NULL, CompletedAtUtc TEXT NULL,
                        RowVersion BLOB NOT NULL DEFAULT (randomblob(8)));
                    CREATE UNIQUE INDEX IX_CommandReceipt_Key ON MaintenanceCommandReceipts(ActorUserId, Operation, IdempotencyKeyHash);
                    CREATE TABLE MaintenanceAttachments (
                        Id INTEGER PRIMARY KEY, MaintenanceRequestId INTEGER NOT NULL, Purpose TEXT NOT NULL,
                        ResolutionCycle INTEGER NOT NULL, MediaType TEXT NOT NULL, FileName TEXT NOT NULL,
                        ContentType TEXT NOT NULL, SizeBytes INTEGER NOT NULL, BlobName TEXT NOT NULL,
                        StagingBlobName TEXT NULL, UploadedByUserId INTEGER NOT NULL, CreatedAtUtc TEXT NOT NULL,
                        LifecycleState TEXT NOT NULL, LifecycleLeaseId TEXT NULL, LifecycleLeaseUntilUtc TEXT NULL);
                    """;
                await command.ExecuteNonQueryAsync();
            }
            var db = new DataContext(new DbContextOptionsBuilder<DataContext>().UseSqlite(connection).Options);
            return new(connection, db);
        }
        public async ValueTask DisposeAsync() { await Db.DisposeAsync(); await connection.DisposeAsync(); }
    }
}
