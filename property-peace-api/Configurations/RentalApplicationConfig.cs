using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using brownstone_hub_api.Models;

namespace brownstone_hub_api.Configurations
{
    public class RentalApplicationConfig : IEntityTypeConfiguration<RentalApplication>
    {
        public void Configure(EntityTypeBuilder<RentalApplication> builder)
        {
            builder.ToTable("RentalApplications", "tenant");
            builder.HasKey(ra => ra.Id);

            builder.Property(ra => ra.FirstName)
                .IsRequired()
                .HasMaxLength(100);

            builder.Property(ra => ra.LastName)
                .IsRequired()
                .HasMaxLength(100);

            builder.Property(ra => ra.Email)
                .IsRequired()
                .HasMaxLength(255);

            builder.Property(ra => ra.PhoneNumber)
                .HasMaxLength(20);


            builder.Property(ra => ra.CurrentAddress)
                .HasMaxLength(500);

            builder.Property(ra => ra.EmployerName)
                .HasMaxLength(200);

            builder.Property(ra => ra.JobTitle)
                .HasMaxLength(100);

            builder.Property(ra => ra.MonthlyIncome)
                .HasPrecision(18, 2);

            builder.Property(ra => ra.PetDetails)
                .HasMaxLength(500);

            builder.Property(ra => ra.VehicleDetails)
                .HasMaxLength(500);

            builder.Property(ra => ra.RejectionReason)
                .HasMaxLength(1000);

            builder.Property(ra => ra.ReviewNotes)
                .HasColumnType("nvarchar(max)");

            builder.Property(ra => ra.AdditionalNotes)
                .HasColumnType("nvarchar(max)");


            // Relationships
            builder.HasOne(ra => ra.Property)
                .WithMany()
                .HasForeignKey(ra => ra.PropertyId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(ra => ra.Unit)
                .WithMany()
                .HasForeignKey(ra => ra.UnitId)
                .OnDelete(DeleteBehavior.SetNull);

            builder.HasOne(ra => ra.Landlord)
                .WithMany()
                .HasForeignKey(ra => ra.LandlordId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(ra => ra.ConvertedToTenant)
                .WithMany()
                .HasForeignKey(ra => ra.ConvertedToTenantId)
                .OnDelete(DeleteBehavior.SetNull);

            builder.HasOne(ra => ra.ConvertedToLease)
                .WithMany()
                .HasForeignKey(ra => ra.ConvertedToLeaseId)
                .OnDelete(DeleteBehavior.SetNull);

            // Organization relationship
            builder.HasOne(ra => ra.Organization)
                .WithMany()
                .HasForeignKey(ra => ra.OrganizationId)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.SetNull);

            // Indexes
            builder.HasIndex(ra => ra.PropertyId);
            builder.HasIndex(ra => ra.UnitId);
            builder.HasIndex(ra => ra.LandlordId);
            builder.HasIndex(ra => ra.Status);
            builder.HasIndex(ra => new { ra.LandlordId, ra.Status });
            builder.HasIndex(ra => ra.SubmittedAt);
            builder.HasIndex(ra => ra.Email);
            builder.HasIndex(ra => ra.OrganizationId);
        }
    }
}

