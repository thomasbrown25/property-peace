using brownstone_hub_api.Dtos.LeasingPipeline;
using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Services.LeasingPipeline;

public sealed record LeasingPipelineFacts
{
    public bool IsOccupied { get; init; }
    public bool HasActiveListing { get; init; }
    public bool HasLead { get; init; }
    public bool HasScheduledShowing { get; init; }
    public bool HasSubmittedApplication { get; init; }
    public bool HasScreeningInProgress { get; init; }
    public bool HasApprovedApplication { get; init; }
    public bool HasLeaseDraft { get; init; }
    public bool HasSignaturePending { get; init; }
    public bool HasCompletedSignatures { get; init; }
    public bool HasFutureActiveLease { get; init; }
    public bool HasRejectedOrWithdrawnApplication { get; init; }
    public bool HasDeclinedOrExpiredSignature { get; init; }
    public bool ScreeningReady { get; init; } = true;
    public bool ESignatureReady { get; init; } = true;

    public static LeasingPipelineFacts ForStage(LeasingLifecycleStage stage) => stage switch
    {
        LeasingLifecycleStage.Vacant => new(),
        LeasingLifecycleStage.Listed => new() { HasActiveListing = true },
        LeasingLifecycleStage.Lead => new() { HasLead = true },
        LeasingLifecycleStage.ShowingScheduled => new() { HasScheduledShowing = true },
        LeasingLifecycleStage.Applied => new() { HasSubmittedApplication = true },
        LeasingLifecycleStage.Screening => new() { HasScreeningInProgress = true },
        LeasingLifecycleStage.Approved => new() { HasApprovedApplication = true },
        LeasingLifecycleStage.LeaseDraft => new() { HasLeaseDraft = true },
        LeasingLifecycleStage.SignaturePending => new() { HasSignaturePending = true },
        LeasingLifecycleStage.MoveInReady => new() { HasCompletedSignatures = true, HasFutureActiveLease = true },
        LeasingLifecycleStage.Occupied => new() { IsOccupied = true },
        _ => new()
    };
}

public sealed record LeasingProjection(
    LeasingLifecycleStage Stage,
    IReadOnlyList<LifecycleStageDescriptorDto> Stages,
    LifecycleBlockerDto? Blocker,
    LifecycleActionDto? Action);

public static class LeasingPipelineProjector
{
    public static LeasingProjection Project(LeasingPipelineFacts facts)
    {
        var stage = facts.IsOccupied ? LeasingLifecycleStage.Occupied
            : facts.HasCompletedSignatures && facts.HasFutureActiveLease ? LeasingLifecycleStage.MoveInReady
            : facts.HasSignaturePending ? LeasingLifecycleStage.SignaturePending
            : facts.HasLeaseDraft ? LeasingLifecycleStage.LeaseDraft
            : facts.HasApprovedApplication ? LeasingLifecycleStage.Approved
            : facts.HasScreeningInProgress ? LeasingLifecycleStage.Screening
            : facts.HasSubmittedApplication ? LeasingLifecycleStage.Applied
            : facts.HasScheduledShowing ? LeasingLifecycleStage.ShowingScheduled
            : facts.HasLead ? LeasingLifecycleStage.Lead
            : facts.HasActiveListing ? LeasingLifecycleStage.Listed
            : LeasingLifecycleStage.Vacant;

        LifecycleBlockerDto? blocker = stage switch
        {
            LeasingLifecycleStage.Applied when !facts.ScreeningReady => new("screeningUnavailable", "Tenant screening is not currently ready."),
            LeasingLifecycleStage.LeaseDraft when !facts.ESignatureReady => new("eSignatureUnavailable", "Electronic signature is not currently ready."),
            LeasingLifecycleStage.LeaseDraft when facts.HasDeclinedOrExpiredSignature => new("signatureTerminal", "The prior signature request ended and the lease must be reviewed."),
            _ => null
        };

        var actionCode = stage switch
        {
            LeasingLifecycleStage.Vacant => "createListing",
            LeasingLifecycleStage.Listed => "inviteApplicant",
            LeasingLifecycleStage.Lead => "scheduleShowing",
            LeasingLifecycleStage.ShowingScheduled => "manageShowing",
            LeasingLifecycleStage.Applied => facts.ScreeningReady ? "requestScreening" : "reviewApplication",
            LeasingLifecycleStage.Screening => "reviewApplication",
            LeasingLifecycleStage.Approved => "createLease",
            LeasingLifecycleStage.LeaseDraft => facts.ESignatureReady && !facts.HasDeclinedOrExpiredSignature ? "sendForSignature" : "reviewLease",
            LeasingLifecycleStage.SignaturePending => "trackSignatures",
            LeasingLifecycleStage.MoveInReady => "prepareMoveIn",
            _ => null
        };
        var stages = Enum.GetValues<LeasingLifecycleStage>()
            .Select(x => new LifecycleStageDescriptorDto(x, (int)x, x == stage, x < stage)).ToArray();
        return new(stage, stages, blocker,
            actionCode is null ? null : new LifecycleActionDto(actionCode, new Dictionary<string, long>()));
    }
}
