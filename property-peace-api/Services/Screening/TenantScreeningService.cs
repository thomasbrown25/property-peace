using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using brownstone_hub_api.Data;
using brownstone_hub_api.Domain.Screening;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.Timelines;
using brownstone_hub_api.Services.ActivationFunnel;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace brownstone_hub_api.Services.Screening;

public sealed class TenantScreeningService : ITenantScreeningService
{
    private readonly DataContext _db;
    private readonly IScreeningProviderGateway _gateway;
    private readonly IScreeningPolicyResolver _policyResolver;
    private readonly IScreeningQuoteOptionsResolver _quoteOptionsResolver;
    private readonly IScreeningApplicantInvitationDelivery _delivery;
    private readonly IScreeningApplicantLinkFactory _linkFactory;
    private readonly IScreeningCallbackVerifier _callbackVerifier;
    private readonly TimeProvider _timeProvider;
    private readonly ScreeningWebhookProcessingOptions _webhookOptions;
    private readonly IScreeningIncidentRecorder _incidentRecorder;
    private readonly IWorkflowTimelineIntegration? _workflowTimeline;
    private readonly IActivationOccurrenceRecorder? _activationRecorder;

    public TenantScreeningService(DataContext db, IScreeningProviderGateway gateway, IScreeningPolicyResolver policyResolver,
        IScreeningApplicantInvitationDelivery delivery, IScreeningApplicantLinkFactory linkFactory,
        IScreeningCallbackVerifier callbackVerifier, TimeProvider timeProvider,
        ScreeningWebhookProcessingOptions? webhookOptions = null, IScreeningIncidentRecorder? incidentRecorder = null,
        IScreeningQuoteOptionsResolver? quoteOptionsResolver = null,
        IWorkflowTimelineIntegration? workflowTimeline = null,
        IActivationOccurrenceRecorder? activationRecorder = null)
    {
        _db = db ?? throw new ArgumentNullException(nameof(db));
        _gateway = gateway ?? throw new ArgumentNullException(nameof(gateway));
        _policyResolver = policyResolver ?? throw new ArgumentNullException(nameof(policyResolver));
        _quoteOptionsResolver = quoteOptionsResolver ?? new UnavailableScreeningQuoteOptionsResolver();
        _delivery = delivery ?? throw new ArgumentNullException(nameof(delivery));
        _linkFactory = linkFactory ?? throw new ArgumentNullException(nameof(linkFactory));
        _callbackVerifier = callbackVerifier ?? throw new ArgumentNullException(nameof(callbackVerifier));
        _timeProvider = timeProvider ?? throw new ArgumentNullException(nameof(timeProvider));
        _webhookOptions = webhookOptions ?? new ScreeningWebhookProcessingOptions();
        _incidentRecorder = incidentRecorder ?? new ScreeningIncidentRecorder(db, timeProvider);
        _workflowTimeline = workflowTimeline;
        _activationRecorder = activationRecorder;
    }

    public async Task<StaffScreeningOrderResult> CreateInvitationAsync(CreateTenantScreeningInvitationCommand command,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(command);
        var applicant = await LoadEligibleApplicantAsync(command.OrganizationId, command.RentalApplicationId, cancellationToken);
        var authority = await AuthorizeAsync(command.OrganizationId, command.RequesterUserId, applicant.PropertyId, cancellationToken);
        var keyHash = Hash($"screening-idempotency-v1\n{command.OrganizationId}", command.IdempotencyKey);
        var existing = await _db.TenantScreeningOrders.SingleOrDefaultAsync(x =>
            x.OrganizationId == command.OrganizationId && x.InvitationIdempotencyKeyHash == keyHash, cancellationToken);
        if (existing is not null)
        {
            EnsureSameOperation(existing, command);
            return ToStaffResult(existing);
        }

        var policyRequest = new ScreeningPolicyResolutionRequest(command.OrganizationId, command.RequesterUserId,
            applicant.Id, applicant.PropertyId, applicant.UnitId, command.PackageCode, command.Payer, applicant.JurisdictionCode);
        var policy = await _policyResolver.ResolveAsync(policyRequest, cancellationToken)
            ?? throw new ScreeningPolicyViolationException("no server policy is configured");
        if (!string.Equals(policy.AllowedPackageCode, command.PackageCode, StringComparison.Ordinal))
            throw new ScreeningPolicyViolationException("package is not allowed");

        var quoteRequest = new ScreeningQuoteRequest(command.OrganizationId, applicant.Id, applicant.PropertyId,
            applicant.Id, command.PackageCode, applicant.JurisdictionCode, command.Payer);
        var quote = await _gateway.GetAuthoritativeQuoteAsync(quoteRequest, cancellationToken);
        var now = _timeProvider.GetUtcNow();
        ValidateQuote(quoteRequest, quote, policy, now);

        var token = GenerateToken();
        var order = new TenantScreeningOrder
        {
            OrganizationId = command.OrganizationId,
            RentalApplicationId = applicant.Id,
            PropertyId = applicant.PropertyId,
            UnitId = applicant.UnitId,
            ListingId = applicant.ListingId,
            InvitationIdempotencyKeyHash = keyHash,
            PackageCode = command.PackageCode,
            JurisdictionCode = applicant.JurisdictionCode,
            Payer = command.Payer,
            QuoteReference = quote.QuoteReference,
            LandlordAmountMinor = quote.LandlordAmountMinor,
            ApplicantAmountMinor = quote.ApplicantAmountMinor,
            ProviderAmountMinor = quote.ProviderAmountMinor,
            PlatformFeeMinor = quote.PlatformFeeMinor,
            TaxAmountMinor = quote.TaxAmountMinor,
            TotalAmountMinor = quote.TotalAmountMinor,
            Currency = quote.Currency,
            QuoteExpiresAt = quote.ExpiresAt,
            QuotePolicyVersion = quote.PolicyVersion,
            ProviderKey = policy.ProviderKey,
            RequesterUserId = command.RequesterUserId,
            RequesterMemberId = authority.MemberId,
            RequesterMemberRole = authority.Role,
            RequesterPermissionSnapshot = authority.Permission,
            RequesterAuthorityVerifiedAt = now,
            PermissiblePurposeStatement = policy.PermissiblePurposeStatement,
            PermissiblePurposeVersion = policy.PermissiblePurposeVersion,
            DisclosureStatement = policy.DisclosureStatement,
            DisclosureVersion = policy.DisclosureVersion,
            AuthorizationStatement = policy.AuthorizationStatement,
            AuthorizationVersion = policy.AuthorizationVersion,
            RentalCriteriaStatement = policy.RentalCriteriaStatement,
            RentalCriteriaVersion = policy.RentalCriteriaVersion,
            PricingPolicyVersion = policy.PricingPolicyVersion,
            AllowedChecksJson = JsonSerializer.Serialize(policy.AllowedChecks),
            MaximumApplicantTotalMinor = policy.MaximumApplicantTotalMinor,
            ApplicantTotalExpresslyUnrestricted = policy.ApplicantTotalExpresslyUnrestricted,
            MaximumPlatformFeeMinor = policy.MaximumPlatformFeeMinor,
            MarkupPermitted = policy.MarkupPermitted,
            MinimumQuoteLifetimeSeconds = checked((long)policy.MinimumQuoteLifetime.TotalSeconds),
            MaximumQuoteLifetimeSeconds = checked((long)policy.MaximumQuoteLifetime.TotalSeconds),
            CreatedAt = now
        };
        order.SetApplicantAccess(TokenHash(token), now.Add(policy.ApplicantAccessLifetime));
        order.ApplyTransition(ScreeningStatus.ConsentPending, 1, now);
        var initial = Transition(order, null, ScreeningStatus.ConsentPending, now, now, ScreeningTransitionSource.User,
            "QuoteCreatedAndInvitationIssued", null, command.RequesterUserId);

        await InTransactionAsync(async () =>
        {
            _db.TenantScreeningOrders.Add(order);
            await _db.SaveChangesAsync(cancellationToken);
            initial.TenantScreeningOrderId = order.Id;
            _db.ScreeningTransitionEvents.Add(initial);
            await _db.SaveChangesAsync(cancellationToken);
        }, cancellationToken);

        if (_workflowTimeline is not null)
            await _workflowTimeline.RecordScreeningTransitionAsync(order.OrganizationId, order.RentalApplicationId,
                order.Id, command.RequesterUserId, "invited", "Screening invitation created",
                $"screening:{order.Id}:invited", cancellationToken);

        try
        {
            await DeliverAsync(order, applicant, token, cancellationToken);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            // Delivery failure does not regress or advance the screening lifecycle. The order remains
            // ConsentPending, and an authorized retry rotates the applicant access token before redelivery.
            throw new ScreeningDeliveryException(order.Id, exception);
        }
        return ToStaffResult(order);
    }

    public async Task RetryInvitationDeliveryAsync(long organizationId, long requesterUserId, long orderId,
        CancellationToken cancellationToken = default)
    {
        ValidateIds(organizationId, requesterUserId, orderId);
        var order = await _db.TenantScreeningOrders.SingleOrDefaultAsync(x => x.Id == orderId && x.OrganizationId == organizationId, cancellationToken)
            ?? throw new ScreeningResourceNotFoundException("screening order");
        await AuthorizeAsync(organizationId, requesterUserId, order.PropertyId, cancellationToken);
        var now = _timeProvider.GetUtcNow();
        if (order.Status != ScreeningStatus.ConsentPending || order.ProviderOrderId is not null)
            throw new InvalidOperationException("Only a consent-pending invitation that has not started can be retried.");
        if (order.QuoteExpiresAt <= now) throw new ScreeningInvitationExpiredException();
        var applicant = await LoadApplicantContactAsync(organizationId, order.RentalApplicationId, cancellationToken);
        var token = GenerateToken();
        order.SetApplicantAccess(TokenHash(token), order.ApplicantAccessExpiresAt ?? now.AddDays(90));
        await _db.SaveChangesAsync(cancellationToken); // rotation invalidates the old token before delivery
        try
        {
            await DeliverAsync(order, applicant, token, cancellationToken);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            throw new ScreeningDeliveryException(order.Id, exception);
        }
    }

