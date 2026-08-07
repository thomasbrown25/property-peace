using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Xunit;

namespace brownstone_hub_api.Tests.Domain.Screening;

public sealed class ScreeningDecisionAndDisputePersistenceTests
{
    private static readonly Type[] AuditableHistoryTypes =
    [
        typeof(ScreeningReportRevision),
        typeof(ScreeningRentalDecisionRevision),
        typeof(ScreeningDispute),
        typeof(ScreeningDisputeEvent),
        typeof(ScreeningAdverseActionDeliveryAttempt),
        typeof(ScreeningReconsiderationEvent)
    ];

    [Fact]
    public void Model_registers_bounded_provider_neutral_audit_evidence()
    {
        using var context = CreateContext();
        var model = context.Model;

        foreach (var type in AuditableHistoryTypes)
            model.FindEntityType(type).Should().NotBeNull($"{type.Name} must be configured");

        var report = Entity<ScreeningReportRevision>(model);
        Required(report, nameof(ScreeningReportRevision.ProviderKey), "nvarchar(100)", 100);
        Required(report, nameof(ScreeningReportRevision.ProviderReportReference), "nvarchar(200)", 200);
        Required(report, nameof(ScreeningReportRevision.ReportVersion), "nvarchar(100)", 100);
        Required(report, nameof(ScreeningReportRevision.NormalizedFactsJson), "nvarchar(4000)", 4000);
        Required(report, nameof(ScreeningReportRevision.NormalizedFactsSha256Hash), "char(64)", 64);
        AssertStringConversion<ScreeningReportRevision, ScreeningReportStatus>(report, nameof(ScreeningReportRevision.Status));

        var decision = Entity<ScreeningRentalDecisionRevision>(model);
        Required(decision, nameof(ScreeningRentalDecisionRevision.DecisionActorUserId), "bigint");
        Required(decision, nameof(ScreeningRentalDecisionRevision.CriteriaVersion), "nvarchar(100)", 100);
        Required(decision, nameof(ScreeningRentalDecisionRevision.CriteriaSnapshotSha256Hash), "char(64)", 64);
        Required(decision, nameof(ScreeningRentalDecisionRevision.ReasonCodesJson), "nvarchar(2000)", 2000);
        AssertStringConversion<ScreeningRentalDecisionRevision, ScreeningRentalDecision>(decision, nameof(ScreeningRentalDecisionRevision.Decision));
        AssertStringConversion<ScreeningRentalDecisionRevision, ScreeningDecisionDisputeStatus>(decision, nameof(ScreeningRentalDecisionRevision.DisputeStatus));

        var dispute = Entity<ScreeningDispute>(model);
        Required(dispute, nameof(ScreeningDispute.ProviderKey), "nvarchar(100)", 100);
        Required(dispute, nameof(ScreeningDispute.ProviderDisputeReference), "nvarchar(200)", 200);
        Required(dispute, nameof(ScreeningDispute.IssueCodesJson), "nvarchar(2000)", 2000);
        Required(dispute, nameof(ScreeningDispute.NotesSha256Hash), "char(64)", 64);
        AssertStringConversion<ScreeningDispute, ScreeningDisputeStatus>(dispute, nameof(ScreeningDispute.Status));

        var disputeEvent = Entity<ScreeningDisputeEvent>(model);
        AssertStringConversion<ScreeningDisputeEvent, ScreeningDisputeStatus>(disputeEvent, nameof(ScreeningDisputeEvent.Status));
        disputeEvent.FindProperty(nameof(ScreeningDisputeEvent.ProviderEventType))!.GetMaxLength().Should().Be(100);
        disputeEvent.FindProperty(nameof(ScreeningDisputeEvent.ProviderEventReference))!.GetMaxLength().Should().Be(200);

        var attempt = Entity<ScreeningAdverseActionDeliveryAttempt>(model);
        Required(attempt, nameof(ScreeningAdverseActionDeliveryAttempt.NoticeContentSha256Hash), "char(64)", 64);
        Required(attempt, nameof(ScreeningAdverseActionDeliveryAttempt.ProviderIdempotencyKey), "char(64)", 64);
        attempt.FindProperty(nameof(ScreeningAdverseActionDeliveryAttempt.ProviderDeliveryReference))!.GetMaxLength().Should().Be(200);
        attempt.FindProperty(nameof(ScreeningAdverseActionDeliveryAttempt.FailureCode))!.GetMaxLength().Should().Be(100);
        AssertStringConversion<ScreeningAdverseActionDeliveryAttempt, ScreeningAdverseActionDeliveryChannel>(attempt, nameof(ScreeningAdverseActionDeliveryAttempt.Channel));
        AssertStringConversion<ScreeningAdverseActionDeliveryAttempt, ScreeningDeliveryAttemptStatus>(attempt, nameof(ScreeningAdverseActionDeliveryAttempt.Status));

        var reconsideration = Entity<ScreeningReconsiderationEvent>(model);
        AssertStringConversion<ScreeningReconsiderationEvent, ScreeningReconsiderationStatus>(reconsideration, nameof(ScreeningReconsiderationEvent.FromStatus));
        AssertStringConversion<ScreeningReconsiderationEvent, ScreeningReconsiderationStatus>(reconsideration, nameof(ScreeningReconsiderationEvent.ToStatus));
        Required(reconsideration, nameof(ScreeningReconsiderationEvent.ReasonSha256Hash), "char(64)", 64);
    }

