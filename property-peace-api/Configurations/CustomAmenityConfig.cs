using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace brownstone_hub_api.Configurations
{
    public class CustomAmenityConfig : IEntityTypeConfiguration<CustomAmenity>
    {
        public void Configure(EntityTypeBuilder<CustomAmenity> b)
        {
            b.ToTable("CustomAmenities", "listing");
            b.HasOne(a => a.Organization)
             .WithMany()
             .HasForeignKey(a => a.OrganizationId)
             .OnDelete(DeleteBehavior.NoAction);

            b.HasOne(a => a.CreatedByUser)
             .WithMany()
             .HasForeignKey(a => a.CreatedBy)
             .OnDelete(DeleteBehavior.NoAction);

            b.Property(a => a.Category)
             .HasConversion(new EnumToStringConverter<EAmenityCategory>())
             .HasMaxLength(50)
             .IsRequired();

            b.Property(a => a.Name)
             .HasMaxLength(200)
             .IsRequired();

            b.HasIndex(a => a.OrganizationId);
            b.HasIndex(a => a.Category);
        }
    }
}