    public async Task<ApplicantScreeningInvitationResult> GetApplicantInvitationAsync(string rawToken,
        CancellationToken cancellationToken = default)
    {
        var order = await ResolveApplicantOrderAsync(rawToken, cancellationToken);
        EnsureAccessCurrent(order, _timeProvider.GetUtcNow());
        return ToApplicantResult(order);
    }

    public async Task<ApplicantScreeningStatusResult> GetApplicantStatusAsync(string rawToken, CancellationToken cancellationToken = default)
    {
        var order = await ResolveApplicantOrderAsync(rawToken, cancellationToken);
        EnsureAccessCurrent(order, _timeProvider.GetUtcNow());
        var dispute = await _db.ScreeningDisputes.AsNoTracking().Where(x => x.TenantScreeningOrderId == order.Id)
            .OrderByDescending(x => x.OpenedAt).FirstOrDefaultAsync(cancellationToken);
        var adverse = await _db.ScreeningAdverseActions.AsNoTracking().Where(x => x.TenantScreeningOrderId == order.Id)
            .OrderByDescending(x => x.CreatedAt).FirstOrDefaultAsync(cancellationToken);
        var latestReportRevision = await _db.ScreeningReportRevisions.AsNoTracking()
            .Where(x => x.TenantScreeningOrderId == order.Id && x.DeletedAt == null)
            .OrderByDescending(x => x.Revision).Select(x => (long?)x.Revision).FirstOrDefaultAsync(cancellationToken);
        ApplicantAdverseActionNoticeSummary? notice = null;
        var reconsideration = ScreeningReconsiderationStatus.NotRequested;
        if (adverse is not null)
        {
            var attempt = await _db.ScreeningAdverseActionDeliveryAttempts.AsNoTracking().Where(x => x.ScreeningAdverseActionId == adverse.Id)
                .OrderByDescending(x => x.AttemptNumber).FirstOrDefaultAsync(cancellationToken);
            reconsideration = await _db.ScreeningReconsiderationEvents.AsNoTracking().Where(x => x.ScreeningAdverseActionId == adverse.Id)
                .OrderByDescending(x => x.Revision).Select(x => (ScreeningReconsiderationStatus?)x.ToStatus).FirstOrDefaultAsync(cancellationToken)
                ?? ScreeningReconsiderationStatus.NotRequested;
            notice = new(adverse.ActionType, adverse.CreatedAt, JsonSerializer.Deserialize<string[]>(adverse.ReasonCodesJson) ?? [],
                attempt?.Status ?? ScreeningDeliveryAttemptStatus.Requested, attempt?.DeliveredAt, reconsideration, "/support/screening",
                adverse.NoticeVersion, adverse.NoticeContentSha256Hash, adverse.ImmutableNoticeContent,
                adverse.CraContactName, adverse.CraContactAddress, adverse.CraContactPhone,
                string.Empty, string.Empty, string.Empty, adverse.JurisdictionCode,
                adverse.StateLocalDisclosureVersion, string.Empty);
        }
        return new(order.Status, Quote(order), NextAction(order.Status), Help(order.Status),
            order.Status == ScreeningStatus.ConsentPending ? "pending" : "recorded",
            order.Status == ScreeningStatus.PaymentPending ? "pending" : order.Status == ScreeningStatus.ConsentPending ? "not-started" : "complete-or-not-required",
            order.Status == ScreeningStatus.Processing ? "processing" : order.Status.ToString().ToLowerInvariant(),
            dispute?.Status.ToString().ToLowerInvariant() ?? "none",
            dispute?.CorrectedScreeningReportRevisionId.HasValue == true ? "corrected" : "none",
            notice, reconsideration, "/support/screening", latestReportRevision);
    }

    public async Task<ApplicantScreeningConsentResult> ConsentAndStartAsync(string rawToken, string expectedQuoteReference,
        string acceptedDisclosureVersion, string acceptedAuthorizationVersion, string ipAddress, string userAgent,
        CancellationToken cancellationToken = default)
    {
        ValidateConsentText(expectedQuoteReference, acceptedDisclosureVersion, acceptedAuthorizationVersion, ipAddress, userAgent);
        var order = await ResolveApplicantOrderAsync(rawToken, cancellationToken);
        var now = _timeProvider.GetUtcNow();
        EnsureAccessCurrent(order, now);
        if (order.QuoteExpiresAt <= now) throw new ScreeningInvitationExpiredException();
        if (!FixedEquals(order.QuoteReference, expectedQuoteReference) ||
            !FixedEquals(order.DisclosureVersion, acceptedDisclosureVersion) ||
            !FixedEquals(order.AuthorizationVersion, acceptedAuthorizationVersion))
            throw new ScreeningConsentMismatchException();

        var existingEvidence = await _db.ScreeningConsentEvidence.SingleOrDefaultAsync(x => x.TenantScreeningOrderId == order.Id, cancellationToken);
        if (existingEvidence is not null && order.ProviderOrderId is not null)
            return new ApplicantScreeningConsentResult(order.Id, order.Status, ScreeningConsentOutcome.AlreadyStarted, null, null);
        if (order.Status != ScreeningStatus.ConsentPending)
            throw new ScreeningInvalidInvitationException();
        if (await _db.ScreeningCancellationIntents.AnyAsync(x =>
                x.TenantScreeningOrderId == order.Id &&
                x.Status != ScreeningCancellationIntentStatus.SupersededByCompletion &&
                x.Status != ScreeningCancellationIntentStatus.RejectedByOrderState, cancellationToken))
            throw new ScreeningInvalidInvitationException();

        if (existingEvidence is null)
        {
            var evidence = new ScreeningConsentEvidence
            {
                TenantScreeningOrderId = order.Id,
                OrganizationId = order.OrganizationId,
                DisclosureVersion = order.DisclosureVersion,
                AuthorizationVersion = order.AuthorizationVersion,
                ConsentedAt = now,
                ActorType = ScreeningConsentActorType.Applicant,
                IpAddressHash = Hash($"screening-consent-ip-v1\n{order.OrganizationId}\n{order.Id}", ipAddress),
                UserAgentHash = Hash($"screening-consent-ua-v1\n{order.OrganizationId}\n{order.Id}", userAgent),
                QuoteReferenceHash = Hash($"screening-consent-quote-v1\n{order.OrganizationId}\n{order.Id}", order.QuoteReference)
            };
            await InTransactionAsync(async () =>
            {
                _db.ScreeningConsentEvidence.Add(evidence);
                await _db.SaveChangesAsync(cancellationToken);
            }, cancellationToken);
        }

        // Re-check the durable cancellation fence after committing consent and immediately before
        // the provider boundary. A cancellation intent always wins over starting a new session.
        if (await _db.ScreeningCancellationIntents.AnyAsync(x =>
                x.TenantScreeningOrderId == order.Id &&
                x.Status != ScreeningCancellationIntentStatus.SupersededByCompletion &&
                x.Status != ScreeningCancellationIntentStatus.RejectedByOrderState, cancellationToken))
            throw new ScreeningInvalidInvitationException();

        // Provider invocation occurs only after durable consent. Local order ID is the idempotency correlation.
        var hosted = await CreateHostedSessionAsync(order, now, cancellationToken);
        if (await AttachLateCancellationCorrelationAsync(order.Id, hosted.ProviderOrderId))
            throw new ScreeningInvalidInvitationException();
        ScreeningPaymentOperationEvidence operation;
        ScreeningPaymentEvidenceSource paymentSource;
        long? paymentActor;
        if (order.Payer is ScreeningPayer.Applicant or ScreeningPayer.Split)
        {
            operation = hosted.PaymentEvidence ?? throw new ScreeningPaymentEvidenceException();
            if (operation.Status is not (ScreeningPaymentEventStatus.AuthorizationInitiated or ScreeningPaymentEventStatus.Authorized))
                throw new ScreeningPaymentEvidenceException();
            paymentSource = ScreeningPaymentEvidenceSource.HostedPaymentBoundary;
            paymentActor = null;
        }
        else
        {
            operation = new ScreeningPaymentOperationEvidence($"server-billing-responsibility:{order.Id}",
                ScreeningPaymentEventStatus.Authorized, now, null, now);
            paymentSource = ScreeningPaymentEvidenceSource.ServerBillingResponsibility;
            paymentActor = order.RequesterUserId;
        }

        var payment = PaymentEvidence(order, operation, paymentSource, paymentActor, 1, now);
        order.SetProviderOrder(hosted.ProviderOrderId);
        var to = order.Payer == ScreeningPayer.Landlord ? ScreeningStatus.Processing : ScreeningStatus.PaymentPending;
        var from = order.Status;
        order.ApplyTransition(to, checked(order.CurrentRevision + 1), now);
        _db.ScreeningPaymentEvidence.Add(payment);
        _db.ScreeningTransitionEvents.Add(Transition(order, from, to, now, now, ScreeningTransitionSource.System,
            "ApplicantConsentedAndProviderStarted", null, null));
        await InTransactionAsync(() => _db.SaveChangesAsync(cancellationToken), cancellationToken);
        await RecordStatusTimelineAsync(order, to, null, cancellationToken);
        return new ApplicantScreeningConsentResult(order.Id, order.Status, ScreeningConsentOutcome.Started,
            hosted.ContinuationUri, hosted.ExpiresAt);
    }

    public async Task<StaffScreeningOrderResult?> GetStaffOrderAsync(long organizationId, long requesterUserId, long orderId,
        CancellationToken cancellationToken = default)
    {
        ValidateIds(organizationId, requesterUserId, orderId);
        var order = await _db.TenantScreeningOrders.AsNoTracking().SingleOrDefaultAsync(x => x.OrganizationId == organizationId && x.Id == orderId, cancellationToken);
        if (order is not null)
            await AuthorizeAsync(organizationId, requesterUserId, order.PropertyId, cancellationToken);
        return order is null ? null : ToStaffResult(order);
    }

    public async Task<IReadOnlyList<StaffScreeningOrderResult>> ListStaffOrdersByApplicationAsync(long organizationId,
        long requesterUserId, long rentalApplicationId, CancellationToken cancellationToken = default)
    {
        ValidateIds(organizationId, requesterUserId, rentalApplicationId);
        var applicant = await LoadEligibleApplicantAsync(organizationId, rentalApplicationId, cancellationToken);
        await AuthorizeAsync(organizationId, requesterUserId, applicant.PropertyId, cancellationToken);
        return (await _db.TenantScreeningOrders.AsNoTracking().Where(x => x.OrganizationId == organizationId && x.RentalApplicationId == rentalApplicationId)
            .OrderByDescending(x => x.CreatedAt).ToListAsync(cancellationToken)).Select(ToStaffResult).ToArray();
    }

