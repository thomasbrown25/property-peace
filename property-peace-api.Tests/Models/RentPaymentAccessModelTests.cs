using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.RentPaymentAccess;
using brownstone_hub_api.Models;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Xunit;

namespace brownstone_hub_api.Tests.RentPaymentAccess;

public sealed class RentPaymentAccessModelTests
{
    [Fact]
    public void Organization_without_an_access_request_is_not_requested_and_therefore_denied()
    {
        using var db = CreateContext();
        db.Organizations.Add(new Organization { Id = 701, Name = "No approval row" });

        var request = db.RentPaymentAccessRequests.Local
            .SingleOrDefault(x => x.OrganizationId == 701);
        var status = request?.Status.ToString() ?? "NotRequested";

        request.Should().BeNull();
        status.Should().Be("NotRequested");
        Enum.GetNames<RentPaymentAccessStatus>().Should().NotContain("NotRequested");
    }

    [Fact]
    public void Request_model_exposes_public_identifier_statuses_and_row_version_concurrency()
    {
        using var db = CreateContext();
        var entity = Entity<RentPaymentAccessRequest>(db.Model);

        typeof(RentPaymentAccessRequest).GetProperty(nameof(RentPaymentAccessRequest.PublicId))!.PropertyType
            .Should().Be(typeof(Guid));
        new RentPaymentAccessRequest().PublicId.Should().NotBe(Guid.Empty);
        Enum.GetValues<RentPaymentAccessStatus>().Should().Equal(
            RentPaymentAccessStatus.Pending,
            RentPaymentAccessStatus.Approved,
            RentPaymentAccessStatus.Rejected,
            RentPaymentAccessStatus.Suspended);
        ((int)RentPaymentAccessStatus.Pending).Should().Be(1);
        ((int)RentPaymentAccessStatus.Approved).Should().Be(2);
        ((int)RentPaymentAccessStatus.Rejected).Should().Be(3);
        ((int)RentPaymentAccessStatus.Suspended).Should().Be(4);

        AssertUniqueIndex(entity, nameof(RentPaymentAccessRequest.OrganizationId));
        AssertUniqueIndex(entity, nameof(RentPaymentAccessRequest.PublicId));
        var rowVersion = entity.FindProperty(nameof(RentPaymentAccessRequest.RowVersion))!;
        rowVersion.IsConcurrencyToken.Should().BeTrue();
        rowVersion.ValueGenerated.Should().Be(ValueGenerated.OnAddOrUpdate);
        entity.FindProperty(nameof(RentPaymentAccessRequest.DecisionReason))!.GetMaxLength().Should().Be(1000);
        entity.FindProperty(nameof(RentPaymentAccessRequest.InternalNotes))!.GetMaxLength().Should().Be(2000);
    }

    [Fact]
    public void Audit_event_captures_transition_actor_timestamp_and_only_safe_metadata()
    {
        using var db = CreateContext();
        var entity = Entity<RentPaymentAccessAuditEvent>(db.Model);
        var audit = new RentPaymentAccessAuditEvent
        {
            RentPaymentAccessRequestId = 17,
            OrganizationId = 701,
            PriorStatus = RentPaymentAccessStatus.Pending,
            NextStatus = RentPaymentAccessStatus.Approved,
            ActorUserId = 8,
            OccurredAtUtc = DateTime.UtcNow,
            SafeMetadataJson = "{\"reasonCode\":\"verified\"}"
        };

        audit.RentPaymentAccessRequestId.Should().Be(17);
        audit.OrganizationId.Should().Be(701);
        audit.PriorStatus.Should().Be(RentPaymentAccessStatus.Pending);
        audit.NextStatus.Should().Be(RentPaymentAccessStatus.Approved);
        audit.ActorUserId.Should().Be(8);
        audit.OccurredAtUtc.Should().NotBe(default);
        audit.SafeMetadataJson.Should().Be("{\"reasonCode\":\"verified\"}");
        entity.FindProperty(nameof(RentPaymentAccessAuditEvent.SafeMetadataJson))!.GetMaxLength().Should().Be(2000);
        typeof(RentPaymentAccessAuditEvent).GetProperties().Select(x => x.Name)
            .Should().NotContain(new[] { "StripeSecretKey", "AccessToken", "BankAccountNumber", "CardNumber", "RawRequestBody" });

        var requestForeignKey = entity.GetForeignKeys().Single(x =>
            x.PrincipalEntityType.ClrType == typeof(RentPaymentAccessRequest) &&
            x.Properties.Single().Name == nameof(RentPaymentAccessAuditEvent.RentPaymentAccessRequestId));
        requestForeignKey.DeleteBehavior.Should().Be(DeleteBehavior.Restrict);
        requestForeignKey.IsRequired.Should().BeTrue();
    }

    [Fact]
    public void Audit_events_are_append_only()
    {
        using var db = CreateContext();
        var audit = new RentPaymentAccessAuditEvent();
        db.Attach(audit);

        db.Entry(audit).State = EntityState.Modified;
        FluentActions.Invoking(() => db.SaveChanges()).Should().Throw<InvalidOperationException>()
            .WithMessage("*append-only*");
        db.Entry(audit).State = EntityState.Deleted;
        FluentActions.Invoking(() => db.SaveChanges()).Should().Throw<InvalidOperationException>()
            .WithMessage("*append-only*");
    }

    [Fact]
    public void Access_dtos_keep_internal_notes_out_of_the_organization_facing_contract()
    {
        typeof(RentPaymentAccessDto).GetProperty("InternalNotes").Should().BeNull();
        typeof(RentPaymentAccessAdminDetailDto).GetProperty("InternalNotes").Should().NotBeNull();
    }

    [Fact]
    public void Data_context_exposes_access_request_and_audit_sets()
    {
        using var db = CreateContext();

        db.RentPaymentAccessRequests.Should().NotBeNull();
        db.RentPaymentAccessAuditEvents.Should().NotBeNull();
    }

    private static DataContext CreateContext() => new(
        new DbContextOptionsBuilder<DataContext>()
            .UseInMemoryDatabase($"rent-payment-access-model-{Guid.NewGuid()}")
            .Options);

    private static IEntityType Entity<T>(IModel model) => model.FindEntityType(typeof(T))!;

    private static void AssertUniqueIndex(IEntityType entity, params string[] propertyNames) =>
        entity.GetIndexes().Should().Contain(index =>
            index.IsUnique && index.Properties.Select(property => property.Name).SequenceEqual(propertyNames));
}
