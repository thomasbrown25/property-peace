namespace brownstone_hub_api.Dtos.FinancialStatements
{
    public class BalanceSheetDto
    {
        public DateTime AsOfDate { get; set; }
        public List<AssetLineItem> Assets { get; set; } = new();
        public decimal TotalAssets { get; set; }
        public List<LiabilityLineItem> Liabilities { get; set; } = new();
        public decimal TotalLiabilities { get; set; }
        public List<EquityLineItem> Equity { get; set; } = new();
        public decimal TotalEquity { get; set; }
        public decimal TotalLiabilitiesAndEquity { get; set; }
    }

    public class AssetLineItem
    {
        public string AccountCode { get; set; } = string.Empty;
        public string AccountName { get; set; } = string.Empty;
        public decimal Balance { get; set; }
    }

    public class LiabilityLineItem
    {
        public string AccountCode { get; set; } = string.Empty;
        public string AccountName { get; set; } = string.Empty;
        public decimal Balance { get; set; }
    }

    public class EquityLineItem
    {
        public string AccountCode { get; set; } = string.Empty;
        public string AccountName { get; set; } = string.Empty;
        public decimal Balance { get; set; }
    }
}
