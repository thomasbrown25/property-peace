using brownstone_hub_api.Controllers;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Leads;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.Leads;
using FluentAssertions;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Leads;

public sealed class PublicLeadAuthorityAndListingPrivacyTests
{
    [Fact]
    public async Task Valid_browser_verification_session_books_exact_resolved_lead_without_management_token()
    {
        await using var db = Db(nameof(Valid_browser_verification_session_books_exact_resolved_lead_without_management_token));
        Seed(db);
        AddSlots(db);
        await db.SaveChangesAsync();
        var delivery = new FakeLeadTokenDelivery();
        var service = Service(db, delivery);
        var sessions = Sessions();
        var controller = Controller(service, sessions);
        await service.SubmitInquiryAsync(10, Inquiry("Ada", "ada@example.com", "ada"), "ip", default);
        await service.SubmitInquiryAsync(10, Inquiry("Grace", "grace@example.com", "grace"), "ip", default);
        var ada = db.Leads.Single(x => x.NormalizedEmail == "ada@example.com");
        var grace = db.Leads.Single(x => x.NormalizedEmail == "grace@example.com");

        var verificationResponse = await controller.Verify(10,
            new(delivery.TokenFor(ada.Id, LeadTokenPurpose.ContactVerification)), default);
        var verification = ((OkObjectResult)verificationResponse).Value.Should()
            .BeOfType<PublicVerificationResult>().Subject;
        verification.Session.Should().NotBe(ada.Id.ToString());

        var response = await controller.BrowserBook(10,
            new(7, "UTC", "browser-book", verification.Session), default);

        response.Should().BeOfType<OkObjectResult>();
        db.Showings.Should().ContainSingle(x => x.LeadId == ada.Id && x.ListingId == 10);
        db.Showings.Should().NotContain(x => x.LeadId == grace.Id);
        typeof(BrowserBookShowingRequest).GetProperties().Select(x => x.Name)
            .Should().NotContain(new[] { "LeadId", "AccessToken", "ManagementToken" });
    }

    [Fact]
    public async Task Invalid_decoy_expired_and_wrong_listing_sessions_have_identical_safe_failure_and_never_book()
    {
        await using var db = Db(nameof(Invalid_decoy_expired_and_wrong_listing_sessions_have_identical_safe_failure_and_never_book));
        Seed(db);
        AddSlots(db);
        await db.SaveChangesAsync();
        var delivery = new FakeLeadTokenDelivery();
        var service = Service(db, delivery);
        await service.SubmitInquiryAsync(10, Inquiry("Ada", "ada@example.com", "ada"), "ip", default);
        var lead = db.Leads.Single();
        await service.VerifyContactAsync(delivery.TokenFor(lead.Id, LeadTokenPurpose.ContactVerification), "ip", default, 10);
        var clock = new MutableTimeProvider(DateTimeOffset.Parse("2030-01-01T00:00:00Z"));
        var sessions = Sessions(clock);
        var validThenExpired = sessions.Issue(10, lead.Id);
        var decoy = sessions.Issue(10, null);
        var wrongListing = sessions.Issue(11, lead.Id);
        clock.Advance(TimeSpan.FromMinutes(16));
        var controller = Controller(service, sessions);

        var responses = new[]
        {
            await controller.BrowserBook(10, new(7, "UTC", "invalid", "not-a-session"), default),
            await controller.BrowserBook(10, new(7, "UTC", "decoy", decoy), default),
            await controller.BrowserBook(10, new(7, "UTC", "expired", validThenExpired), default),
            await controller.BrowserBook(10, new(7, "UTC", "wrong-listing", wrongListing), default)
        };

        responses.Should().OnlyContain(x => x is NotFoundObjectResult);
        responses.Cast<NotFoundObjectResult>().Select(x => ((ProblemDetails)x.Value!).Title)
            .Should().OnlyContain(x => x == "Request could not be processed.");
        db.Showings.Should().BeEmpty();
    }

