using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Screening;

public sealed class ScreeningAppendOnlyEnforcementTests
{
    public static IEnumerable<object[]> ImmutableEvidenceTypes()
    {
        yield return [new ScreeningPaymentEvidence()];
        yield return [new ScreeningTransitionEvent()];
        yield return [new ScreeningConsentEvidence()];
        yield return [new ScreeningReportDeletionEvent()];
        yield return [new ScreeningDisputeEvent()];
        yield return [new ScreeningReconsiderationEvent()];
        yield return [new ScreeningIncidentEvent()];
        yield return [new ScreeningRentalDecisionRevision()];
        yield return [new ScreeningAdverseAction()];
        yield return [new ScreeningWebhookInboxEvent()];
        yield return [new ScreeningCancellationIntent()];
        yield return [new ScreeningDisputeIntent()];
        yield return [new ScreeningReportAccessAudit()];
        yield return [new ScreeningSupportElevation()];
        yield return [new ScreeningDispute()];
        yield return [new ScreeningAdverseActionDeliveryAttempt()];
        yield return [new ScreeningIncident()];
    }

    [Theory]
    [MemberData(nameof(ImmutableEvidenceTypes))]
    public async Task Immutable_screening_evidence_rejects_modify_and_delete(object evidence)
    {
        await using var db = Db();
        db.Attach(evidence);
        db.Entry(evidence).State = EntityState.Modified;
        await FluentActions.Invoking(() => db.SaveChangesAsync()).Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*append-only*");
        db.Entry(evidence).State = EntityState.Deleted;
        await FluentActions.Invoking(() => db.SaveChangesAsync()).Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*append-only*");
    }

    [Fact]
    public async Task Explicit_accept_changes_overload_cannot_bypass_append_only_guard()
    {
        await using var db = Db();
        var evidence = new ScreeningConsentEvidence();
        db.Attach(evidence);
        db.Entry(evidence).State = EntityState.Modified;

        await FluentActions.Invoking(() => db.SaveChangesAsync(acceptAllChangesOnSuccess: false, default))
            .Should().ThrowAsync<InvalidOperationException>().WithMessage("*append-only*");
    }

    [Fact]
    public void Milestone3_sql_installs_database_append_only_guards_for_every_immutable_evidence_table()
    {
        using var db = new DataContext(new DbContextOptionsBuilder<DataContext>()
            .UseSqlServer("Server=(localdb)\\mssqllocaldb;Database=ScreeningAppendOnlyMetadata;Trusted_Connection=True").Options);
        var sql = db.GetService<IMigrator>().GenerateScript(
            "20260806212127_AddLeadDeliveryLeases",
            "20260807120109_Milestone3TenantScreeningProductionization",
            MigrationsSqlGenerationOptions.Idempotent);
        var checkedInSqlPath = Path.GetFullPath(Path.Combine(
            AppContext.BaseDirectory, "..", "..", "..", "..", "property-peace-api", "Migrations", "Scripts",
            "20260807120109_Milestone3TenantScreeningProductionization.idempotent.sql"));
        var checkedInSql = System.IO.File.ReadAllText(checkedInSqlPath);
        checkedInSql.Replace("\r\n", "\n").Trim().Should().Be(sql.Replace("\r\n", "\n").Trim());
        foreach (var table in new[] { "ScreeningPaymentEvidence", "ScreeningTransitionEvents", "ScreeningConsentEvidence",
                     "ScreeningReportDeletionEvents", "ScreeningDisputeEvents", "ScreeningReconsiderationEvents",
                     "ScreeningIncidentEvents", "ScreeningAdverseActions" })
            sql.Should().Contain($"TR_AppendOnly_{table}");
        sql.Should().Contain("TR_ImmutableEvidence_ScreeningRentalDecisionRevisions");
        sql.Should().Contain("TR_ImmutableEvidence_ScreeningReportRevisions");
        foreach (var table in new[] { "ScreeningWebhookInboxEvents", "ScreeningCancellationIntents", "ScreeningDisputeIntents",
                     "ScreeningReportAccessAudits", "ScreeningSupportElevations", "ScreeningDisputes",
                     "ScreeningAdverseActionDeliveryAttempts", "ScreeningIncidents" })
            sql.Should().Contain($"TR_ImmutableEvidence_{table}");
        sql.Should().NotContain("UPDATE([NormalizedFactsJson])",
            "fact minimization is an allowed report lifecycle update while its original hash remains immutable");
    }

    private static DataContext Db() => new(new DbContextOptionsBuilder<DataContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
}
