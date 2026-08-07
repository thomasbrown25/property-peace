using brownstone_hub_api.Data;
using brownstone_hub_api.Domain.Screening;
using brownstone_hub_api.Models;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Xunit;

namespace brownstone_hub_api.Tests.Domain.Screening;

public sealed class ScreeningPersistenceModelTests
{
    private static readonly Type[] ScreeningEntityTypes =
    [
        typeof(TenantScreeningOrder),
        typeof(ScreeningTransitionEvent),
        typeof(ScreeningConsentEvidence),
        typeof(ScreeningPaymentEvidence),
        typeof(ScreeningWebhookInboxEvent),
        typeof(ScreeningReportAccessAudit),
        typeof(ScreeningAdverseAction)
    ];

    [Fact]
    public void Model_registers_screening_entities_and_explicit_scalar_contracts()
    {
        using var context = CreateContext();
        var model = context.Model;

        foreach (var type in ScreeningEntityTypes)
            model.FindEntityType(type).Should().NotBeNull($"{type.Name} must be configured");

        var order = Entity<TenantScreeningOrder>(model);
        Required(order, nameof(TenantScreeningOrder.OrganizationId), "bigint");
        Required(order, nameof(TenantScreeningOrder.RentalApplicationId), "bigint");
        Required(order, nameof(TenantScreeningOrder.PropertyId), "bigint");
        Required(order, nameof(TenantScreeningOrder.InvitationIdempotencyKeyHash), "char(64)", 64);
        Required(order, nameof(TenantScreeningOrder.PackageCode), "nvarchar(100)", 100);
        Required(order, nameof(TenantScreeningOrder.JurisdictionCode), "char(2)", 2);
        Required(order, nameof(TenantScreeningOrder.QuoteReference), "nvarchar(200)", 200);
        Required(order, nameof(TenantScreeningOrder.Currency), "char(3)", 3);
        Required(order, nameof(TenantScreeningOrder.ProviderKey), "nvarchar(100)", 100);
        Required(order, nameof(TenantScreeningOrder.PermissiblePurposeVersion), "nvarchar(100)", 100);
        Required(order, nameof(TenantScreeningOrder.DisclosureVersion), "nvarchar(100)", 100);
        Required(order, nameof(TenantScreeningOrder.RentalCriteriaVersion), "nvarchar(100)", 100);
        order.FindProperty(nameof(TenantScreeningOrder.RowVersion))!.IsConcurrencyToken.Should().BeTrue();
        order.FindProperty(nameof(TenantScreeningOrder.RowVersion))!.ValueGenerated.Should().Be(ValueGenerated.OnAddOrUpdate);

        AssertStringConversion<TenantScreeningOrder, ScreeningStatus>(order, nameof(TenantScreeningOrder.Status), 32);
        AssertStringConversion<TenantScreeningOrder, ScreeningPayer>(order, nameof(TenantScreeningOrder.Payer), 32);

        var transition = Entity<ScreeningTransitionEvent>(model);
        AssertStringConversion<ScreeningTransitionEvent, ScreeningStatus>(transition, nameof(ScreeningTransitionEvent.ToStatus), 32);
        transition.FindProperty(nameof(ScreeningTransitionEvent.ReasonCode))!.GetMaxLength().Should().Be(200);
        transition.FindProperty(nameof(ScreeningTransitionEvent.ProviderEventId))!.GetMaxLength().Should().Be(200);
        Required(transition, nameof(ScreeningTransitionEvent.ProviderKey), "nvarchar(100)", 100);

        var consent = Entity<ScreeningConsentEvidence>(model);
        Required(consent, nameof(ScreeningConsentEvidence.IpAddressHash), "char(64)", 64);
        Required(consent, nameof(ScreeningConsentEvidence.UserAgentHash), "char(64)", 64);
        consent.FindProperty(nameof(ScreeningConsentEvidence.ProviderAuthorizationReference))!.GetMaxLength().Should().Be(200);

        var payment = Entity<ScreeningPaymentEvidence>(model);
        Required(payment, nameof(ScreeningPaymentEvidence.QuoteReferenceHash), "char(64)", 64);
        Required(payment, nameof(ScreeningPaymentEvidence.PaymentOperationReferenceHash), "char(64)", 64);
        Required(payment, nameof(ScreeningPaymentEvidence.Currency), "char(3)", 3);
        AssertStringConversion<ScreeningPaymentEvidence, ScreeningPayer>(payment, nameof(ScreeningPaymentEvidence.Payer), 32);
        AssertStringConversion<ScreeningPaymentEvidence, ScreeningPaymentEventStatus>(payment, nameof(ScreeningPaymentEvidence.Status), 32);
        AssertStringConversion<ScreeningPaymentEvidence, ScreeningPaymentEvidenceSource>(payment, nameof(ScreeningPaymentEvidence.Source), 40);

        var webhook = Entity<ScreeningWebhookInboxEvent>(model);
        Required(webhook, nameof(ScreeningWebhookInboxEvent.PayloadSha256Hash), "char(64)", 64);
        webhook.FindProperty(nameof(ScreeningWebhookInboxEvent.FailureCode))!.GetMaxLength().Should().Be(100);
        webhook.FindProperty(nameof(ScreeningWebhookInboxEvent.FailureDetail))!.GetMaxLength().Should().Be(500);
        webhook.FindProperty(nameof(ScreeningWebhookInboxEvent.RowVersion))!.IsConcurrencyToken.Should().BeTrue();

        var adverse = Entity<ScreeningAdverseAction>(model);
        Required(adverse, nameof(ScreeningAdverseAction.ReasonCodesJson), "nvarchar(2000)", 2000);
        adverse.FindProperty(nameof(ScreeningAdverseAction.CraContactName))!.GetMaxLength().Should().Be(200);
        adverse.FindProperty(nameof(ScreeningAdverseAction.CraContactAddress))!.GetMaxLength().Should().Be(500);
        adverse.FindProperty(nameof(ScreeningAdverseAction.CraContactPhone))!.GetMaxLength().Should().Be(50);
    }