    [Fact]
    public async Task Showing_management_authenticates_with_reference_and_code_then_uses_scoped_session_and_concurrency()
    {
        await using var db = Db(nameof(Showing_management_authenticates_with_reference_and_code_then_uses_scoped_session_and_concurrency));
        Seed(db);
        AddSlots(db);
        await db.SaveChangesAsync();
        var delivery = new FakeLeadTokenDelivery();
        var service = Service(db, delivery);
        var sessions = Sessions();
        var controller = Controller(service, sessions);
        await service.SubmitInquiryAsync(10, Inquiry("Ada", "ada@example.com", "ada"), "ip", default);
        var lead = db.Leads.Single();
        await service.VerifyContactAsync(delivery.TokenFor(lead.Id, LeadTokenPurpose.ContactVerification),
            "ip", default, 10);
        var code = delivery.TokenFor(lead.Id, LeadTokenPurpose.PublicManagement);
        var booked = await service.BookShowingAsync(lead.Id, new(7, "UTC", "initial", code),
            0, "ip", default, 10);

        var managedResponse = await controller.Manage(10, booked.ShowingId, new(code), default);
        var managed = ((OkObjectResult)managedResponse).Value.Should().BeOfType<ManageShowingResult>().Subject;
        managed.Showing.StartsAtUtc.Should().Be(new DateTime(2035, 1, 1, 15, 0, 0, DateTimeKind.Utc));
        managed.Session.Should().NotContain(code);

        var badCode = await controller.Manage(10, booked.ShowingId, new("wrong-code"), default);
        var badReference = await controller.Manage(10, booked.ShowingId + 999, new(code), default);
        badCode.Should().BeOfType<NotFoundObjectResult>();
        badReference.Should().BeOfType<NotFoundObjectResult>();
        ((ProblemDetails)((NotFoundObjectResult)badCode).Value!).Title.Should().Be(
            ((ProblemDetails)((NotFoundObjectResult)badReference).Value!).Title);

        var invalidConcurrency = await controller.Reschedule(10, booked.ShowingId,
            new(8, "UTC", "invalid-concurrency", managed.Session, "not-base64"), default);
        invalidConcurrency.Should().BeOfType<BadRequestObjectResult>();
        db.Showings.Single().AvailabilityId.Should().Be(7);
        // Public controller calls execute in separate request scopes in production. Clear the shared
        // in-memory test context so a rejected request cannot leave tracked state for the next request.
        db.ChangeTracker.Clear();

        var rescheduledResponse = await controller.Reschedule(10, booked.ShowingId,
            new(8, "UTC", "reschedule", managed.Session, managed.Showing.ConcurrencyToken), default);
        var rescheduled = ((OkObjectResult)rescheduledResponse).Value.Should().BeOfType<ShowingDto>().Subject;
        rescheduled.AvailabilityId.Should().Be(8);

        var cancelled = await controller.Cancel(10, booked.ShowingId,
            new(managed.Session, rescheduled.ConcurrencyToken), default);
        cancelled.Should().BeOfType<NoContentResult>();
        db.Showings.Single().Status.Should().Be(ShowingStatus.Cancelled);
    }

    [Fact]
    public async Task Every_anonymous_surface_treats_inactive_listing_as_not_found_including_management_operations()
    {
        await using var db = Db(nameof(Every_anonymous_surface_treats_inactive_listing_as_not_found_including_management_operations));
        Seed(db);
        AddSlots(db);
        await db.SaveChangesAsync();
        var delivery = new FakeLeadTokenDelivery();
        var service = Service(db, delivery);
        var sessions = Sessions();
        await service.SubmitInquiryAsync(10, Inquiry("Ada", "ada@example.com", "ada"), "ip", default);
        await service.SubmitInquiryAsync(10, Inquiry("Grace", "grace@example.com", "grace"), "ip", default);
        var ada = db.Leads.Single(x => x.NormalizedEmail == "ada@example.com");
        var grace = db.Leads.Single(x => x.NormalizedEmail == "grace@example.com");
        await service.VerifyContactAsync(delivery.TokenFor(ada.Id, LeadTokenPurpose.ContactVerification), "ip", default, 10);
        var management = delivery.TokenFor(ada.Id, LeadTokenPurpose.PublicManagement);
        var browserAuthority = sessions.ResolveBookingAuthority(sessions.Issue(10, ada.Id), 10)!;
        var showing = await service.BookShowingAsync(ada.Id, new(7, "UTC", "initial", management),
            0, "ip", default, 10);
        db.Listings.Single().Status = EListingStatus.Draft;
        await db.SaveChangesAsync();
        var controller = Controller(service, sessions);

        await service.Invoking(x => x.GetPublicPreScreenAsync(10, default)).Should().ThrowAsync<LeadNotFoundException>();
        await service.Invoking(x => x.SubmitInquiryAsync(10, Inquiry("New", "new@example.com", "new"), "ip", default))
            .Should().ThrowAsync<LeadNotFoundException>();
        await service.Invoking(x => x.GetAvailableSlotsAsync(10, DateTime.UtcNow, default))
            .Should().ThrowAsync<LeadNotFoundException>();
        var inactiveVerification = await controller.Verify(10,
            new(delivery.TokenFor(grace.Id, LeadTokenPurpose.ContactVerification)), default);
        var decoySession = ((OkObjectResult)inactiveVerification).Value.Should()
            .BeOfType<PublicVerificationResult>().Subject.Session;
        sessions.ResolveBookingAuthority(decoySession, 10).Should().BeNull();
        await service.Invoking(x => x.BookShowingFromVerifiedSessionAsync(browserAuthority,
                new(8, "UTC", "browser"), "ip", default)).Should().ThrowAsync<LeadNotFoundException>();
        await service.Invoking(x => x.BookShowingAsync(ada.Id, new(8, "UTC", "managed", management),
                0, "ip", default, 10)).Should().ThrowAsync<LeadNotFoundException>();
        await service.Invoking(x => x.CancelPublicShowingAsync(10, showing.ShowingId, management, "ip", default))
            .Should().ThrowAsync<LeadNotFoundException>();
        await service.Invoking(x => x.ReschedulePublicShowingAsync(10, showing.ShowingId,
                new(8, "UTC", "reschedule", management), "ip", default))
            .Should().ThrowAsync<LeadNotFoundException>();

        var draft = (NotFoundObjectResult)await controller.PreScreen(10, default);
        var missing = (NotFoundObjectResult)await controller.PreScreen(999, default);
        ((ProblemDetails)draft.Value!).Title.Should().Be(((ProblemDetails)missing.Value!).Title);
        draft.StatusCode.Should().Be(missing.StatusCode);
    }

