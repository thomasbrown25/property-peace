namespace brownstone_hub_api.Enums
{
    /// <summary>
    /// Status of a rental application in the workflow
    /// </summary>
    public enum EApplicationStatus
    {
        Draft = 0,              // Application is being filled out
        Submitted = 1,          // Application submitted, awaiting review
        UnderReview = 2,        // Application is being reviewed
        Approved = 3,           // Application approved, ready for lease signing
        Rejected = 4,           // Application rejected
        Withdrawn = 5,          // Applicant withdrew application
        OnHold = 6,             // Application on hold (waiting for documents, etc.)
        LeaseSigned = 7,        // Application approved and lease signed (moved to active tenant)
        Pending = 8             // Application invite sent, waiting for tenant to submit
    }
}

