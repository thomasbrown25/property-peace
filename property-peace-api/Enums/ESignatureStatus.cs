namespace brownstone_hub_api.Enums
{
    /// <summary>
    /// Status of e-signature workflow for leases
    /// </summary>
    public enum ESignatureStatus
    {
        NotSent = 0,           // Lease hasn't been sent for signature yet
        Sent = 1,              // Lease has been sent to signers
        InProgress = 2,        // At least one party has started signing
        PartiallySigned = 3,   // Some but not all parties have signed
        Completed = 4,         // All parties have signed
        Declined = 5,          // One or more parties declined to sign
        Expired = 6,           // Signature request expired
        Cancelled = 7          // Signature request was cancelled
    }
}