    [Fact]
    public void Model_has_idempotency_revision_tenant_lookup_and_retention_indexes()
    {
        using var context = CreateContext();
        var model = context.Model;

        AssertUniqueIndex(Entity<TenantScreeningOrder>(model), nameof(TenantScreeningOrder.ProviderKey), nameof(TenantScreeningOrder.ProviderOrderId));
        AssertUniqueIndex(Entity<TenantScreeningOrder>(model), nameof(TenantScreeningOrder.OrganizationId), nameof(TenantScreeningOrder.InvitationIdempotencyKeyHash));
        AssertIndex(Entity<TenantScreeningOrder>(model), nameof(TenantScreeningOrder.OrganizationId), nameof(TenantScreeningOrder.Status), nameof(TenantScreeningOrder.CreatedAt));
        AssertIndex(Entity<TenantScreeningOrder>(model), nameof(TenantScreeningOrder.OrganizationId), nameof(TenantScreeningOrder.RentalApplicationId));
        AssertIndex(Entity<TenantScreeningOrder>(model), nameof(TenantScreeningOrder.OrganizationId), nameof(TenantScreeningOrder.ExpiredAt));

        AssertUniqueIndex(Entity<ScreeningTransitionEvent>(model), nameof(ScreeningTransitionEvent.TenantScreeningOrderId), nameof(ScreeningTransitionEvent.Revision));
        AssertUniqueIndex(Entity<ScreeningTransitionEvent>(model), nameof(ScreeningTransitionEvent.ProviderKey), nameof(ScreeningTransitionEvent.ProviderEventId));
        AssertUniqueIndex(Entity<ScreeningConsentEvidence>(model), nameof(ScreeningConsentEvidence.TenantScreeningOrderId));
        AssertUniqueIndex(Entity<ScreeningPaymentEvidence>(model), nameof(ScreeningPaymentEvidence.TenantScreeningOrderId), nameof(ScreeningPaymentEvidence.Revision));
        AssertUniqueIndex(Entity<ScreeningPaymentEvidence>(model), nameof(ScreeningPaymentEvidence.TenantScreeningOrderId),
            nameof(ScreeningPaymentEvidence.PaymentOperationReferenceHash), nameof(ScreeningPaymentEvidence.Status));
        AssertUniqueIndex(Entity<ScreeningWebhookInboxEvent>(model), nameof(ScreeningWebhookInboxEvent.ProviderKey), nameof(ScreeningWebhookInboxEvent.ProviderEventId));
        AssertIndex(Entity<ScreeningWebhookInboxEvent>(model), nameof(ScreeningWebhookInboxEvent.ProcessingStatus), nameof(ScreeningWebhookInboxEvent.NextAttemptAt), nameof(ScreeningWebhookInboxEvent.ProcessingLeaseUntil));
        AssertIndex(Entity<ScreeningWebhookInboxEvent>(model), nameof(ScreeningWebhookInboxEvent.ProcessedAt));
        AssertIndex(Entity<ScreeningCancellationIntent>(model), nameof(ScreeningCancellationIntent.Status),
            nameof(ScreeningCancellationIntent.NextAttemptAt), nameof(ScreeningCancellationIntent.ProcessingLeaseUntil),
            nameof(ScreeningCancellationIntent.CreatedAt));
        AssertIndex(Entity<ScreeningDisputeIntent>(model), nameof(ScreeningDisputeIntent.Status),
            nameof(ScreeningDisputeIntent.NextAttemptAt), nameof(ScreeningDisputeIntent.ProcessingLeaseUntil),
            nameof(ScreeningDisputeIntent.CreatedAt));
        AssertIndex(Entity<ScreeningAdverseActionDeliveryAttempt>(model), nameof(ScreeningAdverseActionDeliveryAttempt.Status),
            nameof(ScreeningAdverseActionDeliveryAttempt.NextAttemptAt), nameof(ScreeningAdverseActionDeliveryAttempt.ProcessingLeaseUntil),
            nameof(ScreeningAdverseActionDeliveryAttempt.AttemptedAt));
        AssertIndex(Entity<ScreeningReportAccessAudit>(model), nameof(ScreeningReportAccessAudit.OrganizationId), nameof(ScreeningReportAccessAudit.RequestedAt));
        AssertIndex(Entity<ScreeningAdverseAction>(model), nameof(ScreeningAdverseAction.OrganizationId), nameof(ScreeningAdverseAction.CreatedAt));
    }

