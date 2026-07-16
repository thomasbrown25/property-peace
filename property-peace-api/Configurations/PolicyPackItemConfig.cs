using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class PolicyPackItemConfig : IEntityTypeConfiguration<PolicyPackItem>
    {
        public void Configure(EntityTypeBuilder<PolicyPackItem> b)
        {
            b.ToTable("PolicyPackItems", "lease_builder");
            b.HasKey(i => i.Id);

            b.Property(i => i.Title)
                .IsRequired()
                .HasMaxLength(200);

            b.Property(i => i.Content)
                .IsRequired()
                .HasColumnType("nvarchar(max)");

            b.Property(i => i.Category)
                .IsRequired()
                .HasMaxLength(50);

            b.Property(i => i.Order)
                .IsRequired();

            // Relationship
            b.HasOne(i => i.PolicyPack)
                .WithMany(p => p.Items)
                .HasForeignKey(i => i.PolicyPackId)
                .OnDelete(DeleteBehavior.Cascade);

            // Index
            b.HasIndex(i => new { i.PolicyPackId, i.Order });
        }
    }
}
