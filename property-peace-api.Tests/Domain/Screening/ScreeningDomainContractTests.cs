using brownstone_hub_api.Domain.Screening;
using FluentAssertions;
using Xunit;

namespace brownstone_hub_api.Tests.Domain.Screening;

public sealed class ScreeningDomainContractTests
{
    private static readonly ScreeningStatus[] AllStatuses = Enum.GetValues<ScreeningStatus>();

    [Fact]
    public void Status_contract_has_exact_public_names()
    {
        Enum.GetNames<ScreeningStatus>().Should().Equal(
            "Invited",
            "ConsentPending",
            "PaymentPending",
            "Processing",
            "Complete",
            "ActionRequired",
            "Expired",
            "Disputed",
            "Failed");

        Enum.GetNames<ScreeningPayer>().Should().Equal("Landlord", "Applicant", "Split");
        Enum.GetValues<ScreeningStatus>().Select(value => (int)value).Should().Equal(0, 1, 2, 3, 4, 5, 6, 7, 8);
        Enum.GetValues<ScreeningPayer>().Select(value => (int)value).Should().Equal(1, 2, 3);
    }

    [Fact]
    public void Policy_matches_the_complete_transition_matrix()
    {
        // Columns and rows use the public enum order asserted above. T includes every
        // legal transition and the deliberately idempotent callback for each status.
        var expectedRows = new[]
        {
            "TTFFFFTFT", // Invited
            "FTTFFTTFT", // ConsentPending
            "FFTTFTTFT", // PaymentPending
            "FFFTTTTFT", // Processing
            "FFFFTFFTF", // Complete
            "FFFTFTTFT", // ActionRequired
            "FFFFFFTFF", // Expired
            "FFFTTTFTT", // Disputed
            "FFFFFFFFT"  // Failed
        };

        AllStatuses.Should().HaveCount(9);
        expectedRows.Should().OnlyContain(row => row.Length == AllStatuses.Length);

        for (var currentIndex = 0; currentIndex < AllStatuses.Length; currentIndex++)
        {
            for (var nextIndex = 0; nextIndex < AllStatuses.Length; nextIndex++)
            {
                var expected = expectedRows[currentIndex][nextIndex] == 'T';
                ScreeningTransitionPolicy.CanTransition(AllStatuses[currentIndex], AllStatuses[nextIndex])
                    .Should().Be(expected,
                        $"the transition from {AllStatuses[currentIndex]} to {AllStatuses[nextIndex]} is explicitly specified");
            }
        }
    }

    [Theory]
    [InlineData(-1, -1)]
    [InlineData(9, 9)]
    [InlineData(99, 99)]
    [InlineData(99, 0)]
    [InlineData(0, 99)]
    public void Policy_rejects_every_transition_containing_an_undefined_status(int current, int next)
    {
        ScreeningTransitionPolicy.CanTransition((ScreeningStatus)current, (ScreeningStatus)next)
            .Should().BeFalse();
    }

    [Fact]
    public void Action_required_can_only_remain_or_exit_to_processing_expired_or_failed()
    {
        AllStatuses.Where(next => ScreeningTransitionPolicy.CanTransition(ScreeningStatus.ActionRequired, next))
            .Should().BeEquivalentTo(new[]
            {
                ScreeningStatus.ActionRequired,
                ScreeningStatus.Processing,
                ScreeningStatus.Expired,
                ScreeningStatus.Failed
            });
        ScreeningTransitionPolicy.CanTransition(ScreeningStatus.ActionRequired, ScreeningStatus.ConsentPending).Should().BeFalse("invitation delivery failure remains consent pending and does not require lifecycle regression");
        ScreeningTransitionPolicy.CanTransition(ScreeningStatus.ActionRequired, ScreeningStatus.PaymentPending).Should().BeFalse();
    }

    [Fact]
    public void Authoritative_quote_cannot_be_constructed_by_external_callers()
    {
        typeof(AuthoritativeScreeningQuote).GetConstructors().Should().BeEmpty();
    }

    [Fact]
    public void Quote_accepts_consistent_minor_unit_totals()
    {
        var quote = AuthoritativeScreeningQuote.Create(
            ValidQuoteRequest(ScreeningPayer.Landlord),
            "quote-reference-secret",
            ScreeningPayer.Landlord,
            landlordAmountMinor: 4_500,
            applicantAmountMinor: 0,
            providerAmountMinor: 3_500,
            platformFeeMinor: 750,
            taxAmountMinor: 250,
            currency: "USD",
            expiresAt: DateTimeOffset.UtcNow.AddMinutes(15),
            policyVersion: "2026-08-06",
            now: DateTimeOffset.UtcNow);

        quote.LandlordAmountMinor.Should().Be(4_500);
        quote.ApplicantAmountMinor.Should().Be(0);
        quote.TotalAmountMinor.Should().Be(4_500);
    }

