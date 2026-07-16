using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using brownstone_hub_api.Models;

namespace brownstone_hub_api.Configurations
{
    public class OrganizationReportSpaceItemConfig : IEntityTypeConfiguration<OrganizationReportSpaceItem>
    {
        public void Configure(EntityTypeBuilder<OrganizationReportSpaceItem> builder)
        {
            builder.ToTable("OrganizationReportSpaceItems", "checklist");
            builder.HasKey(i => i.Id);

            builder.Property(i => i.ItemName)
                .IsRequired()
                .HasMaxLength(200);

            builder.HasOne(i => i.Space)
                .WithMany(s => s.Items)
                .HasForeignKey(i => i.SpaceId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasIndex(i => i.SpaceId);
        }
    }
}
