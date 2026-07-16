using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class LeaseTemplateDefaultPolicyConfig : IEntityTypeConfiguration<LeaseTemplateDefaultPolicy>
    {
        public void Configure(EntityTypeBuilder<LeaseTemplateDefaultPolicy> b)
        {
            b.ToTable("LeaseTemplateDefaultPolicies", "lease_builder");
            
            b.HasKey(p => p.Id);

            b.Property(p => p.Title)
                .IsRequired()
                .HasMaxLength(200);

            b.Property(p => p.Content)
                .IsRequired()
                .HasColumnType("nvarchar(max)");

            b.Property(p => p.Category)
                .IsRequired()
                .HasMaxLength(50);

            b.Property(p => p.Order)
                .IsRequired();

            b.Property(p => p.CreatedAt)
                .IsRequired()
                .HasDefaultValueSql("GETDATE()");

            // Index for ordering
            b.HasIndex(p => p.Order);
        }
    }
}
