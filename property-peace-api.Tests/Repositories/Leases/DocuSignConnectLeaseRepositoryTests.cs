using AutoMapper;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Lease;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Leases;
using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Repositories.Leases;

public sealed class DocuSignConnectLeaseRepositoryTests
{
    private const string Envelope = "Envelope-Case-Sensitive";

    [Theory]
    [InlineData(false, false, false, false)]
    [InlineData(true, true, false, false)]
    [InlineData(true, false, true, false)]
    [InlineData(true, false, false, true)]
    public async Task Mapping_rejects_inactive_deleted_or_mismatched_organization(
        bool organizationActive, bool organizationDeleted, bool leaseDeleted, bool mismatchedPropertyOrganization)
    {
        await using var db = CreateContext();
        await SeedAsync(db, organizationActive, organizationDeleted, leaseDeleted, mismatchedPropertyOrganization);
        var repository = CreateRepository(db);

        var mapping = await repository.GetLeaseByDocuSignEnvelopeIdAsync(Envelope, CancellationToken.None);

        mapping.Should().BeNull();
    }

    [Fact]
    public async Task Relational_mapping_rejects_inactive_lease()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = await CreateInactiveLeaseRelationalContextAsync(connection);

        var mapping = await CreateRepository(db)
            .GetLeaseByDocuSignEnvelopeIdAsync(Envelope, CancellationToken.None);