    [Fact]
    public void Compliance_evidence_relationships_restrict_principal_deletion()
    {
        using var context = CreateContext();
        var model = context.Model;

        AssertFk<TenantScreeningOrder, Organization>(model, nameof(TenantScreeningOrder.OrganizationId), DeleteBehavior.Restrict, required: true);
        AssertFk<TenantScreeningOrder, RentalApplication>(model, nameof(TenantScreeningOrder.RentalApplicationId), DeleteBehavior.Restrict, required: true);
        AssertFk<TenantScreeningOrder, Property>(model, nameof(TenantScreeningOrder.PropertyId), DeleteBehavior.Restrict, required: true);

        foreach (var dependent in new[]
                 {
                     typeof(ScreeningTransitionEvent), typeof(ScreeningConsentEvidence),
                     typeof(ScreeningPaymentEvidence),
                     typeof(ScreeningReportAccessAudit), typeof(ScreeningAdverseAction)
                 })
        {
            var fk = Entity(model, dependent).GetForeignKeys().Single(x => x.PrincipalEntityType.ClrType == typeof(TenantScreeningOrder));
            fk.DeleteBehavior.Should().Be(DeleteBehavior.Restrict);
            fk.IsRequired.Should().BeTrue();
        }

        AssertFk<ScreeningAdverseAction, RentalApplication>(model, nameof(ScreeningAdverseAction.RentalApplicationId), DeleteBehavior.Restrict, required: true);
        var webhookOrderFk = Entity<ScreeningWebhookInboxEvent>(model).GetForeignKeys()
            .Single(x => x.PrincipalEntityType.ClrType == typeof(TenantScreeningOrder));
        webhookOrderFk.IsRequired.Should().BeFalse();
        webhookOrderFk.DeleteBehavior.Should().Be(DeleteBehavior.Restrict);
    }

