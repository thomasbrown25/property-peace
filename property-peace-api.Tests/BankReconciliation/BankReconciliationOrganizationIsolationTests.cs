using AutoMapper;
using brownstone_hub_api.Dtos.BankReconciliation;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.BankReconciliation;
using brownstone_hub_api.Services.BankReconciliationService;
using brownstone_hub_api.Services.GeneralLedgerService;
using brownstone_hub_api.Tests.Helpers;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.BankReconciliation;

public sealed class BankReconciliationOrganizationIsolationTests
{
    [Fact]
    public async Task ScopedLookups_DoNotReturnAnotherOrganizationsRecords()
    {
        await using var context = DbContextFactory.Create();
        context.BankStatements.Add(Statement(10, 2));
        context.BankStatementTransactions.Add(new BankStatementTransaction
        {
            Id = 20,
            BankStatementId = 10,
            TransactionDate = DateTime.UtcNow,
            Amount = 12m
        });
        await context.SaveChangesAsync();
        var repository = new BankReconciliationRepository(context);

        Assert.Null(await repository.GetBankStatementByIdAsync(1, 10));
        Assert.Null(await repository.GetTransactionByIdAsync(1, 20));
        Assert.Empty(await repository.GetTransactionsByStatementIdAsync(1, 10));
        Assert.Null(await repository.GetReconciliationByStatementIdAsync(1, 10));
        Assert.False(await repository.TryUnmatchTransactionAsync(1, 20));
        Assert.False(await repository.DeleteTransactionAsync(1, 20));
    }

    [Fact]
    public async Task Match_RejectsCrossOrganizationLedgerAndLedgerReuse()
    {
        await using var context = DbContextFactory.Create();
        context.BankStatements.AddRange(
            Statement(10, 1),
            Statement(11, 1));
        context.BankStatementTransactions.AddRange(
            Transaction(20, 10),
            Transaction(21, 11));
        context.GeneralLedgerEntries.AddRange(
            Ledger(30, 2),
            Ledger(31, 1));
        await context.SaveChangesAsync();
        var repository = new BankReconciliationRepository(context);

        Assert.False(await repository.TryMatchTransactionAsync(1, 20, 30));
        Assert.True(await repository.TryMatchTransactionAsync(1, 20, 31));
        Assert.False(await repository.TryMatchTransactionAsync(1, 21, 31));
    }

    [Fact]
    public async Task ReconciledTransaction_CannotBeUnmatchedOrDeleted()
    {
        await using var context = DbContextFactory.Create();
        context.BankStatements.Add(Statement(10, 1));
        context.BankStatementTransactions.Add(new BankStatementTransaction
        {
            Id = 20,
            BankStatementId = 10,
            TransactionDate = DateTime.UtcNow,
            Amount = 12m,
            IsMatched = true,
            IsReconciled = true,
            MatchedLedgerEntryId = 30
        });
        await context.SaveChangesAsync();
        var repository = new BankReconciliationRepository(context);

        Assert.False(await repository.TryUnmatchTransactionAsync(1, 20));
        Assert.False(await repository.DeleteTransactionAsync(1, 20));
        Assert.NotNull(await context.BankStatementTransactions.FindAsync(20L));
    }

    [Fact]
    public async Task Upload_RejectsEmptyAndForeignBankAccountWithoutPersistingStatement()
    {
        await using var context = DbContextFactory.Create();
        context.BankAccounts.Add(new BankAccount
        {
            Id = 50,
            OrganizationId = 2,
            StripeAccountId = "not-a-feed",
            DisplayName = "Other org"
        });
        await context.SaveChangesAsync();
        var service = Service(new BankReconciliationRepository(context));

        var empty = await service.UploadBankStatementAsync(1, new UploadBankStatementDto());
        var foreign = await service.UploadBankStatementAsync(1, new UploadBankStatementDto
        {
            BankAccountId = 50,
            Transactions = [new() { TransactionDate = DateTime.UtcNow, Amount = 10m }]
        });

        Assert.False(empty.Success);
        Assert.False(foreign.Success);
        Assert.Empty(context.BankStatements);
    }