        mapping.Should().BeNull();
    }

    [Fact]
    public async Task Relational_connect_mutation_rejects_lease_that_became_inactive()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = await CreateInactiveLeaseRelationalContextAsync(connection);
        var mapping = new LeaseConnectInfoDto
        {
            LeaseId = 30,
            OrganizationId = 10,
            EnvelopeId = Envelope
        };
        var update = new DocuSignConnectUpdate(Envelope, ESignatureStatus.Completed,
            new DateTime(2026, 8, 10, 12, 0, 0, DateTimeKind.Utc), new Dictionary<string, DateTime>());

        var action = () => CreateRepository(db)
            .ApplyDocuSignConnectUpdateAsync(mapping, update, CancellationToken.None);

        await action.Should().ThrowAsync<UnauthorizedAccessException>();
        (await db.LeaseAgreements.AsNoTracking().SingleAsync()).SignatureStatus.Should().Be(ESignatureStatus.Sent);
    }

    [Fact]
    public async Task Mapping_requires_exact_envelope_case_and_returns_persisted_authority()
    {
        await using var db = CreateContext();
        await SeedAsync(db);
        var repository = CreateRepository(db);

        (await repository.GetLeaseByDocuSignEnvelopeIdAsync(Envelope.ToLowerInvariant(), CancellationToken.None)).Should().BeNull();
        var mapping = await repository.GetLeaseByDocuSignEnvelopeIdAsync(Envelope, CancellationToken.None);

        mapping.Should().NotBeNull();
        mapping!.LeaseId.Should().Be(30);
        mapping.OrganizationId.Should().Be(10);
        mapping.EnvelopeId.Should().Be(Envelope);
    }

    [Fact]
    public async Task Apply_is_atomic_scoped_and_updates_agreement_and_only_same_org_tenant()
    {
        await using var db = CreateContext();
        await SeedAsync(db, addTenants: true);
        var repository = CreateRepository(db);
        var mapping = (await repository.GetLeaseByDocuSignEnvelopeIdAsync(Envelope, CancellationToken.None))!;
        var signedAt = new DateTime(2026, 8, 10, 11, 59, 0, DateTimeKind.Utc);
        var update = new DocuSignConnectUpdate(Envelope, ESignatureStatus.Completed, signedAt.AddMinutes(1),
            new Dictionary<string, DateTime>(StringComparer.OrdinalIgnoreCase)
            {
                ["tenant@example.com"] = signedAt,
                ["foreign@example.com"] = signedAt
            });

        var result = await repository.ApplyDocuSignConnectUpdateAsync(mapping, update, CancellationToken.None);

        result.Applied.Should().BeTrue();
        result.TenantSignaturesUpdated.Should().Be(1);
        var agreement = await db.LeaseAgreements.SingleAsync();
        agreement.SignatureStatus.Should().Be(ESignatureStatus.Completed);
        agreement.SignatureCompletedAt.Should().Be(signedAt.AddMinutes(1));
        (await db.TenantLeases.SingleAsync(x => x.TenantId == 40)).TenantSignedAt.Should().Be(signedAt);
        (await db.TenantLeases.SingleAsync(x => x.TenantId == 41)).TenantSignedAt.Should().BeNull();
    }

    [Fact]
    public async Task Duplicate_and_older_replay_are_no_op_and_terminal_status_cannot_regress()
    {
        await using var db = CreateContext();
        await SeedAsync(db);
        var repository = CreateRepository(db);
        var mapping = (await repository.GetLeaseByDocuSignEnvelopeIdAsync(Envelope, CancellationToken.None))!;
        var completed = new DocuSignConnectUpdate(Envelope, ESignatureStatus.Completed,
            new DateTime(2026, 8, 10, 12, 0, 0, DateTimeKind.Utc), new Dictionary<string, DateTime>());

        (await repository.ApplyDocuSignConnectUpdateAsync(mapping, completed, CancellationToken.None)).Applied.Should().BeTrue();
        (await repository.ApplyDocuSignConnectUpdateAsync(mapping, completed, CancellationToken.None)).Applied.Should().BeFalse();
        var replay = new DocuSignConnectUpdate(Envelope, ESignatureStatus.Sent, null, new Dictionary<string, DateTime>());
        (await repository.ApplyDocuSignConnectUpdateAsync(mapping, replay, CancellationToken.None)).Applied.Should().BeFalse();

        (await db.LeaseAgreements.SingleAsync()).SignatureStatus.Should().Be(ESignatureStatus.Completed);
    }

    [Fact]
    public async Task Send_persists_and_returns_the_exact_provider_envelope_only_in_exact_scope()
    {
        await using var db = CreateContext();
        await SeedAsync(db, envelopeId: null);
        var repository = CreateRepository(db);

        var stored = await repository.PersistSentEnvelopeAsync(30, 10, "provider-Exact-ID",
            new DateTime(2026, 8, 10, 10, 0, 0, DateTimeKind.Utc), null, CancellationToken.None);
        var foreign = await repository.PersistSentEnvelopeAsync(30, 11, "must-not-store",
            DateTime.UtcNow, null, CancellationToken.None);

        stored.Should().Be("provider-Exact-ID");
        foreign.Should().BeNull();
        (await db.LeaseAgreements.SingleAsync()).DocuSignEnvelopeId.Should().Be("provider-Exact-ID");
    }

    [Fact]
    public async Task Send_is_idempotent_for_same_id_and_never_replaces_or_regresses_terminal_state()
    {
        await using var db = CreateContext();
        await SeedAsync(db);
        var agreement = await db.LeaseAgreements.SingleAsync();
        agreement.SignatureStatus = ESignatureStatus.Completed;
        var completedAt = new DateTime(2026, 8, 10, 12, 0, 0, DateTimeKind.Utc);
        agreement.SignatureCompletedAt = completedAt;
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        var repository = CreateRepository(db);

        var replay = await repository.PersistSentEnvelopeAsync(30, 10, Envelope,
            completedAt.AddHours(1), null, CancellationToken.None);
        var replacement = await repository.PersistSentEnvelopeAsync(30, 10, "replacement",
            completedAt.AddHours(2), null, CancellationToken.None);

        replay.Should().Be(Envelope);
        replacement.Should().BeNull();
        var stored = await db.LeaseAgreements.AsNoTracking().SingleAsync();
        stored.DocuSignEnvelopeId.Should().Be(Envelope);
        stored.SignatureStatus.Should().Be(ESignatureStatus.Completed);
        stored.SignatureCompletedAt.Should().Be(completedAt);
    }

    [Fact]
    public async Task Concurrent_different_sends_from_real_sqlite_contexts_have_exactly_one_success()
    {
        var databasePath = Path.Combine(Path.GetTempPath(), $"property-peace-send-{Guid.NewGuid():N}.db");
        var options = new DbContextOptionsBuilder<DataContext>().UseSqlite($"Data Source={databasePath};Default Timeout=5").Options;
        try
        {
            await using (var seed = new DataContext(options))
            {
                await seed.Database.ExecuteSqlRawAsync("""
                    CREATE TABLE Organizations (Id INTEGER PRIMARY KEY, Name TEXT NOT NULL, IsActive INTEGER NOT NULL, IsDeleted INTEGER NOT NULL);
                    CREATE TABLE Properties (Id INTEGER PRIMARY KEY, OrganizationId INTEGER, LandlordId INTEGER NOT NULL);
                    CREATE TABLE Units (Id INTEGER PRIMARY KEY, PropertyId INTEGER NOT NULL);
                    CREATE TABLE Leases (Id INTEGER PRIMARY KEY, UnitId INTEGER NOT NULL, OrganizationId INTEGER, IsDeleted INTEGER NOT NULL, IsActive INTEGER NOT NULL);
                    CREATE TABLE LeaseAgreements (
                        Id INTEGER PRIMARY KEY, LeaseId INTEGER NOT NULL, IsDrafted INTEGER,
                        IsLeaseSpecificsComplete INTEGER NOT NULL, IsRentDepositFeesComplete INTEGER NOT NULL,
                        IsPeopleOnLeaseComplete INTEGER NOT NULL, IsPetsSmokingOtherComplete INTEGER NOT NULL,
                        IsUtilitiesMaintenanceKeysComplete INTEGER NOT NULL, IsProvisionsAttachmentsComplete INTEGER NOT NULL,
                        SignatureStatus INTEGER, DocuSignEnvelopeId TEXT, SignatureSentAt TEXT,
                        SignatureCompletedAt TEXT, SignatureExpiresAt TEXT, LandlordSignature TEXT,
                        LandlordSignedAt TEXT, LandlordSignedBy TEXT, SignedDocumentBlobName TEXT, SignedDocumentBlobUrl TEXT);
                    INSERT INTO Organizations (Id, Name, IsActive, IsDeleted) VALUES (10, 'Scoped', 1, 0);
                    INSERT INTO Properties (Id, OrganizationId, LandlordId) VALUES (20, 10, 99);
                    INSERT INTO Units (Id, PropertyId) VALUES (21, 20);
                    INSERT INTO Leases (Id, UnitId, OrganizationId, IsDeleted, IsActive) VALUES (30, 21, 10, 0, 1);
                    INSERT INTO LeaseAgreements (Id, LeaseId, IsDrafted, IsLeaseSpecificsComplete, IsRentDepositFeesComplete,
                        IsPeopleOnLeaseComplete, IsPetsSmokingOtherComplete, IsUtilitiesMaintenanceKeysComplete,
                        IsProvisionsAttachmentsComplete, SignatureStatus, DocuSignEnvelopeId)
                        VALUES (31, 30, 0, 0, 0, 0, 0, 0, 0, 0, NULL);
                    """);
            }

            using var gate = new ManualResetEventSlim(false);
            var ids = new[] { "provider-race-a", "provider-race-b" };
            var tasks = ids.Select(id => Task.Run(async () =>
            {
                gate.Wait();
                await using var context = new DataContext(options);
                return await CreateRepository(context).PersistSentEnvelopeAsync(30, 10, id,
                    DateTime.UtcNow, null, CancellationToken.None);
            })).ToArray();
            gate.Set();
            var results = await Task.WhenAll(tasks);

            results.Count(result => result != null).Should().Be(1);
            await using var verify = new DataContext(options);
            var stored = await verify.LeaseAgreements.AsNoTracking().SingleAsync();
            ids.Should().Contain(stored.DocuSignEnvelopeId);
            results.Single(result => result != null).Should().Be(stored.DocuSignEnvelopeId);
            stored.SignatureStatus.Should().Be(ESignatureStatus.Sent);
        }
        finally
        {
            SqliteConnection.ClearAllPools();
            if (System.IO.File.Exists(databasePath)) System.IO.File.Delete(databasePath);
        }
    }

    [Fact]
    public async Task Cancel_requires_exact_persisted_envelope_and_persists_cancelled_before_success()
    {
        await using var db = CreateContext();
        await SeedAsync(db);
        var repository = CreateRepository(db);

        (await repository.PersistCancelledEnvelopeAsync(30, 10, "wrong-case", CancellationToken.None)).Should().BeFalse();
        (await repository.PersistCancelledEnvelopeAsync(30, 10, Envelope, CancellationToken.None)).Should().BeTrue();

        (await db.LeaseAgreements.SingleAsync()).SignatureStatus.Should().Be(ESignatureStatus.Cancelled);
    }

    [Fact]
    public async Task Sync_is_exact_scoped_atomic_and_terminal_monotonic()
    {
        await using var db = CreateContext();
        await SeedAsync(db, addTenants: true);
        var repository = CreateRepository(db);
        var signedAt = new DateTime(2026, 8, 10, 11, 0, 0, DateTimeKind.Utc);
        var completed = new SignatureSyncUpdate(Envelope, ESignatureStatus.Completed, signedAt.AddHours(1), null,
            signedAt, "Landlord", "organizations/10/leases/30/envelopes/exact/signed.pdf", "https://blob/signed.pdf",
            new Dictionary<string, DateTime> { ["tenant@example.com"] = signedAt });

        (await repository.ApplySignatureSyncAsync(30, 11, completed, CancellationToken.None)).Should().BeNull();
        var applied = await repository.ApplySignatureSyncAsync(30, 10, completed, CancellationToken.None);
        var replay = await repository.ApplySignatureSyncAsync(30, 10,
            completed with { Status = ESignatureStatus.Sent, CompletedAt = null }, CancellationToken.None);

        applied!.Applied.Should().BeTrue();
        applied.TenantSignaturesUpdated.Should().Be(1);
        replay!.Applied.Should().BeFalse();
        var agreement = await db.LeaseAgreements.SingleAsync();
        agreement.SignatureStatus.Should().Be(ESignatureStatus.Completed);
        agreement.SignatureCompletedAt.Should().Be(signedAt.AddHours(1));
        agreement.SignedDocumentBlobName.Should().Be("organizations/10/leases/30/envelopes/exact/signed.pdf");
        (await db.TenantLeases.SingleAsync(x => x.TenantId == 40)).TenantSignedAt.Should().Be(signedAt);
        (await db.TenantLeases.SingleAsync(x => x.TenantId == 41)).TenantSignedAt.Should().BeNull();
    }

    [Theory]
    [InlineData(ESignatureStatus.Expired)]
    [InlineData(ESignatureStatus.Cancelled)]
    [InlineData(ESignatureStatus.Declined)]
    public async Task Higher_precedence_completed_advances_other_terminal_states(ESignatureStatus terminal)
    {
        await using var db = CreateContext();
        await SeedAsync(db);
        var repository = CreateRepository(db);
        var mapping = (await repository.GetLeaseByDocuSignEnvelopeIdAsync(Envelope, CancellationToken.None))!;
        var completedAt = new DateTime(2026, 8, 10, 5, 30, 0, DateTimeKind.Utc);

        await repository.ApplyDocuSignConnectUpdateAsync(mapping,
            new DocuSignConnectUpdate(Envelope, terminal, null, new Dictionary<string, DateTime>()), CancellationToken.None);
        await repository.ApplyDocuSignConnectUpdateAsync(mapping,
            new DocuSignConnectUpdate(Envelope, ESignatureStatus.Completed, completedAt,
                new Dictionary<string, DateTime>()), CancellationToken.None);

        var agreement = await db.LeaseAgreements.SingleAsync();
        agreement.SignatureStatus.Should().Be(ESignatureStatus.Completed);
        agreement.SignatureCompletedAt.Should().Be(completedAt);
    }

    [Fact]
    public async Task Lower_or_equal_terminal_replay_never_changes_completed_timestamp()
    {
        await using var db = CreateContext();
        await SeedAsync(db);
        var repository = CreateRepository(db);
        var mapping = (await repository.GetLeaseByDocuSignEnvelopeIdAsync(Envelope, CancellationToken.None))!;
        var winningTime = new DateTime(2026, 8, 10, 5, 30, 0, DateTimeKind.Utc);

        await repository.ApplyDocuSignConnectUpdateAsync(mapping,
            new DocuSignConnectUpdate(Envelope, ESignatureStatus.Completed, null,
                new Dictionary<string, DateTime>(), winningTime), CancellationToken.None);
        var lower = await repository.ApplyDocuSignConnectUpdateAsync(mapping,
            new DocuSignConnectUpdate(Envelope, ESignatureStatus.Declined, winningTime.AddHours(1),
                new Dictionary<string, DateTime>(), winningTime.AddHours(1)), CancellationToken.None);
        var equal = await repository.ApplyDocuSignConnectUpdateAsync(mapping,
            new DocuSignConnectUpdate(Envelope, ESignatureStatus.Completed, winningTime.AddHours(2),
                new Dictionary<string, DateTime>(), winningTime.AddHours(2)), CancellationToken.None);

        lower.Applied.Should().BeFalse();
        equal.Applied.Should().BeFalse();
        var agreement = await db.LeaseAgreements.SingleAsync();
        agreement.SignatureStatus.Should().Be(ESignatureStatus.Completed);
        agreement.SignatureCompletedAt.Should().Be(winningTime);
    }

    [Fact]
    public async Task Envelope_mismatch_fails_before_any_mutation()
    {
        await using var db = CreateContext();
        await SeedAsync(db);
        var repository = CreateRepository(db);
        var mapping = (await repository.GetLeaseByDocuSignEnvelopeIdAsync(Envelope, CancellationToken.None))!;
        var update = new DocuSignConnectUpdate("different", ESignatureStatus.Completed, DateTime.UtcNow,
            new Dictionary<string, DateTime>());

        var action = () => repository.ApplyDocuSignConnectUpdateAsync(mapping, update, CancellationToken.None);

        await action.Should().ThrowAsync<UnauthorizedAccessException>();
        (await db.LeaseAgreements.SingleAsync()).SignatureStatus.Should().Be(ESignatureStatus.Sent);
    }

    [Fact]
    public async Task Concurrent_terminal_updates_from_separate_contexts_converge_to_completed_and_its_timestamp()
    {
        var databasePath = Path.Combine(Path.GetTempPath(), $"property-peace-connect-{Guid.NewGuid():N}.db");
        var connectionString = new SqliteConnectionStringBuilder
        {
            DataSource = databasePath,
            Mode = SqliteOpenMode.ReadWriteCreate,
            Cache = SqliteCacheMode.Shared,
            DefaultTimeout = 1
        }.ToString();
        var options = new DbContextOptionsBuilder<DataContext>().UseSqlite(connectionString).Options;
        var completedAt = new DateTime(2026, 8, 10, 5, 45, 0, DateTimeKind.Utc);
        var mapping = new LeaseConnectInfoDto { LeaseId = 30, OrganizationId = 10, EnvelopeId = Envelope };
        try
        {
            await using (var seed = new DataContext(options))
            {
                await seed.Database.ExecuteSqlRawAsync("""
                    CREATE TABLE Organizations (Id INTEGER PRIMARY KEY, IsActive INTEGER NOT NULL, IsDeleted INTEGER NOT NULL);
                    CREATE TABLE Properties (Id INTEGER PRIMARY KEY, OrganizationId INTEGER, LandlordId INTEGER NOT NULL);
                    CREATE TABLE Units (Id INTEGER PRIMARY KEY, PropertyId INTEGER NOT NULL);
                    CREATE TABLE Leases (Id INTEGER PRIMARY KEY, UnitId INTEGER NOT NULL, OrganizationId INTEGER, IsDeleted INTEGER NOT NULL, IsActive INTEGER NOT NULL);
                    CREATE TABLE LeaseAgreements (
                        Id INTEGER PRIMARY KEY, LeaseId INTEGER NOT NULL, IsDrafted INTEGER,
                        IsLeaseSpecificsComplete INTEGER NOT NULL, IsRentDepositFeesComplete INTEGER NOT NULL,
                        IsPeopleOnLeaseComplete INTEGER NOT NULL, IsPetsSmokingOtherComplete INTEGER NOT NULL,
                        IsUtilitiesMaintenanceKeysComplete INTEGER NOT NULL, IsProvisionsAttachmentsComplete INTEGER NOT NULL,
                        SignatureStatus INTEGER, DocuSignEnvelopeId TEXT, SignatureSentAt TEXT,
                        SignatureCompletedAt TEXT, SignatureExpiresAt TEXT, LandlordSignature TEXT,
                        LandlordSignedAt TEXT, LandlordSignedBy TEXT, SignedDocumentBlobName TEXT, SignedDocumentBlobUrl TEXT);
                    INSERT INTO Organizations (Id, IsActive, IsDeleted) VALUES (10, 1, 0);
                    INSERT INTO Properties (Id, OrganizationId, LandlordId) VALUES (20, 10, 99);
                    INSERT INTO Units (Id, PropertyId) VALUES (21, 20);
                    INSERT INTO Leases (Id, UnitId, OrganizationId, IsDeleted, IsActive) VALUES (30, 21, 10, 0, 1);
                    INSERT INTO LeaseAgreements (Id, LeaseId, IsDrafted, IsLeaseSpecificsComplete, IsRentDepositFeesComplete,
                        IsPeopleOnLeaseComplete, IsPetsSmokingOtherComplete, IsUtilitiesMaintenanceKeysComplete,
                        IsProvisionsAttachmentsComplete, SignatureStatus, DocuSignEnvelopeId)
                        VALUES (31, 30, 0, 0, 0, 0, 0, 0, 0, 1, 'Envelope-Case-Sensitive');
                    """);
            }

            // Reverse the launch bias on a second real race. Every attempt uses a fresh
            // DataContext; SQLite busy/locked is retried finitely and is never reported as success.
            foreach (var statuses in new[]
                     {
                         new[] { ESignatureStatus.Completed, ESignatureStatus.Declined, ESignatureStatus.Cancelled, ESignatureStatus.Expired },
                         new[] { ESignatureStatus.Expired, ESignatureStatus.Cancelled, ESignatureStatus.Declined, ESignatureStatus.Completed }
                     })
            {
                await using (var reset = new DataContext(options))
                {
                    var agreement = await reset.LeaseAgreements.SingleAsync();
                    agreement.SignatureStatus = ESignatureStatus.Sent;
                    agreement.SignatureCompletedAt = null;
                    await reset.SaveChangesAsync();
                }

                using var gate = new ManualResetEventSlim(false);
                var racers = statuses.Select((status, index) => Task.Run(async () =>
                {
                    gate.Wait();
                    await ApplyWithBoundedSqliteRetryAsync(options, mapping,
                        new DocuSignConnectUpdate(Envelope, status,
                            status == ESignatureStatus.Completed ? completedAt : null,
                            new Dictionary<string, DateTime>(),
                            status == ESignatureStatus.Completed ? completedAt : completedAt.AddMinutes(-index - 1)));
                })).ToArray();
                gate.Set();
                await Task.WhenAll(racers);

                await using var verify = new DataContext(options);
                var final = await verify.LeaseAgreements.AsNoTracking().SingleAsync();
                final.SignatureStatus.Should().Be(ESignatureStatus.Completed);
                final.SignatureCompletedAt.Should().Be(completedAt);
            }
        }
        finally
        {
            SqliteConnection.ClearAllPools();
            if (System.IO.File.Exists(databasePath)) System.IO.File.Delete(databasePath);
        }
    }

    [Fact]
    public async Task Failed_save_returns_no_success_and_does_not_persist_partial_updates()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<DataContext>().UseSqlite(connection).Options;
        await using (var seed = new DataContext(options))
        {
            await seed.Database.ExecuteSqlRawAsync("""
                CREATE TABLE Organizations (Id INTEGER PRIMARY KEY, IsActive INTEGER NOT NULL, IsDeleted INTEGER NOT NULL);
                CREATE TABLE Properties (Id INTEGER PRIMARY KEY, OrganizationId INTEGER, LandlordId INTEGER NOT NULL);
                CREATE TABLE Units (Id INTEGER PRIMARY KEY, PropertyId INTEGER NOT NULL);
                CREATE TABLE Leases (Id INTEGER PRIMARY KEY, UnitId INTEGER NOT NULL, OrganizationId INTEGER, IsDeleted INTEGER NOT NULL, IsActive INTEGER NOT NULL);
                CREATE TABLE LeaseAgreements (
                    Id INTEGER PRIMARY KEY, LeaseId INTEGER NOT NULL, IsDrafted INTEGER,
                    IsLeaseSpecificsComplete INTEGER NOT NULL, IsRentDepositFeesComplete INTEGER NOT NULL,
                    IsPeopleOnLeaseComplete INTEGER NOT NULL, IsPetsSmokingOtherComplete INTEGER NOT NULL,
                    IsUtilitiesMaintenanceKeysComplete INTEGER NOT NULL, IsProvisionsAttachmentsComplete INTEGER NOT NULL,
                    SignatureStatus INTEGER, DocuSignEnvelopeId TEXT, SignatureSentAt TEXT,
                    SignatureCompletedAt TEXT, SignatureExpiresAt TEXT, LandlordSignature TEXT,
                    LandlordSignedAt TEXT, LandlordSignedBy TEXT, SignedDocumentBlobName TEXT, SignedDocumentBlobUrl TEXT);
                INSERT INTO Organizations (Id, IsActive, IsDeleted) VALUES (10, 1, 0);
                INSERT INTO Properties (Id, OrganizationId, LandlordId) VALUES (20, 10, 99);
                INSERT INTO Units (Id, PropertyId) VALUES (21, 20);
                INSERT INTO Leases (Id, UnitId, OrganizationId, IsDeleted, IsActive) VALUES (30, 21, 10, 0, 1);
                INSERT INTO LeaseAgreements (Id, LeaseId, IsDrafted, IsLeaseSpecificsComplete, IsRentDepositFeesComplete,
                    IsPeopleOnLeaseComplete, IsPetsSmokingOtherComplete, IsUtilitiesMaintenanceKeysComplete,
                    IsProvisionsAttachmentsComplete, SignatureStatus, DocuSignEnvelopeId)
                    VALUES (31, 30, 0, 0, 0, 0, 0, 0, 0, 1, 'Envelope-Case-Sensitive');
                """);
        }
        await using (var failing = new FailingDataContext(options))
        {
            var repository = CreateRepository(failing);
            var mapping = (await repository.GetLeaseByDocuSignEnvelopeIdAsync(Envelope, CancellationToken.None))!;
            var update = new DocuSignConnectUpdate(Envelope, ESignatureStatus.Completed, DateTime.UtcNow,
                new Dictionary<string, DateTime>());
            var action = () => repository.ApplyDocuSignConnectUpdateAsync(mapping, update, CancellationToken.None);
            await action.Should().ThrowAsync<DbUpdateException>();
        }
        await using var verify = new DataContext(options);
        (await verify.LeaseAgreements.SingleAsync()).SignatureStatus.Should().Be(ESignatureStatus.Sent);
    }

    private static async Task ApplyWithBoundedSqliteRetryAsync(
        DbContextOptions<DataContext> options,
        LeaseConnectInfoDto mapping,
        DocuSignConnectUpdate update)
    {
        const int maximumAttempts = 8;
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                await using var context = new DataContext(options);
                await CreateRepository(context).ApplyDocuSignConnectUpdateAsync(mapping, update, CancellationToken.None);
                return;
            }
            catch (Exception exception) when (attempt < maximumAttempts && IsSqliteBusy(exception))
            {
                await Task.Delay(attempt * 20);
            }
        }
    }

    private static bool IsSqliteBusy(Exception exception) => exception switch
    {
        SqliteException { SqliteErrorCode: 5 or 6 } => true,
        DbUpdateException { InnerException: not null } updateException => IsSqliteBusy(updateException.InnerException!),
        _ when exception.InnerException != null => IsSqliteBusy(exception.InnerException!),
        _ => false
    };

    private static DataContext CreateContext() => new(new DbContextOptionsBuilder<DataContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private static LeaseRepository CreateRepository(DataContext db) =>
        new(db, Mock.Of<ILogger<LeaseRepository>>(), Mock.Of<IMapper>());

    private static async Task<DataContext> CreateInactiveLeaseRelationalContextAsync(SqliteConnection connection)
    {
        var db = new DataContext(new DbContextOptionsBuilder<DataContext>().UseSqlite(connection).Options);
        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE Organizations (Id INTEGER PRIMARY KEY, IsActive INTEGER NOT NULL, IsDeleted INTEGER NOT NULL);
            CREATE TABLE Properties (Id INTEGER PRIMARY KEY, OrganizationId INTEGER, LandlordId INTEGER NOT NULL);
            CREATE TABLE Units (Id INTEGER PRIMARY KEY, PropertyId INTEGER NOT NULL);
            CREATE TABLE Leases (Id INTEGER PRIMARY KEY, UnitId INTEGER NOT NULL, OrganizationId INTEGER, IsDeleted INTEGER NOT NULL, IsActive INTEGER NOT NULL);
            CREATE TABLE LeaseAgreements (
                Id INTEGER PRIMARY KEY, LeaseId INTEGER NOT NULL, IsDrafted INTEGER,
                IsLeaseSpecificsComplete INTEGER NOT NULL, IsRentDepositFeesComplete INTEGER NOT NULL,
                IsPeopleOnLeaseComplete INTEGER NOT NULL, IsPetsSmokingOtherComplete INTEGER NOT NULL,
                IsUtilitiesMaintenanceKeysComplete INTEGER NOT NULL, IsProvisionsAttachmentsComplete INTEGER NOT NULL,
                SignatureStatus INTEGER, DocuSignEnvelopeId TEXT, SignatureSentAt TEXT,
                SignatureCompletedAt TEXT, SignatureExpiresAt TEXT, LandlordSignature TEXT,
                LandlordSignedAt TEXT, LandlordSignedBy TEXT, SignedDocumentBlobName TEXT, SignedDocumentBlobUrl TEXT);
            INSERT INTO Organizations (Id, IsActive, IsDeleted) VALUES (10, 1, 0);
            INSERT INTO Properties (Id, OrganizationId, LandlordId) VALUES (20, 10, 99);
            INSERT INTO Units (Id, PropertyId) VALUES (21, 20);
            INSERT INTO Leases (Id, UnitId, OrganizationId, IsDeleted, IsActive) VALUES (30, 21, 10, 0, 0);
            INSERT INTO LeaseAgreements (Id, LeaseId, IsDrafted, IsLeaseSpecificsComplete, IsRentDepositFeesComplete,
                IsPeopleOnLeaseComplete, IsPetsSmokingOtherComplete, IsUtilitiesMaintenanceKeysComplete,
                IsProvisionsAttachmentsComplete, SignatureStatus, DocuSignEnvelopeId)
                VALUES (31, 30, 0, 0, 0, 0, 0, 0, 0, 1, 'Envelope-Case-Sensitive');
            """);
        return db;
    }

    private static async Task SeedAsync(DataContext db, bool organizationActive = true, bool organizationDeleted = false,
        bool leaseDeleted = false, bool mismatchedPropertyOrganization = false, bool addTenants = false,
        string? envelopeId = Envelope)
    {
        var organization = new Organization { Id = 10, Name = "Scoped", IsActive = organizationActive, IsDeleted = organizationDeleted };
        var otherOrganization = new Organization { Id = 11, Name = "Foreign", IsActive = true };
        var property = new Property { Id = 20, OrganizationId = mismatchedPropertyOrganization ? 11 : 10, LandlordId = 99 };
        var unit = new Unit { Id = 21, PropertyId = 20, OrganizationId = 10 };
        var lease = new Lease { Id = 30, UnitId = 21, OrganizationId = 10, IsDeleted = leaseDeleted };
        var agreement = new LeaseAgreement { Id = 31, LeaseId = 30, DocuSignEnvelopeId = envelopeId,
            SignatureStatus = envelopeId == null ? ESignatureStatus.NotSent : ESignatureStatus.Sent };
        db.Organizations.AddRange(organization, otherOrganization);
        db.Properties.Add(property);
        db.Units.Add(unit);
        db.Leases.Add(lease);
        db.LeaseAgreements.Add(agreement);
        if (addTenants)
        {
            db.Tenants.AddRange(
                new Tenant { Id = 40, Firstname = "Same", Lastname = "Org", Email = "tenant@example.com", OrganizationId = 10 },
                new Tenant { Id = 41, Firstname = "Foreign", Lastname = "Org", Email = "foreign@example.com", OrganizationId = 11 });
            db.TenantLeases.AddRange(
                new TenantLease { TenantId = 40, LeaseId = 30 },
                new TenantLease { TenantId = 41, LeaseId = 30 });
        }
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
    }

    private sealed class FailingDataContext(DbContextOptions<DataContext> options) : DataContext(options)
    {
        public override async Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
        {
            await base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
            throw new DbUpdateException("Injected failure after database writes");
        }
    }
}