    [Fact]
    public void Revision_and_provider_correlations_are_unique_and_retention_queries_are_indexed()
    {
        using var context = CreateContext();
        var model = context.Model;

        AssertUniqueIndex(Entity<ScreeningReportRevision>(model), nameof(ScreeningReportRevision.TenantScreeningOrderId), nameof(ScreeningReportRevision.Revision));
        AssertUniqueIndex(Entity<ScreeningReportRevision>(model), nameof(ScreeningReportRevision.ProviderKey), nameof(ScreeningReportRevision.ProviderReportReference));
        AssertIndex(Entity<ScreeningReportRevision>(model), nameof(ScreeningReportRevision.OrganizationId), nameof(ScreeningReportRevision.RetentionExpiresAt), nameof(ScreeningReportRevision.DeletedAt));

        AssertUniqueIndex(Entity<ScreeningRentalDecisionRevision>(model), nameof(ScreeningRentalDecisionRevision.TenantScreeningOrderId), nameof(ScreeningRentalDecisionRevision.Revision));
        AssertUniqueIndex(Entity<ScreeningDispute>(model), nameof(ScreeningDispute.ProviderKey), nameof(ScreeningDispute.ProviderDisputeReference));
        AssertIndex(Entity<ScreeningDispute>(model), nameof(ScreeningDispute.OrganizationId), nameof(ScreeningDispute.Status), nameof(ScreeningDispute.ResolvedAt));
        AssertIndex(Entity<ScreeningDispute>(model), nameof(ScreeningDispute.OrganizationId), nameof(ScreeningDispute.RetentionExpiresAt));
        AssertUniqueIndex(Entity<ScreeningDisputeEvent>(model), nameof(ScreeningDisputeEvent.ScreeningDisputeId), nameof(ScreeningDisputeEvent.Revision));
        AssertUniqueIndex(Entity<ScreeningAdverseActionDeliveryAttempt>(model), nameof(ScreeningAdverseActionDeliveryAttempt.ScreeningAdverseActionId), nameof(ScreeningAdverseActionDeliveryAttempt.AttemptNumber));
        AssertIndex(Entity<ScreeningAdverseActionDeliveryAttempt>(model), nameof(ScreeningAdverseActionDeliveryAttempt.ScreeningAdverseActionId), nameof(ScreeningAdverseActionDeliveryAttempt.Channel));
        AssertIndex(Entity<ScreeningAdverseActionDeliveryAttempt>(model), nameof(ScreeningAdverseActionDeliveryAttempt.ProviderIdempotencyKey));
        AssertUniqueIndex(Entity<ScreeningReconsiderationEvent>(model), nameof(ScreeningReconsiderationEvent.ScreeningAdverseActionId), nameof(ScreeningReconsiderationEvent.Revision));
    }

