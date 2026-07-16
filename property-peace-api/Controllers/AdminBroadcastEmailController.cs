using System.IO;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using brownstone_hub_api.Dtos.Admin;
using brownstone_hub_api.Dtos.User;
using brownstone_hub_api.Services.UserService;
using brownstone_hub_api.Services.EmailService;
using brownstone_hub_api.Services.OpenAIService;
using System.Net;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/admin/broadcast-email")]
    [Authorize(Roles = "Admin")]
    public class AdminBroadcastEmailController : ControllerBase
    {
        private readonly IUserService _userService;
        private readonly IEmailService _emailService;
        private readonly IOpenAIService _openAIService;
        private readonly IConfiguration _configuration;
        private readonly IWebHostEnvironment _env;
        private readonly ILogger<AdminBroadcastEmailController> _logger;

        public AdminBroadcastEmailController(
            IUserService userService,
            IEmailService emailService,
            IOpenAIService openAIService,
            IConfiguration configuration,
            IWebHostEnvironment env,
            ILogger<AdminBroadcastEmailController> logger)
        {
            _userService = userService;
            _emailService = emailService;
            _openAIService = openAIService;
            _configuration = configuration;
            _env = env;
            _logger = logger;
        }

        private const string SignaturePlainText = "\n\nBest regards,\n\nThe Property Peace Team";

        private string GetPropertyPeaceSignatureHtml()
        {
            const string logoUrl = "https://propertypeace.io/images/logos/property-peace-dark.png";
            var logoHtml = $"<div style='margin-bottom: 16px;'><img src='{logoUrl}' alt='Property Peace' style='max-width: 180px; height: auto; display: block;' /></div>";

            // No divider before signature; minimal top margin only
            return "<div style='margin-top: 24px;'>"
                + logoHtml
                + "<p style='margin: 4px 0; color: #4a4a4a;'>Best regards,</p>"
                + "<p style='margin: 4px 0; font-weight: 600; color: #1976d2;'>The Property Peace Team</p>"
                + "</div>";
        }

        /// <summary>
        /// Send a broadcast email to all users or to selected user IDs (admin only).
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> SendBroadcastEmail([FromBody] AdminBroadcastEmailRequestDto request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.Subject) || string.IsNullOrWhiteSpace(request.Body))
            {
                return BadRequest(new { success = false, message = "Subject and body are required." });
            }

            try
            {
                var usersResponse = await _userService.GetAllUsers(includeDeleted: false);
                if (!usersResponse.Success || usersResponse.Data == null)
                {
                    return StatusCode(500, new { success = false, message = "Failed to load users." });
                }

                var users = usersResponse.Data;

                if (request.UserIds != null && request.UserIds.Count > 0)
                {
                    var idSet = request.UserIds.ToHashSet();
                    users = users.Where(u => idSet.Contains(u.Id)).ToList();
                }

                var recipients = users
                    .Where(u => !string.IsNullOrWhiteSpace(u.Email))
                    .Select(u => new { Email = u.Email!.Trim(), FirstName = u.Firstname ?? "", LastName = u.Lastname ?? "" })
                    .DistinctBy(r => r.Email, StringComparer.OrdinalIgnoreCase)
                    .ToList();

                if (recipients.Count == 0)
                {
                    return Ok(new
                    {
                        success = true,
                        message = "No recipients with email addresses found.",
                        sentCount = 0
                    });
                }

                var subjectBase = request.Subject.Trim();
                var bodyBase = request.Body;
                var htmlBase = bodyBase.TrimStart().StartsWith("<", StringComparison.Ordinal)
                    ? bodyBase
                    : "<div style=\"font-family: sans-serif; white-space: pre-wrap;\">" + WebUtility.HtmlEncode(bodyBase) + "</div>";
                var plainBase = bodyBase;
                var signatureHtml = GetPropertyPeaceSignatureHtml();

                int sentCount = 0;
                foreach (var r in recipients)
                {
                    var firstName = string.IsNullOrWhiteSpace(r.FirstName) ? "there" : r.FirstName.Trim();
                    var lastName = (r.LastName ?? "").Trim();
                    var subject = subjectBase.Replace("{{FirstName}}", firstName).Replace("{{LastName}}", lastName);
                    var htmlContent = htmlBase.Replace("{{FirstName}}", WebUtility.HtmlEncode(firstName)).Replace("{{LastName}}", WebUtility.HtmlEncode(lastName)) + signatureHtml;
                    var plainText = plainBase.Replace("{{FirstName}}", firstName).Replace("{{LastName}}", lastName) + SignaturePlainText;

                    var sent = await _emailService.SendEmailAsync(r.Email, subject, htmlContent, plainText);
                    if (sent) sentCount++;
                }

                _logger.LogInformation("Admin broadcast email sent to {SentCount}/{Total} recipients. Subject: {Subject}", sentCount, recipients.Count, request.Subject);

                if (sentCount == 0)
                {
                    return Ok(new
                    {
                        success = false,
                        message = "Email could not be delivered to any recipient. Please check your email service configuration (Azure Communication Services connection and sender address).",
                        sentCount = 0
                    });
                }

                return Ok(new { success = true, message = $"Email sent to {sentCount} recipient(s).", sentCount });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending admin broadcast email");
                return StatusCode(500, new { success = false, message = "An error occurred while sending the email." });
            }
        }

        /// <summary>
        /// Use AI to improve the subject and body of a broadcast message (admin only).
        /// </summary>
        [HttpPost("improve-message")]
        public async Task<IActionResult> ImproveMessage([FromBody] AdminImproveMessageRequestDto request)
        {
            if (request == null)
            {
                return BadRequest(new { success = false, message = "Request body is required." });
            }

            var prompt = "You are a helpful assistant that improves announcement and warning messages for a property management app. " +
                "Make the text clear, professional, and appropriate for all users (landlords and tenants). Keep the same intent and key information. " +
                "IMPORTANT: Change the greeting so it uses the placeholder {{FirstName}} (exactly that text, with double curly braces). " +
                "For example, if the user wrote 'Hello,' or 'Hi,' change it to 'Hello {{FirstName}},' or 'Hi {{FirstName}},' so each recipient will see their own first name (e.g. 'Hello John,'). " +
                "Use {{FirstName}} in the opening greeting so the email does not look like a mass email. " +
                "Return a JSON object with exactly two keys: \"Subject\" (string) and \"Body\" (string). " +
                "Current subject: " + (string.IsNullOrWhiteSpace(request.Subject) ? "(none)" : request.Subject.Trim()) + "\n\n" +
                "Current body: " + (string.IsNullOrWhiteSpace(request.Body) ? "(none)" : request.Body.Trim()) + "\n\n" +
                "Return only valid JSON with keys Subject and Body.";

            try
            {
                var response = await _openAIService.GenerateJsonAsync<AdminImproveMessageResponseDto>(prompt, maxTokens: 1500);
                if (!response.Success || response.Data == null)
                {
                    return StatusCode(500, new
                    {
                        success = false,
                        message = response.Message ?? "Failed to improve message.",
                        subject = request.Subject ?? "",
                        body = request.Body ?? ""
                    });
                }

                return Ok(new
                {
                    success = true,
                    subject = response.Data.Subject ?? request.Subject ?? "",
                    body = response.Data.Body ?? request.Body ?? ""
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error improving broadcast message with AI");
                return StatusCode(500, new
                {
                    success = false,
                    message = "An error occurred while improving the message.",
                    subject = request.Subject ?? "",
                    body = request.Body ?? ""
                });
            }
        }
    }
}
