using System.Security.Claims;
using System.Data.Common;
using Microsoft.EntityFrameworkCore.Diagnostics;
using brownstone_hub_api.Attributes;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.ShortStay;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.ShortStay;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Units;

public sealed class ShortStayCollectionApiTests
{
    private static SaveShortStayCollectionDraftDto Draft(params long[] ids) => new(ids, true, "fees-v1");

    [Fact]
    public void Routes_are_authenticated_and_role_gated()
    {
        var type = typeof(ShortStayCollectionController);
        Assert.NotNull(type.GetCustomAttributes(typeof(AuthorizeAttribute), true).SingleOrDefault());
        Assert.Equal(new[] { "Owner", "Manager" }, type.GetCustomAttributes(typeof(RequireOrganizationRoleAttribute), true)
            .Cast<RequireOrganizationRoleAttribute>().Single().AllowedRoles);
        Assert.All(new[] { nameof(ShortStayCollectionController.Get), nameof(ShortStayCollectionController.Requirements), nameof(ShortStayCollectionController.Put), nameof(ShortStayCollectionController.Submit) },
            method => Assert.NotNull(type.GetMethod(method)));
        Assert.Equal("requirements", typeof(ShortStayCollectionController).GetMethod(nameof(ShortStayCollectionController.Requirements))!
            .GetCustomAttributes(typeof(Microsoft.AspNetCore.Mvc.HttpGetAttribute), false)
            .Cast<Microsoft.AspNetCore.Mvc.HttpGetAttribute>().Single().Template);
        Assert.Equal(3, typeof(SaveShortStayCollectionDraftDto).GetProperties().Length);
        Assert.Throws<System.Text.Json.JsonException>(() => System.Text.Json.JsonSerializer.Deserialize<SaveShortStayCollectionDraftDto>(
            "{\"propertyIds\":[7],\"authorityAttested\":true,\"feePolicyConsentVersion\":\"fees-v1\",\"stripeAccountId\":\"acct_forged\"}",
            new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web)));
    }

    [Theory]
    [InlineData(null, "https://app.propertypeace.io/legal/fees", true, "fee_policy_unavailable")]
    [InlineData("  ", "https://app.propertypeace.io/legal/fees", true, "fee_policy_unavailable")]
    [InlineData("fees-v1", null, true, "fee_policy_unavailable")]
    [InlineData("fees-v1", "http://app.propertypeace.io/legal/fees", true, "fee_policy_unavailable")]
    [InlineData("fees-v1", "https://evil.example/legal/fees", true, "fee_policy_unavailable")]
    [InlineData("fees-v1", "https://app.propertypeace.io.evil.example/legal/fees", true, "fee_policy_unavailable")]
    [InlineData("fees-v1", "https://app.propertypeace.io@evil.example/legal/fees", true, "fee_policy_unavailable")]
    [InlineData("fees-v1", "https://app.propertypeace.io/legal/../redirect", true, "fee_policy_unavailable")]
    [InlineData("fees-v1", "https://app.propertypeace.io/legal/fees?next=https://evil.example", true, "fee_policy_unavailable")]
    [InlineData("fees-v1", "https://app.propertypeace.io/other", true, "fee_policy_unavailable")]
    public async Task Requirements_fail_closed_on_missing_or_unsafe_policy(
        string? version, string? url, bool identityEnabled, string reason)
    {
        await using var f = await Fixture.Create();
        var response = await f.Service(policyVersion: version, policyUrl: url, identityEnabled: identityEnabled).GetRequirements();
        Assert.Equal(200, response.StatusCode);
        Assert.False(response.Data!.Available);
        Assert.Null(response.Data.FeePolicyConsentVersion);
        Assert.Null(response.Data.FeePolicyUrl);
        Assert.Equal(identityEnabled, response.Data.IdentityEnabled);
        Assert.Equal(reason, response.Data.ReasonCode);
    }

    [Fact]
    public async Task Requirements_return_only_configured_policy_for_authorized_manager()
    {
        await using var f = await Fixture.Create();
        (await f.Db.OrganizationMembers.SingleAsync()).Role = "Manager";
        await f.Db.SaveChangesAsync();
        const string url = "https://app.propertypeace.io/legal/collection-fees";
        var service = f.Service(policyUrl: url, identityEnabled: true);
        var result = await service.GetRequirements();
        Assert.Equal(200, result.StatusCode);
        Assert.True(result.Data!.Available);
        Assert.Equal("fees-v1", result.Data.FeePolicyConsentVersion);
        Assert.Equal(url, result.Data.FeePolicyUrl);
        Assert.True(result.Data.IdentityEnabled);
        Assert.Null(result.Data.ReasonCode);
        Assert.Equal(5, typeof(ShortStayCollectionRequirementsDto).GetProperties().Length);
        var json = System.Text.Json.JsonSerializer.Serialize(result.Data);
        Assert.DoesNotContain("acct_", json);
        Assert.DoesNotContain("Secret", json);
        Assert.Equal(403, (await f.Service(org: 21, policyUrl: url, identityEnabled: true).GetRequirements()).StatusCode);
        Assert.Equal(403, (await f.Service(subject: 99, policyUrl: url, identityEnabled: true).GetRequirements()).StatusCode);
        (await f.Db.OrganizationMembers.SingleAsync()).IsActive = false;
        await f.Db.SaveChangesAsync();
        Assert.Equal(403, (await service.GetRequirements()).StatusCode);
    }

    [Theory]
    [InlineData(null, true)]
    [InlineData("https://evil.example/legal/fees", true)]
    [InlineData("https://app.propertypeace.io/legal/fees?redirect=1", true)]
    public async Task Unpublished_policy_blocks_owner_mutations_without_writes_or_provider_calls(string? url, bool identityEnabled)
    {
        await using var f = await Fixture.Create();
        var gateway = new FakeIdentity();
        var valid = f.Service(gateway: gateway);
        Assert.Equal(201, (await valid.Put(Draft(7))).StatusCode);
        var id = (await valid.Submit()).Data!.Id;
        Assert.Equal(200, (await valid.IdentitySession(id)).StatusCode);
        f.Db.ChangeTracker.Clear();
        var before = await f.Db.ShortStayCollectionApplications.AsNoTracking().SingleAsync();
        var blocked = f.Service(gateway: gateway, policyUrl: url, identityEnabled: identityEnabled);
        Assert.False((await blocked.GetRequirements()).Data!.Available);
        Assert.Equal(503, (await blocked.Put(Draft(8))).StatusCode);
        Assert.Equal(503, (await blocked.Submit()).StatusCode);
        Assert.Equal(503, (await blocked.IdentitySession(id)).StatusCode);
        Assert.Equal(503, (await blocked.IdentityRefresh(id)).StatusCode);
        Assert.Equal(200, (await blocked.Get()).StatusCode);
        Assert.Equal(1, gateway.Creates);
        Assert.Equal(0, gateway.Gets);
        f.Db.ChangeTracker.Clear();
        var after = await f.Db.ShortStayCollectionApplications.AsNoTracking().SingleAsync();
        Assert.Equal(before.RowVersion, after.RowVersion);
        Assert.Equal(before.Status, after.Status);
    }

    [Fact]
    public async Task Missing_policy_url_blocks_new_draft_before_any_write()
    {
        await using var f = await Fixture.Create();
        Assert.Equal(503, (await f.Service(policyUrl: null).Put(Draft(7))).StatusCode);
        Assert.Empty(await f.Db.ShortStayCollectionApplications.AsNoTracking().ToListAsync());
        Assert.Equal(201, (await f.Service().Put(Draft(7))).StatusCode);
        Assert.Equal(503, (await f.Service(policyUrl: null).Submit()).StatusCode);
        f.Db.ChangeTracker.Clear();
        Assert.Equal(ShortStayCollectionApplicationStatus.Draft,
            (await f.Db.ShortStayCollectionApplications.AsNoTracking().SingleAsync()).Status);
    }

    [Fact]
    public async Task Draft_edit_submit_freezes_scope_and_account_and_returns_only_safe_status()
    {
        await using var f = await Fixture.Create();
        var service = f.Service();
        Assert.Empty((await service.Get()).Data!);
        Assert.Equal(201, (await service.Put(Draft(7))).StatusCode);
        Assert.Equal(200, (await service.Put(Draft(8))).StatusCode);
        var submitted = await service.Submit();
        Assert.Equal(200, submitted.StatusCode);
        Assert.Equal(ShortStayCollectionApplicationStatus.Submitted, submitted.Data!.Status);
        Assert.Equal(new[] { 8L }, submitted.Data.PropertyIds);
        Assert.Equal(409, (await service.Put(Draft(7))).StatusCode);
        Assert.Equal(409, (await service.Submit()).StatusCode);
        var row = await f.Db.ShortStayCollectionApplications.Include(x => x.Properties).SingleAsync();
        Assert.Equal("acct_owner", row.StripeAccountId);
        Assert.Equal(3, row.RowVersion);
        Assert.Equal(new[] { 8L }, row.Properties.Select(x => x.PropertyId));
        Assert.DoesNotContain("acct_owner", System.Text.Json.JsonSerializer.Serialize(submitted.Data));
        Assert.DoesNotContain("SessionId", System.Text.Json.JsonSerializer.Serialize(submitted.Data));
    }

    [Theory]
    [InlineData("Viewer", true, true, 403)]
    [InlineData("Manager", false, true, 403)]
    [InlineData("Manager", true, true, 201)]
    [InlineData("Owner", false, false, 403)]
    [InlineData("Owner", false, true, 403)]
    public async Task Role_permission_and_active_membership_gate_all_operations(string role, bool manage, bool active, int status)
    {
        await using var f = await Fixture.Create();
        var member = await f.Db.OrganizationMembers.SingleAsync();
        member.Role = role; member.CanManageProperties = manage; member.IsActive = active;
        await f.Db.SaveChangesAsync();
        var service = f.Service();
        Assert.Equal(status == 201 ? 200 : 403, (await service.Get()).StatusCode);
        Assert.Equal(status, (await service.Put(Draft(7))).StatusCode);
        if (status != 201) Assert.Equal(403, (await service.Submit()).StatusCode);
    }

    [Fact]
    public async Task Context_property_and_consent_are_never_trusted()
    {
        await using var f = await Fixture.Create();
        foreach (var service in new[] { f.Service(null), f.Service(21), f.Service(20, 99) })
        {
            Assert.Equal(403, (await service.Get()).StatusCode);
            Assert.Equal(403, (await service.Put(Draft(7))).StatusCode);
            Assert.Equal(403, (await service.Submit()).StatusCode);
        }
        foreach (var ids in new[] { new[] { 999L }, new[] { 9L }, new[] { 10L }, new[] { 7L, 7L }, Array.Empty<long>(), Enumerable.Range(1, 51).Select(x => (long)x).ToArray() })
            Assert.NotEqual(201, (await f.Service().Put(Draft(ids))).StatusCode);
        Assert.Equal(400, (await f.Service().Put(new([7], false, "fees-v1"))).StatusCode);
        Assert.Equal(400, (await f.Service().Put(new([7], true, "made-up"))).StatusCode);
        Assert.Equal(503, (await f.Service(configured: false).Put(Draft(7))).StatusCode);
        Assert.Empty(await f.Db.ShortStayCollectionApplications.ToListAsync());
    }

    [Fact]
    public async Task Account_mapping_is_exact_and_draft_account_change_blocks_submit()
    {
        await using var f = await Fixture.Create();
        var user = await f.Db.Users.SingleAsync();
        user.StripeAccountId = null;
        await f.Db.SaveChangesAsync();
        Assert.Equal(409, (await f.Service().Put(Draft(7))).StatusCode);
        user.StripeAccountId = "acct_owner";
        var review = await f.Db.StripeConnectedPayeeReviews.SingleAsync();
        review.UserId = 99;
        await f.Db.SaveChangesAsync();
        Assert.Equal(409, (await f.Service().Put(Draft(7))).StatusCode);
        review.UserId = 42;
        await f.Db.SaveChangesAsync();
        Assert.Equal(201, (await f.Service().Put(Draft(7))).StatusCode);
        user.StripeAccountId = "acct_other";
        await f.Db.SaveChangesAsync();
        Assert.Equal(409, (await f.Service().Submit()).StatusCode);
        Assert.Equal(ShortStayCollectionApplicationStatus.Draft, (await f.Db.ShortStayCollectionApplications.SingleAsync()).Status);
    }

    [Fact]
    public async Task Duplicate_active_application_is_conflict()
    {
        await using var f = await Fixture.Create();
        Assert.Equal(201, (await f.Service().Put(Draft(7))).StatusCode);
        f.Db.ChangeTracker.Clear();
        f.Db.ShortStayCollectionApplications.Add(new ShortStayCollectionApplication { OrganizationId = 20, ApplicantUserId = 42,
            StripeAccountId = "acct_owner", CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow });
        await Assert.ThrowsAsync<DbUpdateException>(() => f.Db.SaveChangesAsync());
    }

    [Fact]
    public async Task Ambiguous_account_review_and_invalidated_property_block_submission()
    {
        await using var f = await Fixture.Create();
        f.Db.StripeConnectedPayeeReviews.Add(new StripeConnectedPayeeReview { UserId = 99, StripeAccountId = "acct_owner" });
        await Assert.ThrowsAsync<DbUpdateException>(() => f.Db.SaveChangesAsync());
        f.Db.ChangeTracker.Clear();
        Assert.Equal(201, (await f.Service().Put(Draft(7))).StatusCode);
        var property = await f.Db.Properties.SingleAsync(x => x.Id == 7);
        property.IsDeleted = true;
        await f.Db.SaveChangesAsync();
        Assert.Equal(409, (await f.Service().Submit()).StatusCode);
        Assert.Equal(ShortStayCollectionApplicationStatus.Draft, (await f.Db.ShortStayCollectionApplications.SingleAsync()).Status);
    }

    [Fact]
    public async Task Concurrent_stale_draft_edit_cannot_revert_submitted_status()
    {
        await using var f = await Fixture.Create();
        Assert.Equal(201, (await f.Service().Put(Draft(7))).StatusCode);
        f.Db.ChangeTracker.Clear();
        await using var other = f.NewContext();
        var stale = await other.ShortStayCollectionApplications.SingleAsync();
        Assert.Equal(200, (await f.Service().Submit()).StatusCode);
        stale.Status = ShortStayCollectionApplicationStatus.Draft;
        stale.RowVersion++;
        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => other.SaveChangesAsync());
    }

    [Theory]
    [InlineData(false, "revoked")]
    [InlineData(false, "deactivated")]
    [InlineData(false, "permission")]
    [InlineData(false, "role")]
    [InlineData(false, "organization")]
    [InlineData(true, "revoked")]
    [InlineData(true, "deactivated")]
    [InlineData(true, "permission")]
    [InlineData(true, "role")]
    [InlineData(true, "organization")]
    public async Task Mutation_rechecks_authority_after_preflight_before_any_write(bool submit, string change)
    {
        await using var f = await Fixture.Create();
        if (submit) Assert.Equal(201, (await f.Service().Put(Draft(7))).StatusCode);
        f.Db.ChangeTracker.Clear();
        var before = await f.Db.ShortStayCollectionApplications.AsNoTracking().Select(x => x.RowVersion).SingleOrDefaultAsync();
        f.BeforeTransaction = async () =>
        {
            await using var other = f.NewContext();
            if (change == "organization")
                (await other.Organizations.SingleAsync(x => x.Id == 20)).IsActive = false;
            else
            {
                var member = await other.OrganizationMembers.SingleAsync();
                switch (change)
                {
                    case "revoked": other.OrganizationMembers.Remove(member); break;
                    case "deactivated": member.IsActive = false; break;
                    case "permission": member.CanManageProperties = false; break;
                    case "role": member.Role = "Viewer"; break;
                }
            }
            await other.SaveChangesAsync();
        };
        Assert.Equal(403, (submit ? await f.Service().Submit() : await f.Service().Put(Draft(8))).StatusCode);
        Assert.Equal(1, f.TransactionHooksFired);
        f.Db.ChangeTracker.Clear();
        var apps = await f.Db.ShortStayCollectionApplications.AsNoTracking().Include(x => x.Properties).ToListAsync();
        if (submit)
        {
            Assert.Single(apps);
            Assert.Equal(before, apps[0].RowVersion);
            Assert.Equal(ShortStayCollectionApplicationStatus.Draft, apps[0].Status);
            Assert.Equal(new[] { 7L }, apps[0].Properties.Select(x => x.PropertyId));
        }
        else Assert.Empty(apps);
    }

    [Theory]
    [InlineData(false, "property")]
    [InlineData(false, "account")]
    [InlineData(true, "property")]
    [InlineData(true, "account")]
    public async Task Mutation_revalidates_property_and_payee_after_preflight(bool submit, string change)
    {
        await using var f = await Fixture.Create();
        if (submit) Assert.Equal(201, (await f.Service().Put(Draft(7))).StatusCode);
        f.Db.ChangeTracker.Clear();
        f.BeforeTransaction = async () =>
        {
            await using var other = f.NewContext();
            if (change == "property")
                (await other.Properties.SingleAsync(x => x.Id == 7)).IsDeleted = true;
            else
                (await other.Users.SingleAsync(x => x.Id == 42)).StripeAccountId = "acct_changed";
            await other.SaveChangesAsync();
        };
        var response = submit ? await f.Service().Submit() : await f.Service().Put(Draft(7));
        Assert.Equal(409, response.StatusCode);
        Assert.Equal(1, f.TransactionHooksFired);
        f.Db.ChangeTracker.Clear();
        var apps = await f.Db.ShortStayCollectionApplications.AsNoTracking().ToListAsync();
        if (submit)
        {
            Assert.Single(apps);
            Assert.Equal(ShortStayCollectionApplicationStatus.Draft, apps[0].Status);
            Assert.Equal(1, apps[0].RowVersion);
        }
        else Assert.Empty(apps);
    }

    [Fact]
    public async Task Identity_is_bound_to_submitted_applicant_and_existing_session_is_resumed()
    {
        await using var f = await Fixture.Create();
        var gateway = new FakeIdentity();
        var service = f.Service(gateway: gateway);
        Assert.Equal(201, (await service.Put(Draft(7))).StatusCode);
        var id = (await service.Submit()).Data!.Id;
        Assert.Equal(403, (await f.Service(org: 21, gateway: gateway).IdentitySession(id)).StatusCode);
        Assert.Equal(403, (await f.Service(subject: 99, gateway: gateway).IdentitySession(id)).StatusCode);
        Assert.Equal(503, (await f.Service().IdentitySession(id)).StatusCode);
        var first = await service.IdentitySession(id);
        Assert.Equal(200, first.StatusCode);
        Assert.Equal("https://verify.stripe.test/session", first.Data!.Url);
        Assert.Equal(1, gateway.Creates);
        var row = await f.Db.ShortStayCollectionApplications.AsNoTracking().SingleAsync();
        Assert.Equal("vs_bound", row.IdentityVerificationSessionId);
        Assert.Equal(ShortStayCollectionApplicationStatus.IdentityPending, row.Status);
        Assert.Null(row.IdentityVerifiedAt);
        f.Db.ChangeTracker.Clear();
        Assert.Equal(200, (await service.IdentitySession(id)).StatusCode);
        Assert.Equal(1, gateway.Creates);
        Assert.Equal(1, gateway.Gets);
        Assert.Equal(409, (await service.Put(Draft(8))).StatusCode);
    }

    [Fact]
    public async Task Refresh_only_retrieves_bound_session_and_never_approves_payout()
    {
        await using var f = await Fixture.Create();
        var gateway = new FakeIdentity();
        var service = f.Service(gateway: gateway);
        await service.Put(Draft(7));
        var id = (await service.Submit()).Data!.Id;
        Assert.Equal(409, (await service.IdentityRefresh(id)).StatusCode);
        await service.IdentitySession(id);
        f.Db.ChangeTracker.Clear();
        gateway.Status = "processing";
        Assert.Equal(200, (await service.IdentityRefresh(id)).StatusCode);
        f.Db.ChangeTracker.Clear();
        gateway.Status = "verified";
        Assert.Equal(200, (await service.IdentityRefresh(id)).StatusCode);
        f.Db.ChangeTracker.Clear();
        var row = await f.Db.ShortStayCollectionApplications.AsNoTracking().SingleAsync();
        Assert.Equal(ShortStayCollectionApplicationStatus.IdentityVerified, row.Status);
        Assert.NotNull(row.IdentityVerifiedAt);
        Assert.Null(row.ApprovedAt);
        Assert.Equal(409, (await service.IdentitySession(id)).StatusCode);
        Assert.Equal(1, gateway.Creates);
    }

    [Fact]
    public async Task Immediate_provider_verification_binds_returned_session_without_retry_or_client_trust()
    {
        await using var f = await Fixture.Create();
        var gateway = new FakeIdentity { Status = "verified" };
        var service = f.Service(gateway: gateway);
        await service.Put(Draft(7));
        var id = (await service.Submit()).Data!.Id;

        var response = await service.IdentitySession(id);
        Assert.Equal(200, response.StatusCode);
        Assert.Null(response.Data);
        f.Db.ChangeTracker.Clear();
        var row = await f.Db.ShortStayCollectionApplications.AsNoTracking().SingleAsync();
        Assert.Equal("vs_bound", row.IdentityVerificationSessionId);
        Assert.Equal(ShortStayCollectionApplicationStatus.IdentityVerified, row.Status);
        Assert.NotNull(row.IdentityVerifiedAt);
        Assert.Null(row.ApprovedAt);
        Assert.Equal(1, gateway.Creates);
        Assert.Equal(409, (await service.IdentitySession(id)).StatusCode);
        Assert.Equal(1, gateway.Creates);
        Assert.Equal(0, gateway.Gets);
    }

    [Fact]
    public async Task Applicant_status_policy_and_mutation_routes_set_no_store_headers_on_success_and_errors()
    {
        await using var f = await Fixture.Create();

        async Task AssertHeaders(ShortStayCollectionController controller, Func<Task<Microsoft.AspNetCore.Mvc.IActionResult>> action, int expectedStatus)
        {
            controller.Response.Headers.Clear();
            var result = await action();
            Assert.Equal(expectedStatus, ((Microsoft.AspNetCore.Mvc.ObjectResult)result).StatusCode);
            Assert.Equal("no-store", controller.Response.Headers.CacheControl.ToString());
            Assert.Equal("no-cache", controller.Response.Headers.Pragma.ToString());
        }

        var controller = new ShortStayCollectionController(f.Service()) { ControllerContext = new()
            { HttpContext = new DefaultHttpContext() } };
        await AssertHeaders(controller, () => controller.Get(default), 200);
        await AssertHeaders(controller, () => controller.Requirements(default), 200);
        await AssertHeaders(controller, () => controller.Put(Draft(7), default), 201);
        await AssertHeaders(controller, () => controller.Submit(default), 200);

        var forbidden = new ShortStayCollectionController(f.Service(org: 21)) { ControllerContext = new()
            { HttpContext = new DefaultHttpContext() } };
        await AssertHeaders(forbidden, () => forbidden.Get(default), 403);
        await AssertHeaders(forbidden, () => forbidden.Requirements(default), 403);
        await AssertHeaders(forbidden, () => forbidden.Put(Draft(7), default), 403);
        await AssertHeaders(forbidden, () => forbidden.Submit(default), 403);
    }

    [Fact]
    public async Task Identity_routes_set_no_store_headers_on_success_and_errors()
    {
        await using var f = await Fixture.Create();
        var gateway = new FakeIdentity();
        var service = f.Service(gateway: gateway);
        await service.Put(Draft(7));
        var id = (await service.Submit()).Data!.Id;
        var controller = new ShortStayCollectionController(service) { ControllerContext = new()
            { HttpContext = new DefaultHttpContext() } };

        var created = await controller.IdentitySession(id, default);
        Assert.Equal(200, ((Microsoft.AspNetCore.Mvc.ObjectResult)created).StatusCode);
        Assert.Equal("no-store", controller.Response.Headers.CacheControl.ToString());
        Assert.Equal("no-cache", controller.Response.Headers.Pragma.ToString());
        controller.Response.Headers.Clear();

        var refreshed = await controller.IdentityRefresh(id, default);
        Assert.Equal(200, ((Microsoft.AspNetCore.Mvc.ObjectResult)refreshed).StatusCode);
        Assert.Equal("no-store", controller.Response.Headers.CacheControl.ToString());
        Assert.Equal("no-cache", controller.Response.Headers.Pragma.ToString());
        controller.Response.Headers.Clear();

        var error = await controller.IdentitySession(-1, default);
        Assert.Equal(403, ((Microsoft.AspNetCore.Mvc.ObjectResult)error).StatusCode);
        Assert.DoesNotContain("https://verify.stripe.test/session", System.Text.Json.JsonSerializer.Serialize(((Microsoft.AspNetCore.Mvc.ObjectResult)error).Value));
        Assert.Equal("no-store", controller.Response.Headers.CacheControl.ToString());
        Assert.Equal("no-cache", controller.Response.Headers.Pragma.ToString());
        controller.Response.Headers.Clear();
        error = await controller.IdentityRefresh(-1, default);
        Assert.Equal(403, ((Microsoft.AspNetCore.Mvc.ObjectResult)error).StatusCode);
        Assert.Equal("no-store", controller.Response.Headers.CacheControl.ToString());
        Assert.Equal("no-cache", controller.Response.Headers.Pragma.ToString());
    }

    [Theory]
    [InlineData("account")]
    [InlineData("property")]
    [InlineData("policy")]
    public async Task Scope_drift_suspends_bound_identity_instead_of_verifying(string change)
    {
        await using var f = await Fixture.Create();
        var gateway = new FakeIdentity();
        var service = f.Service(gateway: gateway);
        await service.Put(Draft(7));
        var id = (await service.Submit()).Data!.Id;
        await service.IdentitySession(id);
        f.Db.ChangeTracker.Clear();
        await using (var other = f.NewContext())
        {
            if (change == "account") (await other.Users.SingleAsync()).StripeAccountId = "acct_changed";
            if (change == "property") (await other.Properties.SingleAsync(x => x.Id == 7)).IsDeleted = true;
            if (change == "policy") (await other.ShortStayCollectionApplications.SingleAsync()).FeePolicyConsentVersion = "stale";
            await other.SaveChangesAsync();
        }
        f.Db.ChangeTracker.Clear();
        gateway.Status = "verified";
        Assert.Equal(409, (await service.IdentityRefresh(id)).StatusCode);
        f.Db.ChangeTracker.Clear();
        var row = await f.Db.ShortStayCollectionApplications.AsNoTracking().SingleAsync();
        Assert.Equal(ShortStayCollectionApplicationStatus.Suspended, row.Status);
        Assert.Null(row.IdentityVerifiedAt);
    }

    [Fact]
    public async Task Provider_failure_and_expiration_are_safe_and_retry_uses_new_version()
    {
        await using var f = await Fixture.Create();
        var gateway = new FakeIdentity { Fail = true };
        var service = f.Service(gateway: gateway);
        await service.Put(Draft(7));
        var id = (await service.Submit()).Data!.Id;
        Assert.Equal(503, (await service.IdentitySession(id)).StatusCode);
        f.Db.ChangeTracker.Clear();
        Assert.Equal(ShortStayCollectionApplicationStatus.Submitted, (await f.Db.ShortStayCollectionApplications.AsNoTracking().SingleAsync()).Status);
        gateway.Fail = false;
        await service.IdentitySession(id);
        f.Db.ChangeTracker.Clear();
        gateway.Status = "expired";
        await service.IdentityRefresh(id);
        f.Db.ChangeTracker.Clear();
        var row = await f.Db.ShortStayCollectionApplications.AsNoTracking().SingleAsync();
        Assert.Null(row.IdentityVerificationSessionId);
        Assert.Equal(ShortStayCollectionApplicationStatus.Submitted, row.Status);
        gateway.Status = "requires_input";
        await service.IdentitySession(id);
        Assert.Equal(2, gateway.Versions.Distinct().Count());
    }

    [Theory]
    [InlineData("member")]
    [InlineData("organization")]
    public async Task Revoked_authority_suspends_existing_identity_without_provider_call(string change)
    {
        await using var f = await Fixture.Create();
        var gateway = new FakeIdentity();
        var service = f.Service(gateway: gateway);
        await service.Put(Draft(7));
        var id = (await service.Submit()).Data!.Id;
        await service.IdentitySession(id);
        f.Db.ChangeTracker.Clear();
        await using (var other = f.NewContext())
        {
            if (change == "member") (await other.OrganizationMembers.SingleAsync()).IsActive = false;
            else (await other.Organizations.SingleAsync(x => x.Id == 20)).IsActive = false;
            await other.SaveChangesAsync();
        }
        Assert.Equal(403, (await service.IdentityRefresh(id)).StatusCode);
        f.Db.ChangeTracker.Clear();
        Assert.Equal(ShortStayCollectionApplicationStatus.Suspended,
            (await f.Db.ShortStayCollectionApplications.AsNoTracking().SingleAsync()).Status);
        Assert.Equal(0, gateway.Gets);
    }

    [Theory]
    [InlineData("requires_input")]
    [InlineData("verified")]
    public async Task Scope_changed_during_provider_create_is_never_bound(string providerStatus)
    {
        await using var f = await Fixture.Create();
        var gateway = new FakeIdentity { Status = providerStatus };
        var service = f.Service(gateway: gateway);
        await service.Put(Draft(7));
        var id = (await service.Submit()).Data!.Id;
        gateway.BeforeCreate = async () =>
        {
            await using var other = f.NewContext();
            (await other.Users.SingleAsync()).StripeAccountId = "acct_changed";
            await other.SaveChangesAsync();
            f.Db.ChangeTracker.Clear();
        };
        Assert.Equal(409, (await service.IdentitySession(id)).StatusCode);
        f.Db.ChangeTracker.Clear();
        var row = await f.Db.ShortStayCollectionApplications.AsNoTracking().SingleAsync();
        Assert.Equal(ShortStayCollectionApplicationStatus.Submitted, row.Status);
        Assert.Null(row.IdentityVerificationSessionId);
    }

    [Fact]
    public async Task Racing_create_requests_share_one_persisted_binding_and_one_version()
    {
        await using var f = await Fixture.Create();
        var gateway = new FakeIdentity();
        var service = f.Service(gateway: gateway);
        await service.Put(Draft(7));
        var id = (await service.Submit()).Data!.Id;
        gateway.BeforeCreate = async () =>
        {
            f.Db.ChangeTracker.Clear();
            Assert.Equal(200, (await f.Service(gateway: gateway).IdentitySession(id)).StatusCode);
            f.Db.ChangeTracker.Clear();
        };
        var response = await service.IdentitySession(id);
        Assert.Equal(200, response.StatusCode);
        Assert.Equal(2, gateway.Creates);
        Assert.Single(gateway.Versions.Distinct());
        f.Db.ChangeTracker.Clear();
        var bound = await f.Db.ShortStayCollectionApplications.AsNoTracking().SingleAsync();
        Assert.Equal("vs_bound", bound.IdentityVerificationSessionId);
        Assert.Equal(ShortStayCollectionApplicationStatus.IdentityPending, bound.Status);
    }

    private sealed class FakeIdentity : IStripeShortStayIdentityGateway
    {
        public int Creates { get; private set; }
        public int Gets { get; private set; }
        public List<int> Versions { get; } = [];
        public string Status { get; set; } = "requires_input";
        public bool Fail { get; set; }
        public Func<Task>? BeforeCreate { get; set; }
        public Func<Task>? BeforeGet { get; set; }
        public async Task<ShortStayIdentitySession> CreateAsync(string applicationId, string boundUserId, int version, CancellationToken ct = default)
        {
            Creates++;
            Versions.Add(version);
            if (BeforeCreate is { } callback) { BeforeCreate = null; await callback(); }
            if (Fail) throw new InvalidOperationException("sensitive provider detail");
            return new ShortStayIdentitySession("vs_bound", "https://verify.stripe.test/session", Status);
        }
        public async Task<ShortStayIdentitySession> GetAsync(string sessionId, CancellationToken ct = default)
        {
            Gets++;
            if (BeforeGet is { } callback) { BeforeGet = null; await callback(); }
            if (Fail) throw new InvalidOperationException("sensitive provider detail");
            return new ShortStayIdentitySession(sessionId, "https://verify.stripe.test/session", Status);
        }
    }

    [Theory]
    [InlineData("{\"caseReference\":\"CASE1234\"}")]
    [InlineData("{\"caseReference\":\"CASE1234\",\"propertyAuthorityConfirmed\":false}")]
    [InlineData("{\"caseReference\":\"CASE1234\",\"propertyAuthorityConfirmed\":null}")]
    public async Task Direct_admin_approval_without_explicit_authority_confirmation_is_rejected_before_provider(string json)
    {
        await using var f = await Fixture.Create();
        var gateway = new FakeIdentity { Status = "verified" };
        var owner = f.Service(gateway: gateway);
        await owner.Put(Draft(7));
        var id = (await owner.Submit()).Data!.Id;
        await owner.IdentitySession(id);
        f.Db.ChangeTracker.Clear();
        var admin = f.Admin(gateway);
        Assert.Equal(200, (await admin.BeginReview(id)).StatusCode);
        var before = await f.Db.ShortStayCollectionApplications.AsNoTracking().SingleAsync();
        var request = System.Text.Json.JsonSerializer.Deserialize<ApproveShortStayCollectionRequest>(json,
            new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web));
        var controller = new AdminShortStayCollectionController(admin)
        {
            ControllerContext = new Microsoft.AspNetCore.Mvc.ControllerContext { HttpContext = new DefaultHttpContext() }
        };
        var result = await controller.Approve(id, request, default);
        Assert.Equal(400, Assert.IsType<Microsoft.AspNetCore.Mvc.ObjectResult>(result).StatusCode);
        Assert.Equal(0, gateway.Gets);
        f.Db.ChangeTracker.Clear();
        var after = await f.Db.ShortStayCollectionApplications.AsNoTracking().SingleAsync();
        Assert.Equal(before.RowVersion, after.RowVersion);
        Assert.Equal(ShortStayCollectionApplicationStatus.UnderReview, after.Status);
        Assert.Null(after.PropertyAuthorityConfirmedAt);
        Assert.Null(after.ApprovedAt);
        Assert.Null(after.ApprovedByUserId);
        Assert.Null(after.ApprovalCaseReference);
    }

    [Fact]
    public async Task Admin_review_approval_requires_authority_identity_and_fresh_scoped_payee()
    {
        await using var f = await Fixture.Create();
        var gateway = new FakeIdentity { Status = "verified" };
        var owner = f.Service(gateway: gateway);
        await owner.Put(Draft(7));
        var id = (await owner.Submit()).Data!.Id;
        await owner.IdentitySession(id);
        f.Db.ChangeTracker.Clear();
        Assert.Equal(403, (await f.Admin(gateway, 42).BeginReview(id)).StatusCode);
        Assert.Equal(403, (await f.Admin(gateway, 55, false).BeginReview(id)).StatusCode);
        var admin = f.Admin(gateway);
        Assert.True(await f.Db.Users.AnyAsync(u => u.Id == 55 && !u.IsDeleted && !u.IsSuspended && u.UserRoles.Any(r => r.Role.RoleName == "Admin")));
        Assert.Equal(200, (await admin.List()).StatusCode);
        Assert.Equal(200, (await admin.BeginReview(id)).StatusCode);
        Assert.Equal(400, (await admin.Approve(id, "john@example.com", true)).StatusCode);
        Assert.Equal(409, (await admin.Approve(id, "CASE1234", true)).StatusCode);
        var review = await f.Db.StripeConnectedPayeeReviews.SingleAsync();
        review.Status = StripePayeeReviewStatus.PayoutApproved;
        review.ApprovedAt = DateTimeOffset.UtcNow;
        review.ApprovedOrganizationId = 20;
        review.LastStripeSnapshotAt = DateTimeOffset.UtcNow.AddMinutes(-6);
        review.StripeDetailsSubmitted = review.StripePayoutsEnabled = review.StripeTransfersActive = true;
        review.StripeTransferCapabilityStatus = "active";
        review.ExternalAccountFingerprint = "fingerprint";
        await f.Db.SaveChangesAsync();
        Assert.Equal(409, (await admin.Approve(id, "CASE1234", true)).StatusCode);
        review.LastStripeSnapshotAt = DateTimeOffset.UtcNow;
        review.ApprovedOrganizationId = 21;
        await f.Db.SaveChangesAsync();
        Assert.Equal(409, (await admin.Approve(id, "CASE1234", true)).StatusCode);
        review.ApprovedOrganizationId = 20;
        await f.Db.SaveChangesAsync();
        gateway.Status = "requires_input";
        Assert.Equal(409, (await admin.Approve(id, "CASE1234", true)).StatusCode);
        gateway.Status = "verified";
        Assert.Equal(200, (await admin.Approve(id, "CASE1234", true)).StatusCode);
        f.Db.ChangeTracker.Clear();
        var row = await f.Db.ShortStayCollectionApplications.SingleAsync();
        Assert.Equal(ShortStayCollectionApplicationStatus.PayoutApproved, row.Status);
        Assert.Equal(55, row.ApprovedByUserId);
        Assert.Equal("CASE1234", row.ApprovalCaseReference);
        Assert.NotNull(row.PropertyAuthorityConfirmedAt);
        Assert.Equal(row.ApprovedAt, row.PropertyAuthorityConfirmedAt);
        Assert.Equal(200, (await admin.Suspend(id, "scope_changed")).StatusCode);
        Assert.Equal(409, (await admin.Approve(id, "CASE5678", true)).StatusCode);
        Assert.Equal(200, (await admin.Reject(id, "other")).StatusCode);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("https://evil.example/legal/fees")]
    public async Task Changed_policy_url_after_submit_blocks_review_and_approval_without_provider_or_write(string? url)
    {
        await using var f = await Fixture.Create();
        var gateway = new FakeIdentity { Status = "verified" };
        var owner = f.Service(gateway: gateway);
        await owner.Put(Draft(7));
        var id = (await owner.Submit()).Data!.Id;
        await owner.IdentitySession(id);
        f.Db.ChangeTracker.Clear();
        var admin = f.Admin(gateway);
        Assert.Equal(200, (await admin.BeginReview(id)).StatusCode);
        f.Db.ChangeTracker.Clear();
        var before = await f.Db.ShortStayCollectionApplications.AsNoTracking().SingleAsync();
        var blocked = f.Admin(gateway, policyUrl: url);
        Assert.Equal(503, (await blocked.Approve(id, "CASE1234", true)).StatusCode);
        Assert.Equal(503, (await blocked.BeginReview(id)).StatusCode);
        Assert.Equal(0, gateway.Gets);
        f.Db.ChangeTracker.Clear();
        var after = await f.Db.ShortStayCollectionApplications.AsNoTracking().SingleAsync();
        Assert.Equal(before.RowVersion, after.RowVersion);
        Assert.Equal(ShortStayCollectionApplicationStatus.UnderReview, after.Status);
        Assert.Null(after.ApprovedAt);
    }

    [Fact]
    public async Task Admin_review_suspends_changed_property_scope()
    {
        await using var f = await Fixture.Create();
        var gateway = new FakeIdentity { Status = "verified" };
        var owner = f.Service(gateway: gateway);
        await owner.Put(Draft(7));
        var id = (await owner.Submit()).Data!.Id;
        await owner.IdentitySession(id);
        f.Db.ChangeTracker.Clear();
        var admin = f.Admin(gateway);
        await admin.BeginReview(id);
        f.Db.ChangeTracker.Clear();
        (await f.Db.Properties.SingleAsync(p => p.Id == 7)).OrganizationId = 21;
        await f.Db.SaveChangesAsync();
        Assert.Equal(409, (await admin.Approve(id, "CASE1234", true)).StatusCode);
        f.Db.ChangeTracker.Clear();
        Assert.Equal(ShortStayCollectionApplicationStatus.Suspended, (await f.Db.ShortStayCollectionApplications.SingleAsync()).Status);
    }

    [Fact]
    public async Task Approval_rejects_racing_status_changes_and_provider_outage()
    {
        await using var f = await Fixture.Create();
        var gateway = new FakeIdentity { Status = "verified" };
        var owner = f.Service(gateway: gateway);
        await owner.Put(Draft(7));
        var id = (await owner.Submit()).Data!.Id;
        await owner.IdentitySession(id);
        f.Db.ChangeTracker.Clear();
        var admin = f.Admin(gateway);
        Assert.Equal(200, (await admin.BeginReview(id)).StatusCode);
        gateway.Fail = true;
        Assert.Equal(503, (await admin.Approve(id, "CASE1234", true)).StatusCode);
        gateway.Fail = false;
        gateway.BeforeGet = async () =>
        {
            await using var other = f.NewContext();
            var row = await other.ShortStayCollectionApplications.SingleAsync();
            row.Status = ShortStayCollectionApplicationStatus.Suspended;
            row.RowVersion++;
            await other.SaveChangesAsync();
            f.Db.ChangeTracker.Clear();
        };
        Assert.Equal(409, (await admin.Approve(id, "CASE1234", true)).StatusCode);
        f.Db.ChangeTracker.Clear();
        Assert.Null((await f.Db.ShortStayCollectionApplications.SingleAsync()).ApprovedAt);
    }

    [Fact]
    public async Task Admin_can_review_submitted_application_without_optional_PP_identity()
    {
        await using var f = await Fixture.Create();
        var owner = f.Service(identityEnabled: false);
        Assert.Equal(201, (await owner.Put(Draft(7))).StatusCode);
        var id = (await owner.Submit()).Data!.Id;
        var admin = f.Admin(new FakeIdentity(), requireIdentity: false);
        Assert.Equal(200, (await admin.BeginReview(id)).StatusCode);
        var review = await f.Db.StripeConnectedPayeeReviews.SingleAsync();
        review.Status = StripePayeeReviewStatus.PayoutApproved;
        review.ApprovedAt = DateTimeOffset.UtcNow;
        review.ApprovedOrganizationId = 20;
        review.LastStripeSnapshotAt = DateTimeOffset.UtcNow;
        review.StripeDetailsSubmitted = review.StripePayoutsEnabled = review.StripeTransfersActive = true;
        review.StripeTransferCapabilityStatus = "active";
        review.ExternalAccountFingerprint = "fingerprint";
        await f.Db.SaveChangesAsync();
        Assert.Equal(200, (await admin.Approve(id, "CASE1234", true)).StatusCode);
    }

    [Fact]
    public async Task Readiness_is_exact_property_and_fails_closed_on_changed_facts()
    {
        await using var f = await Fixture.Create();
        var config = ReadinessPolicy();
        var service = f.Readiness(config);
        Assert.False((await service.Check(1, 42, 20)).IsReady);
        var app = await f.ApproveForReadiness();
        Assert.True((await service.Check(1, 42, 20)).CollectionEligible);
        Assert.False((await service.Check(1, 42, 20)).IsReady);
        Assert.False((await service.Check(2, 42, 20)).CollectionEligible);
        Assert.False((await service.Check(3, 42, 20)).CollectionEligible);
        Assert.False((await service.Check(1, 42, 21)).CollectionEligible);
        Assert.False((await service.Check(1, 99, 20)).CollectionEligible);
        Assert.False((await service.Check(0, 42, 20)).CollectionEligible);
        Assert.False((await service.Check(1, 42, 20)).BookingEnabled);
        Assert.False((await service.Check(1, 42, 20)).PaymentsEnabled);
        var json = System.Text.Json.JsonSerializer.Serialize(await service.Check(1, 42, 20));
        Assert.DoesNotContain("acct_owner", json);
        Assert.DoesNotContain("vs_bound", json);
        app.Status = ShortStayCollectionApplicationStatus.Suspended;
        await f.Db.SaveChangesAsync();
        Assert.False((await service.Check(1, 42, 20)).CollectionEligible);
    }

    [Fact]
    public async Task Application_approval_can_be_required_without_separate_identity()
    {
        await using var f = await Fixture.Create();
        var app = await f.ApproveForReadiness();
        app.IdentityVerifiedAt = null;
        app.IdentityVerificationSessionId = null;
        await f.Db.SaveChangesAsync();
        var config = ReadinessPolicy();
        config.Remove("ShortStayCollection:RequireIdentityForApplicationApproval");
        Assert.True((await f.Readiness(config).Check(1, 42, 20)).CollectionEligible);
        config["ShortStayCollection:RequireIdentityForApplicationApproval"] = "true";
        Assert.False((await f.Readiness(config).Check(1, 42, 20)).CollectionEligible);
    }

    [Theory]
    [InlineData(false, false)]
    [InlineData(false, true)]
    [InlineData(true, false)]
    [InlineData(true, true)]
    public async Task Independent_collection_flags_control_only_optional_PP_requirements(bool identity, bool approval)
    {
        await using var f = await Fixture.Create();
        var app = await f.ApproveForReadiness();
        app.IdentityVerifiedAt = null;
        app.IdentityVerificationSessionId = null;
        app.Status = ShortStayCollectionApplicationStatus.Suspended;
        await f.Db.SaveChangesAsync();
        var config = new Dictionary<string, string?> {
            ["ShortStayCollection:RequireIdentityBeforeConnect"] = identity ? "true" : "false",
            ["ShortStayCollection:RequireApplicationApproval"] = approval ? "true" : "false",
            ["ShortStayCollection:BookingEnabled"] = "true",
            ["ShortStayCollection:PaymentsEnabled"] = "true" };
        var result = await f.Readiness(config).Check(1, 42, 20);
        Assert.Equal(!identity && !approval, result.CollectionEligible);
        Assert.False(result.IsReady);
        Assert.False(result.BookingEnabled);
        Assert.False(result.PaymentsEnabled);
    }

    [Fact]
    public async Task Missing_flags_and_policy_do_not_require_PP_application_but_never_bypass_Stripe_or_scope()
    {
        await using var f = await Fixture.Create();
        await f.ApproveForReadiness();
        f.Db.ShortStayCollectionApplications.RemoveRange(f.Db.ShortStayCollectionApplications);
        var pending = await f.Db.StripeConnectedPayeeReviews.SingleAsync();
        pending.Status = StripePayeeReviewStatus.Onboarding;
        pending.ApprovedAt = null;
        pending.ApprovedOrganizationId = null;
        await f.Db.SaveChangesAsync();
        var config = new Dictionary<string, string?>();
        Assert.True((await f.Readiness(config).Check(1, 42, 20)).CollectionEligible);
        Assert.False((await f.Readiness(config).Check(2, 42, 21)).CollectionEligible);
        var review = await f.Db.StripeConnectedPayeeReviews.SingleAsync();
        review.StripeTransferCapabilityStatus = "inactive";
        await f.Db.SaveChangesAsync();
        Assert.False((await f.Readiness(config).Check(1, 42, 20)).CollectionEligible);
    }

    [Theory]
    [InlineData("TRUE ")]
    [InlineData("1")]
    [InlineData("yes")]
    public async Task Nonliteral_policy_flags_remain_off(string value)
    {
        await using var f = await Fixture.Create();
        await f.ApproveForReadiness();
        f.Db.ShortStayCollectionApplications.RemoveRange(f.Db.ShortStayCollectionApplications);
        await f.Db.SaveChangesAsync();
        Assert.True((await f.Readiness(new Dictionary<string, string?> {
            ["ShortStayCollection:RequireIdentityBeforeConnect"] = value,
            ["ShortStayCollection:RequireApplicationApproval"] = value }).Check(1, 42, 20)).CollectionEligible);
    }

    [Theory]
    [InlineData("snapshot")]
    [InlineData("account")]
    [InlineData("membership")]
    [InlineData("policy")]
    [InlineData("rental_mode")]
    [InlineData("property")]
    [InlineData("organization")]
    [InlineData("user")]
    [InlineData("review_org")]
    [InlineData("identity")]
    [InlineData("payout")]
    [InlineData("review_suspended")]
    [InlineData("role")]
    [InlineData("account_review")]
    [InlineData("consent")]
    [InlineData("unit_org")]
    public async Task Readiness_rechecks_live_facts(string change)
    {
        await using var f = await Fixture.Create();
        var app = await f.ApproveForReadiness();
        var config = ReadinessPolicy();
        if (change == "policy") config["ShortStayCollection:FeePolicyConsentVersion"] = "fees-v2";
        var review = await f.Db.StripeConnectedPayeeReviews.SingleAsync();
        switch (change)
        {
            case "snapshot": review.LastStripeSnapshotAt = DateTimeOffset.UtcNow.AddMinutes(-6); break;
            case "account": (await f.Db.Users.SingleAsync(x => x.Id == 42)).StripeAccountId = "acct_changed"; break;
            case "membership": (await f.Db.OrganizationMembers.SingleAsync()).CanManageProperties = false; break;
            case "rental_mode": (await f.Db.Units.SingleAsync(x => x.Id == 1)).RentalMode = ERentalMode.LongTerm; break;
            case "property": (await f.Db.Properties.SingleAsync(x => x.Id == 7)).OrganizationId = 21; break;
            case "organization": (await f.Db.Organizations.SingleAsync(x => x.Id == 20)).IsActive = false; break;
            case "user": (await f.Db.Users.SingleAsync(x => x.Id == 42)).IsSuspended = true; break;
            case "review_org": review.ApprovedOrganizationId = 21; break;
            case "identity": app.IdentityVerificationSessionId = null; break;
            case "payout": review.PayoutSchedulePolicy = "daily"; break;
            case "review_suspended": review.SuspendedAt = DateTimeOffset.UtcNow; break;
            case "role": (await f.Db.OrganizationMembers.SingleAsync()).Role = "Viewer"; break;
            case "account_review": review.StripeAccountId = "acct_changed"; break;
            case "consent": app.FeePolicyConsentVersion = "fees-old"; break;
            case "unit_org": (await f.Db.Units.SingleAsync(x => x.Id == 1)).OrganizationId = 21; break;
        }
        await f.Db.SaveChangesAsync();
        Assert.False((await f.Readiness(config).Check(1, 42, 20)).CollectionEligible);
    }

    [Fact]
    public async Task Booking_and_payment_gates_remain_closed_for_draft_inventory()
    {
        await using var f = await Fixture.Create();
        await f.ApproveForReadiness();
        var config = ReadinessPolicy();
        config["ShortStayCollection:BookingEnabled"] = "true";
        config["ShortStayCollection:PaymentsEnabled"] = "true";
        var result = await f.Readiness(config).Check(1, 42, 20);
        Assert.True(result.CollectionEligible);
        Assert.False(result.IsReady);
        Assert.False(result.BookingEnabled);
        Assert.False(result.PaymentsEnabled);
        Assert.False((await f.Readiness(new Dictionary<string, string?>()).Check(1, 42, 20)).IsReady);
    }

    [Theory]
    [InlineData("true", null)]
    [InlineData("true", "https://example.com/legal/collection-fees")]
    [InlineData("true", "http://app.propertypeace.io/legal/collection-fees")]
    public async Task Readiness_requires_published_policy_when_review_required(string? identityEnabled, string? policyUrl)
    {
        await using var f = await Fixture.Create();
        await f.ApproveForReadiness();
        var config = ReadinessPolicy();
        config["Stripe:IdentityEnabled"] = identityEnabled;
        config["ShortStayCollection:FeePolicyUrl"] = policyUrl;
        config["ShortStayCollection:BookingEnabled"] = "true";
        config["ShortStayCollection:PaymentsEnabled"] = "true";
        var result = await f.Readiness(config).Check(1, 42, 20);
        Assert.False(result.CollectionEligible);
        Assert.False(result.IsReady);
        Assert.False(result.BookingEnabled);
        Assert.False(result.PaymentsEnabled);
        Assert.Contains("policy_unavailable", result.ReasonCodes);
    }

    private static Dictionary<string, string?> ReadinessPolicy() => new() {
        ["Stripe:IdentityEnabled"] = "true",
        ["ShortStayCollection:RequireApplicationApproval"] = "true",
        ["ShortStayCollection:RequireIdentityForApplicationApproval"] = "true",
        ["ShortStayCollection:FeePolicyConsentVersion"] = "fees-v1",
        ["ShortStayCollection:FeePolicyUrl"] = "https://app.propertypeace.io/legal/collection-fees" };

    private sealed class Fixture : IAsyncDisposable
    {
        private readonly SqliteConnection connection;
        private readonly BeforeTransactionInterceptor interceptor;
        public Func<Task>? BeforeTransaction { get => interceptor.Callback; set => interceptor.Callback = value; }
        public int TransactionHooksFired => interceptor.Fired;
        public DataContext Db { get; }
        private Fixture(SqliteConnection connection, DataContext db, BeforeTransactionInterceptor interceptor) { this.connection = connection; Db = db; this.interceptor = interceptor; }
        public static async Task<Fixture> Create()
        {
            var connection = new SqliteConnection("Data Source=:memory:;Foreign Keys=False");
            await connection.OpenAsync();
            var interceptor = new BeforeTransactionInterceptor();
            var db = new SlimContext(new DbContextOptionsBuilder<DataContext>().UseSqlite(connection).AddInterceptors(interceptor).Options);
            await db.Database.EnsureCreatedAsync();
            db.Organizations.AddRange(new Organization { Id = 20, IsActive = true }, new Organization { Id = 21, IsActive = true });
            db.Users.Add(new User { Id = 42, StripeAccountId = "acct_owner" });
            db.StripeConnectedPayeeReviews.Add(new StripeConnectedPayeeReview { UserId = 42, StripeAccountId = "acct_owner" });
            db.OrganizationMembers.Add(new OrganizationMember { OrganizationId = 20, UserId = 42, Role = "Owner", IsActive = true, CanManageProperties = true });
            db.Properties.AddRange(new Property { Id = 7, OrganizationId = 20 }, new Property { Id = 8, OrganizationId = 20 },
                new Property { Id = 9, OrganizationId = 21 }, new Property { Id = 10 });
            db.Units.AddRange(new Unit { Id = 1, PropertyId = 7, OrganizationId = 20, RentalMode = ERentalMode.ShortTerm },
                new Unit { Id = 2, PropertyId = 8, OrganizationId = 20, RentalMode = ERentalMode.ShortTerm },
                new Unit { Id = 3, PropertyId = 9, OrganizationId = 21, RentalMode = ERentalMode.ShortTerm });
            await db.SaveChangesAsync();
            return new(connection, db, interceptor);
        }
        public ShortStayCollectionService Service(long? org = 20, long subject = 42, bool configured = true, IStripeShortStayIdentityGateway? gateway = null,
            string? policyVersion = "fees-v1", string? policyUrl = "https://app.propertypeace.io/legal/collection-fees", bool? identityEnabled = null)
        {
            var http = new DefaultHttpContext();
            http.User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, subject.ToString())], "test"));
            if (org.HasValue) http.Items["OrganizationId"] = org.Value;
            http.Items["UserId"] = 42L;
            var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> {
                ["ShortStayCollection:FeePolicyConsentVersion"] = configured ? policyVersion : null,
                ["ShortStayCollection:FeePolicyUrl"] = policyUrl,
                ["Stripe:IdentityEnabled"] = (identityEnabled ?? true) ? "true" : "false" }).Build();
            return new(Db, new HttpContextAccessor { HttpContext = http }, config, NullLogger<ShortStayCollectionService>.Instance, gateway);
        }
        public AdminShortStayCollectionService Admin(IStripeShortStayIdentityGateway gateway, long subject = 55, bool role = true,
            string? policyUrl = "https://app.propertypeace.io/legal/collection-fees", bool requireIdentity = true)
        {
            if (!Db.Users.Any(u => u.Id == 55))
            {
                Db.Users.Add(new User { Id = 55, Email = "reviewer@example.test" });
                Db.Roles.Add(new Role { Id = 1, RoleName = "Admin" });
                Db.UserRoles.Add(new UserRole { UserId = 55, RoleId = 1 });
                Db.SaveChanges();
            }
            var claims = new List<Claim> { new(ClaimTypes.NameIdentifier, subject.ToString()) };
            if (role) claims.Add(new Claim(ClaimTypes.Role, "Admin"));
            var http = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(claims, "test")) };
            Assert.True(http.User.IsInRole("Admin") == role);
            http.Items["UserId"] = subject;
            return new(Db, new HttpContextAccessor { HttpContext = http },
                new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> {
                    ["Stripe:IdentityEnabled"] = "true", ["ShortStayCollection:RequireIdentityForApplicationApproval"] = requireIdentity ? "true" : "false",
                    ["ShortStayCollection:FeePolicyConsentVersion"] = "fees-v1",
                    ["ShortStayCollection:FeePolicyUrl"] = policyUrl }).Build(),
                NullLogger<AdminShortStayCollectionService>.Instance, gateway);
        }
        public ShortStayCollectionReadinessService Readiness(Dictionary<string, string?> config) => new(Db,
            new ConfigurationBuilder().AddInMemoryCollection(config).Build(), NullLogger<ShortStayCollectionReadinessService>.Instance);
        public async Task<ShortStayCollectionApplication> ApproveForReadiness()
        {
            var now = DateTimeOffset.UtcNow;
            var review = await Db.StripeConnectedPayeeReviews.SingleAsync();
            review.Status = StripePayeeReviewStatus.PayoutApproved;
            review.ApprovedOrganizationId = 20; review.ApprovedAt = now; review.LastStripeSnapshotAt = now;
            review.StripeDetailsSubmitted = review.StripePayoutsEnabled = review.StripeTransfersActive = true;
            review.StripeTransferCapabilityStatus = "active";
            review.ExternalAccountFingerprint = "fingerprint";
            var app = new ShortStayCollectionApplication {
                OrganizationId = 20, ApplicantUserId = 42, StripeAccountId = "acct_owner",
                Status = ShortStayCollectionApplicationStatus.PayoutApproved, SubmittedAt = now,
                ApprovedAt = now, IdentityVerifiedAt = now, IdentityVerificationSessionId = "vs_bound",
                AuthorityAttestedAt = now, FeePolicyConsentVersion = "fees-v1", CreatedAt = now, UpdatedAt = now,
                Properties = [new ShortStayCollectionApplicationProperty { PropertyId = 7 }] };
            Db.ShortStayCollectionApplications.Add(app);
            await Db.SaveChangesAsync();
            return app;
        }
        public DataContext NewContext() => new SlimContext(new DbContextOptionsBuilder<DataContext>().UseSqlite(connection).Options);
        public async ValueTask DisposeAsync() { await Db.DisposeAsync(); await connection.DisposeAsync(); }
    }
    private sealed class BeforeTransactionInterceptor : DbTransactionInterceptor
    {
        public Func<Task>? Callback { get; set; }
        public int Fired { get; private set; }
        public override async ValueTask<InterceptionResult<DbTransaction>> TransactionStartingAsync(
            DbConnection connection, TransactionStartingEventData eventData,
            InterceptionResult<DbTransaction> result, CancellationToken cancellationToken = default)
        {
            if (Callback is { } callback)
            {
                Callback = null;
                Fired++;
                await callback();
            }
            return result;
        }
    }
    private sealed class SlimContext(DbContextOptions<DataContext> options) : DataContext(options)
    {
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            var keep = new[] { typeof(Property), typeof(Unit), typeof(Organization), typeof(OrganizationMember), typeof(User), typeof(Role), typeof(UserRole),
                typeof(StripeConnectedPayeeReview), typeof(ShortStayCollectionApplication), typeof(ShortStayCollectionApplicationProperty) };
            foreach (var entity in modelBuilder.Model.GetEntityTypes().ToList())
                if (!keep.Contains(entity.ClrType)) modelBuilder.Ignore(entity.ClrType);
            modelBuilder.Entity<StripeConnectedPayeeReview>().Property(x => x.RowVersion).ValueGeneratedNever();
            foreach (var entity in modelBuilder.Model.GetEntityTypes())
                foreach (var property in entity.GetProperties())
                    if (property.GetColumnType()?.Contains("(max)", StringComparison.OrdinalIgnoreCase) == true)
                        property.SetColumnType("TEXT");
        }
    }
}
