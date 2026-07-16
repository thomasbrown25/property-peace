using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using brownstone_hub_api.Models;

namespace brownstone_hub_api.Configurations
{
    public class VendorConfig : IEntityTypeConfiguration<Vendor>
    {
        public void Configure(EntityTypeBuilder<Vendor> builder)
        {
            builder.ToTable("Vendors", "financial");
            builder.HasKey(v => v.Id);

            builder.Property(v => v.Name).IsRequired().HasMaxLength(200);
            builder.Property(v => v.BusinessName).HasMaxLength(200);
            builder.Property(v => v.Description).HasMaxLength(1000);
            builder.Property(v => v.Email).HasMaxLength(200);
            builder.Property(v => v.Phone).HasMaxLength(50);
            builder.Property(v => v.AlternatePhone).HasMaxLength(50);
            builder.Property(v => v.Address).HasMaxLength(500);
            builder.Property(v => v.City).HasMaxLength(100);
            builder.Property(v => v.State).HasMaxLength(50);
            builder.Property(v => v.ZipCode).HasMaxLength(20);
            builder.Property(v => v.TaxId).HasMaxLength(50);
            builder.Property(v => v.LicenseNumber).HasMaxLength(100);
            builder.Property(v => v.Category).HasMaxLength(100);
            builder.Property(v => v.Specialties).HasMaxLength(500);
            builder.Property(v => v.Notes).HasMaxLength(2000);

            builder.Property(v => v.CreatedAt).HasDefaultValueSql("GETUTCDATE()");
            builder.Property(v => v.UpdatedAt).HasDefaultValueSql("GETUTCDATE()");

            // Relationship with Landlord (User)
            builder.HasOne(v => v.Landlord)
                   .WithMany()
                   .HasForeignKey(v => v.LandlordId)
                   .OnDelete(DeleteBehavior.NoAction);

            // Relationship with Expenses (configured in ExpenseConfig)
            // Relationship with MaintenanceRequests (configured in MaintenanceRequestConfig)

            // Organization relationship
            builder.HasOne(v => v.Organization)
                   .WithMany()
                   .HasForeignKey(v => v.OrganizationId)
                   .IsRequired(false)
                   .OnDelete(DeleteBehavior.SetNull);

            // Indexes
            builder.HasIndex(v => v.LandlordId);
            builder.HasIndex(v => new { v.LandlordId, v.Name });
            builder.HasIndex(v => v.Category);
            builder.HasIndex(v => v.IsActive);
            builder.HasIndex(v => v.IsDeleted);
            builder.HasIndex(v => v.OrganizationId);
        }
    }
}

