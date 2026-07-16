using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class LeaseTemplateSectionConfig : IEntityTypeConfiguration<LeaseTemplateSection>
    {
        public void Configure(EntityTypeBuilder<LeaseTemplateSection> b)
        {
            b.ToTable("LeaseTemplateSections", "lease_builder");
            b.HasKey(s => s.Id);

            b.Property(s => s.SectionName)
                .IsRequired()
                .HasMaxLength(100);

            b.Property(s => s.Content)
                .HasColumnType("nvarchar(max)");

            b.Property(s => s.SectionOrder)
                .IsRequired();

            b.Property(s => s.IsEnabled)
                .HasDefaultValue(true);

            // Relationship
            b.HasOne(s => s.LeaseTemplate)
                .WithMany(t => t.Sections)
                .HasForeignKey(s => s.LeaseTemplateId)
                .OnDelete(DeleteBehavior.Cascade);

            // Index
            b.HasIndex(s => new { s.LeaseTemplateId, s.SectionOrder });
        }
    }
}