    [Fact]
    public void Every_audit_reference_uses_navigation_independent_restrict_foreign_keys()
    {
        using var context = CreateContext();
        var model = context.Model;

        AssertFk<ScreeningReportRevision, TenantScreeningOrder>(model, nameof(ScreeningReportRevision.TenantScreeningOrderId), true);
        AssertFk<ScreeningReportRevision, Organization>(model, nameof(ScreeningReportRevision.OrganizationId), true);
        AssertFk<ScreeningReportRevision, ScreeningReportRevision>(model, nameof(ScreeningReportRevision.SupersedesScreeningReportRevisionId), false);
        AssertFk<ScreeningRentalDecisionRevision, TenantScreeningOrder>(model, nameof(ScreeningRentalDecisionRevision.TenantScreeningOrderId), true);
        AssertFk<ScreeningRentalDecisionRevision, Organization>(model, nameof(ScreeningRentalDecisionRevision.OrganizationId), true);
        AssertFk<ScreeningRentalDecisionRevision, RentalApplication>(model, nameof(ScreeningRentalDecisionRevision.RentalApplicationId), true);
        AssertFk<ScreeningRentalDecisionRevision, User>(model, nameof(ScreeningRentalDecisionRevision.DecisionActorUserId), true);
        AssertFk<ScreeningRentalDecisionRevision, ScreeningReportRevision>(model, nameof(ScreeningRentalDecisionRevision.ReliedUponScreeningReportRevisionId), false);
        AssertFk<ScreeningRentalDecisionRevision, ScreeningRentalDecisionRevision>(model, nameof(ScreeningRentalDecisionRevision.SupersedesScreeningRentalDecisionRevisionId), false);
        AssertFk<ScreeningDispute, TenantScreeningOrder>(model, nameof(ScreeningDispute.TenantScreeningOrderId), true);
        AssertFk<ScreeningDispute, Organization>(model, nameof(ScreeningDispute.OrganizationId), true);
        AssertFk<ScreeningDispute, ScreeningReportRevision>(model, nameof(ScreeningDispute.OriginalScreeningReportRevisionId), true);
        AssertFk<ScreeningDispute, ScreeningReportRevision>(model, nameof(ScreeningDispute.CorrectedScreeningReportRevisionId), false);
        AssertFk<ScreeningDisputeEvent, ScreeningDispute>(model, nameof(ScreeningDisputeEvent.ScreeningDisputeId), true);
        AssertFk<ScreeningDisputeEvent, TenantScreeningOrder>(model, nameof(ScreeningDisputeEvent.TenantScreeningOrderId), true);
        AssertFk<ScreeningAdverseActionDeliveryAttempt, ScreeningAdverseAction>(model, nameof(ScreeningAdverseActionDeliveryAttempt.ScreeningAdverseActionId), true);
        AssertFk<ScreeningAdverseActionDeliveryAttempt, Organization>(model, nameof(ScreeningAdverseActionDeliveryAttempt.OrganizationId), true);
        AssertFk<ScreeningReconsiderationEvent, ScreeningAdverseAction>(model, nameof(ScreeningReconsiderationEvent.ScreeningAdverseActionId), true);
        AssertFk<ScreeningReconsiderationEvent, User>(model, nameof(ScreeningReconsiderationEvent.ActorUserId), true);
        AssertFk<ScreeningAdverseAction, ScreeningRentalDecisionRevision>(model, nameof(ScreeningAdverseAction.OriginalScreeningRentalDecisionRevisionId), true);
        AssertFk<ScreeningAdverseAction, ScreeningReportRevision>(model, nameof(ScreeningAdverseAction.OriginalScreeningReportRevisionId), false);
    }

