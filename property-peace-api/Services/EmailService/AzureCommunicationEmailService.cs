using Azure;
using Azure.Communication.Email;
using brownstone_hub_api.Config;
using Microsoft.Extensions.Options;

namespace brownstone_hub_api.Services.EmailService
{
    public class AzureCommunicationEmailService : IEmailService
    {
        private readonly EmailClient? _emailClient;
        private readonly AzureCommunicationSettings _settings;
        private readonly ILogger<AzureCommunicationEmailService> _logger;

        public AzureCommunicationEmailService(
            IOptions<AzureCommunicationSettings> settings,
            ILogger<AzureCommunicationEmailService> logger)
        {
            _settings = settings.Value;
            _logger = logger;

            if (string.IsNullOrWhiteSpace(_settings.ConnectionString))
            {
                _logger.LogWarning("Azure Communication Services connection string is not configured. Email sending will fail.");
                _logger.LogWarning("Please set AzureCommunication:ConnectionString in your configuration.");
            }
            else
            {
                try
                {
                    _emailClient = new EmailClient(_settings.ConnectionString);
                    _logger.LogInformation("Azure Communication Services EmailClient initialized successfully.");
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to initialize Azure Communication Services EmailClient. Connection string may be invalid.");
                }
            }

            if (string.IsNullOrWhiteSpace(_settings.SenderAddress))
            {
                _logger.LogWarning("Azure Communication Services sender address is not configured. Email sending may fail.");
                _logger.LogWarning("Please set AzureCommunication:SenderAddress in your configuration.");
            }
            else
            {
                _logger.LogInformation("Azure Communication Services sender address configured: {SenderAddress}", _settings.SenderAddress);
            }
        }

        public async Task<bool> SendEmailAsync(string to, string subject, string htmlContent, string? plainTextContent = null, CancellationToken cancellationToken = default)
        {
            return await SendEmailAsync(to, subject, htmlContent, plainTextContent, null, cancellationToken);
        }

        public async Task<bool> SendEmailAsync(string to, string subject, string htmlContent, string? plainTextContent, string? senderAddress, CancellationToken cancellationToken = default)
        {
            // Azure Communication Services requires senderAddress to be the bare email (no display name).
            // The name shown in recipients' inboxes (e.g. "The Property Peace Team") is set in Azure Portal: Email Communication Service → Domains → Mail From → Display Name.
            string rawSenderEmail = GetRawSenderEmail(
                !string.IsNullOrWhiteSpace(senderAddress) ? senderAddress : _settings.SenderAddress);
            string displayFrom = rawSenderEmail;
            if (!string.IsNullOrWhiteSpace(_settings.SenderDisplayName) && string.IsNullOrWhiteSpace(senderAddress))
                displayFrom = $"\"{_settings.SenderDisplayName.Trim()}\" <{rawSenderEmail}>";

            try
            {
                if (_emailClient == null)
                {
                    _logger.LogError("Email client is not initialized. Check Azure Communication Services configuration. Connection string may be missing or invalid.");
                    return false;
                }

                if (string.IsNullOrWhiteSpace(rawSenderEmail))
                {
                    _logger.LogError("Sender address is not configured. Please set AzureCommunication:SenderAddress in Azure App Configuration or provide a sender address.");
                    return false;
                }

                if (!rawSenderEmail.Contains("@"))
                {
                    _logger.LogError("Invalid sender address format: {SenderAddress}. Expected format: email@domain.com", rawSenderEmail);
                    return false;
                }

                var emailContent = new EmailContent(subject)
                {
                    PlainText = plainTextContent ?? StripHtml(htmlContent),
                    Html = htmlContent
                };

                var emailMessage = new EmailMessage(
                    senderAddress: rawSenderEmail,
                    content: emailContent,
                    recipients: new EmailRecipients(new List<EmailAddress> { new EmailAddress(to) })
                );

                _logger.LogInformation("Sending email to {To} from {Sender} with subject: {Subject}", to, displayFrom, subject);

                // Submit and return immediately — do not poll for delivery status.
                // Azure email delivery is async; polling WaitForCompletionAsync blocks for 2–5s per send.
                await _emailClient.SendAsync(
                    WaitUntil.Started,
                    emailMessage,
                    cancellationToken);

                _logger.LogInformation("Email submitted to {To} from {Sender}", to, displayFrom);
                return true;
            }
            catch (RequestFailedException ex)
            {
                var errorMessage = ex.Message.ToLower();
                if (errorMessage.Contains("domain") || errorMessage.Contains("verified") || errorMessage.Contains("sender"))
                {
                    var domain = rawSenderEmail.Contains('@') ? rawSenderEmail.Split('@')[1].TrimEnd('>') : rawSenderEmail;
                    _logger.LogError(ex, "Azure Communication Services error - Domain may not be verified. " +
                        "Error sending email to {To} from {Sender}: {Error}. " +
                        "Please verify the domain '{Domain}' in Azure Communication Services Email Communication Services.",
                        to, displayFrom, ex.Message, domain);
                }
                else
                {
                    _logger.LogError(ex, "Azure Communication Services error sending email to {To} from {Sender}: {Error}",
                        to, displayFrom, ex.Message);
                }
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error sending email to {To} from {Sender}: {Error}",
                    to, displayFrom, ex.Message);
                return false;
            }
        }

