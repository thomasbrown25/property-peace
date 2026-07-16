namespace brownstone_hub_api.Config
{
    /// <summary>
    /// Configuration settings for SMS message templates
    /// </summary>
    public class SmsTemplateSettings
    {
        /// <summary>
        /// Template for Payment notifications
        /// Available variables: {Title}, {Message}
        /// </summary>
        public string? Payment { get; set; }

        /// <summary>
        /// Template for Rent notifications (reminders and overdue)
        /// Available variables: {Title}, {Message}
        /// </summary>
        public string? Rent { get; set; }

        /// <summary>
        /// Template for Maintenance notifications
        /// Available variables: {Title}, {Message}
        /// </summary>
        public string? Maintenance { get; set; }

        /// <summary>
        /// Template for Lease notifications
        /// Available variables: {Title}, {Message}
        /// </summary>
        public string? Lease { get; set; }

        /// <summary>
        /// Template for general Message notifications
        /// Available variables: {Title}, {Message}
        /// </summary>
        public string? Message { get; set; }

        /// <summary>
        /// Template for Expense notifications
        /// Available variables: {Title}, {Message}
        /// </summary>
        public string? Expense { get; set; }
    }
}

