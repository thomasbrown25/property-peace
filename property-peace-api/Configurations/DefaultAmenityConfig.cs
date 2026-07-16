using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace brownstone_hub_api.Configurations
{
    public class DefaultAmenityConfig : IEntityTypeConfiguration<DefaultAmenity>
    {
        public void Configure(EntityTypeBuilder<DefaultAmenity> b)
        {
            b.ToTable("DefaultAmenities", "listing");
            b.Property(a => a.Category)
             .HasConversion(new EnumToStringConverter<EAmenityCategory>())
             .HasMaxLength(50)
             .IsRequired();

            b.Property(a => a.Name)
             .HasMaxLength(200)
             .IsRequired();

            b.HasIndex(a => a.Category);
        }
    }
}
