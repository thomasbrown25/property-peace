using System.Security.Claims;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Data;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.ShortStay;
using brownstone_hub_api.Services.ShortStayStripe;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace brownstone_hub_api.Tests.Services.ShortStay;

public sealed class ShortStayHoldTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 20, 12, 0, 0, TimeSpan.Zero);
    private static readonly DateOnly Arrival = new(2026, 11, 1);
    private sealed class Clock : TimeProvider
    {
        public DateTimeOffset Current = Now;
        public override DateTimeOffset GetUtcNow() => Current;
    }
    private sealed class Gateway : IShortStayDirectChargeGateway
    {
        public int Creates;
        public bool FailOnce;
        public Action? AfterCreate;
        public int Cancels;
        public string? LastKey;
        public List<string> Keys = [];
        public bool WrongCode;
        private string? code;
        public Task<ShortStayIntent> CreatePaymentIntentAsync(string a, long n, string c, string code, string key, CancellationToken ct = default)
        { Creates++; LastKey = key; Keys.Add(key); if (FailOnce) { FailOnce = false; throw new InvalidOperationException("provider unavailable"); }
          this.code = code;
          AfterCreate?.Invoke();
          return Task.FromResult(new ShortStayIntent("pi_1234567890123456", "secret", n, c, "requires_payment_method", a, WrongCode ? new string('A', 32) : code)); }
        public Task<ShortStayIntent> RetrieveAsync(string a, string id, CancellationToken ct = default) =>
            Task.FromResult(new ShortStayIntent(id, null, 18150, "usd", "requires_payment_method", a, code));
        public Task<ShortStayIntent> RetrieveForGuestPaymentAsync(string a, string id, long n, string c, string reservationCode, CancellationToken ct = default) =>
            Task.FromResult(new ShortStayIntent(id, "secret", 18150, "usd", "requires_payment_method", a, code));
        public Task<ShortStayIntent> CancelAsync(string a, string i, string k, CancellationToken ct = default)
        { Cancels++; return Task.FromResult(new ShortStayIntent(i, null, 18150, "usd", "canceled", a, code)); }
        public Task<ShortStayRefund> RefundAsync(string a, string i, long n, string k, CancellationToken ct = default) => throw new NotSupportedException();
    }
    private sealed class Slim(DbContextOptions<DataContext> options) : DataContext(options)
    {
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            var keep = new[] { typeof(Property), typeof(Unit), typeof(Organization), typeof(OrganizationMember), typeof(User), typeof(BankAccount), typeof(ShortStayListing), typeof(ShortStayBlock), typeof(ShortStayNightlyRateOverride), typeof(ShortStayIcalSubscription), typeof(ShortStayIcalOccurrence), typeof(ShortStayReservation), typeof(ShortStayReservationNight), typeof(ShortStayOccupancyClaim), typeof(ShortStayCollectionApplication), typeof(ShortStayCollectionApplicationProperty) };
            foreach (var entity in modelBuilder.Model.GetEntityTypes().ToList())
                if (!keep.Contains(entity.ClrType)) modelBuilder.Ignore(entity.ClrType);
            foreach (var entity in modelBuilder.Model.GetEntityTypes())
                foreach (var property in entity.GetProperties())
                    if (property.GetColumnType()?.Contains("(max)", StringComparison.OrdinalIgnoreCase) == true) property.SetColumnType("TEXT");
        }
    }
    private sealed class Eligible : IShortStayStripeEligibility
    {
        public bool Ready = true;
        public Task<bool> IsEligibleAsync(string account, CancellationToken ct) => Task.FromResult(Ready);
    }
    private sealed class FailAttach : SaveChangesInterceptor
    {
        public bool Armed;
        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData eventData,
            InterceptionResult<int> result, CancellationToken cancellationToken = default)
        {
            if (Armed && eventData.Context?.ChangeTracker.Entries<ShortStayReservation>()
                .Any(e => e.State == EntityState.Modified && e.Entity.StripePaymentIntentId is not null) == true)
            {
                Armed = false;
                throw new InvalidOperationException("simulated attach failure after provider create");
            }
            return base.SavingChangesAsync(eventData, result, cancellationToken);
        }
    }
    private sealed class AmbiguousCommit : DbTransactionInterceptor
    {
        public bool Armed;
        public override Task TransactionCommittedAsync(System.Data.Common.DbTransaction transaction,
            TransactionEndEventData eventData, CancellationToken cancellationToken = default)
        {
            if (Armed)
            {
                Armed = false;
                throw new InvalidOperationException("simulated lost commit acknowledgement");
            }
            return base.TransactionCommittedAsync(transaction, eventData, cancellationToken);
        }
    }
    private sealed class Fixture : IAsyncDisposable
    {
        private readonly SqliteConnection connection = new("Data Source=:memory:;Foreign Keys=False");
        public Slim Db = null!;
        public Eligible Stripe = new();
        public Gateway Gateway = new();
        public DefaultHttpContext Http = new();
        public Clock Time = new();
        public FailAttach AttachFault = new();
        public AmbiguousCommit CommitFault = new();
        public ShortStayStartPaymentService Payment(bool enabled = true) => new(Db, new HttpContextAccessor { HttpContext = Http },
            new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["ShortStayBooking:Enabled"] = "true",
                ["ShortStayBooking:PaymentsEnabled"] = enabled.ToString() }).Build(), Stripe, Gateway, Time);
        public ShortStayHoldService Service(bool enabled = true, bool approval = false) => new(Db, new HttpContextAccessor { HttpContext = Http },
            new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["ShortStayBooking:Enabled"] = enabled.ToString(),
                ["ShortStayCollection:RequireApplicationApproval"] = approval.ToString(), ["ShortStayCollection:FeePolicyConsentVersion"] = "v1",
                ["ShortStayCollection:FeePolicyUrl"] = "https://app.propertypeace.io/legal/fees" }).Build(), Stripe, new Clock());
        public static async Task<Fixture> Create()
        {
            var f = new Fixture(); await f.connection.OpenAsync();
            f.Db = new Slim(new DbContextOptionsBuilder<DataContext>().UseSqlite(f.connection).AddInterceptors(f.AttachFault, f.CommitFault).Options);
            await f.Db.Database.EnsureCreatedAsync();
            f.Db.Users.AddRange(new User { Id = 42, Email = "owner@example.test", StripeAccountId = "acct_owned" }, new User { Id = 5, Email = "guest@example.test" });
            f.Db.Organizations.Add(new Organization { Id = 20, IsActive = true });
            f.Db.Properties.Add(new Property { Id = 7, OrganizationId = 20, LandlordId = 42, TimeZoneId = "America/New_York", OperatingAccountId = 30 });
            f.Db.Units.Add(new Unit { Id = 10, PropertyId = 7, OrganizationId = 20, RentalMode = ERentalMode.ShortTerm });
            f.Db.OrganizationMembers.Add(new OrganizationMember { OrganizationId = 20, UserId = 42, Role = "Owner", IsActive = true, CanManageProperties = true });
            f.Db.BankAccounts.Add(new BankAccount { Id = 30, OrganizationId = 20, StripeAccountId = "acct_owned", IsActive = true });
            f.Db.ShortStayListings.Add(new ShortStayListing { UnitId = 10, Status = ShortStayListingStatus.Published, NightlyBasePrice = 75m, CleaningFee = 15m, MinimumNights = 1, Capacity = 2, LodgingTaxRatePercent = 10, TaxPolicyAttestedAtUtc = Now.AddDays(-1).UtcDateTime, TaxPolicyAttestedByUserId = 42 });
            f.Db.ShortStayIcalSubscriptions.Add(new ShortStayIcalSubscription { UnitId = 10, OrgId = 20, Enabled = true, EncryptedUrl = "secret", UrlFingerprint = "fingerprint", LastSuccessAtUtc = Now.UtcDateTime });
            await f.Db.SaveChangesAsync();
            f.Http.User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, "5")], "test"));
            f.Http.Items["UserId"] = 5L;
            return f;
        }
        public ValueTask DisposeAsync() => connection.DisposeAsync();
    }
    [Fact]
    public async Task Payment_requires_gate_and_matching_guest()
    {
        await using var f = await Fixture.Create();
        var hold = (await f.Service().Create(10, new(Arrival, Arrival.AddDays(2), 2, "pay"), default)).Hold!;
        Assert.Equal(503, (await f.Payment(false).Start(hold.Code, default)).StatusCode);
        f.Http.Items["UserId"] = 42L;
        Assert.Equal(403, (await f.Payment().Start(hold.Code, default)).StatusCode);
        Assert.Equal(0, f.Gateway.Creates);
    }
    [Fact]
    public async Task Payment_persists_pending_and_authorized_replay_recovers_secret()
    {
        await using var f = await Fixture.Create();
        var hold = (await f.Service().Create(10, new(Arrival, Arrival.AddDays(2), 2, "pay"), default)).Hold!;
        var started = await f.Payment().Start(hold.Code, default);
        Assert.Equal(200, started.StatusCode);
        Assert.Equal("secret", started.Payment!.ClientSecret);
        f.Db.ChangeTracker.Clear();
        var saved = await f.Db.ShortStayReservations.SingleAsync();
        Assert.Equal(ShortStayReservationStatus.PendingPayment, saved.Status);
        Assert.Equal("pi_1234567890123456", saved.StripePaymentIntentId);
        var replay = await f.Payment().Start(hold.Code, default);
        Assert.Equal(200, replay.StatusCode);
        Assert.Equal("secret", replay.Payment!.ClientSecret);
        Assert.Equal(1, f.Gateway.Creates);
        Assert.Equal(2, await f.Db.ShortStayOccupancyClaims.CountAsync());
    }
    [Fact]
    public async Task Database_attach_failure_retries_same_provider_operation_and_never_stores_secret()
    {
        await using var f = await Fixture.Create();
        var hold = (await f.Service().Create(10, new(Arrival, Arrival.AddDays(2), 2, "attach-fault"), default)).Hold!;
        f.AttachFault.Armed = true;
        var first = await f.Payment().Start(hold.Code, default);
        Assert.Equal(503, first.StatusCode);
        Assert.Null(first.Payment);
        f.Db.ChangeTracker.Clear();
        var pending = await f.Db.ShortStayReservations.SingleAsync();
        Assert.Equal(ShortStayReservationStatus.PendingPayment, pending.Status);
        Assert.Null(pending.StripePaymentIntentId);
        Assert.Equal(2, await f.Db.ShortStayOccupancyClaims.CountAsync());
        var recovered = await f.Payment().Start(hold.Code, default);
        Assert.Equal(200, recovered.StatusCode);
        Assert.Equal("secret", recovered.Payment!.ClientSecret);
        Assert.Equal("pi_1234567890123456", recovered.Payment.PaymentIntentId);
        Assert.Single(f.Gateway.Keys.Distinct());
        f.Db.ChangeTracker.Clear();
        var stored = await f.Db.ShortStayReservations.SingleAsync();
        Assert.Equal("pi_1234567890123456", stored.StripePaymentIntentId);
        Assert.DoesNotContain("secret", string.Join(' ', stored.GetType().GetProperties().Select(p => p.GetValue(stored)?.ToString())));
    }
    [Fact]
    public async Task Commit_acknowledgement_lost_after_attach_recovers_exact_intent_by_account()
    {
        await using var f = await Fixture.Create();
        var hold = (await f.Service().Create(10, new(Arrival, Arrival.AddDays(2), 2, "commit-ambiguous"), default)).Hold!;
        f.Gateway.AfterCreate = () => f.CommitFault.Armed = true;
        var first = await f.Payment().Start(hold.Code, default);
        Assert.Equal(503, first.StatusCode);
        Assert.Null(first.Payment);
        f.Db.ChangeTracker.Clear();
        Assert.Equal("pi_1234567890123456", (await f.Db.ShortStayReservations.SingleAsync()).StripePaymentIntentId);
        var retry = await f.Payment().Start(hold.Code, default);
        Assert.Equal(200, retry.StatusCode);
        Assert.Equal("pi_1234567890123456", retry.Payment!.PaymentIntentId);
        Assert.Equal("secret", retry.Payment.ClientSecret);
        Assert.Equal(1, f.Gateway.Creates);
    }
    [Fact]
    public async Task Wrong_provider_receipt_cannot_attach_or_return_secret()
    {
        await using var f = await Fixture.Create();
        var hold = (await f.Service().Create(10, new(Arrival, Arrival.AddDays(2), 2, "wrong-receipt"), default)).Hold!;
        f.Gateway.WrongCode = true;
        var result = await f.Payment().Start(hold.Code, default);
        Assert.Equal(503, result.StatusCode);
        Assert.Null(result.Payment);
        f.Db.ChangeTracker.Clear();
        Assert.Null((await f.Db.ShortStayReservations.SingleAsync()).StripePaymentIntentId);
    }
    [Fact]
    public async Task Recovered_intent_requires_current_account_and_unexpired_hold()
    {
        await using var f = await Fixture.Create();
        var hold = (await f.Service().Create(10, new(Arrival, Arrival.AddDays(2), 2, "recover-guards"), default)).Hold!;
        Assert.Equal(200, (await f.Payment().Start(hold.Code, default)).StatusCode);
        f.Db.ChangeTracker.Clear();
        f.Db.Users.Single(u => u.Id == 42).StripeAccountId = "acct_other";
        await f.Db.SaveChangesAsync();
        Assert.Null((await f.Payment().Start(hold.Code, default)).Payment);
        f.Db.Users.Single(u => u.Id == 42).StripeAccountId = "acct_owned";
        await f.Db.SaveChangesAsync();
        f.Time.Current = hold.ExpiresAtUtc.AddSeconds(1);
        Assert.Null((await f.Payment().Start(hold.Code, default)).Payment);
        Assert.Equal(1, f.Gateway.Creates);
    }
    [Fact]
    public async Task Authority_revoked_during_provider_create_denies_secret_and_cancels_without_releasing_claims()
    {
        await using var f = await Fixture.Create();
        var hold = (await f.Service().Create(10, new(Arrival, Arrival.AddDays(2), 2, "revoked"), default)).Hold!;
        f.Gateway.AfterCreate = () => { f.Db.OrganizationMembers.Single().CanManageProperties = false; f.Db.SaveChanges(); };
        var result = await f.Payment().Start(hold.Code, default);
        Assert.Null(result.Payment);
        Assert.Equal(1, f.Gateway.Cancels);
        Assert.Equal(2, await f.Db.ShortStayOccupancyClaims.CountAsync());
    }
    [Fact]
    public async Task Stripe_capabilities_withdrawn_during_create_denies_secret()
    {
        await using var f = await Fixture.Create();
        var hold = (await f.Service().Create(10, new(Arrival, Arrival.AddDays(2), 2, "capabilities"), default)).Hold!;
        f.Gateway.AfterCreate = () => f.Stripe.Ready = false;
        Assert.Null((await f.Payment().Start(hold.Code, default)).Payment);
        Assert.Equal(1, f.Gateway.Cancels);
        Assert.Equal(2, await f.Db.ShortStayOccupancyClaims.CountAsync());
    }
    [Fact]
    public async Task Expiry_during_create_never_returns_secret_and_keeps_claims()
    {
        await using var f = await Fixture.Create();
        var hold = (await f.Service().Create(10, new(Arrival, Arrival.AddDays(2), 2, "expire"), default)).Hold!;
        f.Gateway.AfterCreate = () => f.Time.Current = hold.ExpiresAtUtc.AddSeconds(1);
        Assert.Null((await f.Payment().Start(hold.Code, default)).Payment);
        Assert.Equal(1, f.Gateway.Cancels);
        Assert.Equal(2, await f.Db.ShortStayOccupancyClaims.CountAsync());
    }
    [Fact]
    public async Task Revoked_guest_cannot_retrieve_previous_secret()
    {
        await using var f = await Fixture.Create();
        var hold = (await f.Service().Create(10, new(Arrival, Arrival.AddDays(2), 2, "guest"), default)).Hold!;
        Assert.Equal(200, (await f.Payment().Start(hold.Code, default)).StatusCode);
        f.Http.User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, "42")], "test"));
        f.Http.Items["UserId"] = 42L;
        Assert.Equal(404, (await f.Payment().Start(hold.Code, default)).StatusCode);
        Assert.Equal(1, f.Gateway.Creates);
    }
    [Fact]
    public async Task Ambiguous_provider_failure_keeps_claims_and_retry_recovers_operation()
    {
        await using var f = await Fixture.Create();
        var hold = (await f.Service().Create(10, new(Arrival, Arrival.AddDays(2), 2, "pay"), default)).Hold!;
        f.Gateway.FailOnce = true;
        Assert.Equal(503, (await f.Payment().Start(hold.Code, default)).StatusCode);
        f.Db.ChangeTracker.Clear();
        Assert.Equal(ShortStayReservationStatus.PendingPayment, (await f.Db.ShortStayReservations.SingleAsync()).Status);
        Assert.Equal(2, await f.Db.ShortStayOccupancyClaims.CountAsync());
        Assert.Equal(200, (await f.Payment().Start(hold.Code, default)).StatusCode);
    }
    [Fact]
    public async Task Changed_payee_authority_blocks_payment_before_provider_call()
    {
        await using var f = await Fixture.Create();
        var hold = (await f.Service().Create(10, new(Arrival, Arrival.AddDays(2), 2, "pay"), default)).Hold!;
        f.Db.OrganizationMembers.Single().CanManageProperties = false;
        await f.Db.SaveChangesAsync();
        Assert.Equal(503, (await f.Payment().Start(hold.Code, default)).StatusCode);
        Assert.Equal(0, f.Gateway.Creates);
    }
    [Fact]
    public async Task Pending_payment_cannot_be_expired_by_cleanup_or_release_claims()
    {
        await using var f = await Fixture.Create();
        var hold = (await f.Service().Create(10, new(Arrival, Arrival.AddDays(2), 2, "pay"), default)).Hold!;
        Assert.Equal(200, (await f.Payment().Start(hold.Code, default)).StatusCode);
        f.Db.ChangeTracker.Clear();
        var reservation = await f.Db.ShortStayReservations.SingleAsync();
        f.Db.Entry(reservation).Property(x => x.Status).CurrentValue = ShortStayReservationStatus.Expired;
        f.Db.Entry(reservation).Property(x => x.RowVersion).CurrentValue++;
        Assert.Throws<InvalidOperationException>(() => f.Db.SaveChanges());
    }
    [Fact]
    public async Task Hold_is_server_priced_and_replay_is_immutable()
    {
        await using var f = await Fixture.Create();
        var request = new ShortStayHoldRequest(Arrival, Arrival.AddDays(2), 2, "guest-key");
        var result = await f.Service().Create(10, request, default);
        Assert.Equal(201, result.StatusCode);
        Assert.Equal(18150, result.Hold!.TotalCents);
        Assert.Equal("acct_owned", (await f.Db.ShortStayReservations.SingleAsync()).DestinationStripeAccountId);
        Assert.Equal(2, await f.Db.ShortStayOccupancyClaims.CountAsync());
        f.Db.ShortStayListings.Single().NightlyBasePrice = 200;
        await f.Db.SaveChangesAsync();
        var replay = await f.Service().Create(10, request, default);
        Assert.Equal(200, replay.StatusCode);
        Assert.Equal(result.Hold, replay.Hold);
        f.Http.Items["OrganizationId"] = 21L;
        Assert.Equal(200, (await f.Service().Create(10, request, default)).StatusCode);
        Assert.Equal(409, (await f.Service().Create(10, request with { CheckOut = Arrival.AddDays(3) }, default)).StatusCode);
    }
    [Fact]
    public async Task Gate_auth_and_provider_fail_closed()
    {
        await using var f = await Fixture.Create();
        var request = new ShortStayHoldRequest(Arrival, Arrival.AddDays(1), 1, "key");
        Assert.Equal(503, (await f.Service(false).Create(10, request, default)).StatusCode);
        f.Http.User = new ClaimsPrincipal();
        Assert.Equal(403, (await f.Service().Create(10, request, default)).StatusCode);
        f.Http.User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, "5")], "test"));
        f.Stripe.Ready = false;
        Assert.Equal(503, (await f.Service().Create(10, request, default)).StatusCode);
        Assert.Empty(await f.Db.ShortStayReservations.ToListAsync());
    }
    [Fact]
    public async Task Owner_and_missing_feed_cannot_book()
    {
        await using var f = await Fixture.Create();
        var request = new ShortStayHoldRequest(Arrival, Arrival.AddDays(1), 1, "key");
        f.Http.User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, "42")], "test"));
        f.Http.Items["UserId"] = 42L;
        Assert.Equal(403, (await f.Service().Create(10, request, default)).StatusCode);
        f.Http.User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, "5")], "test"));
        f.Http.Items["UserId"] = 5L;
        f.Db.ShortStayIcalSubscriptions.Remove(f.Db.ShortStayIcalSubscriptions.Single());
        await f.Db.SaveChangesAsync();
        Assert.Equal(409, (await f.Service().Create(10, request, default)).StatusCode);
    }
    [Fact]
    public async Task Controller_rejects_untrusted_body_fields()
    {
        await using var f = await Fixture.Create();
        var controller = new ShortStayHoldController(f.Service()) { ControllerContext = new ControllerContext { HttpContext = f.Http } };
        var result = await controller.Create(10, new ShortStayHoldRequest(Arrival, Arrival.AddDays(1), 1, "key"), default);
        Assert.Equal(201, ((ObjectResult)result).StatusCode);
        var forged = System.Text.Json.JsonSerializer.Deserialize<ShortStayHoldRequest>("""{"CheckIn":"2026-11-01","CheckOut":"2026-11-02","Guests":1,"IdempotencyKey":"key2","TotalCents":1}""")!;
        Assert.Equal(400, ((ObjectResult)await controller.Create(10, forged, default)).StatusCode);
    }
    [Fact]
    public async Task Expired_hold_releases_all_its_nights_and_new_guest_can_claim()
    {
        await using var f = await Fixture.Create();
        var expired = ShortStayReservation.CreateHold(10, 7, 20, 6, 42, "acct_owned", Arrival,
            Arrival.AddDays(2), 1, [7500L, 7500L], Now.AddMinutes(-1), Now.AddMinutes(-11));
        f.Db.ShortStayReservations.Add(expired);
        await f.Db.SaveChangesAsync();
        var result = await f.Service().Create(10, new(Arrival, Arrival.AddDays(1), 1, "new-key"), default);
        Assert.Equal(201, result.StatusCode);
        f.Db.ChangeTracker.Clear();
        Assert.Equal(ShortStayReservationStatus.Expired, (await f.Db.ShortStayReservations.SingleAsync(r => r.Id == expired.Id)).Status);
        Assert.Single(await f.Db.ShortStayOccupancyClaims.ToListAsync());
    }
    [Fact]
    public async Task Live_claim_prevents_double_booking_and_scopes_idempotency_by_guest()
    {
        await using var f = await Fixture.Create();
        var request = new ShortStayHoldRequest(Arrival, Arrival.AddDays(1), 1, "same-key");
        Assert.Equal(201, (await f.Service().Create(10, request, default)).StatusCode);
        f.Http.User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, "6")], "test"));
        f.Http.Items["UserId"] = 6L;
        Assert.Equal(409, (await f.Service().Create(10, request, default)).StatusCode);
        f.Http.Items["OrganizationId"] = 21L;
        Assert.Equal(409, (await f.Service().Create(10, request with { IdempotencyKey = "other" }, default)).StatusCode);
    }
    [Fact]
    public async Task Product_amount_ceiling_fails_without_claims()
    {
        await using var f = await Fixture.Create();
        f.Db.ShortStayListings.Single().NightlyBasePrice = 2000m;
        await f.Db.SaveChangesAsync();
        Assert.Equal(400, (await f.Service().Create(10, new(Arrival, Arrival.AddDays(1), 1, "large"), default)).StatusCode);
        Assert.Empty(await f.Db.ShortStayOccupancyClaims.ToListAsync());
    }
    [Fact]
    public async Task Owner_cannot_replay_an_old_guest_hold_after_becoming_the_owner()
    {
        await using var f = await Fixture.Create();
        var request = new ShortStayHoldRequest(Arrival, Arrival.AddDays(1), 1, "changed-owner");
        Assert.Equal(201, (await f.Service().Create(10, request, default)).StatusCode);
        f.Db.Properties.Single().LandlordId = 5;
        await f.Db.SaveChangesAsync();
        Assert.Equal(403, (await f.Service().Create(10, request, default)).StatusCode);
    }
    [Fact]
    public async Task Guest_with_unrelated_selected_organization_can_book()
    {
        await using var f = await Fixture.Create();
        f.Http.Items["OrganizationId"] = 999L;
        f.Db.Organizations.Add(new Organization { Id = 999, IsActive = true });
        f.Db.OrganizationMembers.Add(new OrganizationMember { OrganizationId = 999, UserId = 5, IsActive = true });
        await f.Db.SaveChangesAsync();
        Assert.Equal(201, (await f.Service().Create(10, new(Arrival, Arrival.AddDays(1), 1, "cross-org"), default)).StatusCode);
        Assert.Equal(20, (await f.Db.ShortStayReservations.SingleAsync()).OrganizationId);
    }
    [Fact]
    public async Task Unpublished_unit_is_indistinguishable_from_missing_unit()
    {
        await using var f = await Fixture.Create();
        f.Db.ShortStayListings.Single().Status = ShortStayListingStatus.Draft;
        await f.Db.SaveChangesAsync();
        var request = new ShortStayHoldRequest(Arrival, Arrival.AddDays(1), 1, "private");
        Assert.Equal(await f.Service().Create(999, request, default), await f.Service().Create(10, request, default));
    }
    [Fact]
    public async Task Owner_account_is_used_instead_of_organization_operating_account()
    {
        await using var f = await Fixture.Create();
        f.Db.BankAccounts.Single().StripeAccountId = "acct_organization";
        await f.Db.SaveChangesAsync();
        Assert.Equal(201, (await f.Service().Create(10, new(Arrival, Arrival.AddDays(1), 1, "owner-account"), default)).StatusCode);
        Assert.Equal("acct_owned", (await f.Db.ShortStayReservations.SingleAsync()).DestinationStripeAccountId);
    }
    [Fact]
    public async Task Manager_payee_requires_live_property_management_authority()
    {
        await using var f = await Fixture.Create();
        var member = f.Db.OrganizationMembers.Single();
        member.Role = "Manager";
        member.CanManageProperties = false;
        await f.Db.SaveChangesAsync();
        var request = new ShortStayHoldRequest(Arrival, Arrival.AddDays(1), 1, "manager");
        Assert.Equal(503, (await f.Service().Create(10, request, default)).StatusCode);
        member.CanManageProperties = true;
        await f.Db.SaveChangesAsync();
        Assert.Equal(201, (await f.Service().Create(10, request, default)).StatusCode);
    }
    [Fact]
    public async Task Optional_review_requires_exact_approved_property_scope_when_enabled()
    {
        await using var f = await Fixture.Create();
        var request = new ShortStayHoldRequest(Arrival, Arrival.AddDays(1), 1, "review");
        Assert.Equal(503, (await f.Service(approval: true).Create(10, request, default)).StatusCode);
        var app = new ShortStayCollectionApplication { OrganizationId = 20, ApplicantUserId = 42, StripeAccountId = "acct_owned",
            Status = ShortStayCollectionApplicationStatus.PayoutApproved, FeePolicyConsentVersion = "v1",
            SubmittedAt = Now, ApprovedAt = Now, AuthorityAttestedAt = Now };
        app.Properties.Add(new ShortStayCollectionApplicationProperty { PropertyId = 8 });
        f.Db.ShortStayCollectionApplications.Add(app);
        await f.Db.SaveChangesAsync();
        Assert.Equal(503, (await f.Service(approval: true).Create(10, request, default)).StatusCode);
        app.Properties.Clear();
        app.Properties.Add(new ShortStayCollectionApplicationProperty { PropertyId = 7 });
        await f.Db.SaveChangesAsync();
        Assert.Equal(201, (await f.Service(approval: true).Create(10, request, default)).StatusCode);
    }
}
