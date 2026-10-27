using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations;

public sealed class ShortStayIcalSubscriptionConfig : IEntityTypeConfiguration<ShortStayIcalSubscription>
{
    public void Configure(EntityTypeBuilder<ShortStayIcalSubscription> b)
    {
        b.ToTable("ShortStayIcalSubscriptions", "listing", t =>
        {
            t.HasCheckConstraint("CK_ShortStayIcalSubscriptions_Generation", "[Generation] >= 1");
            t.HasCheckConstraint("CK_ShortStayIcalSubscriptions_ConsecutiveFailures", "[ConsecutiveFailures] >= 0");
            t.HasCheckConstraint("CK_ShortStayIcalSubscriptions_EncryptedUrl", "[Enabled] = 0 OR [EncryptedUrl] <> ''");
            t.HasCheckConstraint("CK_ShortStayIcalSubscriptions_UrlFingerprint", "[Enabled] = 0 OR [UrlFingerprint] <> ''");
            t.HasCheckConstraint("CK_ShortStayIcalSubscriptions_LeasePair", "([LeaseToken] IS NULL AND [LeaseExpiresAtUtc] IS NULL) OR ([LeaseToken] IS NOT NULL AND [LeaseExpiresAtUtc] IS NOT NULL)");
        });
        b.HasKey(x => x.Id);
        // A unit has one current feed (including disabled feeds retained for recovery).
        b.HasIndex(x => x.UnitId).IsUnique();
        b.HasIndex(x => x.LeaseToken).IsUnique();
        b.HasIndex(x => new { x.Enabled, x.NextAttemptAtUtc, x.LeaseExpiresAtUtc });
        b.HasIndex(x => x.OrgId);
        b.HasOne(x => x.Unit).WithMany().HasForeignKey(x => x.UnitId).IsRequired().OnDelete(DeleteBehavior.NoAction);
        b.HasOne(x => x.Organization).WithMany().HasForeignKey(x => x.OrgId).IsRequired().OnDelete(DeleteBehavior.NoAction);
        b.Property(x => x.EncryptedUrl).HasMaxLength(4096).IsRequired();
        b.Property(x => x.UrlFingerprint).HasMaxLength(64).IsRequired();
        b.Property(x => x.Generation).IsRequired();
        b.Property(x => x.Enabled).IsRequired();
        b.Property(x => x.FailureCode).HasMaxLength(64);
        b.Property(x => x.ConsecutiveFailures).IsRequired();
    }
}
