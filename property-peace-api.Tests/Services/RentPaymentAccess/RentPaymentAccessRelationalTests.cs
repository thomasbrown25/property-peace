using System.Data.Common;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.RentPaymentAccess;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.RentPaymentAccess;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Xunit;

namespace brownstone_hub_api.Tests.Services.RentPaymentAccess;

public sealed class RentPaymentAccessRelationalTests
{
    private static readonly DateTimeOffset Now = new(2031, 4, 5, 14, 30, 0, TimeSpan.Zero);

    [Fact]
    public async Task First_request_opens_relational_transaction_and_commits_one_state_and_audit()
    {
        await using var database = await SqliteDatabase.CreateAsync();
        var observedTransaction = false;
        var interceptor = new OneShotSavingChangesInterceptor((context, _) =>
        {
            observedTransaction = context.Database.CurrentTransaction is not null;
            return Task.CompletedTask;
        });
        await using var db = database.CreateContext(interceptor);
        var service = CreateService(db);

        var result = await service.RequestAsync(701, 41, CancellationToken.None);

        result.Status.Should().Be("Pending");
        observedTransaction.Should().BeTrue("the service write boundary must own the relational transaction");
        await using var verification = database.CreateContext();
        (await verification.RentPaymentAccessRequests.CountAsync()).Should().Be(1);
        (await verification.RentPaymentAccessAuditEvents.CountAsync()).Should().Be(1);
    }

