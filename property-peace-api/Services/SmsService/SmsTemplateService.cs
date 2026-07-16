using brownstone_hub_api.Config;
using brownstone_hub_api.Enums;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace brownstone_hub_api.Services.SmsService
{
    /// <summary>
    /// Service for formatting SMS messages using templates based on notification type
    /// </summary>
    public class SmsTemplateService
    {
        private readonly ILogger<SmsTemplateService> _logger;
        private readonly Dictionary<ENotificationType, string> _templates;

        public SmsTemplateService(
            ILogger<SmsTemplateService> logger,
            IOptions<SmsTemplateSettings>? templateSettings = null)
        {
            _logger = logger;
            _templates = InitializeTemplates(templateSettings?.Value);
        }

        /// <summary>
        /// Formats an SMS message using the appropriate template for the notification type
        /// </summary>
        public string FormatMessage(ENotificationType type, string title, string message, Dictionary<string, string>? additionalData = null)
        {
            try
            {
                if (!_templates.TryGetValue(type, out var template))
                {
                    // Fallback to default template if no specific template exists
                    template = "{Title}: {Message}";
                }

                // Replace template variables
                var formatted = template
                    .Replace("{Title}", title ?? "")
                    .Replace("{Message}", message ?? "");

                // Replace additional data if provided
                if (additionalData != null)
                {
                    foreach (var kvp in additionalData)
                    {
                        formatted = formatted.Replace($"{{{kvp.Key}}}", kvp.Value ?? "");
                    }
                }

                // Ensure message doesn't exceed SMS limits
                if (formatted.Length > 160)
                {
                    formatted = formatted.Substring(0, 157) + "...";
                    _logger.LogWarning("SMS message truncated to 160 characters for type {Type}", type);
                }

                return formatted;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error formatting SMS message for type {Type}", type);
                // Fallback to simple format
                return $"{title}: {message}";
            }
        }

        /// <summary>
        /// Initializes SMS templates from configuration or defaults
        /// </summary>
        private Dictionary<ENotificationType, string> InitializeTemplates(SmsTemplateSettings? settings)
        {
            var templates = new Dictionary<ENotificationType, string>();

            // Use configured templates if provided, otherwise use defaults
            templates[ENotificationType.Payment] = settings?.Payment 
                ?? "Payment Received: {Message} -Property Peace";

            templates[ENotificationType.Rent] = settings?.Rent 
                ?? "Rent Alert: {Message} -Property Peace";

            templates[ENotificationType.Maintenance] = settings?.Maintenance 
                ?? "Maintenance Update: {Message} -Property Peace";

            templates[ENotificationType.Lease] = settings?.Lease 
                ?? "Lease Alert: {Message} -Property Peace";

            templates[ENotificationType.Message] = settings?.Message 
                ?? "{Title}: {Message} -Property Peace";

            templates[ENotificationType.Expense] = settings?.Expense 
                ?? "Expense Alert: {Message} -Property Peace";

            _logger.LogInformation("SMS templates initialized. Using {(Source)} templates", 
                settings != null ? "configured" : "default");

            return templates;
        }

        /// <summary>
        /// Updates a template for a specific notification type
        /// </summary>
        public void UpdateTemplate(ENotificationType type, string template)
        {
            if (string.IsNullOrWhiteSpace(template))
            {
                _logger.LogWarning("Attempted to set empty template for type {Type}", type);
                return;
            }

            _templates[type] = template;
            _logger.LogInformation("Updated SMS template for type {Type}", type);
        }

        /// <summary>
        /// Gets the current template for a notification type
        /// </summary>
        public string GetTemplate(ENotificationType type)
        {
            return _templates.TryGetValue(type, out var template) 
                ? template 
                : "{Title}: {Message}";
        }

        /// <summary>
        /// Gets all templates
        /// </summary>
        public Dictionary<ENotificationType, string> GetAllTemplates()
        {
            return new Dictionary<ENotificationType, string>(_templates);
        }
    }
}

