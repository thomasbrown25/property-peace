using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using brownstone_hub_api.Models;

namespace brownstone_hub_api.Configurations
{
    public class DemoRequestConfig : IEntityTypeConfiguration<DemoRequest>
    {
        public void Configure(EntityTypeBuilder<DemoRequest> b)
        {
            b.ToTable("DemoRequests", "admin");
            b.HasKey(dr => dr.Id);

            b.Property(dr => dr.FirstName)
                .IsRequired()
                .HasMaxLength(100);

            b.Property(dr => dr.LastName)
                .IsRequired()
                .HasMaxLength(100);

            b.Property(dr => dr.CompanyName)
                .IsRequired()
                .HasMaxLength(200);

            b.Property(dr => dr.Email)
                .IsRequired()
                .HasMaxLength(255);

            b.Property(dr => dr.Phone)
                .IsRequired()
                .HasMaxLength(20);

            b.Property(dr => dr.NumberOfUnits)
                .IsRequired()
                .HasMaxLength(50);

            b.Property(dr => dr.HowCanWeHelp)
                .IsRequired()
                .HasMaxLength(500);

            b.Property(dr => dr.CalendlyEventUri)
                .HasMaxLength(500);

            b.Property(dr => dr.CalendlyInviteeUri)
                .HasMaxLength(500);

            b.Property(dr => dr.CreatedAt)
                .IsRequired()
                .HasDefaultValueSql("GETUTCDATE()");

            b.HasIndex(dr => dr.Email);
            b.HasIndex(dr => dr.CreatedAt);
        }
    }
}
