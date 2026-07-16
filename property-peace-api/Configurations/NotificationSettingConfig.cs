using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class NotificationSettingConfig : IEntityTypeConfiguration<NotificationSetting>
    {
        public void Configure(EntityTypeBuilder<NotificationSetting> b)
        {
            b.ToTable("NotificationSettings", "communication");
            b.HasKey(x => x.Id);
            
            b.HasIndex(x => x.UserId);
            
            b.Property(x => x.EmailAddress)
                .HasMaxLength(255);
                
            b.Property(x => x.PhoneNumber)
                .HasMaxLength(20);
        }
    }
}

