using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations;

public sealed class ShortStayCollectionApplicationConfig : IEntityTypeConfiguration<ShortStayCollectionApplication>
{
    public void Configure(EntityTypeBuilder<ShortStayCollectionApplication> b)
    {
        b.ToTable("ShortStayCollectionApplications", "financial", t =>
            t.HasCheckConstraint("CK_ShortStayCollectionApplications_Status",
                "[Status] IN ('Draft', 'Submitted', 'IdentityPending', 'IdentityVerified', 'UnderReview', 'PayoutApproved', 'Suspended', 'Rejected')"));
        b.HasKey(x => x.Id);
        b.HasOne(x => x.Organization).WithMany().HasForeignKey(x => x.OrganizationId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.ApplicantUser).WithMany().HasForeignKey(x => x.ApplicantUserId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<User>().WithMany().HasForeignKey(x => x.ApprovedByUserId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<User>().WithMany().HasForeignKey(x => x.SuspendedByUserId).OnDelete(DeleteBehavior.Restrict);
        // Rejected applications are retained as history, while a new attempt can be made.
        b.HasIndex(x => new { x.OrganizationId, x.ApplicantUserId }).IsUnique()
            .HasFilter("[Status] <> 'Rejected'");
        b.HasIndex(x => x.IdentityVerificationSessionId).IsUnique()
            .HasFilter("[IdentityVerificationSessionId] IS NOT NULL");
        b.Property(x => x.StripeAccountId).HasMaxLength(255).IsRequired();
        b.Property(x => x.Status).HasConversion<string>().HasMaxLength(32)
            .HasDefaultValue(ShortStayCollectionApplicationStatus.Draft).IsRequired();
        b.Property(x => x.IdentityVerificationSessionId).HasMaxLength(255);
        b.Property(x => x.ApprovalCaseReference).HasMaxLength(128);
        b.Property(x => x.FeePolicyConsentVersion).HasMaxLength(64);
        b.Property(x => x.RowVersion).HasDefaultValue(1L).IsConcurrencyToken();
    }
}

public sealed class ShortStayCollectionApplicationPropertyConfig : IEntityTypeConfiguration<ShortStayCollectionApplicationProperty>
{
    public void Configure(EntityTypeBuilder<ShortStayCollectionApplicationProperty> b)
    {
        b.ToTable("ShortStayCollectionApplicationProperties", "financial");
        b.HasKey(x => new { x.ShortStayCollectionApplicationId, x.PropertyId });
        b.HasOne(x => x.Application).WithMany(x => x.Properties)
            .HasForeignKey(x => x.ShortStayCollectionApplicationId).OnDelete(DeleteBehavior.Cascade);
        // Property.OrganizationId is nullable for legacy inventory; a composite principal key
        // would break tracking of those properties. Submission must validate every selected
        // property's organization against Application.OrganizationId before persisting.
        b.HasOne(x => x.Property).WithMany().HasForeignKey(x => x.PropertyId).OnDelete(DeleteBehavior.Restrict);
        b.HasIndex(x => x.PropertyId);
    }
}
