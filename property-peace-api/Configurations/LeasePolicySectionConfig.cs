using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class LeasePolicySectionConfig : IEntityTypeConfiguration<LeasePolicySection>
    {
        public void Configure(EntityTypeBuilder<LeasePolicySection> b)
        {
            b.ToTable("LeasePolicySections", "lease_builder");
            b.HasKey(p => p.Id);

            b.Property(p => p.OriginalPolicies)
                .HasColumnType("nvarchar(max)");

            b.Property(p => p.AiFormattedPolicies)
                .HasColumnType("nvarchar(max)");

            b.Property(p => p.AiFormattedMarkdown)
                .HasColumnType("nvarchar(max)");

            b.Property(p => p.Tone)
                .IsRequired()
                .HasMaxLength(20)
                .HasDefaultValue("Neutral");

            // Relationships
            b.HasOne(p => p.LeaseInstance)
                .WithOne(i => i.PolicySection)
                .HasForeignKey<LeasePolicySection>(p => p.LeaseInstanceId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(p => p.AiModifiedByUser)
                .WithMany()
                .HasForeignKey(p => p.AiModifiedBy)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.SetNull);

            // Index
            b.HasIndex(p => p.LeaseInstanceId)
                .IsUnique();
        }
    }
}
