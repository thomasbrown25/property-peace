using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class UnitConfig : IEntityTypeConfiguration<Unit>
    {
        public void Configure(EntityTypeBuilder<Unit> b)
        {
            b.ToTable("Units", "property");
            b.Property(u => u.Name).HasMaxLength(128);

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

            // Configure the 1:1 from ONE side only (here)
            b.HasOne(u => u.Lease)
             .WithOne(l => l.Unit)
             .HasForeignKey<Lease>(l => l.UnitId)
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