    [Fact]
    public void Adverse_action_freezes_notice_snapshots_and_uses_append_only_delivery_and_reconsideration_histories()
    {
        using var context = CreateContext();
        var adverse = Entity<ScreeningAdverseAction>(context.Model);

        Required(adverse, nameof(ScreeningAdverseAction.NoticeVersion), "nvarchar(100)", 100);
        Required(adverse, nameof(ScreeningAdverseAction.ImmutableNoticeContent), "nvarchar(max)", 10000);
        Required(adverse, nameof(ScreeningAdverseAction.NoticeContentSha256Hash), "char(64)", 64);
        Required(adverse, nameof(ScreeningAdverseAction.StatutoryDisclosureVersion), "nvarchar(100)", 100);
        Required(adverse, nameof(ScreeningAdverseAction.StatutoryDisclosureSha256Hash), "char(64)", 64);
        Required(adverse, nameof(ScreeningAdverseAction.StateLocalDisclosureVersion), "nvarchar(100)", 100);
        Required(adverse, nameof(ScreeningAdverseAction.StateLocalDisclosureSha256Hash), "char(64)", 64);

        typeof(ScreeningAdverseAction).GetProperty("DeliveryStatus").Should().BeNull();
        typeof(ScreeningAdverseAction).GetProperty("DeliveredAt").Should().BeNull();
        typeof(ScreeningAdverseAction).GetProperty("DeliveryEvidenceReference").Should().BeNull();
        typeof(ScreeningAdverseAction).GetProperty("ReconsiderationStatus").Should().BeNull();
    }

    [Fact]
    public void Human_decision_is_mandatory_and_sensitive_or_automatic_storage_is_absent()
    {
        using var context = CreateContext();
        Entity<ScreeningRentalDecisionRevision>(context.Model)
            .FindProperty(nameof(ScreeningRentalDecisionRevision.DecisionActorUserId))!.IsNullable.Should().BeFalse();

        Enum.GetNames<ScreeningRentalDecision>().Should().Equal("Approved", "Denied", "Conditional", "Deferred");

        var forbiddenTerms = new[]
        {
            "Ssn", "SocialSecurity", "DateOfBirth", "Dob", "Bank", "Credential", "Password", "Secret",
            "ReportUrl", "ReportUri", "ReportHtml", "ReportPdf", "ReportBlob", "FullReport", "RawNarrative",
            "AutomaticDecision", "AutomaticPass", "AutomaticFail", "DecisionRule", "DecisionScore"
        };
        AuditableHistoryTypes.Append(typeof(ScreeningAdverseAction))
            .SelectMany(type => type.GetProperties().Select(property => $"{type.Name}.{property.Name}"))
            .Should().NotContain(name => forbiddenTerms.Any(term => name.Contains(term, StringComparison.OrdinalIgnoreCase)));
    }

    private static DataContext CreateContext() => new(
        new DbContextOptionsBuilder<DataContext>()
            .UseSqlServer("Server=(localdb)\\mssqllocaldb;Database=ScreeningDecisionMetadataOnly;Trusted_Connection=True")
            .Options);

    private static IEntityType Entity<T>(IModel model) => model.FindEntityType(typeof(T))!;

    private static void Required(IEntityType entity, string name, string columnType, int? maxLength = null)
    {
        var property = entity.FindProperty(name)!;
        property.IsNullable.Should().BeFalse();
        property.GetColumnType().Should().Be(columnType);
        if (maxLength.HasValue) property.GetMaxLength().Should().Be(maxLength);
    }

    private static void AssertStringConversion<TEntity, TEnum>(IEntityType entity, string propertyName)
        where TEnum : struct, Enum
    {
        var property = entity.FindProperty(propertyName)!;
        property.ClrType.Should().Be(typeof(TEnum));
        (property.GetValueConverter() ?? property.GetTypeMapping().Converter)!.ProviderClrType.Should().Be(typeof(string));
        property.GetMaxLength().Should().Be(32);
    }

    private static void AssertIndex(IEntityType entity, params string[] names) =>
        entity.GetIndexes().Should().Contain(index => index.Properties.Select(x => x.Name).SequenceEqual(names));

    private static void AssertUniqueIndex(IEntityType entity, params string[] names) =>
        entity.GetIndexes().Should().Contain(index => index.IsUnique && index.Properties.Select(x => x.Name).SequenceEqual(names));

    private static void AssertFk<TDependent, TPrincipal>(IModel model, string propertyName, bool required)
    {
        var foreignKey = Entity<TDependent>(model).GetForeignKeys().Single(fk =>
            fk.PrincipalEntityType.ClrType == typeof(TPrincipal) &&
            fk.Properties.Count == 1 && fk.Properties.Single().Name == propertyName);
        foreignKey.DeleteBehavior.Should().Be(DeleteBehavior.Restrict);
        foreignKey.IsRequired.Should().Be(required);
    }
}
