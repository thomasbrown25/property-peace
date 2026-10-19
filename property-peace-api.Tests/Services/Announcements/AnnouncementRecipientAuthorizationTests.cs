using brownstone_hub_api.Config;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Announcement;
using brownstone_hub_api.Dtos.User;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Conversations;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.AnnouncementService;
using brownstone_hub_api.Services.EmailService;
using brownstone_hub_api.Services.MessageService;
using brownstone_hub_api.Services.NotificationService;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Announcements;

public sealed class AnnouncementRecipientAuthorizationTests
{
    [Theory]
    [InlineData(false, true)]
    [InlineData(true, false)]
    public async Task Selected_foreign_target_does_not_expand_send_beyond_preview(bool propertyTarget, bool unitTarget)
    {
        using var fixture = new Fixture();
        var propertyIds = propertyTarget ? new List<long> { 101, 201 } : null;
        var unitIds = unitTarget ? new List<long> { 1001, 2001 } : null;
        var preview = await fixture.Service.PreviewRecipientsAsync(new PreviewAnnouncementRecipientsDto
        {
            OrganizationIds = [10], PropertyIds = propertyIds, UnitIds = unitIds
        });
        Assert.True(preview.Success);
        Assert.Equal([101L], preview.Data!.Select(x => x.UserId).ToArray());

        var send = await fixture.Service.SendAnnouncementAsync(new SendAnnouncementDto
        {
            OrganizationIds = [10], PropertyIds = propertyIds, UnitIds = unitIds,
            Message = "Notice", ScheduledAt = DateTime.UtcNow.AddDays(1)
        });
        Assert.True(send.Success);
        Assert.Equal(preview.Data.Count, send.Data!.SentCount);
    }

    [Fact]
    public async Task Foreign_organization_is_forbidden_without_persisting_even_if_first_organization_is_accessible()
    {
        using var fixture = new Fixture();
        var send = await fixture.Service.SendAnnouncementAsync(new SendAnnouncementDto
        {
            OrganizationIds = [10, 20], Message = "Notice", ScheduledAt = DateTime.UtcNow.AddDays(1)
        });
        Assert.Equal(403, send.StatusCode);
        Assert.False(send.Success);
        Assert.Empty(fixture.Context.Announcements);
    }

