using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Leads;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.Leads;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Leads;

public sealed class LeadServiceTests
{
    private static DataContext Db(string name) => new(new DbContextOptionsBuilder<DataContext>()
        .UseInMemoryDatabase(name).Options);

    private static LeadService Service(DataContext db, FakeLeadTokenDelivery delivery,
        ILeadAbuseGuard? guard = null) =>
        new(db, guard ?? new PermitAllLeadAbuseGuard(), TimeProvider.System, delivery);

    [Fact]
    public async Task Inquiry_normalizes_deduplicates_hashes_tokens_and_returns_only_a_safe_receipt()
    {
        await using var db = Db(nameof(Inquiry_normalizes_deduplicates_hashes_tokens_and_returns_only_a_safe_receipt));
        Seed(db); await db.SaveChangesAsync();
        var delivery = new FakeLeadTokenDelivery();
        var service = Service(db, delivery);
        var request = new PublicInquiryRequest(" Ada ", " LOVELACE@Example.COM ", "+1 (555) 123-4567", LeadSourceKind.ListingWebsite,
            "idem-1", new(DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30)), 2, true, false, "5000-7499", null));

        var first = await service.SubmitInquiryAsync(10, request, "203.0.113.4", default);
        var second = await service.SubmitInquiryAsync(10, request with { Email = "lovelace@example.com" }, "203.0.113.4", default);

        first.Receipt.Should().NotBeNullOrWhiteSpace();
        second.Receipt.Should().NotBeNullOrWhiteSpace();
        db.Leads.Should().ContainSingle(x => x.NormalizedEmail == "lovelace@example.com" && x.NormalizedPhone == "+15551234567");
        db.LeadSources.Should().ContainSingle();
        var secret = delivery.Messages.Single(x => x.Purpose == LeadTokenPurpose.ContactVerification).Token;
        db.Leads.Single().VerificationTokenHash.Should().NotBe(secret);
        typeof(PublicInquiryResult).GetProperties().Select(x => x.Name)
            .Should().NotContain(new[] { "LeadId", "VerificationToken", "PublicAccessToken" });

    }

    [Fact]
    public async Task Inquiry_rejects_disabled_questions_and_abuse()
    {
        await using var db = Db(nameof(Inquiry_rejects_disabled_questions_and_abuse)); Seed(db);
        db.PreScreenConfigurations.Add(new() { ListingId = 10, OrganizationId = 1, AskPets = false });
        await db.SaveChangesAsync();
        var delivery = new FakeLeadTokenDelivery();
        var service = Service(db, delivery, new DenyLeadAbuseGuard());
        var request = new PublicInquiryRequest("A", "a@b.com", null, LeadSourceKind.Direct, "key",
            new(null, null, true, null, null, null));
        await service.Invoking(x => x.SubmitInquiryAsync(10, request, "ip", default))
            .Should().ThrowAsync<LeadRateLimitException>();

        service = Service(db, delivery);
        await service.Invoking(x => x.SubmitInquiryAsync(10, request, "ip", default))
            .Should().ThrowAsync<LeadValidationException>().WithMessage("*disabled*");
        delivery.Messages.Should().BeEmpty();
    }

    [Fact]
    public void Prescreen_contract_has_only_fixed_explained_safe_questions()
    {
        var questions = PreScreenQuestionCatalog.Defaults;
        questions.Select(x => x.Key).Should().BeEquivalentTo("moveInDate", "occupants", "pets", "smoking", "incomeRange", "requestedShowingTime");
        questions.Should().OnlyContain(x => !string.IsNullOrWhiteSpace(x.Explanation));
        questions.Should().OnlyContain(x => !x.IsProtectedClassQuestion);
    }

    [Fact]
    public async Task Verification_is_hashed_expiring_and_single_use()
    {
        await using var db = Db(nameof(Verification_is_hashed_expiring_and_single_use)); Seed(db); await db.SaveChangesAsync();
        var delivery = new FakeLeadTokenDelivery();
        var service = Service(db, delivery);
        await service.SubmitInquiryAsync(10,
            new("A", "a@b.com", null, LeadSourceKind.Direct, "k", new()), "ip", default);
        var lead = db.Leads.Single();
        var verification = delivery.TokenFor(lead.Id, LeadTokenPurpose.ContactVerification);

        (await service.VerifyContactAsync(verification, "ip", default, 10)).Should().Be(lead.Id);
        (await service.VerifyContactAsync(verification, "ip", default, 10)).Should().BeNull();
        delivery.Messages.Should().ContainSingle(x => x.Purpose == LeadTokenPurpose.PublicManagement);
    }

    [Fact]
    public async Task Booking_is_timezone_safe_idempotent_and_prevents_double_booking()
    {
        await using var db = Db(nameof(Booking_is_timezone_safe_idempotent_and_prevents_double_booking)); Seed(db);
        db.ShowingAvailabilities.Add(new() { Id = 7, OrganizationId = 1, ListingId = 10, StartsAtUtc = new(2030,1,1,15,0,0,DateTimeKind.Utc), EndsAtUtc = new(2030,1,1,16,0,0,DateTimeKind.Utc), TimeZoneId = "America/New_York" });
        await db.SaveChangesAsync();
        var delivery = new FakeLeadTokenDelivery();
        var service = Service(db, delivery);
        await service.SubmitInquiryAsync(10, new("A","a@b.com",null,LeadSourceKind.Direct,"i1",new()),"ip",default);
        await service.SubmitInquiryAsync(10, new("B","b@b.com",null,LeadSourceKind.Direct,"i2",new()),"ip",default);
        var one = db.Leads.Single(x => x.NormalizedEmail == "a@b.com");
        var two = db.Leads.Single(x => x.NormalizedEmail == "b@b.com");
        await service.VerifyContactAsync(delivery.TokenFor(one.Id, LeadTokenPurpose.ContactVerification), "ip", default, 10);
        await service.VerifyContactAsync(delivery.TokenFor(two.Id, LeadTokenPurpose.ContactVerification), "ip", default, 10);

        var booked = await service.BookShowingAsync(one.Id, new(7, "America/New_York", "book-1"), 1, "ip", default, 10, 99);
        (await service.BookShowingAsync(one.Id, new(7, "America/New_York", "book-1"), 1, "ip", default, 10, 99)).ShowingId.Should().Be(booked.ShowingId);
        await service.Invoking(x => x.BookShowingAsync(two.Id, new(7,"America/New_York","book-2"),1,"ip",default,10,99))
            .Should().ThrowAsync<LeadConflictException>();
        db.LeadNotificationIntents.Should().Contain(x => x.Kind == LeadNotificationKind.ShowingConfirmation && x.Status == NotificationIntentStatus.Pending);

    }

    [Fact]
    public async Task Crm_is_organization_scoped_validates_enums_and_bounds_and_converts_known_data_once()
    {
        await using var db = Db(nameof(Crm_is_organization_scoped_validates_enums_and_bounds_and_converts_known_data_once)); Seed(db); await db.SaveChangesAsync();
        var delivery = new FakeLeadTokenDelivery();
        var service = Service(db, delivery);
        await service.SubmitInquiryAsync(10, new("Ada Lovelace","ada@example.com","5551234567",LeadSourceKind.Referral,"i",new(DateOnly.Parse("2030-02-01"),3,true,false,"7500+",null)),"ip",default);
        var lead = db.Leads.Single();

        await service.Invoking(x => x.UpdateLeadAsync(2, 99, lead.Id, new((LeadStatus)999,null,null,null,null),default)).Should().ThrowAsync<LeadForbiddenException>();
        await service.Invoking(x => x.UpdateLeadAsync(1, 99, lead.Id, new((LeadStatus)999,null,null,null,null),default)).Should().ThrowAsync<LeadValidationException>();
        await service.Invoking(x => x.AddNoteAsync(1,99,lead.Id,new string('x',2001),default)).Should().ThrowAsync<LeadValidationException>();

        await service.VerifyContactAsync(delivery.TokenFor(lead.Id, LeadTokenPurpose.ContactVerification), "ip", default, 10);
        lead.RowVersion = [1];
        await db.SaveChangesAsync();
        var detail = await service.GetLeadAsync(1, 99, lead.Id, default);
        detail.PreScreenResponse.Should().NotBeNull();
        detail.PreScreenResponse!.Occupants.Should().Be(3);
        detail.PreScreenResponse.HasPets.Should().BeTrue();
        detail.PreScreenResponse.IncomeRange.Should().Be("7500+");
        await service.UpdateLeadAsync(1, 99, lead.Id, new(LeadStatus.Qualified,null,null,detail.ConcurrencyToken,null),default);
        var link = await service.ConvertToApplicationAsync(1, 99, lead.Id, default);
        var app = db.RentalApplications.Single(x => x.Id == link.ApplicationId);
        app.Email.Should().Be("ada@example.com"); app.NumberOfOccupants.Should().Be(3); app.HasPets.Should().BeTrue();
        (await service.ConvertToApplicationAsync(1,99,lead.Id,default)).ApplicationId.Should().Be(link.ApplicationId);
    }

    [Fact]
    public async Task Pipeline_filters_and_metrics_exclude_prescreen_attributes()
    {
        await using var db = Db(nameof(Pipeline_filters_and_metrics_exclude_prescreen_attributes)); Seed(db); await db.SaveChangesAsync();
        var delivery = new FakeLeadTokenDelivery();
        var service = Service(db, delivery);
        await service.SubmitInquiryAsync(10,new("A","a@b.com",null,LeadSourceKind.Direct,"a",new()),"ip",default);
        await service.SubmitInquiryAsync(10,new("B","b@b.com",null,LeadSourceKind.Referral,"b",new()),"ip",default);
        var b = db.Leads.Single(x => x.NormalizedEmail == "b@b.com");
        b.RowVersion = [1];
        await db.SaveChangesAsync();
        var detail = await service.GetLeadAsync(1, 99, b.Id, default);
        await service.UpdateLeadAsync(1,99,b.Id,new(LeadStatus.Qualified,99,null,detail.ConcurrencyToken,DateTime.UtcNow.AddDays(1)),default);
        var result = await service.GetPipelineAsync(1,99,new(LeadStatus.Qualified,99,10,null,null),default);
        result.Items.Should().ContainSingle(x => x.Id == b.Id);
        result.Items.Single().GetType().GetProperties().Select(x=>x.Name).Should().NotContain(new[]{"IncomeRange","Smoking","HasPets"});
        result.Metrics.Total.Should().Be(2); result.Metrics.Qualified.Should().Be(1);
    }

    [Fact]
    public void Model_has_org_dedupe_slot_uniqueness_restrictive_fks_and_concurrency()
    {
        using var db = Db(nameof(Model_has_org_dedupe_slot_uniqueness_restrictive_fks_and_concurrency));
        var lead = db.Model.FindEntityType(typeof(Lead))!;
        lead.GetIndexes().Should().Contain(x => x.IsUnique && x.Properties.Select(p=>p.Name).SequenceEqual(new[]{"OrganizationId","ListingId","ContactIdentityHash"}));
        db.Model.FindEntityType(typeof(Showing))!.GetIndexes().Should().Contain(x => x.IsUnique && x.Properties.Any(p=>p.Name=="AvailabilityId"));
        db.Model.FindEntityType(typeof(Lead))!.FindProperty("RowVersion")!.IsConcurrencyToken.Should().BeTrue();
        db.Model.GetEntityTypes().Where(x => new[]{typeof(Lead),typeof(Showing),typeof(PreScreenConfiguration)}.Contains(x.ClrType))
            .SelectMany(x=>x.GetForeignKeys()).Should().OnlyContain(x=>x.DeleteBehavior==DeleteBehavior.Restrict);
    }

    [Fact]
    public async Task Idempotency_is_scoped_and_duplicate_inquiry_cannot_take_over_management_access()
    {
        await using var db = Db(nameof(Idempotency_is_scoped_and_duplicate_inquiry_cannot_take_over_management_access));
        Seed(db);
        db.Listings.Add(new Listing { Id=11, PropertyId=20, UnitId=30, OrganizationId=1, CreatedBy=99,
            Status=EListingStatus.Active, CreatedAt=DateTime.UtcNow });
        db.ShowingAvailabilities.Add(new() { Id=7, OrganizationId=1, ListingId=10, StartsAtUtc=new(2030,1,1,15,0,0,DateTimeKind.Utc), EndsAtUtc=new(2030,1,1,16,0,0,DateTimeKind.Utc) });
        await db.SaveChangesAsync();
        var delivery = new FakeLeadTokenDelivery();
        var service = Service(db, delivery);

        await service.SubmitInquiryAsync(10, new("A","a@b.com",null,LeadSourceKind.Direct,"same-key",new()),"ip",default);
        await service.SubmitInquiryAsync(11, new("B","b@b.com",null,LeadSourceKind.Direct,"same-key",new()),"ip",default);
        var first = db.Leads.Single(x => x.ListingId == 10);
        var otherListing = db.Leads.Single(x => x.ListingId == 11);
        first.Id.Should().NotBe(otherListing.Id);

        await service.VerifyContactAsync(delivery.TokenFor(first.Id, LeadTokenPurpose.ContactVerification), "ip", default, 10);
        var management = delivery.TokenFor(first.Id, LeadTokenPurpose.PublicManagement);
        var deliveredCount = delivery.Messages.Count;
        await service.SubmitInquiryAsync(10, new("A","a@b.com",null,LeadSourceKind.Referral,"new-key",new()),"ip",default);
        delivery.Messages.Should().HaveCount(deliveredCount);
        var booking = await service.BookShowingAsync(first.Id, new(7,"UTC","same-book-key",management),0,"ip",default,10);
        booking.ShowingId.Should().BePositive();
    }

    [Fact]
    public async Task Showing_can_be_rescheduled_and_completed_with_strict_org_scope()
    {
        await using var db = Db(nameof(Showing_can_be_rescheduled_and_completed_with_strict_org_scope)); Seed(db);
        db.ShowingAvailabilities.AddRange(
            new() { Id=7, OrganizationId=1, ListingId=10, StartsAtUtc=new(2030,1,1,15,0,0,DateTimeKind.Utc), EndsAtUtc=new(2030,1,1,16,0,0,DateTimeKind.Utc) },
            new() { Id=8, OrganizationId=1, ListingId=10, StartsAtUtc=new(2030,1,2,15,0,0,DateTimeKind.Utc), EndsAtUtc=new(2030,1,2,16,0,0,DateTimeKind.Utc) });
        await db.SaveChangesAsync();
        var delivery = new FakeLeadTokenDelivery();
        var service = Service(db, delivery);
        await service.SubmitInquiryAsync(10,new("A","a@b.com",null,LeadSourceKind.Direct,"i",new()),"ip",default);
        var lead = db.Leads.Single();
        await service.VerifyContactAsync(delivery.TokenFor(lead.Id, LeadTokenPurpose.ContactVerification),"ip",default,10);
        var showing=await service.BookShowingAsync(lead.Id,new(7,"UTC","b"),1,"ip",default,10,99);
        db.Showings.Single().RowVersion = [1];
        await db.SaveChangesAsync();

        await service.Invoking(x=>x.RescheduleShowingAsync(2,99,showing.ShowingId,new(8,"UTC","r",null,"AQ=="),default)).Should().ThrowAsync<LeadForbiddenException>();
        var rescheduled = await service.RescheduleShowingAsync(1,99,showing.ShowingId,new(8,"UTC","r",null,"AQ=="),default);
        db.Showings.Single().AvailabilityId.Should().Be(8);
        db.LeadNotificationIntents.Should().Contain(x=>x.Kind==LeadNotificationKind.ShowingRescheduled);
        await service.CompleteShowingAsync(1,99,showing.ShowingId,false,rescheduled.ConcurrencyToken,default);
        db.Showings.Single().Status.Should().Be(ShowingStatus.Completed);

    }

    [Fact]
    public async Task Assignment_requires_active_org_member_and_lost_leads_do_not_inflate_funnel_metrics()
    {
        await using var db = Db(nameof(Assignment_requires_active_org_member_and_lost_leads_do_not_inflate_funnel_metrics)); Seed(db);
        db.Users.Add(new User { Id=100, Email="outsider@example.com", FirstName="Out", LastName="Side", PasswordHash=[1], PasswordSalt=[1] });
        await db.SaveChangesAsync();
        var delivery = new FakeLeadTokenDelivery();
        var service=Service(db,delivery);
        await service.SubmitInquiryAsync(10,new("A","a@b.com",null,LeadSourceKind.Direct,"i",new()),"ip",default);
        var lead = db.Leads.Single();
        lead.RowVersion = [1];
        await db.SaveChangesAsync();
        var detail = await service.GetLeadAsync(1, 99, lead.Id, default);
        await service.Invoking(x=>x.UpdateLeadAsync(1,99,lead.Id,new(LeadStatus.Contacted,100,null,detail.ConcurrencyToken,null),default)).Should().ThrowAsync<LeadValidationException>();
        await service.UpdateLeadAsync(1,99,lead.Id,new(LeadStatus.Lost,null,null,detail.ConcurrencyToken,null),default);
        var metrics=(await service.GetPipelineAsync(1,99,new(null,null,null,null,null),default)).Metrics;
        metrics.Contacted.Should().Be(0); metrics.Qualified.Should().Be(0); metrics.Showings.Should().Be(0);
    }

    private static void Seed(DataContext db)
    {
        db.Organizations.Add(new Organization { Id = 1, Name = "Org", OwnerId = 99 });
        db.Users.Add(new User { Id = 99, Email = "owner@example.com", FirstName="O", LastName="W", PasswordHash=[1], PasswordSalt=[1] });
        db.Properties.Add(new Property { Id=20, Name="P", StreetAddress="1 Main", City="X", State="NY", ZipCode="10001", LandlordId=99, OrganizationId=1 });
        db.Units.Add(new Unit { Id=30, PropertyId=20, Name="1", OrganizationId=1 });
        db.Listings.Add(new Listing { Id=10, PropertyId=20, UnitId=30, OrganizationId=1, CreatedBy=99,
            Status=EListingStatus.Active, CreatedAt=DateTime.UtcNow });
    }

    private sealed class DenyLeadAbuseGuard : ILeadAbuseGuard { public ValueTask<bool> AllowAsync(string key, CancellationToken ct) => ValueTask.FromResult(false); }
}
