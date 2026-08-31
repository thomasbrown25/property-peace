using System.Net;
using brownstone_hub_api.Dtos.NotificationSetting;
using brownstone_hub_api.Dtos.Notification;
using brownstone_hub_api.Dtos.RentPaymentAccess;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.NotificationSettings;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.EmailService;
using brownstone_hub_api.Services.NotificationService;

namespace brownstone_hub_api.Services.RentPaymentAccess;

public sealed class RentPaymentAccessNotificationService(
    IUserRepository userRepository,
    INotificationSettingRepository notificationSettingRepository,
    IEmailService emailService,
    INotificationService notificationService,
    IConfiguration configuration,
    ILogger<RentPaymentAccessNotificationService> logger) : IRentPaymentAccessNotificationService
{
    private const string Subject = "Online rent collection request";
    private const string ButtonLabel = "Review rent-payment request";
    private readonly Uri _frontendBaseUri = NormalizeFrontendBaseUrl(configuration["FrontendBaseUrl"]);

    public async Task<RentPaymentAccessNotificationResult> NotifyReviewersAsync(
        RentPaymentAccessAdminDetailDto request,
        CancellationToken cancellationToken)
    {
        var attempted = 0;
        var accepted = 0;
        var failed = 0;
        var adminUsers = await userRepository.GetAdminUsersAsync();

        foreach (var admin in adminUsers)
        {
            try
            {
                var settings = await ResolveSettingsAsync(admin);

                if (settings.AdminNewUserNotifications.InApp &&
                    !await NotifyInAppAsync(admin, request, cancellationToken))
                {
                    failed++;
                }

                if (!settings.EmailEnabled ||
                    !settings.AdminNewUserNotifications.Email ||
                    string.IsNullOrWhiteSpace(settings.EmailAddress)) continue;

                attempted++;
                var message = BuildMessage(request);
                var result = await emailService.SubmitEmailAsync(
                    settings.EmailAddress,
                    Subject,
                    message.Html,
                    message.Text,
                    cancellationToken: cancellationToken,
                    idempotencyToken: $"rent-payment-access:{request.PublicId}:pending:{request.RequestedAtUtc.Ticks}");
                if (result.Accepted) accepted++;
                else failed++;
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception exception)
            {
                failed++;
                logger.LogWarning(exception,
                    "Rent-payment access notification delivery failed for admin {AdminId} and request {PublicId}",
                    admin.Id,
                    request.PublicId);
            }
        }

        return new RentPaymentAccessNotificationResult(attempted, accepted, failed);
    }

    private async Task<bool> NotifyInAppAsync(
        User admin,
        RentPaymentAccessAdminDetailDto request,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await notificationService.CreateNotification(new CreateNotificationDto
            {
                UserId = admin.Id,
                OrganizationId = request.OrganizationId,
                Type = ENotificationType.RentPaymentAccessRequest,
                Title = Subject,
                Message = $"{request.OrganizationName} requested access to online rent collection.",
                SendEmail = false,
                SendSMS = false,
                SendInApp = true,
                PerformedByUserId = request.RequestedByUserId,
                PerformedByName = request.RequestedBy
            });

            if (result.Success) return true;

            logger.LogWarning(
                "In-app rent-payment access notification failed for admin {AdminId} and request {PublicId}: {Message}",
                admin.Id,
                request.PublicId,
                result.Message);
            return false;
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception exception)
        {
            logger.LogWarning(exception,
                "In-app rent-payment access notification failed for admin {AdminId} and request {PublicId}",
                admin.Id,
                request.PublicId);
            return false;
        }
    }

    private async Task<NotificationSettingDto> ResolveSettingsAsync(User admin)
    {
        var settings = await notificationSettingRepository.GetNotificationSettings(admin.Id);
        if (settings is null)
        {
            settings = await notificationSettingRepository.AddNotificationSettings(admin.Id);
        }

        if (string.IsNullOrWhiteSpace(settings.EmailAddress) && !string.IsNullOrWhiteSpace(admin.Email))
        {
            settings.EmailAddress = admin.Email;
            await notificationSettingRepository.UpdateNotificationSettings(settings);
        }

        return settings;
    }

    private Message BuildMessage(RentPaymentAccessAdminDetailDto request)
    {
        var routeValue = Uri.EscapeDataString(request.PublicId.ToString());
        var reviewUrl = new Uri(_frontendBaseUri, $"admin/rent-payment-access/{routeValue}").AbsoluteUri;
        var encodedOrganization = WebUtility.HtmlEncode(request.OrganizationName);
        var encodedRequester = WebUtility.HtmlEncode(request.RequestedBy);
        var encodedRequestedAt = WebUtility.HtmlEncode(FormatUtc(request.RequestedAtUtc));
        var encodedReviewUrl = WebUtility.HtmlEncode(reviewUrl);
        var html = $"<h2>{Subject}</h2>" +
                   $"<p><strong>Organization:</strong> {encodedOrganization}</p>" +
                   $"<p><strong>Requested by:</strong> {encodedRequester}</p>" +
                   $"<p><strong>Requested at:</strong> {encodedRequestedAt}</p>" +
                   $"<p><a href=\"{encodedReviewUrl}\">{ButtonLabel}</a></p>";
        var text = $"{Subject}\n\n" +
                   $"Organization: {request.OrganizationName}\n" +
                   $"Requested by: {request.RequestedBy}\n" +
                   $"Requested at: {FormatUtc(request.RequestedAtUtc)}\n\n" +
                   $"{ButtonLabel}\n{reviewUrl}";
        return new Message(html, text);
    }

    private static Uri NormalizeFrontendBaseUrl(string? configuredValue)
    {
        var value = configuredValue?.Trim();
        if (string.IsNullOrWhiteSpace(value) ||
            !Uri.TryCreate(value, UriKind.Absolute, out var uri) ||
            (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps) ||
            value.IndexOfAny(['?', '#']) >= 0)
        {
            throw new InvalidOperationException(
                "FrontendBaseUrl must be an absolute HTTP(S) URI without a query string or fragment.");
        }

        var normalizedPath = uri.AbsolutePath.TrimEnd('/') + "/";
        return new UriBuilder(uri)
        {
            Path = normalizedPath,
            Query = string.Empty,
            Fragment = string.Empty
        }.Uri;
    }

    private static string FormatUtc(DateTime value) =>
        $"{DateTime.SpecifyKind(value, DateTimeKind.Utc):yyyy-MM-dd HH:mm:ss} UTC";

    private sealed record Message(string Html, string Text);
}
