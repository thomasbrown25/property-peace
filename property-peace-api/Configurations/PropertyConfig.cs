using brownstone_hub_api.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace brownstone_hub_api.Configurations
{
    public class PropertyConfig : IEntityTypeConfiguration<Property>
    {
        public void Configure(EntityTypeBuilder<Property> b)
        {
            b.ToTable("Properties", "property");

            b.Property(p => p.TargetRent).HasPrecision(18, 2);
            b.Property(p => p.TargetDeposit).HasPrecision(18, 2);

            b.HasOne(p => p.Landlord)
             .WithMany()
             .HasForeignKey(p => p.LandlordId)
             .OnDelete(DeleteBehavior.NoAction);

            b.HasOne(p => p.Organization)
             .WithMany(o => o.Properties)
             .HasForeignKey(p => p.OrganizationId)
             .OnDelete(DeleteBehavior.SetNull);

            b.HasOne(p => p.PrimaryManager)
             .WithMany()
             .HasForeignKey(p => p.PrimaryManagerId)
             .OnDelete(DeleteBehavior.SetNull);

            b.HasOne(p => p.OperatingAccount)
             .WithMany()
             .HasForeignKey(p => p.OperatingAccountId)
             .OnDelete(DeleteBehavior.SetNull);

            b.HasOne(p => p.Client)
             .WithMany(c => c.Properties)
             .HasForeignKey(p => p.ClientId)
             .OnDelete(DeleteBehavior.SetNull);

            b.HasMany(p => p.Units)
             .WithOne()
             .HasForeignKey(u => u.PropertyId)
             .OnDelete(DeleteBehavior.Cascade);

            b.HasMany(p => p.Images)
             .WithOne(i => i.Property)
             .HasForeignKey(i => i.RefId)
             .OnDelete(DeleteBehavior.Cascade);

            // ✅ Store enum as string (e.g., "SingleFamily", "MultiUnit")
            b.Property(p => p.PropertyType)
                   .HasConversion(new EnumToStringConverter<EPropertyType>())
                   .HasMaxLength(50)
                   .IsRequired();

            b.HasIndex(p => new { p.LandlordId, p.PropertyType });

            // Set default value for IsDeleted
            b.Property(p => p.IsDeleted)
                .HasDefaultValue(false);
        }
    }
}