    public async Task<ScreeningQuoteOptionsResult> GetQuoteOptionsAsync(long organizationId, long requesterUserId,
        long rentalApplicationId, CancellationToken cancellationToken = default)
    {
        ValidateIds(organizationId, requesterUserId, rentalApplicationId);
        var applicant = await LoadEligibleApplicantAsync(organizationId, rentalApplicationId, cancellationToken);
        await AuthorizeAsync(organizationId, requesterUserId, applicant.PropertyId, cancellationToken);
        return await _quoteOptionsResolver.ResolveAsync(new(organizationId, requesterUserId, applicant.Id,
            applicant.PropertyId, applicant.UnitId, applicant.JurisdictionCode), cancellationToken)
            ?? throw new ScreeningUnavailableException();
    }

    public async Task<StaffScreeningDetailResult?> GetStaffDetailAsync(long organizationId, long requesterUserId, long orderId,
        CancellationToken cancellationToken = default)
    {
        ValidateIds(organizationId, requesterUserId, orderId);
        var order = await _db.TenantScreeningOrders.AsNoTracking().SingleOrDefaultAsync(x => x.OrganizationId == organizationId && x.Id == orderId, cancellationToken);
        if (order is not null)
            await AuthorizeAsync(organizationId, requesterUserId, order.PropertyId, cancellationToken);
        return order is null ? null : await ToStaffDetailAsync(order, cancellationToken);
    }

    public async Task<IReadOnlyList<StaffScreeningDetailResult>> ListStaffDetailsByApplicationAsync(long organizationId,
        long requesterUserId, long rentalApplicationId, CancellationToken cancellationToken = default)
    {
        ValidateIds(organizationId, requesterUserId, rentalApplicationId);
        var applicant = await LoadEligibleApplicantAsync(organizationId, rentalApplicationId, cancellationToken);
        await AuthorizeAsync(organizationId, requesterUserId, applicant.PropertyId, cancellationToken);
        var orders = await _db.TenantScreeningOrders.AsNoTracking().Where(x => x.OrganizationId == organizationId && x.RentalApplicationId == rentalApplicationId)
            .OrderByDescending(x => x.CreatedAt).ToListAsync(cancellationToken);
        var results = new List<StaffScreeningDetailResult>(orders.Count);
        foreach (var order in orders) results.Add(await ToStaffDetailAsync(order, cancellationToken));
        return results;
    }

    public async Task<ApplicantAccessMutationResult> RevokeApplicantAccessAsync(long organizationId, long requesterUserId, long orderId,
        CancellationToken cancellationToken = default)
    {
        ValidateIds(organizationId, requesterUserId, orderId);
        var order = await _db.TenantScreeningOrders.SingleOrDefaultAsync(x => x.OrganizationId == organizationId && x.Id == orderId, cancellationToken)
            ?? throw new ScreeningResourceNotFoundException("screening order");
        await AuthorizeAsync(organizationId, requesterUserId, order.PropertyId, cancellationToken);
        order.RevokeApplicantAccess();
        await _db.SaveChangesAsync(cancellationToken);
        return new(null, "Applicant screening access revoked.");
    }

    public async Task<ApplicantAccessMutationResult> RotateApplicantAccessAsync(long organizationId, long requesterUserId, long orderId,
        CancellationToken cancellationToken = default)
    {
        ValidateIds(organizationId, requesterUserId, orderId);
        var order = await _db.TenantScreeningOrders.SingleOrDefaultAsync(x => x.OrganizationId == organizationId && x.Id == orderId, cancellationToken)
            ?? throw new ScreeningResourceNotFoundException("screening order");
        await AuthorizeAsync(organizationId, requesterUserId, order.PropertyId, cancellationToken);
        var policy = await _policyResolver.ResolveAsync(new(order.OrganizationId, requesterUserId, order.RentalApplicationId,
            order.PropertyId, order.UnitId, order.PackageCode, order.Payer, order.JurisdictionCode), cancellationToken)
            ?? throw new ScreeningPolicyViolationException("no server policy is configured");
        var applicant = await LoadApplicantContactAsync(organizationId, order.RentalApplicationId, cancellationToken);
        var now = _timeProvider.GetUtcNow();
        var token = GenerateToken();
        order.SetApplicantAccess(TokenHash(token), now.Add(policy.ApplicantAccessLifetime));
        await _db.SaveChangesAsync(cancellationToken);
        try { await DeliverAsync(order, applicant, token, cancellationToken); }
        catch (Exception exception) when (exception is not OperationCanceledException) { throw new ScreeningDeliveryException(order.Id, exception); }
        return new(order.ApplicantAccessExpiresAt, "Applicant screening access rotated and delivered.");
    }

    public async Task<ScreeningCallbackApplyResult> ApplyVerifiedCallbackAsync(string providerKey, ScreeningCallbackRequest request,
        CancellationToken cancellationToken = default)
    {
        ScreeningContractValidation.ValidateBoundedText(providerKey, 100, nameof(providerKey), false);
        ArgumentNullException.ThrowIfNull(request);
        var envelope = await _callbackVerifier.VerifyAsync(providerKey, request, cancellationToken);
        if (!string.Equals(providerKey, envelope.ProviderKey, StringComparison.Ordinal))
            throw new UnauthorizedAccessException("The verified callback provider does not match the routed provider.");
        var now = _timeProvider.GetUtcNow();
        var payloadHash = Convert.ToHexString(SHA256.HashData(request.Payload.Span)).ToLowerInvariant();
        if (!FixedEquals(payloadHash, envelope.SignedPayloadSha256Hash))
            throw new UnauthorizedAccessException("The verified callback is not bound to the received payload.");

        // Do not let a case-insensitive database collation turn a different configured order provider
        // into a correlation match. Provider identities are opaque and ordinal throughout this boundary.
        var configuredOrderProvider = await _db.TenantScreeningOrders
            .Where(x => x.ProviderKey == providerKey && x.ProviderOrderId == envelope.Update.ProviderOrderId)
            .Select(x => x.ProviderKey).FirstOrDefaultAsync(cancellationToken);
        if (configuredOrderProvider is not null &&
            !string.Equals(providerKey, configuredOrderProvider, StringComparison.Ordinal))
            throw new UnauthorizedAccessException("The routed provider does not match the screening order provider.");

        var existing = await _db.ScreeningWebhookInboxEvents.SingleOrDefaultAsync(x =>
            x.ProviderKey == providerKey && x.ProviderEventId == envelope.EventId, cancellationToken);
        if (existing is not null)
            return await ApplyDuplicateSemanticsAsync(existing, payloadHash, now, cancellationToken);
        // Known event IDs remain idempotent replays; never-seen events must be recently signed.
        if (envelope.SignedAt < now.Subtract(_webhookOptions.MaximumSignedAge) || envelope.SignedAt > now.AddMinutes(5))
            throw new UnauthorizedAccessException("The signed callback timestamp is outside the accepted window.");

        var payment = envelope.Update.PaymentEvidence;
        var inbox = new ScreeningWebhookInboxEvent
        {
            ProviderKey = providerKey,
            ProviderEventId = envelope.EventId,
            PayloadSha256Hash = payloadHash,
            ReceivedAt = now,
            OccurredAt = envelope.Update.OccurredAt,
            SignedAt = envelope.SignedAt,
            AuthenticationScheme = envelope.AuthenticationScheme,
            AuthenticationKeyVersion = envelope.AuthenticationKeyVersion,
            ProviderSequence = envelope.Update.ProviderSequence,
            ProviderOrderId = envelope.Update.ProviderOrderId,
            CanonicalStatus = envelope.Update.Status,
            NormalizedReasonCode = envelope.Update.ReasonCode,
            PaymentQuoteReferenceHash = payment?.QuoteReferenceHash,
            PaymentOperationReferenceHash = payment?.PaymentOperationReferenceHash,
            PaymentPayer = payment?.Payer,
            PaymentLandlordAmountMinor = payment?.LandlordAmountMinor,
            PaymentApplicantAmountMinor = payment?.ApplicantAmountMinor,
            PaymentProviderAmountMinor = payment?.ProviderAmountMinor,
            PaymentPlatformFeeMinor = payment?.PlatformFeeMinor,
            PaymentTaxAmountMinor = payment?.TaxAmountMinor,
            PaymentTotalAmountMinor = payment?.TotalAmountMinor,
            PaymentCurrency = payment?.Currency,
            PaymentStatus = payment?.Status,
            PaymentOccurredAt = payment?.OccurredAt,
            PaymentFailureCode = payment?.FailureCode
        };
        _db.ScreeningWebhookInboxEvents.Add(inbox);
        try
        {
            // Commit the verified normalized envelope before lifecycle work so it remains replayable.
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            // A concurrent worker may have won the provider-scoped unique key. Detach only the failed
            // insert (never clear unrelated work), load the durable winner, and apply normal duplicate rules.
            _db.Entry(inbox).State = EntityState.Detached;
            var winner = await _db.ScreeningWebhookInboxEvents.SingleOrDefaultAsync(x =>
                x.ProviderKey == providerKey && x.ProviderEventId == envelope.EventId, cancellationToken);
            if (winner is null) throw;
            return await ApplyDuplicateSemanticsAsync(winner, payloadHash, now, cancellationToken);
        }

        if (!inbox.TryAcquireLease(Guid.NewGuid(), now, now.AddMinutes(1)))
            return new ScreeningCallbackApplyResult(ScreeningCallbackOutcome.Rejected, null, null);
        await _db.SaveChangesAsync(cancellationToken);
        return await ProcessClaimedInboxAsync(inbox, now, cancellationToken);
    }

