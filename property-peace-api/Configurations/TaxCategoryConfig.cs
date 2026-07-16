using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class TaxCategoryConfig : IEntityTypeConfiguration<TaxCategory>
    {
        public void Configure(EntityTypeBuilder<TaxCategory> b)
        {
            b.ToTable("TaxCategories", "financial");
            b.HasKey(tc => tc.Id);

            b.Property(tc => tc.Name)
                .IsRequired()
                .HasMaxLength(100);

            b.Property(tc => tc.Description)
                .HasMaxLength(500);

            b.HasIndex(tc => tc.Name).IsUnique();
            b.HasIndex(tc => tc.ScheduleELineNumber);
            b.HasIndex(tc => tc.SortOrder);

            b.HasMany(tc => tc.Expenses)
                .WithOne(e => e.TaxCategoryEntity)
                .HasForeignKey(e => e.TaxCategoryId)
                .OnDelete(DeleteBehavior.SetNull);
        }
    }
}
