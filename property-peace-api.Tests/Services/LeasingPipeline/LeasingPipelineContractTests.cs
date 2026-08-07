using System.Text.Json;
using brownstone_hub_api.Dtos.LeasingPipeline;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Services.LeasingPipeline;
using FluentAssertions;
using Xunit;

namespace brownstone_hub_api.Tests.Services.LeasingPipeline;

public sealed class LeasingPipelineContractTests
{
    [Fact]
    public void Stage_contract_is_exact_ordered_and_camel_case_on_wire()
    {
        Enum.GetNames<LeasingLifecycleStage>().Should().Equal(
            "Vacant", "Listed", "Lead", "ShowingScheduled", "Applied", "Screening",
            "Approved", "LeaseDraft", "SignaturePending", "MoveInReady", "Occupied");

        var wire = Enum.GetValues<LeasingLifecycleStage>()
            .Select(x => JsonSerializer.Serialize(x, LeasingPipelineJson.Options).Trim('"'));
        wire.Should().Equal("vacant", "listed", "lead", "showingScheduled", "applied", "screening",
            "approved", "leaseDraft", "signaturePending", "moveInReady", "occupied");
    }

    [Theory]
    [InlineData(LeasingLifecycleStage.Vacant)]
    [InlineData(LeasingLifecycleStage.Listed)]
    [InlineData(LeasingLifecycleStage.Lead)]
    [InlineData(LeasingLifecycleStage.ShowingScheduled)]
    [InlineData(LeasingLifecycleStage.Applied)]
    [InlineData(LeasingLifecycleStage.Screening)]
    [InlineData(LeasingLifecycleStage.Approved)]
    [InlineData(LeasingLifecycleStage.LeaseDraft)]
    [InlineData(LeasingLifecycleStage.SignaturePending)]
    [InlineData(LeasingLifecycleStage.MoveInReady)]
    [InlineData(LeasingLifecycleStage.Occupied)]
    public void Projection_supports_every_stage_with_one_truthful_action(LeasingLifecycleStage expected)
    {
        var result = LeasingPipelineProjector.Project(LeasingPipelineFacts.ForStage(expected));
        result.Stage.Should().Be(expected);
        result.Stages.Should().HaveCount(11);
        if (expected == LeasingLifecycleStage.Occupied) result.Action.Should().BeNull();
        else result.Action.Should().NotBeNull();
    }

    [Fact]
    public void Furthest_authoritative_stage_wins_and_future_lease_is_not_occupied()
    {
        var facts = LeasingPipelineFacts.ForStage(LeasingLifecycleStage.SignaturePending) with
        {
            HasActiveListing = true,
            HasLead = true,
            HasSubmittedApplication = true,
            HasFutureActiveLease = true
        };
        LeasingPipelineProjector.Project(facts).Stage.Should().Be(LeasingLifecycleStage.SignaturePending);
    }

    [Fact]
    public void Terminal_records_do_not_advance_and_readiness_blocks_provider_action()
    {
        var result = LeasingPipelineProjector.Project(new LeasingPipelineFacts
        {
            HasRejectedOrWithdrawnApplication = true,
            HasDeclinedOrExpiredSignature = true,
            HasLeaseDraft = true,
            ESignatureReady = false
        });
        result.Stage.Should().Be(LeasingLifecycleStage.LeaseDraft);
        result.Blocker!.Code.Should().Be("eSignatureUnavailable");
        result.Action!.Code.Should().Be("reviewLease");
    }

    [Fact]
    public void Public_DTO_has_an_explicit_safe_surface()
    {
        typeof(LeasingPipelineDto).GetProperties().Select(x => x.Name).Should().BeEquivalentTo(
            "PropertyId", "UnitId", "CurrentStage", "Stages", "Blocker", "PrimaryAction",
            "References", "RelevantRecords", "Revision", "EvaluatedAt");
        var forbidden = new[] { "Email", "Name", "Ssn", "CreditScore", "ReportUrl", "Signature", "Url", "Token", "Provider" };
        typeof(LeasingPipelineDto).Assembly.GetTypes()
            .Where(t => t.Namespace == typeof(LeasingPipelineDto).Namespace)
            .SelectMany(t => t.GetProperties())
            .Select(p => p.Name)
            .Should().NotContain(name => forbidden.Any(x => name.Contains(x, StringComparison.OrdinalIgnoreCase)));
    }
}
