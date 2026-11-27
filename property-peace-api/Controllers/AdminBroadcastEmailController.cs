using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using brownstone_hub_api.Dtos.Admin;
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
        private readonly MarketingEmailUnsubscribeService _marketingUnsubscribe;
        private readonly ILogger<AdminBroadcastEmailController> _logger;

        public AdminBroadcastEmailController(
            IUserService userService,
            IEmailService emailService,
            IOpenAIService openAIService,
            MarketingEmailUnsubscribeService marketingUnsubscribe,
            ILogger<AdminBroadcastEmailController> logger)
        {
            _userService = userService;
            _emailService = emailService;
            _openAIService = openAIService;
            _marketingUnsubscribe = marketingUnsubscribe;
            _logger = logger;
        }

        private const string SignaturePlainText = "\n\nBest regards,\n\nThe Property Peace Team";

        private string GetPropertyPeaceSignatureHtml()
        {
            const string logoUrl = "https://propertypeace.io/images/logos/property-peace-dark.png";
            var logoHtml = $"<div style='margin-bottom: 16px;'><img src='{logoUrl}' alt='Property Peace' style='max-width: 180px; height: auto; display: block;' /></div>";

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
        public async Task<IActionResult> SendBroadcastEmail(
            [FromBody] AdminBroadcastEmailRequestDto request, CancellationToken cancellationToken = default)
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
                    .Select(u => new { u.Id, Email = u.Email!.Trim(), FirstName = u.Firstname ?? "", LastName = u.Lastname ?? "" })
                    .DistinctBy(r => r.Email, StringComparer.OrdinalIgnoreCase)
                    .ToList();

                var subjectBase = request.Subject.Trim();
                var bodyBase = request.Body;
                var htmlBase = bodyBase.TrimStart().StartsWith("<", StringComparison.Ordinal)
                    ? bodyBase
                    : "<div style=\"font-family: sans-serif; white-space: pre-wrap;\">" + WebUtility.HtmlEncode(bodyBase) + "</div>";
                var plainBase = bodyBase;
                var signatureHtml = GetPropertyPeaceSignatureHtml();

                var submittedUserIds = new List<long>();
                int skippedUnsubscribedCount = 0;
                foreach (var r in recipients)
                {
                    cancellationToken.ThrowIfCancellationRequested();
                    if (request.IsMarketing && await _marketingUnsubscribe.IsUnsubscribedAsync(r.Email, cancellationToken))
                    {
                        skippedUnsubscribedCount++;
                        continue;
                    }

                    var firstName = string.IsNullOrWhiteSpace(r.FirstName) ? "there" : r.FirstName.Trim();
                    var lastName = (r.LastName ?? "").Trim();
                    var subject = subjectBase.Replace("{{FirstName}}", firstName).Replace("{{LastName}}", lastName);
                    var htmlContent = htmlBase.Replace("{{FirstName}}", WebUtility.HtmlEncode(firstName)).Replace("{{LastName}}", WebUtility.HtmlEncode(lastName));
                    var plainText = plainBase.Replace("{{FirstName}}", firstName).Replace("{{LastName}}", lastName) + SignaturePlainText;
                    var footer = signatureHtml;
                    if (request.IsMarketing)
                    {
                        var unsubscribeUrl = _marketingUnsubscribe.BuildUnsubscribeUrl(r.Email, HttpContext?.Request.Host.Host);
                        footer += "<div style='margin-top: 24px; padding: 20px; background-color: #102C29; text-align: center;'>"
                            + $"<a href='{WebUtility.HtmlEncode(unsubscribeUrl)}' style='color: #ffffff; text-decoration: underline;'>Unsubscribe from marketing emails</a>"
                            + "</div>";
                        plainText += $"\n\nUnsubscribe from marketing emails: {unsubscribeUrl}";
                    }

                    var bodyEnd = htmlContent.LastIndexOf("</body>", StringComparison.OrdinalIgnoreCase);
                    htmlContent = bodyEnd >= 0 ? htmlContent.Insert(bodyEnd, footer) : htmlContent + footer;

                    if (await _emailService.SendEmailAsync(r.Email, subject, htmlContent, plainText, cancellationToken))
                    {
                        submittedUserIds.Add(r.Id);
                    }
                }

                var sentCount = submittedUserIds.Count;
                var attemptedCount = recipients.Count - skippedUnsubscribedCount;
                _logger.LogInformation(
                    "Admin broadcast email submitted to {SentCount}/{AttemptedCount} attempted recipients; {SkippedCount} unsubscribed",
                    sentCount, attemptedCount, skippedUnsubscribedCount);

                var success = sentCount > 0 || attemptedCount == 0;
                var message = recipients.Count == 0
                    ? "No recipients with email addresses found."
                    : attemptedCount == 0
                        ? "Everyone in the selected audience has unsubscribed from marketing emails."
                        : sentCount == 0
                            ? "Email could not be submitted for any eligible recipient. Check the email service configuration."
                            : $"Email submitted for {sentCount} of {attemptedCount} eligible recipient(s).";
                if (skippedUnsubscribedCount > 0 && attemptedCount > 0)
                {
                    message += $" Skipped {skippedUnsubscribedCount} unsubscribed address(es).";
                }

                return Ok(new { success, message, sentCount, skippedUnsubscribedCount, submittedUserIds });
            }
            catch (Exception ex) when (ex is not OperationCanceledException || !cancellationToken.IsCancellationRequested)
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
