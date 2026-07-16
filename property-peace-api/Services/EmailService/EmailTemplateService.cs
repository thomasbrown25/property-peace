using brownstone_hub_api.Config;
using brownstone_hub_api.Enums;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace brownstone_hub_api.Services.EmailService
{
    /// <summary>
    /// Service for formatting email messages using templates based on notification type
    /// </summary>
    public class EmailTemplateService
    {
        private readonly ILogger<EmailTemplateService> _logger;
        private readonly Dictionary<ENotificationType, EmailTemplate> _templates;
        private readonly IConfiguration? _configuration;

        public EmailTemplateService(
            ILogger<EmailTemplateService> logger,
            IOptions<EmailTemplateSettings>? templateSettings = null,
            IConfiguration? configuration = null)
        {
            _logger = logger;
            _configuration = configuration;
            _templates = InitializeTemplates(templateSettings?.Value);
        }

        /// <summary>
        /// Formats email subject, HTML body, and plain text body using the appropriate template for the notification type
        /// </summary>
        public (string subject, string htmlBody, string plainTextBody) FormatEmail(
            ENotificationType type,
            string title,
            string message,
            Dictionary<string, string>? additionalData = null)
        {
            try
            {
                if (!_templates.TryGetValue(type, out var template))
                {
                    // Fallback to default template if no specific template exists
                    template = GetDefaultTemplate();
                }

                // Use the public, email-safe dark Property Peace logo so it stays visible on the light header.
                var logoUrl = "https://propertypeace.io/images/logos/property-peace-dark.png";

                // Replace template variables
                var subject = ReplaceVariables(template.Subject ?? "{Title}", title, message, additionalData);
                var htmlBody = ReplaceVariables(template.HtmlBody ?? GetDefaultHtmlBody(), title, message, additionalData);
                htmlBody = htmlBody.Replace("{LogoUrl}", logoUrl);
                var plainTextBody = ReplaceVariables(template.PlainTextBody ?? message, title, message, additionalData);

                return (subject, htmlBody, plainTextBody);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error formatting email message for type {Type}", type);
                // Fallback to simple format
                var logoUrl = "https://propertypeace.io/images/logos/property-peace-dark.png";
                var fallbackHtml = GetDefaultHtmlBody().Replace("{Title}", title ?? "").Replace("{Message}", message ?? "").Replace("{LogoUrl}", logoUrl);
                return (title ?? "Notification", fallbackHtml, message ?? "");
            }
        }

        /// <summary>
        /// Replaces template variables with actual values
        /// </summary>
        private string ReplaceVariables(string template, string title, string message, Dictionary<string, string>? additionalData)
        {
            var result = template
                .Replace("{Title}", title ?? "")
                .Replace("{Message}", message ?? "");

            // Replace additional data if provided
            if (additionalData != null)
            {
                foreach (var kvp in additionalData)
                {
                    result = result.Replace($"{{{kvp.Key}}}", kvp.Value ?? "");
                }
            }

            return result;
        }

        /// <summary>
        /// Initializes email templates from configuration or defaults
        /// </summary>
        private Dictionary<ENotificationType, EmailTemplate> InitializeTemplates(EmailTemplateSettings? settings)
        {
            var templates = new Dictionary<ENotificationType, EmailTemplate>();

            // Use configured templates if provided, otherwise use defaults
            templates[ENotificationType.Payment] = settings?.Payment ?? GetDefaultPaymentTemplate();
            templates[ENotificationType.Rent] = settings?.Rent ?? GetDefaultRentTemplate();
            templates[ENotificationType.Maintenance] = settings?.Maintenance ?? GetDefaultMaintenanceTemplate();
            templates[ENotificationType.Lease] = settings?.Lease ?? GetDefaultLeaseTemplate();
            templates[ENotificationType.Message] = settings?.Message ?? GetDefaultMessageTemplate();
            templates[ENotificationType.Expense] = settings?.Expense ?? GetDefaultExpenseTemplate();

            _logger.LogInformation("Email templates initialized. Using {Source} templates",
                settings != null ? "configured" : "default");

            return templates;
        }

        /// <summary>
        /// Gets the default template structure
        /// </summary>
        private EmailTemplate GetDefaultTemplate()
        {
            return new EmailTemplate
            {
                Subject = "{Title}",
                HtmlBody = GetDefaultHtmlBody(),
                PlainTextBody = "{Message}"
            };
        }

        /// <summary>
        /// Gets the default HTML body template
        /// </summary>
        private string GetDefaultHtmlBody()
        {
            return @"<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333333;
            background-color: #f4f4f3;
            padding: 20px;
        }
        .email-wrapper {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        .header {
            background-color: #ffffff;
            padding: 24px 30px;
            text-align: center;
            border-bottom: 1px solid #e8e8e8;
        }
        .content {
            padding: 40px 30px;
            background-color: #ffffff;
        }
        .content h2 {
            font-size: 22px;
            font-weight: 600;
            color: #1a1a1a;
            margin-bottom: 20px;
        }
        .content p {
            font-size: 15px;
            color: #4a4a4a;
            margin-bottom: 16px;
            line-height: 1.6;
        }
        .signature {
            margin-top: 32px;
            padding-top: 24px;
            border-top: 1px solid #e0e0e0;
        }
        .signature p {
            margin: 4px 0;
            color: #4a4a4a;
            font-size: 15px;
        }
        .signature .team-name {
            font-weight: 600;
            color: #1976d2;
        }
        .footer {
            background-color: #042238;
            padding: 28px 30px;
            text-align: center;
        }
        .footer p {
            font-size: 12px;
            color: rgba(255,255,255,0.65);
            margin: 0;
        }
        @media only screen and (max-width: 600px) {
            body { padding: 10px; }
            .header { padding: 24px 20px; }
            .content { padding: 30px 20px; }
        }
    </style>
</head>
<body>
    <div class='email-wrapper'>
        <div class='header'>
            <img src='{LogoUrl}' alt='Property Peace' style='max-width: 180px; height: auto; display: block; margin: 0 auto;' />
        </div>
        <div class='content'>
            <h2>{Title}</h2>
            <p>{Message}</p>
            <div class='signature'>
                <p>Best regards,</p>
                <p class='team-name'>Property Peace Team</p>
            </div>
        </div>
        <div class='footer'>
            <p>This is an automated email from Property Peace. Please do not reply to this message.</p>
            <p style='margin-top: 12px;'><a href='https://propertypeace.io' style='color:#ffffff; text-decoration:none;'>Website</a></p>
        </div>
    </div>
</body>
</html>";
        }

        /// <summary>
        /// Gets default template for Payment notifications
        /// </summary>
        private EmailTemplate GetDefaultPaymentTemplate()
        {
            return new EmailTemplate
            {
                Subject = "Payment Received - Property Peace",
                HtmlBody = GetDefaultHtmlBody(),
                PlainTextBody = "Payment Received: {Message}"
            };
        }

        /// <summary>
        /// Gets default template for Rent notifications
        /// </summary>
        private EmailTemplate GetDefaultRentTemplate()
        {
            return new EmailTemplate
            {
                Subject = "{Title}",
                HtmlBody = GetDefaultHtmlBody(),
                PlainTextBody = "{Title}: {Message}"
            };
        }

        /// <summary>
        /// Gets default template for Maintenance notifications
        /// </summary>
        private EmailTemplate GetDefaultMaintenanceTemplate()
        {
            return new EmailTemplate
            {
                Subject = "New Maintenance Request - Property Peace",
                HtmlBody = GetDefaultHtmlBody(),
                PlainTextBody = "New Maintenance Request: {Message}"
            };
        }

        /// <summary>
        /// Gets default template for Lease notifications
        /// </summary>
        private EmailTemplate GetDefaultLeaseTemplate()
        {
            return new EmailTemplate
            {
                Subject = "Lease Alert - Property Peace",
                HtmlBody = GetDefaultHtmlBody(),
                PlainTextBody = "Lease Alert: {Message}"
            };
        }

        /// <summary>
        /// Gets default template for Message notifications
        /// </summary>
        private EmailTemplate GetDefaultMessageTemplate()
        {
            return new EmailTemplate
            {
                Subject = "{Title} - Property Peace",
                HtmlBody = GetDefaultHtmlBody(),
                PlainTextBody = "{Title}: {Message}"
            };
        }

        /// <summary>
        /// Gets default template for Expense notifications
        /// </summary>
        private EmailTemplate GetDefaultExpenseTemplate()
        {
            return new EmailTemplate
            {
                Subject = "Expense Alert - Property Peace",
                HtmlBody = GetDefaultHtmlBody(),
                PlainTextBody = "Expense Alert: {Message}"
            };
        }

        /// <summary>
        /// Updates a template for a specific notification type
        /// </summary>
        public void UpdateTemplate(ENotificationType type, EmailTemplate template)
        {
            if (template == null)
            {
                _logger.LogWarning("Attempted to set null template for type {Type}", type);
                return;
            }

            _templates[type] = template;
            _logger.LogInformation("Updated email template for type {Type}", type);
        }

        /// <summary>
        /// Gets the current template for a notification type
        /// </summary>
        public EmailTemplate GetTemplate(ENotificationType type)
        {
            return _templates.TryGetValue(type, out var template)
                ? template
                : GetDefaultTemplate();
        }

        /// <summary>
        /// Gets all templates
        /// </summary>
        public Dictionary<ENotificationType, EmailTemplate> GetAllTemplates()
        {
            return new Dictionary<ENotificationType, EmailTemplate>(_templates);
        }
    }
}