        /// <summary>
        /// Returns the bare email address. If the value is in "Display Name" &lt;email&gt; format, extracts and returns only the email.
        /// Azure Communication Services requires senderAddress to be the raw email, not a display-name format.
        /// </summary>
        private static string GetRawSenderEmail(string address)
        {
            if (string.IsNullOrWhiteSpace(address)) return address;
            var s = address.Trim();
            var open = s.LastIndexOf('<');
            var close = s.IndexOf('>', open + 1);
            if (open >= 0 && close > open)
                return s.Substring(open + 1, close - open - 1).Trim();
            return s;
        }

        public async Task<bool> SendBulkEmailAsync(List<string> to, string subject, string htmlContent, string? plainTextContent = null, CancellationToken cancellationToken = default)
        {
            try
            {
                if (_emailClient == null)
                {
                    _logger.LogError("Email client is not initialized. Check Azure Communication Services configuration.");
                    return false;
                }

                var rawSenderEmail = GetRawSenderEmail(_settings.SenderAddress);
                if (string.IsNullOrWhiteSpace(rawSenderEmail))
                {
                    _logger.LogError("Sender address is not configured in AzureCommunicationSettings.");
                    return false;
                }

                var emailAddresses = to.Select(email => new EmailAddress(email)).ToList();
                var emailContent = new EmailContent(subject)
                {
                    PlainText = plainTextContent ?? StripHtml(htmlContent),
                    Html = htmlContent
                };

                var emailMessage = new EmailMessage(
                    senderAddress: rawSenderEmail,
                    content: emailContent,
                    recipients: new EmailRecipients(emailAddresses)
                );

                _logger.LogInformation("Sending bulk email to {Count} recipients with subject: {Subject}", to.Count, subject);

                EmailSendOperation emailSendOperation = await _emailClient.SendAsync(
                    WaitUntil.Started,
                    emailMessage,
                    cancellationToken);

                var response = await emailSendOperation.WaitForCompletionAsync(cancellationToken);

                if (response.HasValue && response.Value.Status == EmailSendStatus.Succeeded)
                {
                    _logger.LogInformation("Bulk email sent successfully to {Count} recipients", to.Count);
                    return true;
                }
                else
                {
                    _logger.LogError("Bulk email send failed. Status: {Status}", response.HasValue ? response.Value.Status.ToString() : "Unknown");
                    return false;
                }
            }
            catch (RequestFailedException ex)
            {
                var errorMessage = ex.Message.ToLower();
                var rawSenderEmail = GetRawSenderEmail(_settings.SenderAddress);
                if (errorMessage.Contains("domain") || errorMessage.Contains("verified") || errorMessage.Contains("sender"))
                {
                    var domain = rawSenderEmail.Contains('@') ? rawSenderEmail.Split('@')[1].TrimEnd('>') : rawSenderEmail;
                    _logger.LogError(ex, "Azure Communication Services error - Domain may not be verified. " +
                        "Error sending bulk email from {Sender}: {Error}. " +
                        "Please verify the domain '{Domain}' in Azure Communication Services Email Communication Services.",
                        rawSenderEmail, ex.Message, domain);
                }
                else
                {
                    _logger.LogError(ex, "Azure Communication Services error sending bulk email from {Sender}: {Error}",
                        rawSenderEmail, ex.Message);
                }
                return false;
            }
            catch (Exception ex)
            {
                var rawSenderEmail = GetRawSenderEmail(_settings.SenderAddress);
                _logger.LogError(ex, "Unexpected error sending bulk email from {Sender}: {Error}",
                    rawSenderEmail, ex.Message);
                return false;
            }
        }

        private string StripHtml(string html)
        {
            if (string.IsNullOrWhiteSpace(html))
                return string.Empty;

            // Simple HTML stripping - remove tags
            return System.Text.RegularExpressions.Regex.Replace(html, "<.*?>", string.Empty);
        }
    }
}

