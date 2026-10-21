using System.Reflection;
using System.Security.Claims;
using System.Text.Json;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace brownstone_hub_api.Tests.Controllers;

public sealed class ShortStayReservationStatusTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 21, 12, 0, 0, TimeSpan.Zero);
    private static readonly DateOnly Arrival = new(2026, 11, 1);

    private sealed class Fixture : IDisposable
    {
        public DataContext Db { get; } = new(new DbContextOptionsBuilder<DataContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        public DefaultHttpContext Http { get; } = new();
        public ShortStayReservation Reservation { get; }
        public Fixture(ShortStayReservationStatus status = ShortStayReservationStatus.Held)
        {
            Reservation = ShortStayReservation.CreateHold(10, 7, 20, 5, 42, "acct_PRIVATE", Arrival,
                Arrival.AddDays(2), 2, [7500L, 7500L], Now.AddMinutes(10), Now, 1500, 1650);
            Db.ShortStayReservations.Add(Reservation);
            Db.SaveChanges();
            if (status == ShortStayReservationStatus.Expired)
            {
                Reservation.ExpireHold(Now.AddMinutes(11));
                Db.SaveChanges();
            }
            else if (status != ShortStayReservationStatus.Held)
            {
                Reservation.BeginPayment(Now.AddMinutes(1));
                Db.SaveChanges();
                Reservation.AttachPaymentIntent("pi_PRIVATE", Now.AddMinutes(1));
                Db.SaveChanges();
                if (status is ShortStayReservationStatus.Processing or ShortStayReservationStatus.Confirmed or
                    ShortStayReservationStatus.Failed or ShortStayReservationStatus.RefundRequired)
                {
                    Reservation.Reconcile(status, Now.AddMinutes(2));
                    Db.SaveChanges();
                }
                else if (status is ShortStayReservationStatus.Refunded or ShortStayReservationStatus.Disputed)
                {
                    Reservation.Reconcile(status == ShortStayReservationStatus.Refunded
                        ? ShortStayReservationStatus.RefundRequired : ShortStayReservationStatus.Confirmed, Now.AddMinutes(2));
                    Db.SaveChanges();
                    if (status == ShortStayReservationStatus.Refunded) Reservation.MarkRefunded(Now.AddMinutes(3));
                    else Reservation.Reconcile(ShortStayReservationStatus.Disputed, Now.AddMinutes(3));
                    Db.SaveChanges();
                }
            }
            Login(5);
        }
        public void Login(long id)
        {
            Http.User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, id.ToString())], "test"));
            Http.Items["UserId"] = id;
        }
        public ShortStayReservationStatusController Controller() => new(Db, new HttpContextAccessor { HttpContext = Http })
            { ControllerContext = new ControllerContext { HttpContext = Http } };
        public void Dispose() => Db.Dispose();
    }

    [Fact]
    public void Route_requires_authorization_without_feature_gate_or_body()
    {
        var type = typeof(ShortStayReservationStatusController);
        Assert.NotNull(type.GetCustomAttribute<AuthorizeAttribute>());
        Assert.Equal("api/short-stay/holds", type.GetCustomAttribute<RouteAttribute>()?.Template);
        var method = type.GetMethod(nameof(ShortStayReservationStatusController.Get))!;
        Assert.Equal("{code}", method.GetCustomAttribute<HttpGetAttribute>()?.Template);
        Assert.DoesNotContain(method.GetParameters(), p => p.GetCustomAttribute<FromBodyAttribute>() is not null);
    }

    [Theory]
    [InlineData(ShortStayReservationStatus.Held, "Held")]
    [InlineData(ShortStayReservationStatus.PendingPayment, "PendingPayment")]
    [InlineData(ShortStayReservationStatus.Processing, "Processing")]
    [InlineData(ShortStayReservationStatus.Confirmed, "Confirmed")]
    [InlineData(ShortStayReservationStatus.RefundRequired, "RefundRequired")]
    [InlineData(ShortStayReservationStatus.Failed, "Failed")]
    [InlineData(ShortStayReservationStatus.Expired, "Expired")]
    [InlineData(ShortStayReservationStatus.Refunded, "Refunded")]
    [InlineData(ShortStayReservationStatus.Disputed, "Disputed")]
    public async Task Status_and_immutable_quote_are_safe_and_truthful(ShortStayReservationStatus status, string expected)
    {
        using var f = new Fixture(status);
        f.Db.ChangeTracker.Clear();
        f.Http.Items["OrganizationId"] = 999L;
        var result = Assert.IsType<OkObjectResult>(await f.Controller().Get(f.Reservation.PublicCode, default));
        using var json = JsonDocument.Parse(JsonSerializer.Serialize(result.Value));
        var body = json.RootElement;
        Assert.Equal(expected, body.GetProperty("status").GetString());
        Assert.Equal(f.Reservation.PublicCode, body.GetProperty("publicCode").GetString());
        Assert.Equal(Arrival.ToString("yyyy-MM-dd"), body.GetProperty("checkIn").GetString());
        Assert.Equal(Arrival.AddDays(2).ToString("yyyy-MM-dd"), body.GetProperty("checkOut").GetString());
        Assert.Equal(2, body.GetProperty("guestCount").GetInt32());
        Assert.Equal(15000, body.GetProperty("nightlySubtotalCents").GetInt64());
        Assert.Equal(1500, body.GetProperty("cleaningFeeCents").GetInt64());
        Assert.Equal(1650, body.GetProperty("taxCents").GetInt64());
        Assert.Equal(18150, body.GetProperty("totalCents").GetInt64());
        Assert.Equal(Now.AddMinutes(10), body.GetProperty("holdExpiresAt").GetDateTimeOffset());
        Assert.False(string.IsNullOrWhiteSpace(body.GetProperty("message").GetString()));
        if (status != ShortStayReservationStatus.Confirmed)
            Assert.DoesNotContain("confirm", body.GetProperty("message").GetString()!, StringComparison.OrdinalIgnoreCase);
        var serialized = body.GetRawText();
        foreach (var forbidden in new[] { "pi_PRIVATE", "acct_PRIVATE", "clientSecret", "paymentIntentId", "guestUserId", "payeeUserId", "organizationId", "operationId", "destinationStripeAccountId", "email" })
            Assert.DoesNotContain(forbidden, serialized, StringComparison.OrdinalIgnoreCase);
        Assert.Equal("no-store, no-cache", f.Http.Response.Headers.CacheControl.ToString());
    }

    [Fact]
    public async Task Other_guest_owner_and_admin_cannot_read_even_with_code()
    {
        using var f = new Fixture();
        foreach (var id in new[] { 6L, 42L, 1L })
        {
            f.Login(id);
            Assert.IsType<NotFoundResult>(await f.Controller().Get(f.Reservation.PublicCode, default));
        }
        f.Login(5);
        Assert.IsType<NotFoundResult>(await f.Controller().Get(new string('F', 32), default));
        Assert.Equal("no-store, no-cache", f.Http.Response.Headers.CacheControl.ToString());
    }

    [Fact]
    public async Task Anonymous_mismatched_identity_and_invalid_code_fail_closed()
    {
        using var f = new Fixture();
        f.Http.User = new ClaimsPrincipal();
        Assert.IsType<ForbidResult>(await f.Controller().Get(f.Reservation.PublicCode, default));
        f.Login(5);
        f.Http.Items["UserId"] = 42L;
        Assert.IsType<ForbidResult>(await f.Controller().Get(f.Reservation.PublicCode, default));
        f.Login(5);
        foreach (var code in new[] { "", "abc", new string('Z', 32), new string('A', 33) })
            Assert.IsType<BadRequestResult>(await f.Controller().Get(code, default));
    }
}