    public async Task<int> ProcessPendingWebhookInboxAsync(int batchSize, TimeSpan leaseDuration,
        CancellationToken cancellationToken = default)
    {
        if (batchSize <= 0 || batchSize > 1000) throw new ArgumentOutOfRangeException(nameof(batchSize));
        if (leaseDuration <= TimeSpan.Zero || leaseDuration > TimeSpan.FromHours(1)) throw new ArgumentOutOfRangeException(nameof(leaseDuration));
        var now = _timeProvider.GetUtcNow();
        var eligible = await _db.ScreeningWebhookInboxEvents
            .Where(x => x.ProcessingStatus == ScreeningInboxProcessingStatus.Pending ||
                (x.ProcessingStatus == ScreeningInboxProcessingStatus.RetryScheduled &&
                    (!x.NextAttemptAt.HasValue || x.NextAttemptAt <= now)) ||
                (x.ProcessingStatus == ScreeningInboxProcessingStatus.Processing &&
                    x.ProcessingLeaseUntil.HasValue && x.ProcessingLeaseUntil <= now))
            .OrderBy(x => x.ReceivedAt).ThenBy(x => x.Id).Take(batchSize).ToListAsync(cancellationToken);

        var processed = 0;
        foreach (var inbox in eligible)
        {
            if (!inbox.TryAcquireLease(Guid.NewGuid(), now, now.Add(leaseDuration))) continue;
            try
            {
                // Persisting the claim before processing is the multi-worker boundary. Real SQL acceptance
                // (locking/isolation and contention) is intentionally deferred to the database milestone.
                await _db.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateConcurrencyException)
            {
                _db.Entry(inbox).State = EntityState.Detached;
                continue;
            }
            await ProcessClaimedInboxAsync(inbox, now, cancellationToken);
            processed++;
        }
        return processed;
    }

    public async Task<ScreeningCallbackApplyResult> ReconcileOrderAsync(long organizationId, long requesterUserId,
        long orderId, CancellationToken cancellationToken = default)
    {
        ValidateIds(organizationId, requesterUserId, orderId);
        var order = await _db.TenantScreeningOrders.SingleOrDefaultAsync(x => x.Id == orderId, cancellationToken);
        if (order is null)
        {
            // Establish organization authority before revealing whether an order exists.
            await AuthorizeOrganizationAsync(organizationId, requesterUserId, cancellationToken);
            throw new ScreeningResourceNotFoundException("screening order");
        }
        await AuthorizeAsync(organizationId, requesterUserId, order.PropertyId, cancellationToken);
        return await ReconcileOrderCoreAsync(order, cancellationToken);
    }

    /// <summary>Worker-only reconciliation rooted in the durable order/provider correlation.</summary>
    internal async Task<ScreeningCallbackApplyResult> ReconcileOrderFromSystemIntentAsync(long organizationId,
        long orderId, CancellationToken cancellationToken = default)
    {
        ValidateIds(organizationId, orderId);
        var order = await _db.TenantScreeningOrders.SingleOrDefaultAsync(x =>
            x.Id == orderId && x.OrganizationId == organizationId, cancellationToken)
            ?? throw new ScreeningResourceNotFoundException("screening order");
        return await ReconcileOrderCoreAsync(order, cancellationToken);
    }

    private async Task<ScreeningCallbackApplyResult> ReconcileOrderCoreAsync(TenantScreeningOrder order,
        CancellationToken cancellationToken)
    {
        if (order.Status is ScreeningStatus.Expired or ScreeningStatus.Failed)
            throw new InvalidOperationException("Closed screening orders cannot be reconciled.");
        if (order.ProviderOrderId is null)
            throw new InvalidOperationException("The screening order has no provider correlation.");

        var request = new ScreeningStatusRequest(order.OrganizationId, order.RentalApplicationId, order.Id, order.ProviderOrderId);
        var update = await _gateway.GetStatusAsync(request, cancellationToken);
        if (!string.Equals(update.ProviderOrderId, order.ProviderOrderId, StringComparison.Ordinal))
            throw new ScreeningProviderCorrelationException();

        var latestProviderOccurredAt = await _db.ScreeningTransitionEvents.AsNoTracking()
            .Where(x => x.TenantScreeningOrderId == order.Id &&
                (x.Source == ScreeningTransitionSource.ProviderWebhook || x.Source == ScreeningTransitionSource.ProviderPolling))
            .MaxAsync(x => (DateTimeOffset?)x.OccurredAt, cancellationToken);
        long? latestSequence = await _db.ScreeningWebhookInboxEvents.AsNoTracking()
            .Where(x => x.ProviderKey == order.ProviderKey && x.ProviderOrderId == order.ProviderOrderId &&
                x.ProviderSequence.HasValue &&
                (x.ProcessingStatus == ScreeningInboxProcessingStatus.Processed ||
                 x.ProcessingStatus == ScreeningInboxProcessingStatus.Stale))
            .MaxAsync(x => (long?)x.ProviderSequence, cancellationToken);
        var pollingSequencePrefix = $"poll:{order.Id}:";
        var pollingSequenceEvidence = await _db.ScreeningTransitionEvents.AsNoTracking()
            .Where(x => x.TenantScreeningOrderId == order.Id && x.Source == ScreeningTransitionSource.ProviderPolling &&
                x.ProviderEventId != null && x.ProviderEventId.StartsWith(pollingSequencePrefix))
            .Select(x => x.ProviderEventId!).ToListAsync(cancellationToken);
        foreach (var evidence in pollingSequenceEvidence)
            if (long.TryParse(evidence[pollingSequencePrefix.Length..], out var sequence) &&
                (!latestSequence.HasValue || sequence > latestSequence.Value)) latestSequence = sequence;

        var staleCode = latestSequence.HasValue && update.ProviderSequence.HasValue &&
                        update.ProviderSequence.Value <= latestSequence.Value
            ? "ObsoleteProviderSequence"
            : !update.ProviderSequence.HasValue && latestProviderOccurredAt.HasValue &&
              update.OccurredAt < latestProviderOccurredAt.Value && update.Status != order.Status &&
              ScreeningTransitionPolicy.CanTransition(update.Status, order.Status)
                ? "ObsoleteProviderTransition"
                : null;
        if (staleCode is not null)
        {
            await _incidentRecorder.RecordAsync(new ScreeningIncidentRecord(order.OrganizationId, order.Id,
                order.ProviderKey, null, ScreeningIncidentType.StaleProviderPollingState,
                ScreeningIncidentSeverity.Low, "provider-polling-reconciliation",
                $"poll:{order.ProviderKey}:{order.Id}:{update.ProviderSequence?.ToString() ?? update.OccurredAt.ToUnixTimeMilliseconds().ToString()}",
                staleCode, null, null), cancellationToken);
            return new ScreeningCallbackApplyResult(ScreeningCallbackOutcome.Stale, order.Id, order.CurrentRevision);
        }

        var paymentAssessment = await StageAuthoritativePaymentAsync(order, PaymentFacts.From(update.PaymentEvidence),
            ScreeningPaymentEvidenceSource.ProviderPolling, _timeProvider.GetUtcNow(), cancellationToken);
        if (order.Status == ScreeningStatus.PaymentPending && !paymentAssessment.MayAdvance)
        {
            if (paymentAssessment.EvidenceWasStaged)
                await InTransactionAsync(() => _db.SaveChangesAsync(cancellationToken), cancellationToken);
            return new ScreeningCallbackApplyResult(ScreeningCallbackOutcome.Rejected, order.Id, order.CurrentRevision);
        }

        ScreeningReportRevision? report = null;
        if (update.Status == ScreeningStatus.Complete)
        {
            try
            {
                report = await FetchAndStageReportRevisionAsync(order, _timeProvider.GetUtcNow(), cancellationToken);
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                throw new ScreeningReportIngestionException(exception);
            }
        }

        if (update.Status == order.Status)
        {
            if (report is not null || paymentAssessment.EvidenceWasStaged)
                await InTransactionAsync(() => _db.SaveChangesAsync(cancellationToken), cancellationToken);
            return new ScreeningCallbackApplyResult(ScreeningCallbackOutcome.SameState, order.Id, order.CurrentRevision);
        }
        if (!ScreeningTransitionPolicy.CanTransition(order.Status, update.Status))
            throw new InvalidOperationException("The provider returned an illegal screening status transition.");

        var now = _timeProvider.GetUtcNow();
        var from = order.Status;
        order.ApplyTransition(update.Status, checked(order.CurrentRevision + 1), update.OccurredAt);
        _db.ScreeningTransitionEvents.Add(Transition(order, from, update.Status, update.OccurredAt, now,
            ScreeningTransitionSource.ProviderPolling, update.ReasonCode,
            update.ProviderSequence.HasValue ? $"poll:{order.Id}:{update.ProviderSequence.Value}" : null, null));
        await InTransactionAsync(async () =>
        {
            await _db.SaveChangesAsync(cancellationToken);
            await RecordScreeningCompletedAsync(order, update.OccurredAt,
                ScreeningTransitionSource.ProviderPolling,
                update.ProviderSequence.HasValue ? $"poll:{order.Id}:{update.ProviderSequence.Value}" : null,
                cancellationToken);
        }, cancellationToken);
        await RecordStatusTimelineAsync(order, update.Status, null, cancellationToken);
        return new ScreeningCallbackApplyResult(ScreeningCallbackOutcome.Applied, order.Id, order.CurrentRevision);
    }

    private async Task<ScreeningCallbackApplyResult> ApplyDuplicateSemanticsAsync(ScreeningWebhookInboxEvent existing,
        string payloadHash, DateTimeOffset now, CancellationToken cancellationToken)
    {
        if (!FixedEquals(existing.PayloadSha256Hash, payloadHash))
        {
            existing.RecordSecurityIncident("PayloadHashMismatch", now);
            var incidentOrg = existing.TenantScreeningOrderId.HasValue
                ? await _db.TenantScreeningOrders.Where(x => x.Id == existing.TenantScreeningOrderId.Value).Select(x => (long?)x.OrganizationId).SingleOrDefaultAsync(cancellationToken)
                : null;
            await _incidentRecorder.RecordAsync(new ScreeningIncidentRecord(incidentOrg, existing.TenantScreeningOrderId,
                existing.ProviderKey, existing.ProviderEventId, ScreeningIncidentType.WebhookIntegrityConflict,
                ScreeningIncidentSeverity.High, "verified-callback-deduplication", $"{existing.ProviderKey}:{existing.ProviderEventId}",
                "PayloadHashMismatch", null, null), cancellationToken);
            throw new ScreeningWebhookIntegrityException();
        }
        existing.RecordDuplicate(now);
        await _db.SaveChangesAsync(cancellationToken);
        return new ScreeningCallbackApplyResult(ScreeningCallbackOutcome.Duplicate, existing.TenantScreeningOrderId, null);
    }