    [Fact]
    public async Task Null_answers_are_controlled_bad_request_and_public_source_is_always_listing_website()
    {
        await using var db = Db(nameof(Null_answers_are_controlled_bad_request_and_public_source_is_always_listing_website));
        Seed(db);
        await db.SaveChangesAsync();
        var delivery = new FakeLeadTokenDelivery();
        var service = Service(db, delivery);
        var controller = Controller(service, Sessions());

        var bad = await controller.Inquiry(10,
            new("Ada", "ada@example.com", null, LeadSourceKind.Direct, "null-answers", null), default);
        bad.Should().BeOfType<BadRequestObjectResult>();

        var first = await service.SubmitInquiryAsync(10,
            new("Ada", "ada@example.com", null, LeadSourceKind.Referral, "source", new()), "ip", default);
        var replay = await service.SubmitInquiryAsync(10,
            new("Ada", "ada@example.com", null, (LeadSourceKind)999, "source", new()), "ip", default);

        replay.Receipt.Should().Be(first.Receipt);
        db.LeadSources.Should().ContainSingle(x => x.Kind == LeadSourceKind.ListingWebsite);
    }

    private static PublicLeadController Controller(ILeadService service, IPublicLeadSessionService sessions)
    {
        var controller = new PublicLeadController(service, sessions);
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };
        return controller;
    }

    private static PublicInquiryRequest Inquiry(string name, string email, string key) =>
        new(name, email, null, LeadSourceKind.Direct, key, new());

    private static LeadService Service(DataContext db, FakeLeadTokenDelivery delivery) =>
        new(db, new PermitAllLeadAbuseGuard(), TimeProvider.System, delivery);

    private static PublicLeadSessionService Sessions(TimeProvider? clock = null) =>
        new(new EphemeralDataProtectionProvider(), clock ?? TimeProvider.System);

    private static DataContext Db(string name) => new(new DbContextOptionsBuilder<DataContext>()
        .UseInMemoryDatabase(name).Options);

    private static void AddSlots(DataContext db) => db.ShowingAvailabilities.AddRange(
        new ShowingAvailability { Id = 7, OrganizationId = 1, ListingId = 10,
            StartsAtUtc = new(2035, 1, 1, 15, 0, 0, DateTimeKind.Utc),
            EndsAtUtc = new(2035, 1, 1, 16, 0, 0, DateTimeKind.Utc), TimeZoneId = "UTC" },
        new ShowingAvailability { Id = 8, OrganizationId = 1, ListingId = 10,
            StartsAtUtc = new(2035, 1, 2, 15, 0, 0, DateTimeKind.Utc),
            EndsAtUtc = new(2035, 1, 2, 16, 0, 0, DateTimeKind.Utc), TimeZoneId = "UTC" });

    private static void Seed(DataContext db)
    {
        db.Organizations.Add(new Organization { Id = 1, Name = "Org", OwnerId = 99 });
        db.Users.Add(new User { Id = 99, Email = "owner@example.com", FirstName = "O", LastName = "W",
            PasswordHash = [1], PasswordSalt = [1] });
        db.Properties.Add(new Property { Id = 20, Name = "P", StreetAddress = "1 Main", City = "X", State = "NY",
            ZipCode = "10001", LandlordId = 99, OrganizationId = 1 });
        db.Units.Add(new Unit { Id = 30, PropertyId = 20, Name = "1", OrganizationId = 1 });
        db.Listings.Add(new Listing { Id = 10, PropertyId = 20, UnitId = 30, OrganizationId = 1,
            CreatedBy = 99, Status = EListingStatus.Active, CreatedAt = DateTime.UtcNow });
    }

    private sealed class MutableTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
        public void Advance(TimeSpan by) => now = now.Add(by);
    }
}
