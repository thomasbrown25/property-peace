namespace brownstone_hub_api.Enums;

// Numeric order is the canonical furthest-stage precedence. Do not reorder.
public enum LeasingLifecycleStage
{
    Vacant = 0,
    Listed = 1,
    Lead = 2,
    ShowingScheduled = 3,
    Applied = 4,
    Screening = 5,
    Approved = 6,
    LeaseDraft = 7,
    SignaturePending = 8,
    MoveInReady = 9,
    Occupied = 10
}

public enum UnitLifecycleEventType
{
    ShowingScheduled = 0,
    ShowingRescheduled = 1,
    ShowingCancelled = 2,
    ShowingCompleted = 3,
    LeadCaptured = 4,
    ApplicationStarted = 5
}