    private async Task<ScreeningCallbackApplyResult> ProcessClaimedInboxAsync(ScreeningWebhookInboxEvent inbox,
        DateTimeOffset now, CancellationToken cancellationToken)
    {
        var order = await _db.TenantScreeningOrders.SingleOrDefaultAsync(x =>
            x.ProviderKey == inbox.ProviderKey && x.ProviderOrderId == inbox.ProviderOrderId, cancellationToken);
        if (order is not null && !string.Equals(order.ProviderKey, inbox.ProviderKey, StringComparison.Ordinal))
            throw new UnauthorizedAccessException("The verified callback provider does not match the screening order provider.");
        if (order is null)
        {
            inbox.ScheduleRetry("OrderCorrelationNotFound", null, now, now.Add(_webhookOptions.RetryDelay), _webhookOptions.MaximumAttempts);
            if (inbox.ProcessingStatus == ScreeningInboxProcessingStatus.DeadLettered)
                await RecordDeadLetterAsync(inbox, null, cancellationToken);
            else await _db.SaveChangesAsync(cancellationToken);
            return new ScreeningCallbackApplyResult(ScreeningCallbackOutcome.Rejected, null, null);
        }

        inbox.TenantScreeningOrderId = order.Id;
        var latest = await _db.ScreeningTransitionEvents.Where(x => x.TenantScreeningOrderId == order.Id &&
                (x.Source == ScreeningTransitionSource.ProviderWebhook || x.Source == ScreeningTransitionSource.ProviderPolling))
            .Select(x => (DateTimeOffset?)x.OccurredAt).MaxAsync(cancellationToken);
        var latestProviderSequence = inbox.ProviderSequence.HasValue
            ? await _db.ScreeningWebhookInboxEvents.Where(x => x.Id != inbox.Id &&
                    x.ProviderKey == inbox.ProviderKey && x.ProviderOrderId == inbox.ProviderOrderId &&
                    x.ProviderSequence.HasValue &&
                    (x.ProcessingStatus == ScreeningInboxProcessingStatus.Processed ||
                     x.ProcessingStatus == ScreeningInboxProcessingStatus.Stale))
                .MaxAsync(x => (long?)x.ProviderSequence, cancellationToken)
            : null;
        if (latestProviderSequence.HasValue && inbox.ProviderSequence!.Value <= latestProviderSequence.Value)
        {
            inbox.MarkStale("ObsoleteProviderSequence", now);
            await _db.SaveChangesAsync(cancellationToken);
            return new ScreeningCallbackApplyResult(ScreeningCallbackOutcome.Stale, order.Id, order.CurrentRevision);
        }
        if (!inbox.ProviderSequence.HasValue && latest.HasValue && inbox.OccurredAt < latest.Value &&
            inbox.CanonicalStatus != order.Status && ScreeningTransitionPolicy.CanTransition(inbox.CanonicalStatus, order.Status))
        {
            inbox.MarkStale("ObsoleteProviderTransition", now);
            await _db.SaveChangesAsync(cancellationToken);
            return new ScreeningCallbackApplyResult(ScreeningCallbackOutcome.Stale, order.Id, order.CurrentRevision);
        }
        var paymentAssessment = await StageAuthoritativePaymentAsync(order, PaymentFacts.From(inbox),
            ScreeningPaymentEvidenceSource.ProviderWebhook, now, cancellationToken);
        if (order.Status == ScreeningStatus.PaymentPending && !paymentAssessment.MayAdvance)
        {
            inbox.MarkProcessed(now);
            await InTransactionAsync(() => _db.SaveChangesAsync(cancellationToken), cancellationToken);
            return new ScreeningCallbackApplyResult(ScreeningCallbackOutcome.Rejected, order.Id, order.CurrentRevision);
        }

        ScreeningReportRevision? report = null;
        if (inbox.CanonicalStatus == ScreeningStatus.Complete)
        {
            try
            {
                report = await FetchAndStageReportRevisionAsync(order, now, cancellationToken);
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                inbox.ScheduleRetry("ProviderReportUnavailable", null, now,
                    now.Add(_webhookOptions.RetryDelay), _webhookOptions.MaximumAttempts);
                if (inbox.ProcessingStatus == ScreeningInboxProcessingStatus.DeadLettered)
                    await RecordDeadLetterAsync(inbox, order, cancellationToken);
                else
                    await _db.SaveChangesAsync(cancellationToken);
                return new ScreeningCallbackApplyResult(ScreeningCallbackOutcome.Rejected, order.Id, order.CurrentRevision);
            }
        }
        if (inbox.CanonicalStatus == order.Status)
        {
            inbox.MarkProcessed(now);
            await InTransactionAsync(() => _db.SaveChangesAsync(cancellationToken), cancellationToken);
            return new ScreeningCallbackApplyResult(ScreeningCallbackOutcome.SameState, order.Id, order.CurrentRevision);
        }
        if (!ScreeningTransitionPolicy.CanTransition(order.Status, inbox.CanonicalStatus))
        {
            inbox.ScheduleRetry("IllegalStatusTransition", null, now, now.Add(_webhookOptions.RetryDelay), _webhookOptions.MaximumAttempts);
            if (inbox.ProcessingStatus == ScreeningInboxProcessingStatus.DeadLettered) await RecordDeadLetterAsync(inbox, order, cancellationToken);
            else await _db.SaveChangesAsync(cancellationToken);
            return new ScreeningCallbackApplyResult(ScreeningCallbackOutcome.Rejected, order.Id, order.CurrentRevision);
        }

        var from = order.Status;
        var occurredAt = inbox.OccurredAt;
        order.ApplyTransition(inbox.CanonicalStatus, checked(order.CurrentRevision + 1), occurredAt);
        _db.ScreeningTransitionEvents.Add(Transition(order, from, inbox.CanonicalStatus, occurredAt, now,
            ScreeningTransitionSource.ProviderWebhook, inbox.NormalizedReasonCode, inbox.ProviderEventId, null));
        inbox.MarkProcessed(now);
        await InTransactionAsync(async () =>
        {
            await _db.SaveChangesAsync(cancellationToken);
            await RecordScreeningCompletedAsync(order, occurredAt, ScreeningTransitionSource.ProviderWebhook,
                inbox.ProviderEventId, cancellationToken);
        }, cancellationToken);
        await RecordStatusTimelineAsync(order, inbox.CanonicalStatus, null, cancellationToken);
        return new ScreeningCallbackApplyResult(ScreeningCallbackOutcome.Applied, order.Id, order.CurrentRevision);
    }

    private Task RecordScreeningCompletedAsync(TenantScreeningOrder order, DateTimeOffset occurredAt,
        ScreeningTransitionSource source, string? sourceEventId, CancellationToken cancellationToken)
    {
        if (_activationRecorder is null || order.Status != ScreeningStatus.Complete)
            return Task.CompletedTask;
        var stableSourceId = sourceEventId ?? $"{source}:{order.Id}:{order.CurrentRevision}";
        return _activationRecorder.RecordAsync(new ActivationOccurrenceRequest(order.OrganizationId,
            ActivationMilestones.ScreeningCompleted, $"screening-order:{order.Id}", occurredAt.ToUniversalTime(),
            SourceEventType: source == ScreeningTransitionSource.ProviderWebhook
                ? "screening-provider-webhook"
                : "screening-provider-polling",
            SourceEventId: stableSourceId), cancellationToken);
    }

