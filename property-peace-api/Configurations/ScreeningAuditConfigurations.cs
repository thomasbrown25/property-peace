using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations;

public sealed class ScreeningReportRevisionConfig : IEntityTypeConfiguration<ScreeningReportRevision>
{
    public void Configure(EntityTypeBuilder<ScreeningReportRevision> b)
    {
        b.ToTable("ScreeningReportRevisions", "screening", table =>
        {
            table.HasCheckConstraint("CK_ScreeningReportRevisions_Revision", "[Revision] > 0");
            table.HasCheckConstraint("CK_ScreeningReportRevisions_NormalizedFactsJson", "ISJSON([NormalizedFactsJson]) = 1");
            table.HasCheckConstraint("CK_ScreeningReportRevisions_Deletion", "[DeletedAt] IS NULL OR [DeleteRequestedAt] IS NOT NULL");
        });
        b.HasKey(x => x.Id);
        Fields.BigInt(b.Property(x => x.Id));
        Fields.BigInt(b.Property(x => x.TenantScreeningOrderId));
        Fields.BigInt(b.Property(x => x.OrganizationId));
        Fields.BigInt(b.Property(x => x.Revision));
        Fields.RequiredText(b.Property(x => x.ProviderKey), 100);
        Fields.RequiredText(b.Property(x => x.ProviderReportReference), 200);
        Fields.Timestamp(b.Property(x => x.ReceivedAt));
        Fields.Timestamp(b.Property(x => x.ProviderOccurredAt));
        Fields.Timestamp(b.Property(x => x.CorrectedAt));
        Fields.EnumText(b.Property(x => x.Status));
        Fields.RequiredText(b.Property(x => x.ReportVersion), 100);
        Fields.RequiredText(b.Property(x => x.NormalizedFactsJson), 4000);
        Fields.RequiredHash(b.Property(x => x.NormalizedFactsSha256Hash));
        Fields.NullableBigInt(b.Property(x => x.SupersedesScreeningReportRevisionId));
        Fields.Timestamp(b.Property(x => x.RetentionExpiresAt));
        Fields.EnumText(b.Property(x => x.RetentionSignal));
        Fields.Timestamp(b.Property(x => x.DeleteRequestedAt));
        Fields.Timestamp(b.Property(x => x.DeletedAt));
        Fields.Bit(b.Property(x => x.IsUnderLegalHold));
        Fields.Timestamp(b.Property(x => x.LegalHoldPlacedAt));
        Fields.Timestamp(b.Property(x => x.LegalHoldReleasedAt));
        Fields.Text(b.Property(x => x.LegalHoldReasonCode), 100);
        b.Property(x => x.DeletionClaimToken).HasColumnType("uniqueidentifier").IsConcurrencyToken();
        Fields.Timestamp(b.Property(x => x.DeletionClaimedAt));
        Fields.Timestamp(b.Property(x => x.DeletionClaimExpiresAt));
        Fields.Timestamp(b.Property(x => x.DeletionProviderCallStartedAt));
        b.Property(x => x.DeletionProviderCallStartedAt).IsConcurrencyToken();
        b.Property(x => x.PendingDisputeOperationId).HasColumnType("uniqueidentifier").IsConcurrencyToken();

        b.HasIndex(x => new { x.TenantScreeningOrderId, x.Revision }).IsUnique();
        b.HasIndex(x => new { x.ProviderKey, x.ProviderReportReference }).IsUnique();
        b.HasIndex(x => new { x.OrganizationId, x.RetentionExpiresAt, x.DeletedAt });
        b.HasIndex(x => new { x.OrganizationId, x.IsUnderLegalHold, x.DeleteRequestedAt });
        b.HasOne<TenantScreeningOrder>().WithMany().HasForeignKey(x => x.TenantScreeningOrderId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<Organization>().WithMany().HasForeignKey(x => x.OrganizationId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<ScreeningReportRevision>().WithMany().HasForeignKey(x => x.SupersedesScreeningReportRevisionId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class ScreeningReportDeletionEventConfig : IEntityTypeConfiguration<ScreeningReportDeletionEvent>
{
    public void Configure(EntityTypeBuilder<ScreeningReportDeletionEvent> b)
    {
        b.ToTable("ScreeningReportDeletionEvents", "screening", table =>
            table.HasCheckConstraint("CK_ScreeningReportDeletionEvents_Revision", "[Revision] > 0"));
        b.HasKey(x => x.Id);
        Fields.BigInt(b.Property(x => x.Id));
        Fields.BigInt(b.Property(x => x.ScreeningReportRevisionId));
        Fields.BigInt(b.Property(x => x.TenantScreeningOrderId));
        Fields.BigInt(b.Property(x => x.OrganizationId));
        Fields.BigInt(b.Property(x => x.Revision));
        Fields.EnumText(b.Property(x => x.EventType));
        Fields.Timestamp(b.Property(x => x.OccurredAt));
        Fields.Text(b.Property(x => x.ReasonCode), 100);
        b.HasIndex(x => new { x.ScreeningReportRevisionId, x.Revision }).IsUnique();
        b.HasIndex(x => new { x.OrganizationId, x.OccurredAt });
        b.HasOne<ScreeningReportRevision>().WithMany().HasForeignKey(x => x.ScreeningReportRevisionId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<TenantScreeningOrder>().WithMany().HasForeignKey(x => x.TenantScreeningOrderId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<Organization>().WithMany().HasForeignKey(x => x.OrganizationId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class ScreeningRentalDecisionRevisionConfig : IEntityTypeConfiguration<ScreeningRentalDecisionRevision>
{
    public void Configure(EntityTypeBuilder<ScreeningRentalDecisionRevision> b)
    {
        b.ToTable("ScreeningRentalDecisionRevisions", "screening", table =>
        {
            table.HasCheckConstraint("CK_ScreeningRentalDecisionRevisions_Revision", "[Revision] > 0");
            table.HasCheckConstraint("CK_ScreeningRentalDecisionRevisions_ReasonCodesJson", "ISJSON([ReasonCodesJson]) = 1");
        });
        b.HasKey(x => x.Id);
        Fields.BigInt(b.Property(x => x.Id));
        Fields.BigInt(b.Property(x => x.TenantScreeningOrderId));
        Fields.BigInt(b.Property(x => x.OrganizationId));
        Fields.BigInt(b.Property(x => x.RentalApplicationId));
        Fields.BigInt(b.Property(x => x.Revision));
        Fields.BigInt(b.Property(x => x.DecisionActorUserId));
        Fields.EnumText(b.Property(x => x.Decision));
        Fields.RequiredText(b.Property(x => x.CriteriaVersion), 100);
        Fields.RequiredHash(b.Property(x => x.CriteriaSnapshotSha256Hash));
        Fields.NullableBigInt(b.Property(x => x.ReliedUponScreeningReportRevisionId));
        Fields.RequiredText(b.Property(x => x.ReasonCodesJson), 2000);
        Fields.Timestamp(b.Property(x => x.CreatedAt));
        Fields.NullableBigInt(b.Property(x => x.SupersedesScreeningRentalDecisionRevisionId));
        Fields.Bit(b.Property(x => x.IsFrozenByDispute));
        Fields.EnumText(b.Property(x => x.DisputeStatus));

        b.HasIndex(x => new { x.TenantScreeningOrderId, x.Revision }).IsUnique();
        b.HasIndex(x => new { x.OrganizationId, x.RentalApplicationId, x.CreatedAt });
        b.HasIndex(x => x.ReliedUponScreeningReportRevisionId);
        b.HasOne<TenantScreeningOrder>().WithMany().HasForeignKey(x => x.TenantScreeningOrderId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<Organization>().WithMany().HasForeignKey(x => x.OrganizationId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<RentalApplication>().WithMany().HasForeignKey(x => x.RentalApplicationId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<User>().WithMany().HasForeignKey(x => x.DecisionActorUserId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<ScreeningReportRevision>().WithMany().HasForeignKey(x => x.ReliedUponScreeningReportRevisionId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<ScreeningRentalDecisionRevision>().WithMany().HasForeignKey(x => x.SupersedesScreeningRentalDecisionRevisionId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class ScreeningDisputeConfig : IEntityTypeConfiguration<ScreeningDispute>
{
    public void Configure(EntityTypeBuilder<ScreeningDispute> b)
    {
        b.ToTable("ScreeningDisputes", "screening", table =>
        {
            table.HasCheckConstraint("CK_ScreeningDisputes_IssueCodesJson", "ISJSON([IssueCodesJson]) = 1");
            table.HasCheckConstraint("CK_ScreeningDisputes_ResolvedAt", "[ResolvedAt] IS NULL OR [ResolvedAt] >= [OpenedAt]");
        });
        b.HasKey(x => x.Id);
        Fields.BigInt(b.Property(x => x.Id));
        b.Property(x => x.LocalDisputeId).HasColumnType("uniqueidentifier").IsRequired();
        Fields.BigInt(b.Property(x => x.TenantScreeningOrderId));
        Fields.BigInt(b.Property(x => x.OrganizationId));
        Fields.RequiredText(b.Property(x => x.ProviderKey), 100);
        Fields.RequiredText(b.Property(x => x.ProviderDisputeReference), 200);
        Fields.EnumText(b.Property(x => x.Status));
        Fields.Timestamp(b.Property(x => x.OpenedAt));
        Fields.Timestamp(b.Property(x => x.ResolvedAt));
        Fields.BigInt(b.Property(x => x.OriginalScreeningReportRevisionId));
        Fields.NullableBigInt(b.Property(x => x.CorrectedScreeningReportRevisionId));
        Fields.NullableEnumText(b.Property(x => x.OpenedByActorType));
        Fields.NullableBigInt(b.Property(x => x.OpenedByUserId));
        Fields.RequiredText(b.Property(x => x.IssueCodesJson), 2000);
        Fields.RequiredHash(b.Property(x => x.NotesSha256Hash));
        Fields.Timestamp(b.Property(x => x.RetentionExpiresAt));

        b.HasIndex(x => x.LocalDisputeId).IsUnique();
        b.HasIndex(x => new { x.ProviderKey, x.ProviderDisputeReference }).IsUnique();
        b.HasIndex(x => new { x.OrganizationId, x.Status, x.ResolvedAt });
        b.HasIndex(x => new { x.OrganizationId, x.RetentionExpiresAt });
        b.HasIndex(x => new { x.TenantScreeningOrderId, x.OpenedAt });
        b.HasOne<TenantScreeningOrder>().WithMany().HasForeignKey(x => x.TenantScreeningOrderId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<Organization>().WithMany().HasForeignKey(x => x.OrganizationId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<ScreeningReportRevision>().WithMany().HasForeignKey(x => x.OriginalScreeningReportRevisionId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<ScreeningReportRevision>().WithMany().HasForeignKey(x => x.CorrectedScreeningReportRevisionId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<User>().WithMany().HasForeignKey(x => x.OpenedByUserId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class ScreeningDisputeIntentConfig : IEntityTypeConfiguration<ScreeningDisputeIntent>
{
    public void Configure(EntityTypeBuilder<ScreeningDisputeIntent> b)
    {
        b.ToTable("ScreeningDisputeIntents", "screening", table =>
        {
            table.HasCheckConstraint("CK_ScreeningDisputeIntents_Attempts", "[Attempts] >= 0");
            table.HasCheckConstraint("CK_ScreeningDisputeIntents_IssueCodesJson", "ISJSON([IssueCodesJson]) = 1");
        });
        b.HasKey(x => x.Id);
        Fields.BigInt(b.Property(x => x.Id));
        b.Property(x => x.OperationId).HasColumnType("uniqueidentifier").IsRequired();
        Fields.BigInt(b.Property(x => x.TenantScreeningOrderId));
        Fields.BigInt(b.Property(x => x.OrganizationId));
        Fields.BigInt(b.Property(x => x.RentalApplicationId));
        Fields.BigInt(b.Property(x => x.ScreeningReportRevisionId));
        Fields.RequiredText(b.Property(x => x.ProviderKey), 100);
        Fields.RequiredText(b.Property(x => x.ProviderOrderId), 200);
        Fields.RequiredText(b.Property(x => x.ProviderReportReference), 200);
        Fields.EnumText(b.Property(x => x.ActorType));
        Fields.NullableBigInt(b.Property(x => x.ActorUserId));
        Fields.RequiredText(b.Property(x => x.IssueCodesJson), 2000);
        Fields.RequiredHash(b.Property(x => x.NotesSha256Hash));
        Fields.Timestamp(b.Property(x => x.RetentionExpiresAt));
        Fields.EnumText(b.Property(x => x.Status));
        b.Property(x => x.Attempts).HasColumnType("int").IsRequired();
        b.Property(x => x.ProcessingLeaseId).HasColumnType("uniqueidentifier");
        Fields.Timestamp(b.Property(x => x.ProcessingLeaseUntil));
        Fields.Timestamp(b.Property(x => x.NextAttemptAt));
        Fields.Timestamp(b.Property(x => x.CreatedAt));
        Fields.Timestamp(b.Property(x => x.ProviderAcceptedAt));
        Fields.Timestamp(b.Property(x => x.CompletedAt));
        Fields.Text(b.Property(x => x.ProviderReference), 200);
        Fields.Text(b.Property(x => x.FailureCode), 100);
        b.Property(x => x.RowVersion).HasColumnType("rowversion").IsRowVersion();
        b.HasIndex(x => x.OperationId).IsUnique();
        b.HasIndex(x => new { x.TenantScreeningOrderId, x.ScreeningReportRevisionId }).IsUnique();
        b.HasIndex(x => new { x.Status, x.NextAttemptAt, x.ProcessingLeaseUntil, x.CreatedAt });
        b.HasOne<TenantScreeningOrder>().WithMany().HasForeignKey(x => x.TenantScreeningOrderId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<Organization>().WithMany().HasForeignKey(x => x.OrganizationId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<RentalApplication>().WithMany().HasForeignKey(x => x.RentalApplicationId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<ScreeningReportRevision>().WithMany().HasForeignKey(x => x.ScreeningReportRevisionId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<User>().WithMany().HasForeignKey(x => x.ActorUserId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class ScreeningDisputeEventConfig : IEntityTypeConfiguration<ScreeningDisputeEvent>
{
    public void Configure(EntityTypeBuilder<ScreeningDisputeEvent> b)
    {
        b.ToTable("ScreeningDisputeEvents", "screening", table =>
            table.HasCheckConstraint("CK_ScreeningDisputeEvents_Revision", "[Revision] > 0"));
        b.HasKey(x => x.Id);
        Fields.BigInt(b.Property(x => x.Id));
        Fields.BigInt(b.Property(x => x.ScreeningDisputeId));
        Fields.BigInt(b.Property(x => x.TenantScreeningOrderId));
        Fields.BigInt(b.Property(x => x.OrganizationId));
        Fields.BigInt(b.Property(x => x.Revision));
        Fields.EnumText(b.Property(x => x.Status));
        Fields.Timestamp(b.Property(x => x.OccurredAt));
        Fields.Timestamp(b.Property(x => x.RecordedAt));
        Fields.Text(b.Property(x => x.ProviderEventType), 100);
        Fields.Text(b.Property(x => x.ProviderEventReference), 200);
        Fields.NullableEnumText(b.Property(x => x.ActorType));
        Fields.NullableBigInt(b.Property(x => x.ActorUserId));

        b.HasIndex(x => new { x.ScreeningDisputeId, x.Revision }).IsUnique();
        b.HasIndex(x => new { x.ScreeningDisputeId, x.ProviderEventReference }).IsUnique()
            .HasFilter("[ProviderEventReference] IS NOT NULL");
        b.HasIndex(x => new { x.OrganizationId, x.RecordedAt });
        b.HasIndex(x => new { x.TenantScreeningOrderId, x.OccurredAt });
        b.HasOne<ScreeningDispute>().WithMany().HasForeignKey(x => x.ScreeningDisputeId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<TenantScreeningOrder>().WithMany().HasForeignKey(x => x.TenantScreeningOrderId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<Organization>().WithMany().HasForeignKey(x => x.OrganizationId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<User>().WithMany().HasForeignKey(x => x.ActorUserId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class ScreeningAdverseActionDeliveryAttemptConfig : IEntityTypeConfiguration<ScreeningAdverseActionDeliveryAttempt>
{
    public void Configure(EntityTypeBuilder<ScreeningAdverseActionDeliveryAttempt> b)
    {
        b.ToTable("ScreeningAdverseActionDeliveryAttempts", "screening", table =>
            table.HasCheckConstraint("CK_ScreeningAdverseActionDeliveryAttempts_Attempt", "[AttemptNumber] > 0"));
        b.HasKey(x => x.Id);
        Fields.BigInt(b.Property(x => x.Id));
        Fields.BigInt(b.Property(x => x.ScreeningAdverseActionId));
        Fields.BigInt(b.Property(x => x.OrganizationId));
        b.Property(x => x.AttemptNumber).HasColumnType("int").IsRequired();
        Fields.EnumText(b.Property(x => x.Channel));
        Fields.Timestamp(b.Property(x => x.AttemptedAt));
        Fields.Timestamp(b.Property(x => x.DeliveredAt));
        Fields.EnumText(b.Property(x => x.Status));
        Fields.Text(b.Property(x => x.ProviderDeliveryReference), 200);
        Fields.Text(b.Property(x => x.FailureCode), 100);
        Fields.RequiredHash(b.Property(x => x.NoticeContentSha256Hash));
        Fields.RequiredHash(b.Property(x => x.ProviderIdempotencyKey));
        b.Property(x => x.ProcessingLeaseId).HasColumnType("uniqueidentifier");
        Fields.Timestamp(b.Property(x => x.ProcessingLeaseUntil));
        Fields.Timestamp(b.Property(x => x.NextAttemptAt));
        b.Property(x => x.RowVersion).HasColumnType("rowversion").IsRowVersion();

        b.HasIndex(x => new { x.ScreeningAdverseActionId, x.AttemptNumber }).IsUnique();
        // Retries append evidence rows and intentionally reuse the logical-send key.
        b.HasIndex(x => new { x.ScreeningAdverseActionId, x.Channel });
        b.HasIndex(x => x.ProviderIdempotencyKey);
        b.HasIndex(x => new { x.Status, x.NextAttemptAt, x.ProcessingLeaseUntil, x.AttemptedAt });
        b.HasOne<ScreeningAdverseAction>().WithMany().HasForeignKey(x => x.ScreeningAdverseActionId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<Organization>().WithMany().HasForeignKey(x => x.OrganizationId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class ScreeningReconsiderationEventConfig : IEntityTypeConfiguration<ScreeningReconsiderationEvent>
{
    public void Configure(EntityTypeBuilder<ScreeningReconsiderationEvent> b)
    {
        b.ToTable("ScreeningReconsiderationEvents", "screening", table =>
            table.HasCheckConstraint("CK_ScreeningReconsiderationEvents_Revision", "[Revision] > 0"));
        b.HasKey(x => x.Id);
        Fields.BigInt(b.Property(x => x.Id));
        Fields.BigInt(b.Property(x => x.ScreeningAdverseActionId));
        Fields.BigInt(b.Property(x => x.TenantScreeningOrderId));
        Fields.BigInt(b.Property(x => x.OrganizationId));
        Fields.BigInt(b.Property(x => x.Revision));
        Fields.EnumText(b.Property(x => x.FromStatus));
        Fields.EnumText(b.Property(x => x.ToStatus));
        Fields.Timestamp(b.Property(x => x.OccurredAt));
        Fields.Timestamp(b.Property(x => x.RecordedAt));
        Fields.BigInt(b.Property(x => x.ActorUserId));
        Fields.RequiredHash(b.Property(x => x.ReasonSha256Hash));
        Fields.NullableBigInt(b.Property(x => x.NewScreeningRentalDecisionRevisionId));

        b.HasIndex(x => new { x.ScreeningAdverseActionId, x.Revision }).IsUnique();
        b.HasIndex(x => new { x.OrganizationId, x.RecordedAt });
        b.HasIndex(x => new { x.TenantScreeningOrderId, x.OccurredAt });
        b.HasOne<ScreeningAdverseAction>().WithMany().HasForeignKey(x => x.ScreeningAdverseActionId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<TenantScreeningOrder>().WithMany().HasForeignKey(x => x.TenantScreeningOrderId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<Organization>().WithMany().HasForeignKey(x => x.OrganizationId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<User>().WithMany().HasForeignKey(x => x.ActorUserId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<ScreeningRentalDecisionRevision>().WithMany().HasForeignKey(x => x.NewScreeningRentalDecisionRevisionId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal static class Fields
{
    internal static void BigInt(PropertyBuilder<long> property) => property.HasColumnType("bigint").IsRequired();
    internal static void NullableBigInt(PropertyBuilder<long?> property) => property.HasColumnType("bigint");
    internal static void Bit(PropertyBuilder<bool> property) => property.HasColumnType("bit").IsRequired();
    internal static void Timestamp(PropertyBuilder<DateTimeOffset> property) => property.HasColumnType("datetimeoffset(7)").IsRequired();
    internal static void Timestamp(PropertyBuilder<DateTimeOffset?> property) => property.HasColumnType("datetimeoffset(7)");
    internal static void RequiredHash(PropertyBuilder<string> property) => property.HasColumnType("char(64)").HasMaxLength(64).IsUnicode(false).IsRequired();
    internal static void RequiredText(PropertyBuilder<string> property, int length) => property.HasColumnType($"nvarchar({length})").HasMaxLength(length).IsRequired();
    internal static void Text(PropertyBuilder<string?> property, int length) => property.HasColumnType($"nvarchar({length})").HasMaxLength(length);
    internal static void EnumText<T>(PropertyBuilder<T> property) where T : struct, Enum => property.HasConversion<string>().HasColumnType("nvarchar(32)").HasMaxLength(32).IsRequired();
    internal static void NullableEnumText<T>(PropertyBuilder<T?> property) where T : struct, Enum => property.HasConversion<string>().HasColumnType("nvarchar(32)").HasMaxLength(32);
}
