using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using brownstone_hub_api.Models;

namespace brownstone_hub_api.Configurations
{
    public class OrganizationMoveInReportTemplateConfig : IEntityTypeConfiguration<OrganizationMoveInReportTemplate>
    {
        public void Configure(EntityTypeBuilder<OrganizationMoveInReportTemplate> builder)
        {
            builder.ToTable("OrganizationMoveInReportTemplates", "checklist");
            builder.HasKey(t => t.Id);

            builder.Property(t => t.Name)
                .IsRequired()
                .HasMaxLength(200);

            builder.HasOne(t => t.Organization)
                .WithMany()
                .HasForeignKey(t => t.OrganizationId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasMany(t => t.Spaces)
                .WithOne(s => s.Template)
                .HasForeignKey(s => s.TemplateId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasIndex(t => t.OrganizationId);
        }
    }
}
