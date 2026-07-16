namespace brownstone_hub_api.Enums
{
    /// <summary>
    /// Types of documents that can be stored for tenants
    /// </summary>
    public enum ETenantDocumentType
    {
        // Identity Documents
        GovernmentId = 1,           // Driver's license, passport, state ID
        SocialSecurityCard = 2,     // SSN card copy
        
        // Lease Documents
        LeaseAgreement = 10,        // Signed lease agreement
        LeaseAddendum = 11,         // Lease addendums or amendments
        LeaseRenewal = 12,          // Lease renewal documents
        
        // Insurance Documents
        RenterInsurance = 20,       // Tenant's renter insurance policy
        LiabilityInsurance = 21,    // Liability insurance documents
        
        // Application Documents
        RentalApplication = 30,     // Original rental application
        CreditReport = 31,          // Credit check/credit report
        BackgroundCheck = 32,       // Background check results
        IncomeVerification = 33,    // Pay stubs, tax returns, bank statements
        EmploymentVerification = 34, // Employment verification letter
        
        // Move-in/Move-out Documents
        MoveInChecklist = 40,       // Move-in inspection checklist
        MoveOutChecklist = 41,      // Move-out inspection checklist
        MoveInPhotos = 42,          // Move-in condition photos
        MoveOutPhotos = 43,         // Move-out condition photos
        
        // Financial Documents
        BankStatement = 50,        // Bank statements
        TaxReturn = 51,            // Tax returns
        W2 = 52,                   // W2 forms
        PayStub = 53,              // Pay stubs
        
        // Other Documents
        PetAgreement = 60,         // Pet addendum/agreement
        ParkingAgreement = 61,     // Parking space agreement
        Other = 99                  // Other miscellaneous documents
    }
}

