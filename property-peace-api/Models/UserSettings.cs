

namespace brownstone_hub_api.Models
{
    public class UserSettings
    {
        public long Id { get; set; }
        public long UserId { get; set; }
        public long? FontSize { get; set; } = 0;
        public string? Language { get; set; } = "English";
        public string? Messages { get; set; }
        public bool DarkMode { get; set; } = false;
        public bool SidenavMini { get; set; } = false;
        public bool NavbarFixed { get; set; } = true;
        public string? SidenavType { get; set; } = "dark";
        public string? PropertyLayout { get; set; } = "cards"; // "cards" or "table"
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
