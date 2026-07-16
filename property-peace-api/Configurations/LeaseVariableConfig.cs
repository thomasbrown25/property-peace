using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class LeaseVariableConfig : IEntityTypeConfiguration<LeaseVariable>
    {
        public void Configure(EntityTypeBuilder<LeaseVariable> b)
        {
            b.ToTable("LeaseVariables", "lease_builder");
            b.HasKey(v => v.Id);

            b.Property(v => v.VariableKey)
                .IsRequired()
                .HasMaxLength(100);

            b.Property(v => v.VariableValue)
                .IsRequired()
                .HasMaxLength(2000);

            b.Property(v => v.VariableType)
                .IsRequired()
                .HasMaxLength(20)
                .HasDefaultValue("String");

            // Relationship
            b.HasOne(v => v.LeaseInstance)
                .WithMany(i => i.Variables)
                .HasForeignKey(v => v.LeaseInstanceId)
                .OnDelete(DeleteBehavior.Cascade);

            // Index
            b.HasIndex(v => new { v.LeaseInstanceId, v.VariableKey })
                .IsUnique();
        }
    }
}