    [Fact]
    public void Screening_entities_do_not_expose_forbidden_sensitive_storage_fields()
    {
        var forbiddenNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "Ssn", "SocialSecurityNumber", "DateOfBirth", "Dob", "BankAccount", "BankAccountNumber",
            "ReportUrl", "ReportBlob", "ReportPayload", "RawPayload", "ProviderCredential", "ProviderCredentials",
            "AccessToken", "RawToken", "IdempotencyKey", "AutomaticPass", "AutomaticFail", "Passed", "Failed"
        };

        var exposed = ScreeningEntityTypes
            .SelectMany(type => type.GetProperties().Select(property => $"{type.Name}.{property.Name}"))
            .Where(name => forbiddenNames.Contains(name[(name.IndexOf('.') + 1)..]))
            .ToArray();

        exposed.Should().BeEmpty("screening persistence must contain evidence and hashes, never raw sensitive/report/credential data or automatic decisions");
        typeof(TenantScreeningOrder).GetProperty("ApplicantUserId").Should().BeNull("the schema has no applicant-user relationship");
        typeof(TenantScreeningOrder).GetProperty(nameof(TenantScreeningOrder.ApplicantAccessTokenHash)).Should().NotBeNull();
    }

    [Fact]
    public void Webhook_inbox_models_duplicate_detection_and_expired_lease_recovery()
    {
        var type = typeof(ScreeningWebhookInboxEvent);
        foreach (var property in new[]
                 {
                     nameof(ScreeningWebhookInboxEvent.DuplicateCount), nameof(ScreeningWebhookInboxEvent.LastDuplicateReceivedAt),
                     nameof(ScreeningWebhookInboxEvent.ProcessingAttempts), nameof(ScreeningWebhookInboxEvent.NextAttemptAt),
                     nameof(ScreeningWebhookInboxEvent.ProcessingLeaseId), nameof(ScreeningWebhookInboxEvent.ProcessingLeaseUntil)
                 })
            type.GetProperty(property).Should().NotBeNull();
    }

    private static DataContext CreateContext() => new(
        new DbContextOptionsBuilder<DataContext>()
            .UseSqlServer("Server=(localdb)\\mssqllocaldb;Database=ScreeningMetadataOnly;Trusted_Connection=True")
            .Options);

    private static IEntityType Entity<T>(IModel model) => Entity(model, typeof(T));
    private static IEntityType Entity(IModel model, Type type) => model.FindEntityType(type)!;

    private static void Required(IEntityType entity, string name, string columnType, int? maxLength = null)
    {
        var property = entity.FindProperty(name)!;
        property.IsNullable.Should().BeFalse();
        property.GetColumnType().Should().Be(columnType);
        if (maxLength.HasValue) property.GetMaxLength().Should().Be(maxLength);
    }

    private static void AssertStringConversion<TEntity, TEnum>(IEntityType entity, string propertyName, int maxLength)
        where TEnum : struct, Enum
    {
        var property = entity.FindProperty(propertyName)!;
        property.ClrType.Should().Be(typeof(TEnum));
        var converter = property.GetValueConverter() ?? property.GetTypeMapping().Converter;
        converter.Should().NotBeNull("enum persistence must use an explicit string conversion");
        converter!.ProviderClrType.Should().Be(typeof(string));
        property.GetMaxLength().Should().Be(maxLength);
    }

    private static void AssertIndex(IEntityType entity, params string[] names) =>
        entity.GetIndexes().Should().Contain(index => index.Properties.Select(x => x.Name).SequenceEqual(names));

    private static void AssertUniqueIndex(IEntityType entity, params string[] names) =>
        entity.GetIndexes().Should().Contain(index => index.IsUnique && index.Properties.Select(x => x.Name).SequenceEqual(names));

    private static void AssertFk<TDependent, TPrincipal>(IModel model, string property, DeleteBehavior behavior, bool required)
    {
        var fk = Entity<TDependent>(model).GetForeignKeys().Single(x =>
            x.PrincipalEntityType.ClrType == typeof(TPrincipal) && x.Properties.Single().Name == property);
        fk.DeleteBehavior.Should().Be(behavior);
        fk.IsRequired.Should().Be(required);
    }
}