    [Fact]
    public void Quote_accepts_a_consistent_applicant_paid_quote()
    {
        var quote = ValidQuote("USD", DateTimeOffset.UtcNow.AddMinutes(15));

        quote.Payer.Should().Be(ScreeningPayer.Applicant);
        quote.LandlordAmountMinor.Should().Be(0);
        quote.ApplicantAmountMinor.Should().Be(4_500);
        quote.TotalAmountMinor.Should().Be(4_500);
    }

    [Fact]
    public void Quote_accepts_a_consistent_split_paid_quote()
    {
        var now = DateTimeOffset.UtcNow;
        var quote = AuthoritativeScreeningQuote.Create(ValidQuoteRequest(ScreeningPayer.Split), "quote-reference-secret",
            ScreeningPayer.Split, 2_000, 2_500, 3_500, 750, 250, "USD", now.AddMinutes(15), "v1", now);

        quote.Payer.Should().Be(ScreeningPayer.Split);
        quote.LandlordAmountMinor.Should().Be(2_000);
        quote.ApplicantAmountMinor.Should().Be(2_500);
        quote.TotalAmountMinor.Should().Be(4_500);
    }

    [Theory]
    [InlineData(-1, 0, 0, 0, 0)]
    [InlineData(100, 0, -1, 100, 1)]
    [InlineData(100, 0, 50, 25, 24)]
    public void Quote_rejects_negative_or_inconsistent_totals(
        long landlord,
        long applicant,
        long provider,
        long platform,
        long tax)
    {
        var act = () => AuthoritativeScreeningQuote.Create(
            ValidQuoteRequest(),
            "quote-reference-secret",
            ScreeningPayer.Landlord,
            landlord,
            applicant,
            provider,
            platform,
            tax,
            "USD",
            DateTimeOffset.UtcNow.AddMinutes(15),
            "v1",
            DateTimeOffset.UtcNow);

        act.Should().Throw<ArgumentException>();
    }

