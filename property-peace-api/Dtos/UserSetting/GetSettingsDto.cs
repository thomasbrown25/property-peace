

namespace brownstone_hub_api.Dtos.UserSetting
{
    public class GetSettingsDto
    {
        public long Id { get; set; }
        public long UserId { get; set; }
        public long? FontSize { get; set; }
        public string? Language { get; set; }
        public string? Messages { get; set; }
        public bool DarkMode { get; set; }
        public bool SidenavMini { get; set; }
        public bool NavbarFixed { get; set; }
        public string? SidenavType { get; set; }
    }
}