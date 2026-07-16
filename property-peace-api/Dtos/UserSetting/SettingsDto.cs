

namespace brownstone_hub_api.Dtos.UserSetting
{
    public class SettingsDto
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
        public string? PropertyLayout { get; set; }
        public string? Timezone { get; set; }
        public string? DateFormat { get; set; }
        public string? TimeFormat { get; set; }
        public string? Currency { get; set; }
        
        // AI Summary Preferences
        public bool AiSummaryEnabled { get; set; } = true;
        public bool AiSummaryCheckTenantAccounts { get; set; } = true;
        public bool AiSummaryCheckMoveInChecklist { get; set; } = true;
        public bool AiSummaryCheckMoveOutChecklist { get; set; } = true;
        public bool AiSummaryCheckApplicationsSentSigned { get; set; } = true;
        public bool AiSummaryCheckUnpaidSecurityDeposits { get; set; } = true;
    }
}