using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class RentEstimateCacheConfig : IEntityTypeConfiguration<RentEstimateCache>
    {
        public void Configure(EntityTypeBuilder<RentEstimateCache> b)
        {
            b.ToTable("RentEstimateCache", "rentcast");

            b.HasKey(e => e.Id);

            b.Property(e => e.CacheKey).IsRequired().HasMaxLength(64);
            b.Property(e => e.Address).IsRequired().HasMaxLength(300);
            b.Property(e => e.City).IsRequired().HasMaxLength(100);
            b.Property(e => e.State).IsRequired().HasMaxLength(50);
            b.Property(e => e.ZipCode).IsRequired().HasMaxLength(20);
            b.Property(e => e.Bedrooms).HasMaxLength(20);
            b.Property(e => e.Bathrooms).HasMaxLength(20);
            b.Property(e => e.PropertyType).HasMaxLength(50);
            b.Property(e => e.RentEstimate).HasColumnType("decimal(10,2)");
            b.Property(e => e.RentRangeLow).HasColumnType("decimal(10,2)");
            b.Property(e => e.RentRangeHigh).HasColumnType("decimal(10,2)");
            b.Property(e => e.ComparablesJson).HasColumnType("nvarchar(max)");
            b.Property(e => e.ErrorMessage).HasMaxLength(500);

            b.HasIndex(e => e.CacheKey).IsUnique();
            b.HasIndex(e => e.ExpiresAt);
        }
    }
}
