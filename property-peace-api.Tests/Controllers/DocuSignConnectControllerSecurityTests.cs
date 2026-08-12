using System.Security.Cryptography;
using System.Text;
using brownstone_hub_api.Config;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Dtos.Lease;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Repositories.Leases;
using brownstone_hub_api.Services.ESignatureService;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Controllers;

public sealed class DocuSignConnectControllerSecurityTests
{
    private const string Secret = "connect-test-secret";
    private const string Envelope = "env-exact-123";
    private static readonly byte[] ValidBody = Encoding.UTF8.GetBytes("""
        {"event":"envelope-completed","generatedDateTime":"2026-08-10T05:00:01Z","data":{"envelopeId":"env-exact-123","envelopeSummary":{"status":"completed","completedDateTime":"2026-08-10T05:00:00Z","recipients":{"signers":[{"email":"tenant@example.com","status":"completed","signedDateTime":"2026-08-10T04:59:00Z"}]}}}}
        """);

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task Missing_or_blank_secret_fails_closed_without_repository_or_processor_calls(string? secret)
    {
        var repository = new Mock<ILeaseRepository>(MockBehavior.Strict);
        var processor = new Mock<IDocuSignConnectProcessor>(MockBehavior.Strict);
        var controller = Create(repository.Object, processor.Object, ValidBody, secret: secret);

        var result = await controller.HandleConnect(CancellationToken.None);

        result.Should().BeOfType<ObjectResult>().Which.StatusCode.Should().Be(503);
        repository.VerifyNoOtherCalls();
        processor.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Missing_signature_returns_generic_401_before_lookup()
    {
        var repository = new Mock<ILeaseRepository>(MockBehavior.Strict);
        var processor = new Mock<IDocuSignConnectProcessor>(MockBehavior.Strict);
        var result = await Create(repository.Object, processor.Object, ValidBody).HandleConnect(CancellationToken.None);

        result.Should().BeOfType<UnauthorizedObjectResult>();
        repository.VerifyNoOtherCalls();
        processor.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Invalid_signature_returns_generic_401_before_parsing_or_lookup()
    {
        var repository = new Mock<ILeaseRepository>(MockBehavior.Strict);
        var processor = new Mock<IDocuSignConnectProcessor>(MockBehavior.Strict);
        var malformed = Encoding.UTF8.GetBytes("not json");
        var result = await Create(repository.Object, processor.Object, malformed, "invalid-base64").HandleConnect(CancellationToken.None);

        result.Should().BeOfType<UnauthorizedObjectResult>();
        repository.VerifyNoOtherCalls();
        processor.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Valid_hmac_over_exact_raw_bytes_dispatches_scoped_update()
    {
        var mapping = new LeaseConnectInfoDto { LeaseId = 4, OrganizationId = 7, EnvelopeId = Envelope };
        var repository = new Mock<ILeaseRepository>(MockBehavior.Strict);
        repository.Setup(x => x.GetLeaseByDocuSignEnvelopeIdAsync(Envelope, It.IsAny<CancellationToken>())).ReturnsAsync(mapping);
        var processor = new Mock<IDocuSignConnectProcessor>(MockBehavior.Strict);
        processor.Setup(x => x.SynchronizeAsync(mapping,
                It.Is<DocuSignConnectUpdate>(u => u.EnvelopeId == Envelope && u.Status == ESignatureStatus.Completed &&
                    u.SignedRecipients.ContainsKey("tenant@example.com")), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new DocuSignConnectApplyResult(true, 1));

        var result = await Create(repository.Object, processor.Object, ValidBody, Sign(ValidBody)).HandleConnect(CancellationToken.None);

        result.Should().BeOfType<OkResult>();
        repository.VerifyAll();
        processor.VerifyAll();
    }

    [Fact]
    public async Task Signature_for_different_raw_bytes_is_rejected()
    {
        var repository = new Mock<ILeaseRepository>(MockBehavior.Strict);
        var processor = new Mock<IDocuSignConnectProcessor>(MockBehavior.Strict);
        var altered = ValidBody.Concat(new byte[] { (byte)' ' }).ToArray();

        var result = await Create(repository.Object, processor.Object, altered, Sign(ValidBody)).HandleConnect(CancellationToken.None);

        result.Should().BeOfType<UnauthorizedObjectResult>();
        repository.VerifyNoOtherCalls();
        processor.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Authenticated_malformed_payload_is_rejected_without_lookup()
    {
        var body = Encoding.UTF8.GetBytes("{\"event\":");
        var repository = new Mock<ILeaseRepository>(MockBehavior.Strict);
        var processor = new Mock<IDocuSignConnectProcessor>(MockBehavior.Strict);

        var result = await Create(repository.Object, processor.Object, body, Sign(body)).HandleConnect(CancellationToken.None);

        result.Should().BeOfType<BadRequestObjectResult>();
        repository.VerifyNoOtherCalls();
        processor.VerifyNoOtherCalls();
    }

    [Theory]
    [InlineData("malformed")]
    [InlineData("future")]
    [InlineData("stale")]
    public async Task Invalid_or_unreasonable_authoritative_event_timestamp_is_rejected(string variation)
    {
        var timestamp = variation switch
        {
            "future" => DateTimeOffset.UtcNow.AddHours(1).ToString("O"),
            "stale" => DateTimeOffset.UtcNow.AddYears(-11).ToString("O"),
            _ => "not-a-timestamp"
        };
        var body = EventBody(timestamp);
        var repository = new Mock<ILeaseRepository>(MockBehavior.Strict);
        var processor = new Mock<IDocuSignConnectProcessor>(MockBehavior.Strict);

        var result = await Create(repository.Object, processor.Object, body, Sign(body)).HandleConnect(CancellationToken.None);

        result.Should().BeOfType<BadRequestObjectResult>();
        repository.VerifyNoOtherCalls();
        processor.VerifyNoOtherCalls();
    }

    [Theory]
    [InlineData("envelope-completed", "completed")]
    [InlineData("envelope-declined", "declined")]
    [InlineData("envelope-voided", "voided")]
    [InlineData("envelope-expired", "expired")]
    public async Task Terminal_event_without_authoritative_occurrence_timestamp_is_rejected(
        string eventName, string status)
    {
        var body = System.Text.Json.JsonSerializer.SerializeToUtf8Bytes(new
        {
            @event = eventName,
            data = new { envelopeId = Envelope, envelopeSummary = new { status } }
        });
        var repository = new Mock<ILeaseRepository>(MockBehavior.Strict);
        var processor = new Mock<IDocuSignConnectProcessor>(MockBehavior.Strict);

        var result = await Create(repository.Object, processor.Object, body, Sign(body)).HandleConnect(CancellationToken.None);

        result.Should().BeOfType<BadRequestObjectResult>();
        repository.VerifyNoOtherCalls();
        processor.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Authoritative_event_timestamp_is_normalized_to_bounded_utc()
    {
        var occurred = DateTimeOffset.UtcNow.AddMinutes(-1);
        var body = EventBody(occurred.ToString("O"));
        var mapping = new LeaseConnectInfoDto { LeaseId = 4, OrganizationId = 7, EnvelopeId = Envelope };
        var repository = new Mock<ILeaseRepository>(MockBehavior.Strict);
        repository.Setup(x => x.GetLeaseByDocuSignEnvelopeIdAsync(Envelope, It.IsAny<CancellationToken>())).ReturnsAsync(mapping);
        var processor = new Mock<IDocuSignConnectProcessor>(MockBehavior.Strict);
        processor.Setup(x => x.SynchronizeAsync(mapping,
                It.Is<DocuSignConnectUpdate>(u => u.EventOccurredAt.HasValue &&
                    u.EventOccurredAt.Value.Kind == DateTimeKind.Utc &&
                    u.EventOccurredAt.Value == occurred.UtcDateTime), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new DocuSignConnectApplyResult(true, 0));

        var result = await Create(repository.Object, processor.Object, body, Sign(body)).HandleConnect(CancellationToken.None);

        result.Should().BeOfType<OkResult>();
        repository.VerifyAll();
        processor.VerifyAll();
    }

    [Fact]
    public async Task Oversized_payload_is_rejected_before_read_or_lookup()
    {
        var repository = new Mock<ILeaseRepository>(MockBehavior.Strict);
        var processor = new Mock<IDocuSignConnectProcessor>(MockBehavior.Strict);
        var controller = Create(repository.Object, processor.Object, ValidBody, Sign(ValidBody));
        controller.Request.ContentLength = DocuSignSettings.DefaultConnectBodyLimitBytes + 1;

        var result = await controller.HandleConnect(CancellationToken.None);

        result.Should().BeOfType<ObjectResult>().Which.StatusCode.Should().Be(413);
        repository.VerifyNoOtherCalls();
        processor.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Cancellation_propagates_without_lookup()
    {
        var repository = new Mock<ILeaseRepository>(MockBehavior.Strict);
        var processor = new Mock<IDocuSignConnectProcessor>(MockBehavior.Strict);
        using var cts = new CancellationTokenSource();
        cts.Cancel();

        var action = () => Create(repository.Object, processor.Object, ValidBody, Sign(ValidBody)).HandleConnect(cts.Token);

        await action.Should().ThrowAsync<OperationCanceledException>();
        repository.VerifyNoOtherCalls();
        processor.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Database_failure_is_not_acknowledged_as_success_and_error_is_sanitized()
    {
        var mapping = new LeaseConnectInfoDto { LeaseId = 4, OrganizationId = 7, EnvelopeId = Envelope };
        var repository = new Mock<ILeaseRepository>(MockBehavior.Strict);
        repository.Setup(x => x.GetLeaseByDocuSignEnvelopeIdAsync(Envelope, It.IsAny<CancellationToken>())).ReturnsAsync(mapping);
        var processor = new Mock<IDocuSignConnectProcessor>(MockBehavior.Strict);
        processor.Setup(x => x.SynchronizeAsync(mapping, It.IsAny<DocuSignConnectUpdate>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("sensitive provider/internal detail"));

        var result = await Create(repository.Object, processor.Object, ValidBody, Sign(ValidBody)).HandleConnect(CancellationToken.None);

        var failure = result.Should().BeOfType<ObjectResult>().Which;
        failure.StatusCode.Should().Be(500);
        failure.Value!.ToString().Should().NotContain("sensitive");
    }

    private static byte[] EventBody(string generatedDateTime) => System.Text.Json.JsonSerializer.SerializeToUtf8Bytes(new
    {
        @event = "envelope-sent",
        generatedDateTime,
        data = new { envelopeId = Envelope, envelopeSummary = new { status = "sent" } }
    });

    private static DocuSignConnectController Create(
        ILeaseRepository repository,
        IDocuSignConnectProcessor processor,
        byte[] body,
        string? signature = null,
        string? secret = Secret)
    {
        var controller = new DocuSignConnectController(repository, processor,
            Options.Create(new DocuSignSettings { ConnectSecret = secret ?? string.Empty }),
            Mock.Of<ILogger<DocuSignConnectController>>())
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };
        controller.Request.Body = new MemoryStream(body);
        controller.Request.ContentLength = body.Length;
        if (signature != null) controller.Request.Headers["X-Docusign-Signature-1"] = signature;
        return controller;
    }

    private static string Sign(byte[] body)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(Secret));
        return Convert.ToBase64String(hmac.ComputeHash(body));
    }
}
