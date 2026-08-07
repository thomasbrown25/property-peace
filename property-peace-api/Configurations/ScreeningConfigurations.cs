using brownstone_hub_api.Domain.Screening;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations;

public sealed class TenantScreeningOrderConfig : IEntityTypeConfiguration<TenantScreeningOrder>
{
    public void Configure(EntityTypeBuilder<TenantScreeningOrder> b)
    {
        b.ToTable("TenantScreeningOrders", "screening", table =>
        {
            table.HasCheckConstraint("CK_TenantScreeningOrders_QuoteAmounts",
                "[LandlordAmountMinor] >= 0 AND [ApplicantAmountMinor] >= 0 AND [ProviderAmountMinor] >= 0 AND [PlatformFeeMinor] >= 0 AND [TaxAmountMinor] >= 0 AND [TotalAmountMinor] = [LandlordAmountMinor] + [ApplicantAmountMinor] AND [TotalAmountMinor] = [ProviderAmountMinor] + [PlatformFeeMinor] + [TaxAmountMinor]");
            table.HasCheckConstraint("CK_TenantScreeningOrders_Revision", "[CurrentRevision] >= 0");
        });
        b.HasKey(x => x.Id);
        BigInt(b.Property(x => x.Id));
        BigInt(b.Property(x => x.OrganizationId));
        BigInt(b.Property(x => x.RentalApplicationId));
        BigInt(b.Property(x => x.PropertyId));
        b.Property(x => x.UnitId).HasColumnType("bigint");
        b.Property(x => x.ListingId).HasColumnType("bigint");
        b.Property(x => x.ApplicantAccessTokenHash).HasColumnType("char(64)").HasMaxLength(64).IsUnicode(false);
        Timestamp(b.Property(x => x.ApplicantAccessExpiresAt));
        b.Property(x => x.InvitationIdempotencyKeyHash).HasColumnType("char(64)").HasMaxLength(64).IsUnicode(false).IsRequired();
        EnumText(b.Property(x => x.Status), 32);
        BigInt(b.Property(x => x.CurrentRevision));
        b.Property(x => x.CurrentRevision).IsConcurrencyToken();
        Text(b.Property(x => x.PackageCode), 100, required: true);
        b.Property(x => x.JurisdictionCode).HasColumnType("char(2)").HasMaxLength(2).IsUnicode(false).IsRequired();
        EnumText(b.Property(x => x.Payer), 32);
        Text(b.Property(x => x.QuoteReference), 200, required: true);
        BigInt(b.Property(x => x.LandlordAmountMinor));
        BigInt(b.Property(x => x.ApplicantAmountMinor));
        BigInt(b.Property(x => x.ProviderAmountMinor));
        BigInt(b.Property(x => x.PlatformFeeMinor));
        BigInt(b.Property(x => x.TaxAmountMinor));
        BigInt(b.Property(x => x.TotalAmountMinor));
        b.Property(x => x.Currency).HasColumnType("char(3)").HasMaxLength(3).IsUnicode(false).IsRequired();
        Timestamp(b.Property(x => x.QuoteExpiresAt));
        Text(b.Property(x => x.QuotePolicyVersion), 100, required: true);
        Text(b.Property(x => x.ProviderKey), 100, required: true);
        Text(b.Property(x => x.ProviderOrderId), 200);
        BigInt(b.Property(x => x.RequesterUserId));
        BigInt(b.Property(x => x.RequesterMemberId));
        Text(b.Property(x => x.RequesterMemberRole), 100, required: true);
        Text(b.Property(x => x.RequesterPermissionSnapshot), 200, required: true);
        Timestamp(b.Property(x => x.RequesterAuthorityVerifiedAt));
        Text(b.Property(x => x.PermissiblePurposeStatement), 2000, required: true);
        Text(b.Property(x => x.PermissiblePurposeVersion), 100, required: true);
        Text(b.Property(x => x.DisclosureStatement), 4000, required: true);
        Text(b.Property(x => x.DisclosureVersion), 100, required: true);
        Text(b.Property(x => x.AuthorizationStatement), 4000, required: true);
        Text(b.Property(x => x.AuthorizationVersion), 100, required: true);
        Text(b.Property(x => x.RentalCriteriaStatement), 4000, required: true);
        Text(b.Property(x => x.RentalCriteriaVersion), 100, required: true);
        Text(b.Property(x => x.PricingPolicyVersion), 100, required: true);
        Text(b.Property(x => x.AllowedChecksJson), 2000, required: true);
        b.Property(x => x.MaximumApplicantTotalMinor).HasColumnType("bigint");
        b.Property(x => x.ApplicantTotalExpresslyUnrestricted).HasColumnType("bit").IsRequired();
        BigInt(b.Property(x => x.MaximumPlatformFeeMinor));
        b.Property(x => x.MarkupPermitted).HasColumnType("bit").IsRequired();
        BigInt(b.Property(x => x.MinimumQuoteLifetimeSeconds));
        BigInt(b.Property(x => x.MaximumQuoteLifetimeSeconds));
        Timestamp(b.Property(x => x.CreatedAt));
        Timestamp(b.Property(x => x.UpdatedAt));
        Timestamp(b.Property(x => x.CompletedAt));
        Timestamp(b.Property(x => x.ExpiredAt));
        b.Property(x => x.RowVersion).HasColumnType("rowversion").IsRowVersion();

        b.HasIndex(x => new { x.ProviderKey, x.ProviderOrderId }).IsUnique()
            .HasFilter("[ProviderOrderId] IS NOT NULL");
        b.HasIndex(x => new { x.OrganizationId, x.InvitationIdempotencyKeyHash }).IsUnique();
        b.HasIndex(x => new { x.OrganizationId, x.Status, x.CreatedAt });
        b.HasIndex(x => new { x.OrganizationId, x.RentalApplicationId });
        b.HasIndex(x => x.RentalApplicationId);
        b.HasIndex(x => new { x.OrganizationId, x.ExpiredAt });
        b.HasIndex(x => new { x.OrganizationId, x.CompletedAt });

        b.HasOne<Organization>().WithMany().HasForeignKey(x => x.OrganizationId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<RentalApplication>().WithMany().HasForeignKey(x => x.RentalApplicationId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<Property>().WithMany().HasForeignKey(x => x.PropertyId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<User>().WithMany().HasForeignKey(x => x.RequesterUserId).OnDelete(DeleteBehavior.Restrict);
    }

    private static void BigInt(PropertyBuilder<long> property) => property.HasColumnType("bigint").IsRequired();
    private static void Timestamp(PropertyBuilder<DateTimeOffset> property) => property.HasColumnType("datetimeoffset(7)").IsRequired();
    private static void Timestamp(PropertyBuilder<DateTimeOffset?> property) => property.HasColumnType("datetimeoffset(7)");
    private static void Text(PropertyBuilder<string> property, int length, bool required = false)
    {
        property.HasColumnType($"nvarchar({length})").HasMaxLength(length);
        if (required) property.IsRequired();
    }
    private static void EnumText<T>(PropertyBuilder<T> property, int length) where T : struct, Enum =>
        property.HasConversion<string>().HasColumnType($"nvarchar({length})").HasMaxLength(length).IsRequired();
}

public sealed class ScreeningTransitionEventConfig : IEntityTypeConfiguration<ScreeningTransitionEvent>
{
    public void Configure(EntityTypeBuilder<ScreeningTransitionEvent> b)
    {
        b.ToTable("ScreeningTransitionEvents", "screening", table =>
            table.HasCheckConstraint("CK_ScreeningTransitionEvents_Revision", "[Revision] > 0"));
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasColumnType("bigint");
        b.Property(x => x.TenantScreeningOrderId).HasColumnType("bigint").IsRequired();
        b.Property(x => x.OrganizationId).HasColumnType("bigint").IsRequired();
        b.Property(x => x.FromStatus).HasConversion<string>().HasColumnType("nvarchar(32)").HasMaxLength(32);
        b.Property(x => x.ToStatus).HasConversion<string>().HasColumnType("nvarchar(32)").HasMaxLength(32).IsRequired();
        b.Property(x => x.Revision).HasColumnType("bigint").IsRequired();
        b.Property(x => x.OccurredAt).HasColumnType("datetimeoffset(7)").IsRequired();
        b.Property(x => x.RecordedAt).HasColumnType("datetimeoffset(7)").IsRequired();
        b.Property(x => x.Source).HasConversion<string>().HasColumnType("nvarchar(32)").HasMaxLength(32).IsRequired();
        b.Property(x => x.ReasonCode).HasColumnType("nvarchar(200)").HasMaxLength(200);
        b.Property(x => x.ProviderEventId).HasColumnType("nvarchar(200)").HasMaxLength(200);
        b.Property(x => x.ProviderKey).HasColumnType("nvarchar(100)").HasMaxLength(100).IsRequired();
        b.Property(x => x.ActorUserId).HasColumnType("bigint");
        b.HasIndex(x => new { x.TenantScreeningOrderId, x.Revision }).IsUnique();
        b.HasIndex(x => new { x.ProviderKey, x.ProviderEventId }).IsUnique().HasFilter("[ProviderEventId] IS NOT NULL");
        b.HasIndex(x => new { x.OrganizationId, x.RecordedAt });
        b.HasOne<TenantScreeningOrder>().WithMany().HasForeignKey(x => x.TenantScreeningOrderId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<Organization>().WithMany().HasForeignKey(x => x.OrganizationId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<User>().WithMany().HasForeignKey(x => x.ActorUserId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class ScreeningConsentEvidenceConfig : IEntityTypeConfiguration<ScreeningConsentEvidence>
{
    public void Configure(EntityTypeBuilder<ScreeningConsentEvidence> b)
    {
        b.ToTable("ScreeningConsentEvidence", "screening");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasColumnType("bigint");
        b.Property(x => x.TenantScreeningOrderId).HasColumnType("bigint").IsRequired();
        b.Property(x => x.OrganizationId).HasColumnType("bigint").IsRequired();
        RequiredText(b.Property(x => x.DisclosureVersion), 100);
        RequiredText(b.Property(x => x.AuthorizationVersion), 100);
        b.Property(x => x.ConsentedAt).HasColumnType("datetimeoffset(7)").IsRequired();
        b.Property(x => x.ActorType).HasConversion<string>().HasColumnType("nvarchar(32)").HasMaxLength(32).IsRequired();
        b.Property(x => x.IpAddressHash).HasColumnType("char(64)").HasMaxLength(64).IsUnicode(false).IsRequired();
        b.Property(x => x.UserAgentHash).HasColumnType("char(64)").HasMaxLength(64).IsUnicode(false).IsRequired();
        b.Property(x => x.QuoteReferenceHash).HasColumnType("char(64)").HasMaxLength(64).IsUnicode(false).IsRequired();
        b.Property(x => x.ProviderAuthorizationReference).HasColumnType("nvarchar(200)").HasMaxLength(200);
        b.HasIndex(x => x.TenantScreeningOrderId).IsUnique();
        b.HasIndex(x => new { x.OrganizationId, x.ConsentedAt });
        b.HasOne<TenantScreeningOrder>().WithMany().HasForeignKey(x => x.TenantScreeningOrderId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<Organization>().WithMany().HasForeignKey(x => x.OrganizationId).OnDelete(DeleteBehavior.Restrict);
    }

    private static void RequiredText(PropertyBuilder<string> property, int length) =>
        property.HasColumnType($"nvarchar({length})").HasMaxLength(length).IsRequired();
}

public sealed class ScreeningPaymentEvidenceConfig : IEntityTypeConfiguration<ScreeningPaymentEvidence>
{
    public void Configure(EntityTypeBuilder<ScreeningPaymentEvidence> b)
    {
        b.ToTable("ScreeningPaymentEvidence", "screening", table =>
        {
            table.HasCheckConstraint("CK_ScreeningPaymentEvidence_Revision", "[Revision] > 0");
            table.HasCheckConstraint("CK_ScreeningPaymentEvidence_Amounts", "[LandlordAmountMinor] >= 0 AND [ApplicantAmountMinor] >= 0 AND [ProviderAmountMinor] >= 0 AND [PlatformFeeMinor] >= 0 AND [TaxAmountMinor] >= 0 AND [TotalAmountMinor] = [LandlordAmountMinor] + [ApplicantAmountMinor] AND [TotalAmountMinor] = [ProviderAmountMinor] + [PlatformFeeMinor] + [TaxAmountMinor]");
        });
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasColumnType("bigint");
        b.Property(x => x.TenantScreeningOrderId).HasColumnType("bigint").IsRequired();
        b.Property(x => x.OrganizationId).HasColumnType("bigint").IsRequired();
        b.Property(x => x.Payer).HasConversion<string>().HasColumnType("nvarchar(32)").HasMaxLength(32).IsRequired();
        foreach (var amount in new[] { b.Property(x => x.LandlordAmountMinor), b.Property(x => x.ApplicantAmountMinor),
            b.Property(x => x.ProviderAmountMinor), b.Property(x => x.PlatformFeeMinor), b.Property(x => x.TaxAmountMinor),
            b.Property(x => x.TotalAmountMinor), b.Property(x => x.Revision) }) amount.HasColumnType("bigint").IsRequired();
        b.Property(x => x.Currency).HasColumnType("char(3)").HasMaxLength(3).IsUnicode(false).IsRequired();
        b.Property(x => x.QuoteReferenceHash).HasColumnType("char(64)").HasMaxLength(64).IsUnicode(false).IsRequired();
        b.Property(x => x.PaymentOperationReferenceHash).HasColumnType("char(64)").HasMaxLength(64).IsUnicode(false).IsRequired();
        b.Property(x => x.Status).HasConversion<string>().HasColumnType("nvarchar(32)").HasMaxLength(32).IsRequired();
        b.Property(x => x.Source).HasConversion<string>().HasColumnType("nvarchar(40)").HasMaxLength(40).IsRequired();
        b.Property(x => x.ActorUserId).HasColumnType("bigint");
        b.Property(x => x.ProviderOccurredAt).HasColumnType("datetimeoffset(7)").IsRequired();
        b.Property(x => x.RecordedAt).HasColumnType("datetimeoffset(7)").IsRequired();
        b.Property(x => x.FailureCode).HasColumnType("nvarchar(100)").HasMaxLength(100);
        b.HasIndex(x => new { x.TenantScreeningOrderId, x.Revision }).IsUnique();
        b.HasIndex(x => new { x.TenantScreeningOrderId, x.PaymentOperationReferenceHash, x.Status }).IsUnique();
        b.HasIndex(x => new { x.OrganizationId, x.RecordedAt });
        b.HasOne<TenantScreeningOrder>().WithMany().HasForeignKey(x => x.TenantScreeningOrderId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<Organization>().WithMany().HasForeignKey(x => x.OrganizationId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<User>().WithMany().HasForeignKey(x => x.ActorUserId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class ScreeningWebhookInboxEventConfig : IEntityTypeConfiguration<ScreeningWebhookInboxEvent>
{
    public void Configure(EntityTypeBuilder<ScreeningWebhookInboxEvent> b)
    {
        b.ToTable("ScreeningWebhookInboxEvents", "screening", table =>
        {
            table.HasCheckConstraint("CK_ScreeningWebhookInboxEvents_Attempts", "[ProcessingAttempts] >= 0");
            table.HasCheckConstraint("CK_ScreeningWebhookInboxEvents_Duplicates", "[DuplicateCount] >= 0");
        });
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasColumnType("bigint");
        RequiredText(b.Property(x => x.ProviderKey), 100);
        RequiredText(b.Property(x => x.ProviderEventId), 200);
        b.Property(x => x.PayloadSha256Hash).HasColumnType("char(64)").HasMaxLength(64).IsUnicode(false).IsRequired();
        b.Property(x => x.ReceivedAt).HasColumnType("datetimeoffset(7)").IsRequired();
        b.Property(x => x.OccurredAt).HasColumnType("datetimeoffset(7)").IsRequired();
        b.Property(x => x.SignedAt).HasColumnType("datetimeoffset(7)").IsRequired();
        RequiredText(b.Property(x => x.AuthenticationScheme), 50);
        RequiredText(b.Property(x => x.AuthenticationKeyVersion), 100);
        b.Property(x => x.ProviderSequence).HasColumnType("bigint");
        RequiredText(b.Property(x => x.ProviderOrderId), 200);
        b.Property(x => x.CanonicalStatus).HasConversion<string>().HasColumnType("nvarchar(32)").HasMaxLength(32).IsRequired();
        b.Property(x => x.NormalizedReasonCode).HasColumnType("nvarchar(200)").HasMaxLength(200);
        b.Property(x => x.PaymentQuoteReferenceHash).HasColumnType("char(64)").HasMaxLength(64).IsUnicode(false);
        b.Property(x => x.PaymentOperationReferenceHash).HasColumnType("char(64)").HasMaxLength(64).IsUnicode(false);
        b.Property(x => x.PaymentPayer).HasConversion<string>().HasColumnType("nvarchar(32)").HasMaxLength(32);
        foreach (var amount in new[] { b.Property(x => x.PaymentLandlordAmountMinor), b.Property(x => x.PaymentApplicantAmountMinor),
            b.Property(x => x.PaymentProviderAmountMinor), b.Property(x => x.PaymentPlatformFeeMinor),
            b.Property(x => x.PaymentTaxAmountMinor), b.Property(x => x.PaymentTotalAmountMinor) })
            amount.HasColumnType("bigint");
        b.Property(x => x.PaymentCurrency).HasColumnType("char(3)").HasMaxLength(3).IsUnicode(false);
        b.Property(x => x.PaymentStatus).HasConversion<string>().HasColumnType("nvarchar(32)").HasMaxLength(32);
        b.Property(x => x.PaymentOccurredAt).HasColumnType("datetimeoffset(7)");
        b.Property(x => x.PaymentFailureCode).HasColumnType("nvarchar(100)").HasMaxLength(100);
        b.Property(x => x.ProcessedAt).HasColumnType("datetimeoffset(7)");
        b.Property(x => x.ProcessingLeaseId).HasColumnType("uniqueidentifier");
        b.Property(x => x.ProcessingLeaseUntil).HasColumnType("datetimeoffset(7)");
        b.Property(x => x.ProcessingStatus).HasConversion<string>().HasColumnType("nvarchar(32)").HasMaxLength(32).IsRequired();
        b.Property(x => x.ProcessingAttempts).HasColumnType("int").IsRequired();
        b.Property(x => x.NextAttemptAt).HasColumnType("datetimeoffset(7)");
        b.Property(x => x.FailureCode).HasColumnType("nvarchar(100)").HasMaxLength(100);
        b.Property(x => x.FailureDetail).HasColumnType("nvarchar(500)").HasMaxLength(500);
        b.Property(x => x.DuplicateCount).HasColumnType("int").IsRequired();
        b.Property(x => x.LastDuplicateReceivedAt).HasColumnType("datetimeoffset(7)");
        b.Property(x => x.SecurityIncidentCode).HasColumnType("nvarchar(100)").HasMaxLength(100);
        b.Property(x => x.SecurityIncidentCount).HasColumnType("int").IsRequired();
        b.Property(x => x.LastSecurityIncidentAt).HasColumnType("datetimeoffset(7)");
        b.Property(x => x.TenantScreeningOrderId).HasColumnType("bigint");
        b.Property(x => x.RowVersion).HasColumnType("rowversion").IsRowVersion();
        b.HasIndex(x => new { x.ProviderKey, x.ProviderEventId }).IsUnique();
        b.HasIndex(x => new { x.ProcessingStatus, x.NextAttemptAt, x.ProcessingLeaseUntil });
        b.HasIndex(x => x.ProcessedAt);
        b.HasIndex(x => x.TenantScreeningOrderId);
        b.HasOne<TenantScreeningOrder>().WithMany().HasForeignKey(x => x.TenantScreeningOrderId).OnDelete(DeleteBehavior.Restrict);
    }

    private static void RequiredText(PropertyBuilder<string> property, int length) =>
        property.HasColumnType($"nvarchar({length})").HasMaxLength(length).IsRequired();
}

public sealed class ScreeningReportAccessAuditConfig : IEntityTypeConfiguration<ScreeningReportAccessAudit>
{
    public void Configure(EntityTypeBuilder<ScreeningReportAccessAudit> b)
    {
        b.ToTable("ScreeningReportAccessAudits", "screening", table =>
        {
            table.HasCheckConstraint("CK_ScreeningReportAccessAudits_Sequence", "[AttemptSequence] > 0");
            table.HasCheckConstraint("CK_ScreeningReportAccessAudits_Grant", "([Status] = 'Granted' AND [GrantReference] IS NOT NULL AND [GrantExpiresAt] IS NOT NULL) OR ([Status] <> 'Granted' AND [GrantReference] IS NULL AND [GrantExpiresAt] IS NULL)");
        });
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasColumnType("bigint");
        b.Property(x => x.TenantScreeningOrderId).HasColumnType("bigint").IsRequired();
        b.Property(x => x.OrganizationId).HasColumnType("bigint").IsRequired();
        b.Property(x => x.ActorUserId).HasColumnType("bigint");
        b.Property(x => x.ScreeningReportRevisionId).HasColumnType("bigint").IsRequired();
        b.Property(x => x.AttemptSequence).HasColumnType("bigint").IsRequired();
        b.Property(x => x.Purpose).HasConversion<string>().HasColumnType("nvarchar(32)").HasMaxLength(32).IsRequired();
        b.Property(x => x.Status).HasConversion<string>().HasColumnType("nvarchar(32)").HasMaxLength(32).IsRequired().IsConcurrencyToken();
        b.Property(x => x.RequestedAt).HasColumnType("datetimeoffset(7)").IsRequired();
        b.Property(x => x.CompletedAt).HasColumnType("datetimeoffset(7)");
        b.Property(x => x.ScreeningSupportElevationId).HasColumnType("bigint");
        b.Property(x => x.GrantExpiresAt).HasColumnType("datetimeoffset(7)");
        b.Property(x => x.GrantReference).HasColumnType("nvarchar(200)").HasMaxLength(200);
        b.Property(x => x.FailureCode).HasColumnType("nvarchar(100)").HasMaxLength(100);
        b.HasIndex(x => new { x.TenantScreeningOrderId, x.AttemptSequence }).IsUnique();
        b.HasIndex(x => new { x.OrganizationId, x.RequestedAt });
        b.HasIndex(x => new { x.Status, x.RequestedAt });
        b.HasOne<TenantScreeningOrder>().WithMany().HasForeignKey(x => x.TenantScreeningOrderId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<ScreeningReportRevision>().WithMany().HasForeignKey(x => x.ScreeningReportRevisionId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<ScreeningSupportElevation>().WithMany().HasForeignKey(x => x.ScreeningSupportElevationId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<Organization>().WithMany().HasForeignKey(x => x.OrganizationId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<User>().WithMany().HasForeignKey(x => x.ActorUserId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class ScreeningSupportElevationConfig : IEntityTypeConfiguration<ScreeningSupportElevation>
{
    public void Configure(EntityTypeBuilder<ScreeningSupportElevation> b)
    {
        b.ToTable("ScreeningSupportElevations", "screening", table =>
        {
            table.HasCheckConstraint("CK_ScreeningSupportElevations_Approver", "[ApprovedByUserId] <> [SubjectUserId]");
            table.HasCheckConstraint("CK_ScreeningSupportElevations_Count", "[MaximumAccessCount] > 0 AND [AccessCount] >= 0 AND [AccessCount] <= [MaximumAccessCount]");
            table.HasCheckConstraint("CK_ScreeningSupportElevations_Lifetime", "[ExpiresAt] > [IssuedAt]");
        });
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasColumnType("bigint");
        b.Property(x => x.OrganizationId).HasColumnType("bigint").IsRequired();
        b.Property(x => x.SubjectUserId).HasColumnType("bigint").IsRequired();
        b.Property(x => x.ApprovedByUserId).HasColumnType("bigint").IsRequired();
        b.Property(x => x.CaseReference).HasColumnType("nvarchar(200)").HasMaxLength(200).IsRequired();
        b.Property(x => x.Reason).HasColumnType("nvarchar(500)").HasMaxLength(500).IsRequired();
        b.Property(x => x.Purpose).HasConversion<string>().HasColumnType("nvarchar(32)").HasMaxLength(32).IsRequired();
        b.Property(x => x.IssuedAt).HasColumnType("datetimeoffset(7)").IsRequired();
        b.Property(x => x.ExpiresAt).HasColumnType("datetimeoffset(7)").IsRequired();
        b.Property(x => x.RevokedAt).HasColumnType("datetimeoffset(7)");
        b.Property(x => x.RevokedByUserId).HasColumnType("bigint");
        b.Property(x => x.MaximumAccessCount).HasColumnType("int").IsRequired();
        b.Property(x => x.AccessCount).HasColumnType("int").IsRequired();
        b.Property(x => x.RowVersion).HasColumnType("rowversion").IsRowVersion();
        b.HasIndex(x => new { x.OrganizationId, x.SubjectUserId, x.Purpose, x.ExpiresAt, x.RevokedAt });
        b.HasOne<Organization>().WithMany().HasForeignKey(x => x.OrganizationId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<User>().WithMany().HasForeignKey(x => x.SubjectUserId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<User>().WithMany().HasForeignKey(x => x.ApprovedByUserId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<User>().WithMany().HasForeignKey(x => x.RevokedByUserId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class ScreeningAdverseActionConfig : IEntityTypeConfiguration<ScreeningAdverseAction>
{
    public void Configure(EntityTypeBuilder<ScreeningAdverseAction> b)
    {
        b.ToTable("ScreeningAdverseActions", "screening", table =>
            table.HasCheckConstraint("CK_ScreeningAdverseActions_ReasonCodesJson", "ISJSON([ReasonCodesJson]) = 1"));
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasColumnType("bigint");
        b.Property(x => x.TenantScreeningOrderId).HasColumnType("bigint").IsRequired();
        b.Property(x => x.OrganizationId).HasColumnType("bigint").IsRequired();
        b.Property(x => x.RentalApplicationId).HasColumnType("bigint").IsRequired();
        b.Property(x => x.DecisionActorUserId).HasColumnType("bigint").IsRequired();
        b.Property(x => x.OriginalScreeningRentalDecisionRevisionId).HasColumnType("bigint").IsRequired();
        b.Property(x => x.OriginalScreeningReportRevisionId).HasColumnType("bigint");
        EnumText(b.Property(x => x.ActionType));
        RequiredText(b.Property(x => x.ReasonCodesJson), 2000);
        RequiredText(b.Property(x => x.RentalCriteriaVersion), 100);
        RequiredText(b.Property(x => x.CraContactName), 200);
        RequiredText(b.Property(x => x.CraContactAddress), 500);
        RequiredText(b.Property(x => x.CraContactPhone), 50);
        RequiredText(b.Property(x => x.NoticeVersion), 100);
        b.Property(x => x.ImmutableNoticeContent).HasColumnType("nvarchar(max)").HasMaxLength(10000).IsRequired();
        RequiredHash(b.Property(x => x.NoticeContentSha256Hash));
        RequiredText(b.Property(x => x.StatutoryDisclosureVersion), 100);
        RequiredHash(b.Property(x => x.StatutoryDisclosureSha256Hash));
        RequiredText(b.Property(x => x.StateLocalDisclosureVersion), 100);
        RequiredHash(b.Property(x => x.StateLocalDisclosureSha256Hash));
        RequiredText(b.Property(x => x.JurisdictionCode), 10);
        b.Property(x => x.CreatedAt).HasColumnType("datetimeoffset(7)").IsRequired();
        b.Property(x => x.ReconsiderationLinkReference).HasColumnType("nvarchar(200)").HasMaxLength(200);
        b.HasIndex(x => new { x.OrganizationId, x.CreatedAt });
        b.HasIndex(x => new { x.OrganizationId, x.RentalApplicationId, x.CreatedAt });
        b.HasIndex(x => x.TenantScreeningOrderId);
        b.HasIndex(x => x.OriginalScreeningRentalDecisionRevisionId);
        b.HasIndex(x => new { x.OrganizationId, x.OriginalScreeningRentalDecisionRevisionId, x.ActionType }).IsUnique();
        b.HasOne<TenantScreeningOrder>().WithMany().HasForeignKey(x => x.TenantScreeningOrderId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<Organization>().WithMany().HasForeignKey(x => x.OrganizationId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<RentalApplication>().WithMany().HasForeignKey(x => x.RentalApplicationId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<User>().WithMany().HasForeignKey(x => x.DecisionActorUserId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<ScreeningRentalDecisionRevision>().WithMany().HasForeignKey(x => x.OriginalScreeningRentalDecisionRevisionId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<ScreeningReportRevision>().WithMany().HasForeignKey(x => x.OriginalScreeningReportRevisionId).OnDelete(DeleteBehavior.Restrict);
    }

    private static void RequiredText(PropertyBuilder<string> property, int length) =>
        property.HasColumnType($"nvarchar({length})").HasMaxLength(length).IsRequired();
    private static void RequiredHash(PropertyBuilder<string> property) =>
        property.HasColumnType("char(64)").HasMaxLength(64).IsUnicode(false).IsRequired();
    private static void EnumText<T>(PropertyBuilder<T> property) where T : struct, Enum =>
        property.HasConversion<string>().HasColumnType("nvarchar(32)").HasMaxLength(32).IsRequired();
}

public sealed class ScreeningCancellationIntentConfig : IEntityTypeConfiguration<ScreeningCancellationIntent>
{
    public void Configure(EntityTypeBuilder<ScreeningCancellationIntent> b)
    {
        b.ToTable("ScreeningCancellationIntents", "screening", table =>
            table.HasCheckConstraint("CK_ScreeningCancellationIntents_Attempts", "[Attempts] >= 0"));
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasColumnType("bigint");
        b.Property(x => x.OperationId).HasColumnType("uniqueidentifier").IsRequired();
        b.Property(x => x.TenantScreeningOrderId).HasColumnType("bigint").IsRequired();
        b.Property(x => x.OrganizationId).HasColumnType("bigint").IsRequired();
        b.Property(x => x.RentalApplicationId).HasColumnType("bigint").IsRequired();
        b.Property(x => x.ActorUserId).HasColumnType("bigint").IsRequired();
        b.Property(x => x.ExpectedOrderRevision).HasColumnType("bigint").IsRequired();
        b.Property(x => x.ProviderKey).HasColumnType("nvarchar(100)").HasMaxLength(100).IsRequired();
        b.Property(x => x.ProviderOrderId).HasColumnType("nvarchar(200)").HasMaxLength(200);
        b.Property(x => x.ReasonCode).HasColumnType("nvarchar(100)").HasMaxLength(100).IsRequired();
        b.Property(x => x.Status).HasConversion<string>().HasColumnType("nvarchar(40)").HasMaxLength(40).IsRequired();
        b.Property(x => x.Attempts).HasColumnType("int").IsRequired();
        b.Property(x => x.ProcessingLeaseId).HasColumnType("uniqueidentifier");
        b.Property(x => x.ProcessingLeaseUntil).HasColumnType("datetimeoffset(7)");
        b.Property(x => x.NextAttemptAt).HasColumnType("datetimeoffset(7)");
        b.Property(x => x.CreatedAt).HasColumnType("datetimeoffset(7)").IsRequired();
        b.Property(x => x.ProviderAcceptedAt).HasColumnType("datetimeoffset(7)");
        b.Property(x => x.CompletedAt).HasColumnType("datetimeoffset(7)");
        b.Property(x => x.ProviderReference).HasColumnType("nvarchar(200)").HasMaxLength(200);
        b.Property(x => x.FailureCode).HasColumnType("nvarchar(100)").HasMaxLength(100);
        b.Property(x => x.RowVersion).HasColumnType("rowversion").IsRowVersion();
        b.HasIndex(x => x.OperationId).IsUnique();
        b.HasIndex(x => x.TenantScreeningOrderId).IsUnique();
        b.HasIndex(x => new { x.Status, x.NextAttemptAt, x.ProcessingLeaseUntil, x.CreatedAt });
        b.HasOne<TenantScreeningOrder>().WithMany().HasForeignKey(x => x.TenantScreeningOrderId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<Organization>().WithMany().HasForeignKey(x => x.OrganizationId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<RentalApplication>().WithMany().HasForeignKey(x => x.RentalApplicationId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<User>().WithMany().HasForeignKey(x => x.ActorUserId).OnDelete(DeleteBehavior.Restrict);
    }
}