    [Fact]
    public async Task Upload_RejectsOversizedMalformedAndInconsistentPayloadsBeforePersistence()
    {
        await using var context = DbContextFactory.Create();
        var service = Service(new BankReconciliationRepository(context));
        var validTransaction = new BankStatementTransactionDto
        {
            TransactionDate = new DateTime(2025, 1, 2),
            Amount = 10m
        };

        var oversized = await service.UploadBankStatementAsync(1, new UploadBankStatementDto
        {
            StartingBalance = 0m,
            EndingBalance = 0m,
            Transactions = Enumerable.Repeat(validTransaction, 10_001).ToList()
        });
        var malformed = await service.UploadBankStatementAsync(1, new UploadBankStatementDto
        {
            StartingBalance = 0m,
            EndingBalance = 0m,
            Transactions = [new() { TransactionDate = default, Amount = decimal.MaxValue, Description = new string('x', 1_001) }]
        });
        var inconsistentDate = await service.UploadBankStatementAsync(1, new UploadBankStatementDto
        {
            StartingBalance = 0m,
            EndingBalance = 10m,
            StatementDate = new DateTime(2025, 1, 1),
            Transactions = [validTransaction]
        });

        Assert.False(oversized.Success);
        Assert.Equal(413, oversized.StatusCode);
        Assert.False(malformed.Success);
        Assert.False(inconsistentDate.Success);
        Assert.Empty(context.BankStatements);
        Assert.Empty(context.BankStatementTransactions);
    }

    [Fact]
    public async Task ReportShowsTruthfulDifference_AndReconcileRequiresEveryRowMatchedAndZeroDifference()
    {
        await using var context = DbContextFactory.Create();
        context.BankStatements.Add(new BankStatement
        {
            Id = 10,
            OrganizationId = 1,
            StatementDate = DateTime.UtcNow,
            StartingBalance = 100m,
            EndingBalance = 125m
        });
        context.BankStatementTransactions.Add(Transaction(20, 10, 20m));
        await context.SaveChangesAsync();
        var service = Service(new BankReconciliationRepository(context));

        var report = await service.GetReconciliationReportAsync(1, 10);
        var reconcile = await service.ReconcileStatementAsync(1, 10, 7);

        Assert.True(report.Success);
        Assert.Equal(-5m, report.Data!.Difference);
        Assert.False(reconcile.Success);
        Assert.Empty(context.BankReconciliations);
    }

    [Fact]
    public async Task Reconcile_WithAllRowsMatchedAndZeroDifference_LocksRowsAtomically()
    {
        await using var context = DbContextFactory.Create();
        context.BankStatements.Add(new BankStatement
        {
            Id = 10,
            OrganizationId = 1,
            StatementDate = DateTime.UtcNow,
            StartingBalance = 100m,
            EndingBalance = 120m
        });
        var transaction = Transaction(20, 10, 20m);
        transaction.IsMatched = true;
        transaction.MatchedLedgerEntryId = 30;
        context.BankStatementTransactions.Add(transaction);
        await context.SaveChangesAsync();
        var service = Service(new BankReconciliationRepository(context));

        var result = await service.ReconcileStatementAsync(1, 10, 7, "verified");

        Assert.True(result.Success);
        Assert.True((await context.BankStatementTransactions.FindAsync(20L))!.IsReconciled);
        Assert.Equal("Reconciled", Assert.Single(context.BankReconciliations).Status);
        Assert.False((await service.UnmatchTransactionAsync(1, 20)).Success);
        Assert.False((await service.DeleteTransactionAsync(1, 20)).Success);
    }

    private static BankStatementTransaction Transaction(long id, long statementId, decimal amount = 12m) => new()
    {
        Id = id,
        BankStatementId = statementId,
        TransactionDate = DateTime.UtcNow,
        Amount = amount
    };

    private static BankStatement Statement(long id, long organizationId) => new()
    {
        Id = id,
        OrganizationId = organizationId,
        StatementDate = DateTime.UtcNow,
        StartingBalance = 0m,
        EndingBalance = 0m
    };

    private static GeneralLedgerEntry Ledger(long id, long organizationId) => new()
    {
        Id = id,
        OrganizationId = organizationId,
        AccountId = id,
        TransactionType = "Test",
        TransactionDate = DateTime.UtcNow,
        Amount = 12m
    };

    private static BankReconciliationService Service(IBankReconciliationRepository repository) => new(
        repository,
        new Mock<IGeneralLedgerService>().Object,
        new Mock<IMapper>().Object,
        NullLogger<BankReconciliationService>.Instance);
}
