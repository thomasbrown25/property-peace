using brownstone_hub_api.Data;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.DailySummaryEmailService;
using brownstone_hub_api.Services.EmailService;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.DailySummary;

public sealed class DailySummaryEmailServiceTests
{
    [Fact]
    public async Task ImmediateSummary_IncludesOnlyOpenTasksOccurringToday()
    {
        await using var context = CreateContext();
        var today = GetEasternToday();
        var user = new User { Id = 1, FirstName = "Thomas", Email = "tbrown@brownstonehub.com" };
        var organization = new Organization { Id = 10, Name = "Test Portfolio", OwnerId = user.Id };
        context.AddRange(
            user,
            organization,
            new NotificationSetting
            {
                UserId = user.Id,
                EmailAddress = user.Email,
                EmailEnabled = true,
                DailySummaryEmail = true,
                DailySummaryUnsubscribeToken = "token"
            },
            new LandlordTask
            {
                Id = 100,
                OrganizationId = organization.Id,
                Title = "Call the plumber",
                DueDate = today.AddHours(9),
                Status = ETaskStatus.Open
            },
            new LandlordTask
            {
                Id = 101,
                OrganizationId = organization.Id,
                Title = "Completed task should not appear",
                DueDate = today.AddHours(10),
                Status = ETaskStatus.Done
            },
            new LandlordTask
            {
                Id = 102,
                OrganizationId = organization.Id,
                Title = "Tomorrow task should not appear",
                DueDate = today.AddDays(1).AddHours(9),
                Status = ETaskStatus.Open
            },
            new LandlordTask
            {
                Id = 103,
                OrganizationId = organization.Id,
                Title = "Daily recurring reminder",
                DueDate = today.AddDays(-2).AddHours(8),
                Status = ETaskStatus.Open,
                IsRecurring = true,
                RecurrenceType = ERecurrenceType.Daily,
                RecurrenceInterval = 1
            });
        await context.SaveChangesAsync();

        string? capturedHtml = null;
        string? capturedText = null;
        var email = new Mock<IEmailService>();
        email.Setup(service => service.SendEmailAsync(
                user.Email,
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<string?>(),
                It.IsAny<CancellationToken>()))
            .Callback<string, string, string, string?, CancellationToken>((_, _, html, text, _) =>
            {
                capturedHtml = html;
                capturedText = text;
            })
            .ReturnsAsync(true);

        var service = CreateService(context, email.Object);
        await service.RunImmediateDailySummariesAsync();

        capturedHtml.Should().Contain("Today’s tasks &amp; reminders");
        capturedHtml.Should().Contain("Call the plumber");
        capturedHtml.Should().Contain("Daily recurring reminder");
        capturedHtml.Should().NotContain("Completed task should not appear");
        capturedHtml.Should().NotContain("Tomorrow task should not appear");
        capturedText.Should().Contain("Today's tasks & reminders:");
        capturedText.Should().Contain("Call the plumber");
    }

    [Fact]
    public async Task ImmediateSummary_IncludesNonTaskCalendarItemsScheduledToday()
    {
        await using var context = CreateContext();
        var today = GetEasternToday();
        var user = new User { Id = 1, FirstName = "Thomas", Email = "tbrown@brownstonehub.com" };
        var organization = new Organization { Id = 10, Name = "Test Portfolio", OwnerId = user.Id };
        var property = new Property
        {
            Id = 20,
            Name = "Oak House",
            StreetAddress = "1 Oak St",
            LandlordId = user.Id,
            Landlord = user,
            OrganizationId = organization.Id
        };
        context.AddRange(
            user,
            organization,
            property,
            new NotificationSetting
            {
                UserId = user.Id,
                EmailAddress = user.Email,
                EmailEnabled = true,
                DailySummaryEmail = true,
                DailySummaryUnsubscribeToken = "token"
            },
            new MaintenanceRequest
            {
                Id = 200,
                PropertyId = property.Id,
                Property = property,
                OrganizationId = organization.Id,
                Title = "HVAC appointment",
                ScheduledDate = today.AddHours(13),
                Status = EMaintenanceStatus.Scheduled
            },
            new Checklist
            {
                Id = 300,
                PropertyId = property.Id,
                Property = property,
                LandlordId = user.Id,
                Landlord = user,
                OrganizationId = organization.Id,
                Title = "Move-in checklist",
                InspectionDate = today.AddHours(15),
                ChecklistType = ETenantDocumentType.MoveInChecklist
            });
        await context.SaveChangesAsync();

        string? capturedHtml = null;
        string? capturedText = null;
        var email = new Mock<IEmailService>();
        email.Setup(service => service.SendEmailAsync(
                user.Email,
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<string?>(),
                It.IsAny<CancellationToken>()))
            .Callback<string, string, string, string?, CancellationToken>((_, _, html, text, _) =>
            {
                capturedHtml = html;
                capturedText = text;
            })
            .ReturnsAsync(true);

        var service = CreateService(context, email.Object);
        await service.RunImmediateDailySummariesAsync();

        capturedHtml.Should().Contain("Today’s calendar");
        capturedHtml.Should().Contain("HVAC appointment");
        capturedHtml.Should().Contain("Move-in checklist");
        capturedHtml.Should().Contain("1:00 PM");
        capturedText.Should().Contain("Today's calendar:");
        capturedText.Should().Contain("HVAC appointment");
    }

    private static DataContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<DataContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;
        return new DataContext(options);
    }

    private static DailySummaryEmailService CreateService(DataContext context, IEmailService emailService)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["DailySummaryEmail:AllowedRecipients"] = "tbrown@brownstonehub.com",
                ["FrontendBaseUrl"] = "https://propertypeace.io"
            })
            .Build();
        return new DailySummaryEmailService(
            context,
            emailService,
            configuration,
            NullLogger<DailySummaryEmailService>.Instance);
    }

    private static DateTime GetEasternToday()
    {
        TimeZoneInfo eastern;
        try
        {
            eastern = TimeZoneInfo.FindSystemTimeZoneById("America/New_York");
        }
        catch (TimeZoneNotFoundException)
        {
            eastern = TimeZoneInfo.FindSystemTimeZoneById("Eastern Standard Time");
        }

        return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, eastern).Date;
    }
}