    [Fact]
    public async Task Audit_insert_failure_rolls_back_first_request_state()
    {
        await using var database = await SqliteDatabase.CreateAsync();
        await using (var setup = database.CreateContext())
        {
            await setup.Database.ExecuteSqlRawAsync("""
                CREATE TRIGGER fail_rent_access_audit
                BEFORE INSERT ON RentPaymentAccessAuditEvents
                BEGIN
                    SELECT RAISE(ABORT, 'forced audit failure');
                END;
                """);
        }
        await using var db = database.CreateContext();
        var service = CreateService(db);

        var act = () => service.RequestAsync(701, 41, CancellationToken.None);

        await act.Should().ThrowAsync<DbUpdateException>();
        await using var verification = database.CreateContext();
        (await verification.RentPaymentAccessRequests.CountAsync()).Should().Be(0);
        (await verification.RentPaymentAccessAuditEvents.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task First_request_unique_race_reloads_winner_without_losing_audit_entries()
    {
        await using var database = await SqliteDatabase.CreateAsync();
        var winningPublicId = Guid.NewGuid();
        var interceptor = new OneShotReaderInterceptor(async cancellationToken =>
        {
            await using var competitor = database.CreateContext();
            var winner = Request(RentPaymentAccessStatus.Pending, rowVersion: [1, 1]);
            winner.PublicId = winningPublicId;
            winner.RequestedByUserId = 42;
            competitor.RentPaymentAccessRequests.Add(winner);
            competitor.RentPaymentAccessAuditEvents.Add(Audit(winner, null, RentPaymentAccessStatus.Pending, 42));
            await competitor.SaveChangesAsync(cancellationToken);
        });
        await using var db = database.CreateContext(interceptor);
        var service = CreateService(db);

        var result = await service.RequestAsync(701, 41, CancellationToken.None);

        result.PublicId.Should().Be(winningPublicId);
        result.Status.Should().Be("Pending");
        await using var verification = database.CreateContext();
        (await verification.RentPaymentAccessRequests.CountAsync()).Should().Be(1);
        (await verification.RentPaymentAccessAuditEvents.CountAsync()).Should().Be(1);
        (await verification.RentPaymentAccessAuditEvents.SingleAsync()).ActorUserId.Should().Be(42);
    }

    [Fact]
    public async Task Between_load_and_save_rowversion_change_returns_conflict_and_rolls_back_audit()
    {
        await using var database = await SqliteDatabase.CreateAsync();
        var initialVersion = new byte[] { 2, 4, 6, 8 };
        var competingVersion = new byte[] { 2, 4, 6, 9 };
        Guid publicId;
        await using (var seed = database.CreateContext())
        {
            var request = Request(RentPaymentAccessStatus.Pending, initialVersion);
            seed.RentPaymentAccessRequests.Add(request);
            seed.RentPaymentAccessAuditEvents.Add(Audit(request, null, RentPaymentAccessStatus.Pending, 41));
            await seed.SaveChangesAsync();
            publicId = request.PublicId;
            await seed.Database.ExecuteSqlInterpolatedAsync(
                $"UPDATE RentPaymentAccessRequests SET RowVersion = {initialVersion} WHERE Id = {request.Id}");
        }

        var interceptor = new OneShotReaderInterceptor(async cancellationToken =>
        {
            await using var competitor = database.CreateContext();
            await competitor.Database.ExecuteSqlInterpolatedAsync(
                $"UPDATE RentPaymentAccessRequests SET RowVersion = {competingVersion} WHERE PublicId = {publicId}",
                cancellationToken);
        });
        await using var db = database.CreateContext(interceptor);
        var service = CreateService(db);

        var act = () => service.ApproveAsync(publicId, 8,
            new ReviewRentPaymentAccessRequestDto(null, null, initialVersion), CancellationToken.None);

        await act.Should().ThrowAsync<RentPaymentAccessConcurrencyException>();
        await using var verification = database.CreateContext();
        var persisted = await verification.RentPaymentAccessRequests.SingleAsync();
        persisted.Status.Should().Be(RentPaymentAccessStatus.Pending);
        persisted.RowVersion.Should().Equal(competingVersion);
        (await verification.RentPaymentAccessAuditEvents.CountAsync()).Should().Be(1);
    }

    private static RentPaymentAccessService CreateService(DataContext db) =>
        new(db, new FixedTimeProvider(Now));

    private static RentPaymentAccessRequest Request(RentPaymentAccessStatus status, byte[] rowVersion) => new()
    {
        OrganizationId = 701,
        Status = status,
        RequestedByUserId = 41,
        RequestedAtUtc = Now.UtcDateTime,
        StatusChangedAtUtc = Now.UtcDateTime,
        RowVersion = rowVersion
    };

    private static RentPaymentAccessAuditEvent Audit(
        RentPaymentAccessRequest request,
        RentPaymentAccessStatus? priorStatus,
        RentPaymentAccessStatus nextStatus,
        int actorUserId) => new()
    {
        RentPaymentAccessRequest = request,
        OrganizationId = request.OrganizationId,
        PriorStatus = priorStatus,
        NextStatus = nextStatus,
        ActorUserId = actorUserId,
        OccurredAtUtc = Now.UtcDateTime
    };

    private sealed class FixedTimeProvider(DateTimeOffset utcNow) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => utcNow;
    }

    private sealed class OneShotSavingChangesInterceptor(
        Func<DataContext, CancellationToken, Task> beforeSave) : SaveChangesInterceptor
    {
        private int _invoked;

        public override async ValueTask<InterceptionResult<int>> SavingChangesAsync(
            DbContextEventData eventData,
            InterceptionResult<int> result,
            CancellationToken cancellationToken = default)
        {
            if (Interlocked.Exchange(ref _invoked, 1) == 0)
                await beforeSave((DataContext)eventData.Context!, cancellationToken);
            return result;
        }
    }

    private sealed class OneShotReaderInterceptor(
        Func<CancellationToken, Task> afterReaderOpened) : DbCommandInterceptor
    {
        private int _invoked;

        public override async ValueTask<DbDataReader> ReaderExecutedAsync(
            DbCommand command,
            CommandExecutedEventData eventData,
            DbDataReader result,
            CancellationToken cancellationToken = default)
        {
            if (Interlocked.Exchange(ref _invoked, 1) == 0)
                await afterReaderOpened(cancellationToken);
            return result;
        }
    }

    private sealed class SqliteDatabase : IAsyncDisposable
    {
        private const string Schema = """
            CREATE TABLE RentPaymentAccessRequests (
                Id INTEGER NOT NULL CONSTRAINT PK_RentPaymentAccessRequests PRIMARY KEY AUTOINCREMENT,
                PublicId TEXT NOT NULL,
                OrganizationId INTEGER NOT NULL,
                Status TEXT NOT NULL,
                RequestedByUserId INTEGER NOT NULL,
                RequestedAtUtc TEXT NOT NULL,
                ReviewedByUserId INTEGER NULL,
                ReviewedAtUtc TEXT NULL,
                DecisionReason TEXT NULL,
                InternalNotes TEXT NULL,
                StatusChangedAtUtc TEXT NOT NULL,
                RowVersion BLOB NOT NULL DEFAULT (randomblob(8))
            );
            CREATE UNIQUE INDEX IX_RentPaymentAccessRequests_OrganizationId
                ON RentPaymentAccessRequests (OrganizationId);
            CREATE UNIQUE INDEX IX_RentPaymentAccessRequests_PublicId
                ON RentPaymentAccessRequests (PublicId);
            CREATE TABLE RentPaymentAccessAuditEvents (
                Id INTEGER NOT NULL CONSTRAINT PK_RentPaymentAccessAuditEvents PRIMARY KEY AUTOINCREMENT,
                RentPaymentAccessRequestId INTEGER NOT NULL,
                OrganizationId INTEGER NOT NULL,
                PriorStatus TEXT NULL,
                NextStatus TEXT NOT NULL,
                ActorUserId INTEGER NOT NULL,
                OccurredAtUtc TEXT NOT NULL,
                SafeMetadataJson TEXT NULL,
                CONSTRAINT FK_RentPaymentAccessAuditEvents_RentPaymentAccessRequests
                    FOREIGN KEY (RentPaymentAccessRequestId) REFERENCES RentPaymentAccessRequests (Id) ON DELETE RESTRICT
            );
            """;

        private readonly string _path;
        private readonly DbContextOptions<DataContext> _baseOptions;

        private SqliteDatabase(string path)
        {
            _path = path;
            _baseOptions = Options(path);
        }

        public static async Task<SqliteDatabase> CreateAsync()
        {
            var database = new SqliteDatabase(
                Path.Combine(Path.GetTempPath(), $"rent-payment-access-{Guid.NewGuid():N}.db"));
            await using var context = database.CreateContext();
            await context.Database.ExecuteSqlRawAsync("PRAGMA journal_mode=WAL;");
            await context.Database.ExecuteSqlRawAsync(Schema);
            return database;
        }

        public DataContext CreateContext(params IInterceptor[] interceptors)
        {
            if (interceptors.Length == 0) return new DataContext(_baseOptions);
            var options = new DbContextOptionsBuilder<DataContext>(Options(_path))
                .AddInterceptors(interceptors)
                .Options;
            return new DataContext(options);
        }

        private static DbContextOptions<DataContext> Options(string path) =>
            new DbContextOptionsBuilder<DataContext>()
                .UseSqlite($"Data Source={path};Default Timeout=5;Foreign Keys=True;Pooling=False")
                .Options;

        public ValueTask DisposeAsync()
        {
            if (System.IO.File.Exists(_path)) System.IO.File.Delete(_path);
            return ValueTask.CompletedTask;
        }
    }
}
