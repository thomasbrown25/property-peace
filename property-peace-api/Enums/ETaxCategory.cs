namespace brownstone_hub_api.Enums
{
    /// <summary>
    /// IRS Schedule E tax categories for rental property expenses
    /// </summary>
    public enum ETaxCategory
    {
        // Not specified
        None = 0,

        // Repairs and Maintenance (fully deductible)
        Repairs = 1,
        Maintenance = 2,
        Cleaning = 3,
        Landscaping = 4,

        // Utilities (fully deductible)
        Utilities = 5,
        Water = 6,
        Sewer = 7,
        Garbage = 8,
        Internet = 9,
        Phone = 10,

        // Insurance (fully deductible)
        Insurance = 11,
        LiabilityInsurance = 12,
        PropertyInsurance = 13,

        // Taxes (fully deductible)
        PropertyTaxes = 14,
        LocalTaxes = 15,
        StateTaxes = 16,

        // Management and Professional Services (fully deductible)
        PropertyManagement = 17,
        LegalFees = 18,
        AccountingFees = 19,
        ProfessionalServices = 20,

        // Advertising and Marketing (fully deductible)
        Advertising = 21,
        Marketing = 22,

        // Travel and Transportation (fully deductible)
        Travel = 23,
        Transportation = 24,
        VehicleExpenses = 25,

        // Depreciation (separate category, reported differently)
        Depreciation = 26,

        // Improvements (capitalized, not expensed)
        Improvements = 27,

        // Other Expenses (fully deductible)
        Other = 28,
        Supplies = 29,
        OfficeExpenses = 30,
        BankFees = 31,
        Interest = 32,
        MortgageInterest = 33,

        // 1099-MISC Categories
        ContractLabor = 34, // For 1099 preparation
        Services = 35
    }
}

