namespace brownstone_hub_api.Config
{
    /// <summary>
    /// Configuration settings for email message templates
    /// </summary>
    public class EmailTemplateSettings
    {
        /// <summary>
        /// Email template configuration for Payment notifications
        /// </summary>
        public EmailTemplate? Payment { get; set; }

        /// <summary>
        /// Email template configuration for Rent notifications (reminders and overdue)
        /// </summary>
        public EmailTemplate? Rent { get; set; }

        /// <summary>
        /// Email template configuration for Maintenance notifications
        /// </summary>
        public EmailTemplate? Maintenance { get; set; }

        /// <summary>
        /// Email template configuration for Lease notifications
        /// </summary>
        public EmailTemplate? Lease { get; set; }

        /// <summary>
        /// Email template configuration for general Message notifications
        /// </summary>
        public EmailTemplate? Message { get; set; }

        /// <summary>
        /// Email template configuration for Expense notifications
        /// </summary>
        public EmailTemplate? Expense { get; set; }
    }

    /// <summary>
    /// Email template structure containing subject, HTML body, and plain text body
    /// </summary>
    public class EmailTemplate
    {
        /// <summary>
        /// Email subject template
        /// Available variables: {Title}, {Message}
        /// </summary>
        public string? Subject { get; set; }

        /// <summary>
        /// HTML email body template
        /// Available variables: {Title}, {Message}
        /// </summary>
        public string? HtmlBody { get; set; }

        /// <summary>
        /// Plain text email body template
        /// Available variables: {Title}, {Message}
        /// </summary>
        public string? PlainTextBody { get; set; }
    }
}

