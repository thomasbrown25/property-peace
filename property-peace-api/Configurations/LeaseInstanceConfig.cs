using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class LeaseInstanceConfig : IEntityTypeConfiguration<LeaseInstance>
    {
        public void Configure(EntityTypeBuilder<LeaseInstance> b)
        {
            b.ToTable("LeaseInstances", "lease_builder");
            b.HasKey(i => i.Id);

            b.Property(i => i.TemplateVersion)
                .IsRequired()
                .HasMaxLength(20);

            b.Property(i => i.Warnings)
                .HasColumnType("nvarchar(max)");

            b.Property(i => i.IsDraft)
                .HasDefaultValue(true);

            b.Property(i => i.IsFinalized)
                .HasDefaultValue(false);

            // Relationships
            b.HasOne(i => i.Lease)
                .WithMany()
                .HasForeignKey(i => i.LeaseId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasOne(i => i.LeaseTemplate)
                .WithMany(t => t.LeaseInstances)
                .HasForeignKey(i => i.LeaseTemplateId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasOne(i => i.GeneratedByUser)
                .WithMany()
                .HasForeignKey(i => i.GeneratedBy)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasMany(i => i.Variables)
                .WithOne(v => v.LeaseInstance)
                .HasForeignKey(v => v.LeaseInstanceId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasMany(i => i.Documents)
                .WithOne(d => d.LeaseInstance)
                .HasForeignKey(d => d.LeaseInstanceId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(i => i.PolicySection)
                .WithOne(p => p.LeaseInstance)
                .HasForeignKey<LeasePolicySection>(p => p.LeaseInstanceId)
                .OnDelete(DeleteBehavior.Cascade);

            // Indexes
            b.HasIndex(i => i.LeaseId);
            b.HasIndex(i => i.LeaseTemplateId);
            b.HasIndex(i => new { i.LeaseId, i.IsFinalized });
        }
    }
}
