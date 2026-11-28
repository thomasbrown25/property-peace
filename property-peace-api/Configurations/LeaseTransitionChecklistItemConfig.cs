using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class LeaseTransitionChecklistItemConfig : IEntityTypeConfiguration<LeaseTransitionChecklistItem>
    {
        public void Configure(EntityTypeBuilder<LeaseTransitionChecklistItem> builder)
        {
            builder.ToTable("LeaseTransitionChecklistItems", "checklist");
            builder.HasKey(x => x.Id);
            builder.Property(x => x.Key).HasMaxLength(80).IsRequired();
            builder.Property(x => x.Label).HasMaxLength(300).IsRequired();
            builder.Property(x => x.NotApplicableReason).HasMaxLength(1000);
            builder.HasIndex(x => new { x.LeaseTransitionChecklistId, x.Key }).IsUnique();
        }
    }
}