    private async Task<ScreeningReportRevision?> FetchAndStageReportRevisionAsync(TenantScreeningOrder order,
        DateTimeOffset now, CancellationToken cancellationToken)
    {
        if (order.ProviderOrderId is null) throw new ScreeningProviderCorrelationException();
        var provider = await _gateway.GetReportRevisionAsync(new ScreeningReportRequest(order.OrganizationId,
            order.RentalApplicationId, order.Id, order.ProviderOrderId), cancellationToken);
        if (provider.Status is not (NormalizedScreeningReportStatus.Complete or NormalizedScreeningReportStatus.Corrected))
            throw new ArgumentException("A completed order requires complete provider report evidence.", nameof(provider));

        var facts = TenantScreeningDecisionService.NormalizeReportFacts(provider.NormalizedFacts,
            nameof(provider.NormalizedFacts));
        var json = JsonSerializer.Serialize(facts);
        if (json.Length > 4000)
            throw new ArgumentException("Normalized facts exceed the bounded evidence size.", nameof(provider));
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(json))).ToLowerInvariant();

        var duplicate = await _db.ScreeningReportRevisions.SingleOrDefaultAsync(x =>
            x.ProviderKey == order.ProviderKey &&
            x.ProviderReportReference == provider.ProviderReportReference, cancellationToken);
        if (duplicate is not null)
        {
            if (duplicate.TenantScreeningOrderId != order.Id ||
                !string.Equals(duplicate.ReportVersion, provider.ReportVersion, StringComparison.Ordinal) ||
                duplicate.Status != MapReportStatus(provider.Status) ||
                !FixedEquals(duplicate.NormalizedFactsSha256Hash, hash) ||
                duplicate.SupersedesScreeningReportRevisionId != provider.SupersedesScreeningReportRevisionId ||
                duplicate.ProviderOccurredAt != provider.OccurredAt || duplicate.ReceivedAt != provider.RetrievedAt ||
                duplicate.RetentionSignal != provider.RetentionSignal)
                throw new ScreeningProviderCorrelationException();
            return null;
        }

        ScreeningReportRevision? superseded = null;
        if (provider.SupersedesScreeningReportRevisionId.HasValue)
        {
            superseded = await _db.ScreeningReportRevisions.SingleOrDefaultAsync(x =>
                x.Id == provider.SupersedesScreeningReportRevisionId.Value &&
                x.TenantScreeningOrderId == order.Id, cancellationToken)
                ?? throw new ScreeningProviderCorrelationException();
            if (await _db.ScreeningReportRevisions.AnyAsync(x =>
                    x.SupersedesScreeningReportRevisionId == superseded.Id, cancellationToken))
                throw new InvalidOperationException("A report revision may be superseded only once.");
        }

        var nextRevision = checked((await _db.ScreeningReportRevisions
            .Where(x => x.TenantScreeningOrderId == order.Id)
            .MaxAsync(x => (long?)x.Revision, cancellationToken) ?? 0) + 1);
        var report = new ScreeningReportRevision
        {
            TenantScreeningOrderId = order.Id,
            OrganizationId = order.OrganizationId,
            Revision = nextRevision,
            ProviderKey = order.ProviderKey,
            ProviderReportReference = provider.ProviderReportReference,
            ReceivedAt = provider.RetrievedAt,
            ProviderOccurredAt = provider.OccurredAt,
            CorrectedAt = provider.Status == NormalizedScreeningReportStatus.Corrected ? provider.OccurredAt : null,
            Status = MapReportStatus(provider.Status),
            ReportVersion = provider.ReportVersion,
            NormalizedFactsJson = json,
            NormalizedFactsSha256Hash = hash,
            SupersedesScreeningReportRevisionId = superseded?.Id,
            RetentionExpiresAt = provider.RetrievedAt.Add(provider.RetentionPeriod),
            RetentionSignal = provider.RetentionSignal
        };
        _db.ScreeningReportRevisions.Add(report);
        return report;
    }

    private static ScreeningReportStatus MapReportStatus(NormalizedScreeningReportStatus status) => status switch
    {
        NormalizedScreeningReportStatus.Complete => ScreeningReportStatus.Complete,
        NormalizedScreeningReportStatus.Corrected => ScreeningReportStatus.Corrected,
        _ => throw new ArgumentOutOfRangeException(nameof(status))
    };

    private async Task RecordDeadLetterAsync(ScreeningWebhookInboxEvent inbox, TenantScreeningOrder? order, CancellationToken cancellationToken)
    {
        await _incidentRecorder.RecordAsync(new ScreeningIncidentRecord(order?.OrganizationId, order?.Id, inbox.ProviderKey,
            inbox.ProviderEventId, ScreeningIncidentType.WebhookDeadLetter, ScreeningIncidentSeverity.Medium,
            "webhook-inbox-retry-policy", $"{inbox.ProviderKey}:{inbox.ProviderEventId}", inbox.FailureCode, null, null), cancellationToken);
    }

    private async Task<TenantScreeningOrder> ResolveApplicantOrderAsync(string rawToken, CancellationToken cancellationToken)
    {
        ScreeningContractValidation.ValidateBoundedText(rawToken, 500, nameof(rawToken), false);
        var hash = TokenHash(rawToken);
        return await _db.TenantScreeningOrders.SingleOrDefaultAsync(x => x.ApplicantAccessTokenHash == hash, cancellationToken)
            ?? throw new ScreeningInvalidInvitationException();
    }

    private static void EnsureAccessCurrent(TenantScreeningOrder order, DateTimeOffset now)
    {
        if (order.ApplicantAccessExpiresAt is null || order.ApplicantAccessExpiresAt <= now)
            throw new ScreeningAccessExpiredException();
        if (order.Status is not (ScreeningStatus.ConsentPending or ScreeningStatus.PaymentPending or ScreeningStatus.Processing or
            ScreeningStatus.Complete or ScreeningStatus.Disputed or ScreeningStatus.ActionRequired or ScreeningStatus.Failed or ScreeningStatus.Expired))
            throw new ScreeningInvalidInvitationException();
    }

    private async Task<bool> AttachLateCancellationCorrelationAsync(long orderId, string providerOrderId)
    {
        // The provider session now exists, so request cancellation must not strand its correlation
        // merely because the cancellation worker finalized or renewed its lease concurrently.
        // Retry only optimistic conflicts; all retries use a non-request token because losing this
        // correlation after provider success would leave an externally active session unowned.
        for (var attempt = 0; attempt < 3; attempt++)
        {
            var intent = await _db.ScreeningCancellationIntents.SingleOrDefaultAsync(x =>
                x.TenantScreeningOrderId == orderId &&
                x.Status != ScreeningCancellationIntentStatus.SupersededByCompletion &&
                x.Status != ScreeningCancellationIntentStatus.RejectedByOrderState, CancellationToken.None);
            if (intent is null) return false;

            intent.AttachLateProviderOrder(providerOrderId);
            try
            {
                await _db.SaveChangesAsync(CancellationToken.None);
                return true;
            }
            catch (DbUpdateConcurrencyException) when (attempt < 2)
            {
                _db.Entry(intent).State = EntityState.Detached;
            }
        }

        throw new InvalidOperationException("Cancellation correlation could not be persisted after concurrent updates.");
    }

    private async Task<ApplicantHostedSessionResult> CreateHostedSessionAsync(TenantScreeningOrder order, DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        var request = new ScreeningQuoteRequest(order.OrganizationId, order.RentalApplicationId, order.PropertyId,
            order.RentalApplicationId, order.PackageCode, order.JurisdictionCode, order.Payer);
        var quote = AuthoritativeScreeningQuote.Create(request, order.QuoteReference, order.Payer, order.LandlordAmountMinor,
            order.ApplicantAmountMinor, order.ProviderAmountMinor, order.PlatformFeeMinor, order.TaxAmountMinor, order.Currency,
            order.QuoteExpiresAt, order.QuotePolicyVersion, now);
        var hosted = await _gateway.CreateApplicantHostedSessionAsync(
            new CreateApplicantScreeningSessionRequest(order.Id, request, quote, now), cancellationToken);
        if (hosted.ExpiresAt <= now || hosted.ExpiresAt > now.AddMinutes(15))
            throw new ScreeningPolicyViolationException("hosted continuation lifetime is invalid");
        return hosted;
    }

    private Task DeliverAsync(TenantScreeningOrder order, ApplicantProjection applicant, string token, CancellationToken cancellationToken)
    {
        var link = _linkFactory.CreateApplicantAccessLink(token);
        if (link is null || !link.IsAbsoluteUri || link.Scheme != Uri.UriSchemeHttps)
            throw new InvalidOperationException("Applicant link factory returned an unsafe link.");
        return _delivery.DeliverAsync(new ScreeningApplicantInvitationDeliveryRequest(order.Id, applicant.Email,
            applicant.FirstName, applicant.LastName, token, link, order.ApplicantAccessExpiresAt!.Value), cancellationToken);
    }

    private static void ValidateQuote(ScreeningQuoteRequest request, AuthoritativeScreeningQuote quote,
        ScreeningPolicySnapshot policy, DateTimeOffset now)
    {
        if (!quote.QuoteRequest.Equals(request) || quote.Payer != request.Payer) throw new ScreeningPolicyViolationException("quote context differs");
        if (!string.Equals(quote.PolicyVersion, policy.PricingPolicyVersion, StringComparison.Ordinal)) throw new ScreeningPolicyViolationException("pricing policy version differs");
        var lifetime = quote.ExpiresAt - now;
        if (quote.ExpiresAt <= now || lifetime < policy.MinimumQuoteLifetime || lifetime > policy.MaximumQuoteLifetime) throw new ScreeningPolicyViolationException("quote lifetime is outside policy bounds");
        if (policy.MaximumApplicantTotalMinor.HasValue && quote.ApplicantAmountMinor > policy.MaximumApplicantTotalMinor.Value) throw new ScreeningPolicyViolationException("applicant total exceeds cap");
        if (quote.PlatformFeeMinor > policy.MaximumPlatformFeeMinor) throw new ScreeningPolicyViolationException("platform fee exceeds cap");
        if (!policy.MarkupPermitted && quote.PlatformFeeMinor != 0) throw new ScreeningPolicyViolationException("markup is not permitted");
    }

    private async Task<AuthoritySnapshot> AuthorizeAsync(long organizationId, long requesterUserId, long propertyId,
        CancellationToken cancellationToken)
    {
        var authority = await AuthorizeOrganizationAsync(organizationId, requesterUserId, cancellationToken);
        var hasPropertyAuthority = await _db.Properties.AsNoTracking().AnyAsync(x => x.Id == propertyId &&
            x.OrganizationId == organizationId && !x.IsDeleted &&
            (x.LandlordId == requesterUserId || x.PrimaryManagerId == requesterUserId), cancellationToken);
        if (!hasPropertyAuthority) throw new ScreeningAuthorizationException();
        var permission = authority.Role is "Owner" or "Manager" ? $"role:{authority.Role};property:assigned" : "permission:CanManageTenants;property:assigned";
        return authority with { Permission = permission };
    }

    private async Task<AuthoritySnapshot> AuthorizeOrganizationAsync(long organizationId, long requesterUserId,
        CancellationToken cancellationToken)
    {
        var member = await _db.OrganizationMembers.AsNoTracking().Where(x => x.OrganizationId == organizationId && x.UserId == requesterUserId && x.IsActive)
            .Select(x => new { x.Id, x.Role, x.CanManageTenants }).SingleOrDefaultAsync(cancellationToken);
        if (member is null || (member.Role != "Owner" && member.Role != "Manager" && !member.CanManageTenants))
            throw new ScreeningAuthorizationException();
        return new AuthoritySnapshot(member.Id, member.Role, string.Empty);
    }

    private async Task<ApplicantProjection> LoadEligibleApplicantAsync(long organizationId, long applicationId, CancellationToken cancellationToken)
    {
        var applicant = await LoadApplicantContactAsync(organizationId, applicationId, cancellationToken);
        if (applicant.Status is not (EApplicationStatus.Submitted or EApplicationStatus.UnderReview or EApplicationStatus.Approved or EApplicationStatus.OnHold) ||
            applicant.ConvertedToTenantId.HasValue || applicant.ConvertedToLeaseId.HasValue) throw new ScreeningApplicationIneligibleException();
        return applicant;
    }

    private async Task<ApplicantProjection> LoadApplicantContactAsync(long organizationId, long applicationId, CancellationToken cancellationToken)
    {
        // Deliberately explicit: legacy SSN, DOB and all background/report/result columns are never read or materialized.
        var applicant = await _db.RentalApplications.AsNoTracking().Where(x => x.Id == applicationId)
            .Select(x => new ApplicantProjection(x.Id, x.OrganizationId, x.PropertyId, x.UnitId, x.Status,
                x.ConvertedToTenantId, x.ConvertedToLeaseId, x.Email, x.FirstName, x.LastName)).SingleOrDefaultAsync(cancellationToken);
        if (applicant is null) throw new ScreeningResourceNotFoundException("rental application");
        if (applicant.OrganizationId != organizationId) throw new ScreeningAuthorizationException();
        var property = await _db.Properties.AsNoTracking().Where(x => x.Id == applicant.PropertyId)
            .Select(x => new { x.OrganizationId, x.State, x.IsDeleted }).SingleOrDefaultAsync(cancellationToken);
        if (property is null) throw new ScreeningResourceNotFoundException("property");
        if (property.OrganizationId != organizationId) throw new ScreeningAuthorizationException();
        if (property.IsDeleted) throw new ScreeningApplicationIneligibleException();
        if (applicant.UnitId.HasValue)
        {
            var unit = await _db.Units.AsNoTracking().Where(x => x.Id == applicant.UnitId.Value)
                .Select(x => new { x.PropertyId, x.OrganizationId }).SingleOrDefaultAsync(cancellationToken)
                ?? throw new ScreeningResourceNotFoundException("unit");
            if (unit.PropertyId != applicant.PropertyId || (unit.OrganizationId.HasValue && unit.OrganizationId != organizationId))
                throw new ScreeningApplicationIneligibleException();
        }
        var now = _timeProvider.GetUtcNow().UtcDateTime;
        var listingIds = await _db.Listings.AsNoTracking().Where(x => x.PropertyId == applicant.PropertyId &&
                x.UnitId == applicant.UnitId && x.OrganizationId == organizationId && x.Status == EListingStatus.Active &&
                x.AcceptOnlineApplications != false && (!x.ExpiresAt.HasValue || x.ExpiresAt > now))
            .OrderByDescending(x => x.CreatedAt).Select(x => x.Id).Take(2).ToListAsync(cancellationToken);
        var jurisdiction = property.State.Trim().ToUpperInvariant();
        if (jurisdiction.Length != 2 || jurisdiction.Any(x => x is < 'A' or > 'Z')) throw new InvalidOperationException("The property must have a valid two-letter screening jurisdiction.");
        return applicant with { JurisdictionCode = jurisdiction, ListingId = listingIds.Count == 1 ? listingIds[0] : null };
    }

    private static void EnsureSameOperation(TenantScreeningOrder order, CreateTenantScreeningInvitationCommand command)
    {
        if (order.RentalApplicationId != command.RentalApplicationId || order.PackageCode != command.PackageCode || order.Payer != command.Payer)
            throw new ScreeningIdempotencyConflictException();
    }
    private static void ValidateConsentText(params string[] values)
    {
        foreach (var value in values) ScreeningContractValidation.ValidateBoundedText(value, 2000, nameof(values), false);
    }
    private static string GenerateToken() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    private static string TokenHash(string rawToken) => Hash("property-peace-applicant-invitation-v1", rawToken);
    private static string Hash(string scope, string raw) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes($"{scope}\n{raw}"))).ToLowerInvariant();
    private static bool FixedEquals(string left, string right) => CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(left), Encoding.UTF8.GetBytes(right));

    private sealed record PaymentAssessment(bool MayAdvance, bool EvidenceWasStaged);

    private sealed record PaymentFacts(string QuoteReferenceHash, string OperationReferenceHash, ScreeningPayer Payer,
        long LandlordAmountMinor, long ApplicantAmountMinor, long ProviderAmountMinor, long PlatformFeeMinor,
        long TaxAmountMinor, long TotalAmountMinor, string Currency, ScreeningPaymentEventStatus Status,
        DateTimeOffset OccurredAt, string? FailureCode)
    {
        internal static PaymentFacts? From(ScreeningAuthoritativePaymentUpdate? payment) => payment is null ? null : new(
            payment.QuoteReferenceHash, payment.PaymentOperationReferenceHash, payment.Payer,
            payment.LandlordAmountMinor, payment.ApplicantAmountMinor, payment.ProviderAmountMinor,
            payment.PlatformFeeMinor, payment.TaxAmountMinor, payment.TotalAmountMinor, payment.Currency,
            payment.Status, payment.OccurredAt, payment.FailureCode);

        internal static PaymentFacts? From(ScreeningWebhookInboxEvent inbox)
        {
            if (!inbox.PaymentStatus.HasValue) return null;
            if (inbox.PaymentQuoteReferenceHash is null || inbox.PaymentOperationReferenceHash is null ||
                !inbox.PaymentPayer.HasValue || !inbox.PaymentLandlordAmountMinor.HasValue ||
                !inbox.PaymentApplicantAmountMinor.HasValue || !inbox.PaymentProviderAmountMinor.HasValue ||
                !inbox.PaymentPlatformFeeMinor.HasValue || !inbox.PaymentTaxAmountMinor.HasValue ||
                !inbox.PaymentTotalAmountMinor.HasValue || inbox.PaymentCurrency is null ||
                !inbox.PaymentOccurredAt.HasValue)
                return null;
            return new(inbox.PaymentQuoteReferenceHash, inbox.PaymentOperationReferenceHash, inbox.PaymentPayer.Value,
                inbox.PaymentLandlordAmountMinor.Value, inbox.PaymentApplicantAmountMinor.Value,
                inbox.PaymentProviderAmountMinor.Value, inbox.PaymentPlatformFeeMinor.Value,
                inbox.PaymentTaxAmountMinor.Value, inbox.PaymentTotalAmountMinor.Value, inbox.PaymentCurrency,
                inbox.PaymentStatus.Value, inbox.PaymentOccurredAt.Value, inbox.PaymentFailureCode);
        }
    }

    private async Task<PaymentAssessment> StageAuthoritativePaymentAsync(TenantScreeningOrder order, PaymentFacts? payment,
        ScreeningPaymentEvidenceSource source, DateTimeOffset recordedAt, CancellationToken cancellationToken)
    {
        if (payment is null) return new(false, false);

        var existing = await _db.ScreeningPaymentEvidence.SingleOrDefaultAsync(x =>
            x.TenantScreeningOrderId == order.Id &&
            x.PaymentOperationReferenceHash == payment.OperationReferenceHash &&
            x.Status == payment.Status, cancellationToken);
        var staged = false;
        if (existing is not null)
        {
            if (!PaymentFactsEqual(existing, payment)) throw new ScreeningProviderCorrelationException();
        }
        else
        {
            var revision = checked((await _db.ScreeningPaymentEvidence
                .Where(x => x.TenantScreeningOrderId == order.Id)
                .MaxAsync(x => (long?)x.Revision, cancellationToken) ?? 0) + 1);
            _db.ScreeningPaymentEvidence.Add(new ScreeningPaymentEvidence
            {
                TenantScreeningOrderId = order.Id,
                OrganizationId = order.OrganizationId,
                Payer = payment.Payer,
                LandlordAmountMinor = payment.LandlordAmountMinor,
                ApplicantAmountMinor = payment.ApplicantAmountMinor,
                ProviderAmountMinor = payment.ProviderAmountMinor,
                PlatformFeeMinor = payment.PlatformFeeMinor,
                TaxAmountMinor = payment.TaxAmountMinor,
                TotalAmountMinor = payment.TotalAmountMinor,
                Currency = payment.Currency,
                QuoteReferenceHash = payment.QuoteReferenceHash,
                PaymentOperationReferenceHash = payment.OperationReferenceHash,
                Status = payment.Status,
                Source = source,
                Revision = revision,
                ProviderOccurredAt = payment.OccurredAt,
                RecordedAt = recordedAt,
                FailureCode = payment.FailureCode
            });
            staged = true;
        }

        var initiation = await _db.ScreeningPaymentEvidence.AsNoTracking()
            .Where(x => x.TenantScreeningOrderId == order.Id &&
                x.Source == ScreeningPaymentEvidenceSource.HostedPaymentBoundary)
            .OrderBy(x => x.Revision).FirstOrDefaultAsync(cancellationToken);
        var matches = initiation is not null &&
            FixedEquals(payment.QuoteReferenceHash, ScreeningAuthoritativePaymentUpdate.HashReference(order.QuoteReference)) &&
            FixedEquals(payment.OperationReferenceHash, initiation.PaymentOperationReferenceHash) &&
            payment.Payer == order.Payer &&
            payment.LandlordAmountMinor == order.LandlordAmountMinor &&
            payment.ApplicantAmountMinor == order.ApplicantAmountMinor &&
            payment.ProviderAmountMinor == order.ProviderAmountMinor &&
            payment.PlatformFeeMinor == order.PlatformFeeMinor &&
            payment.TaxAmountMinor == order.TaxAmountMinor &&
            payment.TotalAmountMinor == order.TotalAmountMinor &&
            string.Equals(payment.Currency, order.Currency, StringComparison.Ordinal);
        return new(matches && _webhookOptions.SuccessfulPaymentStates.Contains(payment.Status), staged);
    }

    private static bool PaymentFactsEqual(ScreeningPaymentEvidence evidence, PaymentFacts payment) =>
        FixedEquals(evidence.QuoteReferenceHash, payment.QuoteReferenceHash) &&
        FixedEquals(evidence.PaymentOperationReferenceHash, payment.OperationReferenceHash) &&
        evidence.Payer == payment.Payer &&
        evidence.LandlordAmountMinor == payment.LandlordAmountMinor &&
        evidence.ApplicantAmountMinor == payment.ApplicantAmountMinor &&
        evidence.ProviderAmountMinor == payment.ProviderAmountMinor &&
        evidence.PlatformFeeMinor == payment.PlatformFeeMinor &&
        evidence.TaxAmountMinor == payment.TaxAmountMinor &&
        evidence.TotalAmountMinor == payment.TotalAmountMinor &&
        string.Equals(evidence.Currency, payment.Currency, StringComparison.Ordinal) &&
        evidence.Status == payment.Status &&
        evidence.ProviderOccurredAt == payment.OccurredAt &&
        string.Equals(evidence.FailureCode, payment.FailureCode, StringComparison.Ordinal);

    private static ScreeningPaymentEvidence PaymentEvidence(TenantScreeningOrder order,
        ScreeningPaymentOperationEvidence operation, ScreeningPaymentEvidenceSource source, long? actorUserId,
        long revision, DateTimeOffset recordedAt) => new()
    {
        TenantScreeningOrderId = order.Id,
        OrganizationId = order.OrganizationId,
        Payer = order.Payer,
        LandlordAmountMinor = order.LandlordAmountMinor,
        ApplicantAmountMinor = order.ApplicantAmountMinor,
        ProviderAmountMinor = order.ProviderAmountMinor,
        PlatformFeeMinor = order.PlatformFeeMinor,
        TaxAmountMinor = order.TaxAmountMinor,
        TotalAmountMinor = order.TotalAmountMinor,
        Currency = order.Currency,
        QuoteReferenceHash = ScreeningAuthoritativePaymentUpdate.HashReference(order.QuoteReference),
        PaymentOperationReferenceHash = ScreeningAuthoritativePaymentUpdate.HashReference(operation.OperationReference),
        Status = operation.Status,
        Source = source,
        ActorUserId = actorUserId,
        Revision = revision,
        ProviderOccurredAt = operation.OccurredAt,
        RecordedAt = recordedAt,
        FailureCode = operation.FailureCode
    };

    private static ScreeningTransitionEvent Transition(TenantScreeningOrder order, ScreeningStatus? from, ScreeningStatus to,
        DateTimeOffset occurredAt, DateTimeOffset recordedAt, ScreeningTransitionSource source, string? reason, string? eventId, long? actor) => new()
    {
        TenantScreeningOrderId = order.Id, OrganizationId = order.OrganizationId, FromStatus = from, ToStatus = to,
        Revision = order.CurrentRevision, OccurredAt = occurredAt, RecordedAt = recordedAt, Source = source, ReasonCode = reason,
        ProviderEventId = eventId, ProviderKey = order.ProviderKey, ActorUserId = actor
    };
    private static StaffScreeningOrderResult ToStaffResult(TenantScreeningOrder x) => new(x.Id, x.RentalApplicationId, x.PropertyId,
        x.Status, x.CurrentRevision, x.PackageCode, x.Payer, x.LandlordAmountMinor, x.ApplicantAmountMinor, x.TotalAmountMinor,
        x.Currency, x.QuoteExpiresAt, x.CreatedAt, x.UpdatedAt);
    private static ApplicantScreeningInvitationResult ToApplicantResult(TenantScreeningOrder x) => new(x.Id, x.Status,
        x.QuoteReference, x.Payer, x.PackageCode, x.LandlordAmountMinor, x.ApplicantAmountMinor, x.ProviderAmountMinor,
        x.PlatformFeeMinor, x.TaxAmountMinor, x.TotalAmountMinor, x.Currency, x.QuoteExpiresAt, x.PermissiblePurposeStatement,
        x.PermissiblePurposeVersion, x.DisclosureStatement, x.DisclosureVersion, x.AuthorizationStatement, x.AuthorizationVersion,
        x.RentalCriteriaStatement, x.RentalCriteriaVersion, x.PricingPolicyVersion,
        JsonSerializer.Deserialize<string[]>(x.AllowedChecksJson) ?? []);

    private async Task<StaffScreeningDetailResult> ToStaffDetailAsync(TenantScreeningOrder order, CancellationToken ct)
    {
        var reportEntities = await _db.ScreeningReportRevisions.AsNoTracking().Where(x => x.TenantScreeningOrderId == order.Id && x.DeletedAt == null)
            .OrderBy(x => x.Revision).ToListAsync(ct);
        var reports = reportEntities.Select(x => new StaffScreeningReportSummary(x.Id, x.Revision, x.Status, x.ReceivedAt, x.CorrectedAt,
            order.Status == ScreeningStatus.Complete
                ? (JsonSerializer.Deserialize<Dictionary<string, string>>(x.NormalizedFactsJson) ?? []).OrderBy(f => f.Key, StringComparer.Ordinal)
                    .Select(f => new ScreeningNormalizedFact(f.Key, f.Value)).ToArray()
                : [])).ToArray();
        var disputeEntities = await _db.ScreeningDisputes.AsNoTracking().Where(x => x.TenantScreeningOrderId == order.Id).OrderBy(x => x.OpenedAt).ToListAsync(ct);
        var disputes = disputeEntities.Select(x => new StaffScreeningDisputeSummary(x.Id, x.Status, x.OpenedAt, x.ResolvedAt,
            JsonSerializer.Deserialize<string[]>(x.IssueCodesJson) ?? [])).ToArray();
        var decisionEntity = await _db.ScreeningRentalDecisionRevisions.AsNoTracking().Where(x => x.TenantScreeningOrderId == order.Id)
            .OrderByDescending(x => x.Revision).FirstOrDefaultAsync(ct);
        var decision = decisionEntity is null ? null : new StaffScreeningDecisionSummary(decisionEntity.Id, decisionEntity.Revision,
            decisionEntity.Decision, JsonSerializer.Deserialize<string[]>(decisionEntity.ReasonCodesJson) ?? [], decisionEntity.CreatedAt);
        var adverseEntity = await _db.ScreeningAdverseActions.AsNoTracking().Where(x => x.TenantScreeningOrderId == order.Id)
            .OrderByDescending(x => x.CreatedAt).FirstOrDefaultAsync(ct);
        StaffScreeningAdverseActionSummary? adverse = null;
        if (adverseEntity is not null)
        {
            var attempt = await _db.ScreeningAdverseActionDeliveryAttempts.AsNoTracking().Where(x => x.ScreeningAdverseActionId == adverseEntity.Id)
                .OrderByDescending(x => x.AttemptNumber).FirstOrDefaultAsync(ct);
            var reconsideration = await _db.ScreeningReconsiderationEvents.AsNoTracking().Where(x => x.ScreeningAdverseActionId == adverseEntity.Id)
                .OrderByDescending(x => x.Revision).Select(x => (ScreeningReconsiderationStatus?)x.ToStatus).FirstOrDefaultAsync(ct)
                ?? ScreeningReconsiderationStatus.NotRequested;
            adverse = new(adverseEntity.Id, adverseEntity.ActionType, adverseEntity.CreatedAt,
                attempt is null ? null : new(attempt.Status, attempt.AttemptNumber, attempt.Channel, attempt.AttemptedAt, attempt.DeliveredAt), reconsideration);
        }
        return new(order.Id, order.RentalApplicationId, order.PropertyId, order.UnitId, order.ListingId, order.Status,
            order.CurrentRevision, order.PackageCode, Quote(order), order.RentalCriteriaVersion, order.RentalCriteriaStatement,
            ReasonCodeOptions(order), order.ApplicantAccessExpiresAt,
            order.ApplicantAccessTokenHash is null, reportEntities.LastOrDefault()?.Id, NextAction(order.Status), reports, disputes, decision, adverse,
            order.CreatedAt, order.UpdatedAt);
    }

    private static IReadOnlyList<ScreeningReasonCodeOption> ReasonCodeOptions(TenantScreeningOrder order)
    {
        var checks = (JsonSerializer.Deserialize<string[]>(order.AllowedChecksJson) ?? [])
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        var options = new List<ScreeningReasonCodeOption>
        {
            new("criteria_met", "Applicant meets the frozen rental criteria"),
            new("income_requirement", "Income requirement was not met"),
            new("rental_history", "Rental history did not meet the stated criteria"),
            new("report_incomplete", "Report evidence is incomplete; defer for review")
        };
        if (checks.Contains("credit")) options.Add(new("credit_requirement", "Credit requirement was not met"));
        if (checks.Contains("criminal")) options.Add(new("criminal_history", "Criminal-history criterion requires review"));
        if (checks.Contains("eviction")) options.Add(new("eviction_history", "Eviction-history criterion requires review"));
        return options;
    }

    private static ScreeningQuoteSummary Quote(TenantScreeningOrder x) => new(x.Payer, x.LandlordAmountMinor, x.ApplicantAmountMinor,
        x.ProviderAmountMinor, x.PlatformFeeMinor, x.TaxAmountMinor, x.TotalAmountMinor, x.Currency, x.QuoteExpiresAt);
    private static string NextAction(ScreeningStatus status) => status switch
    {
        ScreeningStatus.ConsentPending => "ApplicantConsent",
        ScreeningStatus.PaymentPending => "ApplicantPayment",
        ScreeningStatus.Processing => "WaitForProcessing",
        ScreeningStatus.Complete => "ReviewCompletedScreening",
        ScreeningStatus.Disputed => "WaitForDisputeResolution",
        ScreeningStatus.ActionRequired => "ContactSupport",
        ScreeningStatus.Failed => "ContactSupport",
        ScreeningStatus.Expired => "NoActionAvailable",
        _ => "Wait"
    };
    private static string Help(ScreeningStatus status) => status switch
    {
        ScreeningStatus.ConsentPending => "Review the quote and disclosures before consenting. Consent is unavailable after quote expiry.",
        ScreeningStatus.Complete => "Your screening is complete. You may review status, notices, or dispute eligible report information.",
        ScreeningStatus.Disputed => "Your dispute is being reviewed. Corrections will appear here.",
        ScreeningStatus.ActionRequired or ScreeningStatus.Failed => "Contact screening support for help.",
        ScreeningStatus.Expired => "This screening order is closed; historical status remains available while access is valid.",
        _ => "Screening is in progress. Return here for updates."
    };
    private async Task InTransactionAsync(Func<Task> operation, CancellationToken cancellationToken)
    {
        IDbContextTransaction? transaction = null;
        if (_db.Database.IsRelational()) transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
        try { await operation(); if (transaction is not null) await transaction.CommitAsync(cancellationToken); }
        catch { if (transaction is not null) await transaction.RollbackAsync(CancellationToken.None); throw; }
        finally { if (transaction is not null) await transaction.DisposeAsync(); }
    }
    private async Task RecordStatusTimelineAsync(TenantScreeningOrder order, ScreeningStatus status, long? actorUserId,
        CancellationToken cancellationToken)
    {
        if (_workflowTimeline is null) return;
        await _workflowTimeline.RecordScreeningTransitionAsync(order.OrganizationId, order.RentalApplicationId,
            order.Id, actorUserId, status.ToString().ToLowerInvariant(), $"Screening status changed to {status}",
            $"screening:{order.Id}:status:{order.CurrentRevision}", cancellationToken);
    }

    private static void ValidateIds(params long[] ids) { if (ids.Any(x => x <= 0)) throw new ArgumentOutOfRangeException(nameof(ids)); }
    private sealed record AuthoritySnapshot(long MemberId, string Role, string Permission);
    private sealed record ApplicantProjection(long Id, long? OrganizationId, long PropertyId, long? UnitId, EApplicationStatus Status,
        long? ConvertedToTenantId, long? ConvertedToLeaseId, string Email, string FirstName, string LastName)
    {
        public string JurisdictionCode { get; init; } = string.Empty;
        public long? ListingId { get; init; }
    }
}
