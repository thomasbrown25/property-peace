namespace brownstone_hub_api.Enums
{
    public enum ETimeEntryStatus
    {
        Draft,        // Being worked on
        Submitted,    // Submitted for approval
        Approved,     // Approved by PM
        Rejected,     // Rejected by PM
        Invoiced      // Used in billing
    }
}
