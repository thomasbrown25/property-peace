using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Configurations
{
    public class UnitConfig : IEntityTypeConfiguration<Unit>
    {
        public void Configure(EntityTypeBuilder<Unit> b)
        {
            b.ToTable("Units", "property", table =>
                table.HasCheckConstraint("CK_Units_RentalMode", "[RentalMode] IN ('LongTerm', 'ShortTerm')"));
            b.Property(u => u.Name).HasMaxLength(128);
            b.Property(u => u.RentalMode).HasConversion<string>().HasMaxLength(32)
                .HasDefaultValue(ERentalMode.LongTerm).IsRequired();

            // helpful in UIs: unique name per property
            b.HasIndex(u => new { u.PropertyId, u.Name }).IsUnique();

            b.HasIndex(u => u.Type);

            b.HasMany(u => u.Amenities)
             .WithOne()
             .HasForeignKey(a => a.UnitId)
             .OnDelete(DeleteBehavior.Cascade);

            b.HasMany(u => u.IncludedUtility)
             .WithOne()
             .HasForeignKey(ri => ri.UnitId)
             .OnDelete(DeleteBehavior.Cascade);

            b.HasMany(u => u.Leases)
             .WithOne(l => l.Unit)
             .HasForeignKey(l => l.UnitId)
             .OnDelete(DeleteBehavior.NoAction);


            b.HasOne(u => u.Property)
           .WithMany(p => p.Units)
           .HasForeignKey(u => u.PropertyId);
           
            // Organization relationship
            b.HasOne(u => u.Organization)
             .WithMany()
             .HasForeignKey(u => u.OrganizationId)
             .IsRequired(false)
             .OnDelete(DeleteBehavior.SetNull);
             
            b.HasIndex(u => u.OrganizationId);
        }
    }
}