    [Fact]
    public async Task All_audience_defaults_to_current_organization_and_matches_preview()
    {
        using var fixture = new Fixture();
        var preview = await fixture.Service.PreviewRecipientsAsync(new PreviewAnnouncementRecipientsDto());
        var send = await fixture.Service.SendAnnouncementAsync(new SendAnnouncementDto
        {
            Message = "Notice", ScheduledAt = DateTime.UtcNow.AddDays(1)
        });
        Assert.True(preview.Success);
        Assert.Equal([101L], preview.Data!.Select(x => x.UserId).ToArray());
        Assert.True(send.Success);
        Assert.Equal(preview.Data.Count, send.Data!.SentCount);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Foreign_only_target_never_falls_back_to_all_properties(bool propertyTarget)
    {
        using var fixture = new Fixture();
        var send = await fixture.Service.SendAnnouncementAsync(new SendAnnouncementDto
        {
            OrganizationIds = [10], PropertyIds = propertyTarget ? [201] : null,
            UnitIds = propertyTarget ? null : [2001], Message = "Notice",
            ScheduledAt = DateTime.UtcNow.AddDays(1)
        });
        Assert.True(send.Success);
        Assert.Equal(0, send.Data!.SentCount);
    }

    [Fact]
    public async Task Scheduled_delivery_rechecks_scope_against_preview_and_does_not_email_foreign_tenant()
    {
        using var fixture = new Fixture();
        var send = await fixture.Service.SendAnnouncementAsync(new SendAnnouncementDto
        {
            OrganizationIds = [10], PropertyIds = [101, 201], UnitIds = [1001, 2001],
            Message = "Notice", SendEmail = true, SendNotification = false,
            ScheduledAt = DateTime.UtcNow.AddDays(1)
        });
        Assert.True(send.Success);
        Assert.Equal(1, send.Data!.SentCount);
        var announcement = Assert.Single(fixture.Context.Announcements);
        announcement.ScheduledAt = DateTime.UtcNow.AddSeconds(-1);
        await fixture.Context.SaveChangesAsync();
        Assert.True(await fixture.Service.SendScheduledAnnouncementAsync(announcement.Id));
        fixture.Email.Verify(x => x.SendBulkEmailAsync(
            It.Is<List<string>>(recipients => recipients.Count == 1 && recipients.Contains("local@example.test")),
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Once);
        Assert.Equal([101L], fixture.Context.AnnouncementRecipients.Select(x => x.TenantId).ToArray());
    }

    [Fact]
    public async Task Deleted_property_unit_does_not_target_a_recipient()
    {
        using var fixture = new Fixture();
        var property = fixture.Context.Properties.Single(x => x.Id == 101);
        property.IsDeleted = true;
        await fixture.Context.SaveChangesAsync();
        var preview = await fixture.Service.PreviewRecipientsAsync(new PreviewAnnouncementRecipientsDto { UnitIds = [1001] });
        var send = await fixture.Service.SendAnnouncementAsync(new SendAnnouncementDto
        {
            UnitIds = [1001], Message = "Notice", ScheduledAt = DateTime.UtcNow.AddDays(1)
        });
        Assert.True(preview.Success);
        Assert.Empty(preview.Data!);
        Assert.True(send.Success);
        Assert.Equal(0, send.Data!.SentCount);
    }

    [Fact]
    public async Task Immediate_email_delivery_uses_only_previewed_recipients()
    {
        using var fixture = new Fixture();
        var send = await fixture.Service.SendAnnouncementAsync(new SendAnnouncementDto
        {
            OrganizationIds = [10], PropertyIds = [101, 201], UnitIds = [1001, 2001],
            Message = "Notice", SendEmail = true, SendNotification = false
        });
        Assert.True(send.Success);
        fixture.Email.Verify(x => x.SendBulkEmailAsync(
            It.Is<List<string>>(recipients => recipients.Count == 1 && recipients.Contains("local@example.test")),
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Once);
        Assert.Equal([101L], fixture.Context.AnnouncementRecipients.Select(x => x.TenantId).ToArray());
    }

    [Fact]
    public async Task Scheduled_delivery_stops_when_organization_membership_is_revoked()
    {
        using var fixture = new Fixture();
        var send = await fixture.Service.SendAnnouncementAsync(new SendAnnouncementDto
        {
            OrganizationIds = [10], Message = "Notice", SendEmail = true, SendNotification = false,
            ScheduledAt = DateTime.UtcNow.AddDays(1)
        });
        var announcement = Assert.Single(fixture.Context.Announcements);
        announcement.ScheduledAt = DateTime.UtcNow.AddSeconds(-1);
        fixture.Context.OrganizationMembers.Single().IsActive = false;
        await fixture.Context.SaveChangesAsync();
        Assert.True(send.Success);
        Assert.False(await fixture.Service.SendScheduledAnnouncementAsync(announcement.Id));
        fixture.Email.Verify(x => x.SendBulkEmailAsync(It.IsAny<List<string>>(),
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        Assert.Empty(fixture.Context.AnnouncementRecipients);
    }

    [Theory]
    [InlineData("Viewer", false)]
    [InlineData("Unknown", false)]
    [InlineData("Manager", true)]
    [InlineData("Owner", true)]
    public async Task Send_and_preview_require_an_active_organization_management_role(string role, bool allowed)
    {
        using var fixture = new Fixture();
        fixture.Context.OrganizationMembers.Single().Role = role;
        // Legacy owner metadata and a global Landlord claim must not elevate a Viewer.
        fixture.Context.Organizations.Single(x => x.Id == 10).OwnerId = 1;
        await fixture.Context.SaveChangesAsync();
        var preview = await fixture.Service.PreviewRecipientsAsync(new PreviewAnnouncementRecipientsDto { OrganizationIds = [10] });
        var send = await fixture.Service.SendAnnouncementAsync(new SendAnnouncementDto
        { OrganizationIds = [10], Message = "Notice", ScheduledAt = DateTime.UtcNow.AddDays(1) });
        Assert.Equal(allowed, preview.Success);
        Assert.Equal(allowed, send.Success);
        if (!allowed)
        {
            Assert.Equal(403, preview.StatusCode);
            Assert.Equal(403, send.StatusCode);
            Assert.Empty(fixture.Context.Announcements);
        }
    }

    [Fact]
    public async Task Multiple_organizations_are_authorized_individually_for_send_and_preview()
    {
        using var fixture = new Fixture();
        fixture.Context.OrganizationMembers.Add(new OrganizationMember
        { Id = 2, OrganizationId = 20, UserId = 1, IsActive = true, Role = "Viewer" });
        await fixture.Context.SaveChangesAsync();
        var preview = await fixture.Service.PreviewRecipientsAsync(new PreviewAnnouncementRecipientsDto { OrganizationIds = [10, 20] });
        var send = await fixture.Service.SendAnnouncementAsync(new SendAnnouncementDto
        { OrganizationIds = [10, 20], Message = "Notice", ScheduledAt = DateTime.UtcNow.AddDays(1) });
        Assert.Equal(403, preview.StatusCode);
        Assert.Equal(403, send.StatusCode);
        Assert.Empty(fixture.Context.Announcements);
    }

    [Fact]
    public async Task Explicit_organization_filter_requires_access_even_when_current_org_is_valid()
    {
        using var fixture = new Fixture();
        fixture.Context.Announcements.Add(new Announcement
        { Id = 1, OrganizationId = 20, CreatedByUserId = 201, Title = "Private", Message = "Secret" });
        await fixture.Context.SaveChangesAsync();
        var forbidden = await fixture.Service.GetAnnouncementsAsync(null, null, organizationId: 20);
        Assert.Equal(403, forbidden.StatusCode);
        Assert.False(forbidden.Success);

        fixture.Context.OrganizationMembers.Add(new OrganizationMember
        { Id = 2, OrganizationId = 20, UserId = 1, IsActive = true, Role = "Viewer" });
        await fixture.Context.SaveChangesAsync();
        var allowed = await fixture.Service.GetAnnouncementsAsync(null, null, organizationId: 20);
        Assert.True(allowed.Success);
        Assert.Equal([1L], allowed.Data!.Select(a => a.Id).ToArray());
        fixture.Context.OrganizationMembers.Single(x => x.OrganizationId == 20).IsActive = false;
        await fixture.Context.SaveChangesAsync();
        Assert.Equal(403, (await fixture.Service.GetAnnouncementsAsync(null, null, organizationId: 20)).StatusCode);
    }

    [Theory]
    [InlineData(false, true)]
    [InlineData(true, false)]
    public async Task Inactive_or_deleted_organization_cannot_be_selected_or_listed(bool deleted, bool inactive)
    {
        using var fixture = new Fixture();
        var organization = fixture.Context.Organizations.Single(x => x.Id == 10);
        organization.IsDeleted = deleted;
        organization.IsActive = !inactive;
        await fixture.Context.SaveChangesAsync();
        Assert.Equal(403, (await fixture.Service.PreviewRecipientsAsync(
            new PreviewAnnouncementRecipientsDto { OrganizationIds = [10] })).StatusCode);
        Assert.Equal(403, (await fixture.Service.SendAnnouncementAsync(new SendAnnouncementDto
        { OrganizationIds = [10], Message = "Notice", ScheduledAt = DateTime.UtcNow.AddDays(1) })).StatusCode);
        Assert.Equal(403, (await fixture.Service.GetAnnouncementsAsync(null, null, organizationId: 10)).StatusCode);
        Assert.Empty(fixture.Context.Announcements);
    }

    private sealed class Fixture : IDisposable
    {
        public DataContext Context { get; }
        public Mock<IEmailService> Email { get; } = new();
        public AnnouncementService Service { get; }

        public Fixture()
        {
            Context = new DataContext(new DbContextOptionsBuilder<DataContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
            var manager = new User { Id = 1, FirstName = "Manager" };
            Context.Users.AddRange(manager,
                new User { Id = 101, FirstName = "Local", Email = "local@example.test" },
                new User { Id = 201, FirstName = "Foreign", Email = "foreign@example.test" });
            Context.Organizations.AddRange(new Organization { Id = 10 }, new Organization { Id = 20 });
            Context.OrganizationMembers.Add(new OrganizationMember { Id = 1, OrganizationId = 10, UserId = 1, IsActive = true, Role = "Manager" });
            foreach (var (org, property, unit, tenantId) in new[] { (10L, 101L, 1001L, 101L), (20L, 201L, 2001L, 201L) })
            {
                var p = new Property { Id = property, OrganizationId = org, LandlordId = 1 };
                var u = new Unit { Id = unit, PropertyId = property, Property = p };
                var lease = new Lease { Id = unit, UnitId = unit, Unit = u, StartDate = DateTime.Today.AddDays(-1), IsActive = true };
                var tenant = new Tenant { Id = tenantId, UserId = tenantId, Firstname = "Tenant", Lastname = "Test" };
                lease.TenantLeases.Add(new TenantLease { TenantId = tenantId, Tenant = tenant, LeaseId = lease.Id, Lease = lease });
                u.Leases.Add(lease);
                p.Units.Add(u);
                Context.Properties.Add(p);
            }
            Context.SaveChanges();
            var users = new Mock<IUserRepository>();
            users.Setup(x => x.GetCurrentUser()).ReturnsAsync(new LoadUserDto { Id = 1, Firstname = "Manager" });
            var http = new DefaultHttpContext();
            http.Items["OrganizationId"] = 10L;
            Service = new AnnouncementService(
                Mock.Of<INotificationService>(), Email.Object, Mock.Of<IMessageService>(),
                Mock.Of<IConversationRepository>(), users.Object, Context,
                new HttpContextAccessor { HttpContext = http }, Options.Create(new AnthropicSettings()),
                NullLogger<AnnouncementService>.Instance);
        }

        public void Dispose() => Context.Dispose();
    }
}
