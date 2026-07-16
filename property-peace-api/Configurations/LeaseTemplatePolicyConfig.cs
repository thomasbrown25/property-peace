using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class LeaseTemplatePolicyConfig : IEntityTypeConfiguration<LeaseTemplatePolicy>
    {
        public void Configure(EntityTypeBuilder<LeaseTemplatePolicy> b)
        {
            b.ToTable("LeaseTemplatePolicies", "lease_builder");
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

            // Relationship
            b.HasOne(p => p.LeaseTemplate)
                .WithMany(t => t.Policies)
                .HasForeignKey(p => p.LeaseTemplateId)
                .OnDelete(DeleteBehavior.Cascade);

            // Index
            b.HasIndex(p => new { p.LeaseTemplateId, p.Order });
        }
    }
}
