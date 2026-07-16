using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using brownstone_hub_api.Models;

namespace brownstone_hub_api.Configurations
{
    public class ChecklistItemConfig : IEntityTypeConfiguration<ChecklistItem>
    {
        public void Configure(EntityTypeBuilder<ChecklistItem> builder)
        {
            builder.ToTable("ChecklistItems", "checklist");
            builder.HasKey(ci => ci.Id);

            builder.Property(ci => ci.Name)
                .IsRequired()
                .HasMaxLength(200);

            builder.Property(ci => ci.Description)
                .HasMaxLength(500);

            builder.Property(ci => ci.Category)
                .HasMaxLength(100);

            builder.Property(ci => ci.Condition)
                .HasMaxLength(50);

            builder.Property(ci => ci.Notes)
                .HasMaxLength(1000);

            builder.Property(ci => ci.DamageDescription)
                .HasMaxLength(1000);

            builder.Property(ci => ci.PhotoBlobName)
                .HasMaxLength(500);

            builder.Property(ci => ci.PhotoBlobUrl)
                .HasMaxLength(1000);

            // Relationships
            builder.HasOne(ci => ci.Checklist)
                .WithMany(c => c.Items)
                .HasForeignKey(ci => ci.ChecklistId)
                .OnDelete(DeleteBehavior.Cascade);

            // Indexes
            builder.HasIndex(ci => ci.ChecklistId);
            builder.HasIndex(ci => new { ci.ChecklistId, ci.SortOrder });
            // Optional: Add these indexes only if you frequently query by these fields
            // Note: More indexes = slower writes, but faster reads
            // Uncomment if needed:
            // builder.HasIndex(ci => new { ci.ChecklistId, ci.IsChecked });
            // builder.HasIndex(ci => new { ci.ChecklistId, ci.Category });
        }
    }
}

