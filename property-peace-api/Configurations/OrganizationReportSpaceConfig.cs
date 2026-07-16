using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using brownstone_hub_api.Models;

namespace brownstone_hub_api.Configurations
{
    public class OrganizationReportSpaceConfig : IEntityTypeConfiguration<OrganizationReportSpace>
    {
        public void Configure(EntityTypeBuilder<OrganizationReportSpace> builder)
        {
            builder.ToTable("OrganizationReportSpaces", "checklist");
            builder.HasKey(s => s.Id);

            builder.Property(s => s.SpaceLabel)
                .IsRequired()
                .HasMaxLength(100);
            builder.Property(s => s.CustomName)
                .HasMaxLength(200);

            builder.HasOne(s => s.Template)
                .WithMany(t => t.Spaces)
                .HasForeignKey(s => s.TemplateId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasMany(s => s.Items)
                .WithOne(i => i.Space)
                .HasForeignKey(i => i.SpaceId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasIndex(s => s.TemplateId);
        }
    }
}