    [Theory]
    [InlineData(ScreeningPayer.Landlord, 0, 4_500)]
    [InlineData(ScreeningPayer.Landlord, 2_250, 2_250)]
    [InlineData(ScreeningPayer.Applicant, 4_500, 0)]
    [InlineData(ScreeningPayer.Applicant, 2_250, 2_250)]
    public void Quote_requires_exactly_the_selected_party_to_pay(
        ScreeningPayer payer,
        long landlord,
        long applicant)
    {
        var act = () => AuthoritativeScreeningQuote.Create(
            ValidQuoteRequest(),
            "quote-reference-secret",
            payer,
            landlord,
            applicant,
            providerAmountMinor: 4_500,
            platformFeeMinor: 0,
            taxAmountMinor: 0,
            currency: "USD",
            expiresAt: DateTimeOffset.UtcNow.AddMinutes(15),
            policyVersion: "v1",
            now: DateTimeOffset.UtcNow);

        act.Should().Throw<ArgumentException>();
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Quote_requires_a_nonblank_policy_version(string policyVersion)
    {
        var act = () => ValidQuote("USD", DateTimeOffset.UtcNow.AddMinutes(15), policyVersion);

        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Quote_rejects_party_total_overflow()
    {
        var act = () => AuthoritativeScreeningQuote.Create(
            ValidQuoteRequest(), "quote-reference-secret", ScreeningPayer.Landlord, long.MaxValue, 1, long.MaxValue, 0, 1,
            "USD", DateTimeOffset.UtcNow.AddMinutes(15), "v1", DateTimeOffset.UtcNow);

        act.Should().Throw<OverflowException>();
    }

    [Fact]
    public void Quote_rejects_component_total_overflow()
    {
        var act = () => AuthoritativeScreeningQuote.Create(
            ValidQuoteRequest(), "quote-reference-secret", ScreeningPayer.Landlord, long.MaxValue, 0, long.MaxValue, 1, 0,
            "USD", DateTimeOffset.UtcNow.AddMinutes(15), "v1", DateTimeOffset.UtcNow);

        act.Should().Throw<OverflowException>();
    }

    [Theory]
    [InlineData("usd")]
    [InlineData("US")]
    [InlineData("US1")]
    [InlineData(" USD")]
    public void Quote_requires_three_letter_uppercase_currency(string currency)
    {
        var act = () => ValidQuote(currency, DateTimeOffset.UtcNow.AddMinutes(15));

        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Quote_rejects_null_currency()
    {
        var act = () => ValidQuote(null!, DateTimeOffset.UtcNow.AddMinutes(15));

        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Quote_requires_future_expiration()
    {
        var act = () => ValidQuote("USD", DateTimeOffset.UtcNow.AddSeconds(-1));

        act.Should().Throw<ArgumentOutOfRangeException>();
    }

    [Theory]
    [InlineData(101)]
    [InlineData(200)]
    public void Quote_limits_policy_version_to_100_characters(int length)
    {
        var act = () => ValidQuote("USD", DateTimeOffset.UtcNow.AddMinutes(15), new string('v', length));
        act.Should().Throw<ArgumentException>();
    }

    [Theory]
    [InlineData("v1\nforged")]
    [InlineData("v1\u0000")]
    public void Quote_rejects_control_characters_in_policy_version(string policyVersion)
    {
        var act = () => ValidQuote("USD", DateTimeOffset.UtcNow.AddMinutes(15), policyVersion);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Quote_rejects_an_undefined_payer()
    {
        var now = DateTimeOffset.UtcNow;
        var act = () => AuthoritativeScreeningQuote.Create(
            ValidQuoteRequest(), "quote-reference-secret", (ScreeningPayer)0, 0, 4_500, 3_500, 750, 250, "USD", now.AddMinutes(15), "v1", now);
        act.Should().Throw<ArgumentOutOfRangeException>();
    }

    [Fact]
    public void Quote_expiration_is_deterministic_against_the_supplied_time()
    {
        var now = new DateTimeOffset(2026, 8, 6, 12, 0, 0, TimeSpan.Zero);
        var quote = AuthoritativeScreeningQuote.Create(
            ValidQuoteRequest(), "quote-reference-secret", ScreeningPayer.Applicant, 0, 4_500, 3_500, 750, 250, "USD", now.AddMinutes(15), "v1", now);

        quote.IsExpired(now.AddMinutes(15)).Should().BeTrue();
        quote.IsExpired(now.AddMinutes(15).AddTicks(-1)).Should().BeFalse();
    }

    [Fact]
    public void Quote_request_accepts_valid_immutable_context()
    {
        var request = ValidQuoteRequest();
        request.OrganizationId.Should().Be(11);
        request.ApplicationId.Should().Be(22);
        request.PropertyId.Should().Be(33);
        request.ApplicantId.Should().Be(44);
        request.PackageCode.Should().Be("tenant-standard");
        request.JurisdictionCode.Should().Be("US");
        request.Payer.Should().Be(ScreeningPayer.Applicant);
        typeof(ScreeningQuoteRequest).GetProperties().Should().OnlyContain(property => !property.CanWrite);
    }

    [Theory]
    [InlineData(0, 22, 33, 44)]
    [InlineData(11, -1, 33, 44)]
    [InlineData(11, 22, 0, 44)]
    [InlineData(11, 22, 33, -1)]
    public void Quote_request_requires_positive_entity_ids(long organizationId, long applicationId, long propertyId, long applicantId)
    {
        var act = () => new ScreeningQuoteRequest(organizationId, applicationId, propertyId, applicantId,
            "tenant-standard", "US", ScreeningPayer.Applicant);
        act.Should().Throw<ArgumentOutOfRangeException>();
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("tenant\nstandard")]
    public void Quote_request_constrains_package_code(string packageCode)
    {
        var act = () => new ScreeningQuoteRequest(11, 22, 33, 44, packageCode, "US", ScreeningPayer.Applicant);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Quote_request_limits_package_code_to_100_characters()
    {
        var act = () => new ScreeningQuoteRequest(11, 22, 33, 44, new string('x', 101), "US", ScreeningPayer.Applicant);
        act.Should().Throw<ArgumentException>();
    }

    [Theory]
    [InlineData("us")]
    [InlineData("USA")]
    [InlineData("U1")]
    [InlineData("")]
    public void Quote_request_requires_a_two_letter_uppercase_jurisdiction(string jurisdictionCode)
    {
        var act = () => new ScreeningQuoteRequest(11, 22, 33, 44, "tenant-standard", jurisdictionCode, ScreeningPayer.Applicant);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Quote_request_rejects_an_undefined_payer()
    {
        var act = () => new ScreeningQuoteRequest(11, 22, 33, 44, "tenant-standard", "US", (ScreeningPayer)0);
        act.Should().Throw<ArgumentOutOfRangeException>();
    }

    [Fact]
    public void Session_request_binds_order_context_and_unexpired_authoritative_quote()
    {
        var now = new DateTimeOffset(2026, 8, 6, 12, 0, 0, TimeSpan.Zero);
        var context = ValidQuoteRequest();
        var quote = ValidQuote("USD", now.AddMinutes(15), now: now, context: context);
        var request = new CreateApplicantScreeningSessionRequest(55, context, quote, now);

        request.ScreeningOrderId.Should().Be(55);
        request.QuoteRequest.Should().BeSameAs(context);
        request.AuthoritativeQuote.Should().BeSameAs(quote);
        typeof(CreateApplicantScreeningSessionRequest).GetProperties().Should().OnlyContain(property => !property.CanWrite);
    }

    [Fact]
    public void Quote_requires_context_and_a_bounded_nonblank_reference()
    {
        var now = new DateTimeOffset(2026, 8, 6, 12, 0, 0, TimeSpan.Zero);
        var context = ValidQuoteRequest();
        var quote = ValidQuote("USD", now.AddMinutes(15), now: now, context: context);

        quote.QuoteRequest.Should().BeSameAs(context);
        quote.QuoteReference.Should().Be("quote-reference-secret");
        new Action(() => AuthoritativeScreeningQuote.Create(
            null!, "ref", ScreeningPayer.Applicant, 0, 4_500, 3_500, 750, 250,
            "USD", now.AddMinutes(15), "v1", now)).Should().Throw<ArgumentNullException>();
        new Action(() => ValidQuote("USD", now.AddMinutes(15), now: now, context: context, quoteReference: "   "))
            .Should().Throw<ArgumentException>();
        new Action(() => ValidQuote("USD", now.AddMinutes(15), now: now, context: context, quoteReference: new string('q', 201)))
            .Should().Throw<ArgumentException>();
        new Action(() => ValidQuote("USD", now.AddMinutes(15), now: now, context: context, quoteReference: new string('q', 200)))
            .Should().NotThrow();
    }

    [Fact]
    public void Session_request_requires_exact_quote_context_and_rejects_expired_quotes_at_explicit_now()
    {
        var now = new DateTimeOffset(2026, 8, 6, 12, 0, 0, TimeSpan.Zero);
        var context = ValidQuoteRequest();
        var equalContext = ValidQuoteRequest();
        var differentContext = new ScreeningQuoteRequest(11, 22, 33, 45, "tenant-standard", "US", ScreeningPayer.Applicant);
        var quote = ValidQuote("USD", now.AddMinutes(15), now: now, context: context);

        new Action(() => new CreateApplicantScreeningSessionRequest(55, equalContext, quote, now)).Should().NotThrow();
        new Action(() => new CreateApplicantScreeningSessionRequest(55, differentContext, quote, now)).Should().Throw<ArgumentException>();
        new Action(() => new CreateApplicantScreeningSessionRequest(55, context, quote, now.AddMinutes(15))).Should().Throw<ArgumentOutOfRangeException>();
        new Action(() => new CreateApplicantScreeningSessionRequest(0, context, quote, now)).Should().Throw<ArgumentOutOfRangeException>();
        new Action(() => new CreateApplicantScreeningSessionRequest(55, null!, quote, now)).Should().Throw<ArgumentNullException>();
        new Action(() => new CreateApplicantScreeningSessionRequest(55, context, null!, now)).Should().Throw<ArgumentNullException>();
    }

    [Fact]
    public void Gateway_methods_require_the_bound_request_contracts()
    {
        var methods = typeof(IScreeningProviderGateway).GetMethods();
        methods.Single(method => method.Name == "GetAuthoritativeQuoteAsync").GetParameters()[0].ParameterType
            .Should().Be<ScreeningQuoteRequest>();
        methods.Single(method => method.Name == "CreateApplicantHostedSessionAsync").GetParameters()[0].ParameterType
            .Should().Be<CreateApplicantScreeningSessionRequest>();
        methods.Single(method => method.Name == "GetStatusAsync").GetParameters()[0].ParameterType
            .Should().Be<ScreeningStatusRequest>();
    }

    [Fact]
    public void Status_request_validates_bound_identifiers()
    {
        var request = new ScreeningStatusRequest(11, 22, 55, "provider-order-secret");
        request.OrganizationId.Should().Be(11);
        request.ApplicationId.Should().Be(22);
        request.ScreeningOrderId.Should().Be(55);
        request.ProviderOrderId.Should().Be("provider-order-secret");

        new Action(() => new ScreeningStatusRequest(0, 22, 55, "order")).Should().Throw<ArgumentOutOfRangeException>();
        new Action(() => new ScreeningStatusRequest(11, 0, 55, "order")).Should().Throw<ArgumentOutOfRangeException>();
        new Action(() => new ScreeningStatusRequest(11, 22, 0, "order")).Should().Throw<ArgumentOutOfRangeException>();
        new Action(() => new ScreeningStatusRequest(11, 22, 55, "   ")).Should().Throw<ArgumentException>();
        new Action(() => new ScreeningStatusRequest(11, 22, 55, new string('x', 201))).Should().Throw<ArgumentException>();
        new Action(() => new ScreeningStatusRequest(11, 22, 55, new string('x', 200))).Should().NotThrow();
    }

    [Fact]
    public void Applicant_hosted_session_accepts_only_an_exact_trusted_origin_and_has_deterministic_expiry()
    {
        var now = new DateTimeOffset(2026, 8, 6, 12, 0, 0, TimeSpan.Zero);
        var expiresAt = now.AddMinutes(15);
        var continuationUri = new Uri("https://screening.example.test/continue/123?token=secret");
        var result = new ApplicantHostedSessionResult(
            "provider-order-123", continuationUri, expiresAt, TrustedOrigins(), now);

        result.ProviderOrderId.Should().Be("provider-order-123");
        result.ContinuationUri.Should().Be(continuationUri);
        result.ExpiresAt.Should().Be(expiresAt);
        result.IsExpired(expiresAt.AddTicks(-1)).Should().BeFalse();
        result.IsExpired(expiresAt).Should().BeTrue();
        result.ToString().Should().NotContain("provider-order-123")
            .And.NotContain("screening.example.test").And.NotContain("token=secret");
        typeof(ApplicantHostedSessionResult).GetProperties().Should().OnlyContain(property => !property.CanWrite);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("order\nforged")]
    public void Applicant_hosted_session_constrains_provider_order_id(string providerOrderId)
    {
        var act = () => ValidHostedSession(providerOrderId);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Applicant_hosted_session_limits_provider_order_id_to_200_characters()
    {
        new Action(() => ValidHostedSession(new string('x', 200))).Should().NotThrow();
        new Action(() => ValidHostedSession(new string('x', 201))).Should().Throw<ArgumentException>();
    }

    [Theory]
    [InlineData("http://screening.example.test/continue")]
    [InlineData("/relative/continue")]
    [InlineData("https://user@screening.example.test/continue")]
    [InlineData("https://screening.example.test.evil.test/continue")]
    [InlineData("https://screening.example.test:444/continue")]
    [InlineData("https://screening.example.test/continue#secret")]
    public void Applicant_hosted_session_rejects_untrusted_or_unsafe_continuation_uris(string continuationUri)
    {
        var act = () => ValidHostedSession(
            continuationUri: new Uri(continuationUri, UriKind.RelativeOrAbsolute));
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Applicant_hosted_session_requires_an_explicit_nonempty_trusted_origin_allowlist()
    {
        new Action(() => new ApplicantHostedSessionResult(
            "provider-order-123",
            new Uri("https://screening.example.test/continue"),
            new DateTimeOffset(2026, 8, 6, 12, 15, 0, TimeSpan.Zero),
            null!,
            new DateTimeOffset(2026, 8, 6, 12, 0, 0, TimeSpan.Zero)))
            .Should().Throw<ArgumentNullException>();
        new Action(() => ValidHostedSession(trustedOrigins: Array.Empty<Uri>())).Should().Throw<ArgumentException>();
        new Action(() => ValidHostedSession(trustedOrigins: new[] { new Uri("https://screening.example.test/path") }))
            .Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Applicant_hosted_session_requires_future_expiration_against_explicit_now()
    {
        var now = new DateTimeOffset(2026, 8, 6, 12, 0, 0, TimeSpan.Zero);
        new Action(() => ValidHostedSession(expiresAt: now, now: now)).Should().Throw<ArgumentOutOfRangeException>();
        new Action(() => ValidHostedSession(expiresAt: now.AddTicks(1), now: now)).Should().NotThrow();
    }

    [Fact]
    public void Status_update_accepts_valid_values_and_redacts_string_fields()
    {
        var now = new DateTimeOffset(2026, 8, 6, 12, 0, 0, TimeSpan.Zero);
        var update = new NormalizedScreeningStatusUpdate(
            "provider-order-secret", ScreeningStatus.Processing, now, "provider-reason-secret", now);

        update.ProviderOrderId.Should().Be("provider-order-secret");
        update.Status.Should().Be(ScreeningStatus.Processing);
        update.ReasonCode.Should().Be("provider-reason-secret");
        update.ToString().Should().NotContain("provider-order-secret").And.NotContain("provider-reason-secret");
        typeof(NormalizedScreeningStatusUpdate).GetProperties().Should().OnlyContain(property => !property.CanWrite);
    }

    [Fact]
    public void Status_update_rejects_invalid_ids_status_times_and_reasons()
    {
        var now = new DateTimeOffset(2026, 8, 6, 12, 0, 0, TimeSpan.Zero);
        new Action(() => new NormalizedScreeningStatusUpdate("", ScreeningStatus.Processing, now, null, now)).Should().Throw<ArgumentException>();
        new Action(() => new NormalizedScreeningStatusUpdate(new string('x', 201), ScreeningStatus.Processing, now, null, now)).Should().Throw<ArgumentException>();
        new Action(() => new NormalizedScreeningStatusUpdate("order\0", ScreeningStatus.Processing, now, null, now)).Should().Throw<ArgumentException>();
        new Action(() => new NormalizedScreeningStatusUpdate("order", (ScreeningStatus)99, now, null, now)).Should().Throw<ArgumentOutOfRangeException>();
        new Action(() => new NormalizedScreeningStatusUpdate("order", ScreeningStatus.Processing, default, null, now)).Should().Throw<ArgumentOutOfRangeException>();
        new Action(() => new NormalizedScreeningStatusUpdate("order", ScreeningStatus.Processing, now.AddMinutes(5).AddTicks(1), null, now)).Should().Throw<ArgumentOutOfRangeException>();
        new Action(() => new NormalizedScreeningStatusUpdate("order", ScreeningStatus.Processing, now, new string('r', 201), now)).Should().Throw<ArgumentException>();
        new Action(() => new NormalizedScreeningStatusUpdate("order", ScreeningStatus.Processing, now, "reason\rforged", now)).Should().Throw<ArgumentException>();
        new Action(() => new NormalizedScreeningStatusUpdate("order", ScreeningStatus.Processing, now.AddMinutes(5), new string('r', 200), now)).Should().NotThrow();
    }

    [Fact]
    public void Verified_callback_envelope_cannot_be_constructed_by_external_callers()
    {
        typeof(VerifiedScreeningCallbackEnvelope).GetConstructors().Should().BeEmpty();
        typeof(IScreeningCallbackVerifier).GetMethod("VerifyAsync")!.ReturnType
            .Should().Be<ValueTask<VerifiedScreeningCallbackEnvelope>>();
    }

    [Fact]
    public void Callback_request_preserves_raw_payload_and_case_insensitive_repeated_headers_immutably()
    {
        var payload = new byte[] { 0, 1, 127, 128, 255 };
        var sourceValues = new List<string> { " first\tvalue " };
        var request = new ScreeningCallbackRequest(payload, new[]
        {
            new KeyValuePair<string, IEnumerable<string>>("X-Signature", sourceValues),
            new KeyValuePair<string, IEnumerable<string>>("x-signature", new[] { "second" }),
            new KeyValuePair<string, IEnumerable<string>>("X-Other", new[] { "exact value" })
        });
        sourceValues.Add("mutated");
        payload[1] = 99;

        request.Payload.ToArray().Should().Equal(0, 1, 127, 128, 255);
        request.Headers["X-SIGNATURE"].Should().Equal(" first\tvalue ", "second");
        request.Headers["x-other"].Should().Equal("exact value");
        request.Headers.Should().HaveCount(2);
        request.Headers["x-signature"].Should().NotContain("mutated");
    }

    [Fact]
    public void Callback_request_rejects_invalid_header_names_values_and_nested_nulls()
    {
        new Action(() => new ScreeningCallbackRequest(ReadOnlyMemory<byte>.Empty, null!)).Should().Throw<ArgumentNullException>();
        new Action(() => CallbackRequestWithHeader("", "value")).Should().Throw<ArgumentException>();
        new Action(() => CallbackRequestWithHeader(new string('h', 201), "value")).Should().Throw<ArgumentException>();
        new Action(() => CallbackRequestWithHeader("X-Bad\tName", "value")).Should().Throw<ArgumentException>();
        new Action(() => CallbackRequestWithHeader("X-Test", "value\rforged")).Should().Throw<ArgumentException>();
        new Action(() => CallbackRequestWithHeader("X-Test", "value\nforged")).Should().Throw<ArgumentException>();
        new Action(() => CallbackRequestWithHeader("X-Test", "value\0forged")).Should().Throw<ArgumentException>();
        new Action(() => new ScreeningCallbackRequest(ReadOnlyMemory<byte>.Empty, new[]
        {
            new KeyValuePair<string, IEnumerable<string>>("X-Test", null!)
        })).Should().Throw<ArgumentNullException>();
        new Action(() => new ScreeningCallbackRequest(ReadOnlyMemory<byte>.Empty, new[]
        {
            new KeyValuePair<string, IEnumerable<string>>("X-Test", new string[] { null! })
        })).Should().Throw<ArgumentException>();
        new Action(() => CallbackRequestWithHeader(new string('h', 200), "value\tallowed")).Should().NotThrow();
    }

    [Fact]
    public void Callback_verifier_accepts_the_hardened_request_contract()
    {
        var parameters = typeof(IScreeningCallbackVerifier).GetMethod("VerifyAsync")!.GetParameters();
        parameters[0].ParameterType.Should().Be<string>();
        parameters[1].ParameterType
            .Should().Be<ScreeningCallbackRequest>();
    }

    [Fact]
    public void Contract_string_representations_redact_identifiers_uris_queries_and_tokens()
    {
        var now = new DateTimeOffset(2026, 8, 6, 12, 0, 0, TimeSpan.Zero);
        var context = ValidQuoteRequest();
        var quote = ValidQuote("USD", now.AddMinutes(15), now: now, context: context);
        var session = new CreateApplicantScreeningSessionRequest(55, context, quote, now);
        var hosted = new ApplicantHostedSessionResult(
            "provider-order-secret",
            new Uri("https://screening.example.test/continue/application-22?token=query-secret"),
            now.AddMinutes(15), TrustedOrigins(), now);
        var statusRequest = new ScreeningStatusRequest(11, 22, 55, "provider-order-secret");
        var update = new NormalizedScreeningStatusUpdate(
            "provider-order-secret", ScreeningStatus.Processing, now, "reason-secret", now);
        var callback = CallbackRequestWithHeader("X-Signature", "signature-secret");

        var sensitiveValues = new[]
        {
            "11", "22", "33", "44", "55", "tenant-standard", "quote-reference-secret",
            "provider-order-secret", "screening.example.test", "application-22", "query-secret",
            "reason-secret", "signature-secret"
        };
        var representations = new[]
        {
            context.ToString(), quote.ToString(), session.ToString(), hosted.ToString(),
            statusRequest.ToString(), update.ToString(), callback.ToString()
        };

        foreach (var representation in representations)
        {
            sensitiveValues.Should().OnlyContain(value => !representation.Contains(value, StringComparison.Ordinal));
        }
    }

    [Fact]
    public void Public_contracts_expose_only_provider_neutral_non_sensitive_properties()
    {
        typeof(AuthoritativeScreeningQuote).GetProperties().Select(x => x.Name).Should().BeEquivalentTo(
            "QuoteRequest", "QuoteReference", "Payer", "LandlordAmountMinor", "ApplicantAmountMinor", "ProviderAmountMinor",
            "PlatformFeeMinor", "TaxAmountMinor", "TotalAmountMinor", "Currency", "ExpiresAt",
            "PolicyVersion");
        typeof(ScreeningQuoteRequest).GetProperties().Select(x => x.Name).Should().BeEquivalentTo(
            "OrganizationId", "ApplicationId", "PropertyId", "ApplicantId", "PackageCode",
            "JurisdictionCode", "Payer");
        typeof(CreateApplicantScreeningSessionRequest).GetProperties().Select(x => x.Name).Should().BeEquivalentTo(
            "ScreeningOrderId", "QuoteRequest", "AuthoritativeQuote");
        typeof(ApplicantHostedSessionResult).GetProperties().Select(x => x.Name).Should().BeEquivalentTo(
            "ProviderOrderId", "ContinuationUri", "ExpiresAt", "PaymentEvidence");
        typeof(ScreeningPaymentOperationEvidence).GetProperties().Select(x => x.Name).Should().BeEquivalentTo(
            "OperationReference", "Status", "OccurredAt", "FailureCode");
        typeof(ScreeningAuthoritativePaymentUpdate).GetProperties().Select(x => x.Name).Should().BeEquivalentTo(
            "QuoteReferenceHash", "PaymentOperationReferenceHash", "Payer", "LandlordAmountMinor",
            "ApplicantAmountMinor", "ProviderAmountMinor", "PlatformFeeMinor", "TaxAmountMinor",
            "TotalAmountMinor", "Currency", "Status", "OccurredAt", "FailureCode");
        typeof(ScreeningPaymentOperationEvidence).GetProperties()
            .Should().NotContain(property => property.PropertyType == typeof(Uri) ||
                property.Name.Contains("Url", StringComparison.OrdinalIgnoreCase) ||
                property.Name.Contains("Uri", StringComparison.OrdinalIgnoreCase) ||
                property.Name.Contains("Provider", StringComparison.OrdinalIgnoreCase) ||
                property.Name.Contains("Credential", StringComparison.OrdinalIgnoreCase) ||
                property.Name.Contains("Card", StringComparison.OrdinalIgnoreCase) ||
                property.Name.Contains("Bank", StringComparison.OrdinalIgnoreCase));
        typeof(ScreeningStatusRequest).GetProperties().Select(x => x.Name).Should().BeEquivalentTo(
            "OrganizationId", "ApplicationId", "ScreeningOrderId", "ProviderOrderId");
        typeof(NormalizedScreeningStatusUpdate).GetProperties().Select(x => x.Name).Should().BeEquivalentTo(
            "ProviderOrderId", "Status", "OccurredAt", "ReasonCode", "PaymentEvidence", "ProviderSequence");
        typeof(VerifiedScreeningCallbackEnvelope).GetProperties().Select(x => x.Name).Should().BeEquivalentTo(
            "ProviderKey", "EventId", "Update", "VerifiedAt", "SignedAt", "AuthenticationScheme",
            "AuthenticationKeyVersion", "SignedPayloadSha256Hash");
        typeof(ScreeningCallbackRequest).GetProperties().Select(x => x.Name).Should().BeEquivalentTo(
            "Payload", "Headers");

        var contracts = new[]
        {
            typeof(AuthoritativeScreeningQuote),
            typeof(ScreeningQuoteRequest),
            typeof(CreateApplicantScreeningSessionRequest),
            typeof(ApplicantHostedSessionResult),
            typeof(ScreeningPaymentOperationEvidence),
            typeof(ScreeningAuthoritativePaymentUpdate),
            typeof(ScreeningStatusRequest),
            typeof(NormalizedScreeningStatusUpdate),
            typeof(VerifiedScreeningCallbackEnvelope),
            typeof(ScreeningCallbackRequest)
        };
        var forbidden = new[]
        {
            "Ssn", "SocialSecurity", "Dob", "Birth", "Bank", "Credential", "Secret",
            "ReportUrl", "ReportUri", "WebhookSecret", "IdentityDocument", "Email", "Phone", "Contact"
        };

        contracts.SelectMany(type => type.GetProperties())
            .Select(property => property.Name)
            .Should().NotContain(name => forbidden.Any(
                term => name.Contains(term, StringComparison.OrdinalIgnoreCase)));
    }

    private static AuthoritativeScreeningQuote ValidQuote(
        string currency,
        DateTimeOffset expiresAt,
        string policyVersion = "v1",
        DateTimeOffset? now = null,
        ScreeningQuoteRequest? context = null,
        string quoteReference = "quote-reference-secret") =>
        AuthoritativeScreeningQuote.Create(
            context ?? ValidQuoteRequest(),
            quoteReference,
            ScreeningPayer.Applicant,
            landlordAmountMinor: 0,
            applicantAmountMinor: 4_500,
            providerAmountMinor: 3_500,
            platformFeeMinor: 750,
            taxAmountMinor: 250,
            currency,
            expiresAt,
            policyVersion,
            now ?? DateTimeOffset.UtcNow);

    private static ScreeningQuoteRequest ValidQuoteRequest(ScreeningPayer payer = ScreeningPayer.Applicant) =>
        new(11, 22, 33, 44, "tenant-standard", "US", payer);

    private static Uri[] TrustedOrigins() => new[] { new Uri("https://screening.example.test") };

    private static ApplicantHostedSessionResult ValidHostedSession(
        string providerOrderId = "provider-order-123",
        Uri? continuationUri = null,
        DateTimeOffset? expiresAt = null,
        IEnumerable<Uri>? trustedOrigins = null,
        DateTimeOffset? now = null)
    {
        var suppliedNow = now ?? new DateTimeOffset(2026, 8, 6, 12, 0, 0, TimeSpan.Zero);
        return new ApplicantHostedSessionResult(
            providerOrderId,
            continuationUri ?? new Uri("https://screening.example.test/continue"),
            expiresAt ?? suppliedNow.AddMinutes(15),
            trustedOrigins ?? TrustedOrigins(),
            suppliedNow);
    }

    private static ScreeningCallbackRequest CallbackRequestWithHeader(string name, string value) =>
        new(ReadOnlyMemory<byte>.Empty, new[]
        {
            new KeyValuePair<string, IEnumerable<string>>(name, new[] { value })
        });
}
