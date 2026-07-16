using System.Text.Json.Serialization;

namespace brownstone_hub_api.Dtos.BackgroundCheck
{
    /// <summary>
    /// Response DTO from RentSpree background check API
    /// </summary>
    public class RentSpreeResponseDto
    {
        [JsonPropertyName("request_id")]
        public string? RequestId { get; set; }

        [JsonPropertyName("status")]
        public string? Status { get; set; } // "pending", "in_progress", "completed", "failed"

        [JsonPropertyName("credit_score")]
        public int? CreditScore { get; set; }

        [JsonPropertyName("credit_report")]
        public RentSpreeCreditReportDto? CreditReport { get; set; }

        [JsonPropertyName("criminal_check")]
        public RentSpreeCriminalCheckDto? CriminalCheck { get; set; }

        [JsonPropertyName("eviction_check")]
        public RentSpreeEvictionCheckDto? EvictionCheck { get; set; }

        [JsonPropertyName("income_verification")]
        public RentSpreeIncomeVerificationDto? IncomeVerification { get; set; }

        [JsonPropertyName("report_url")]
        public string? ReportUrl { get; set; }

        [JsonPropertyName("summary")]
        public RentSpreeSummaryDto? Summary { get; set; }

        [JsonPropertyName("created_at")]
        public DateTime? CreatedAt { get; set; }

        [JsonPropertyName("completed_at")]
        public DateTime? CompletedAt { get; set; }

        [JsonPropertyName("error")]
        public string? Error { get; set; }
    }

    public class RentSpreeCreditReportDto
    {
        [JsonPropertyName("score")]
        public int? Score { get; set; }

        [JsonPropertyName("passed")]
        public bool? Passed { get; set; }

        [JsonPropertyName("details")]
        public string? Details { get; set; }
    }

    public class RentSpreeCriminalCheckDto
    {
        [JsonPropertyName("passed")]
        public bool? Passed { get; set; }

        [JsonPropertyName("records_found")]
        public int? RecordsFound { get; set; }

        [JsonPropertyName("details")]
        public string? Details { get; set; }
    }

    public class RentSpreeEvictionCheckDto
    {
        [JsonPropertyName("passed")]
        public bool? Passed { get; set; }

        [JsonPropertyName("evictions_found")]
        public int? EvictionsFound { get; set; }

        [JsonPropertyName("details")]
        public string? Details { get; set; }
    }

    public class RentSpreeIncomeVerificationDto
    {
        [JsonPropertyName("passed")]
        public bool? Passed { get; set; }

        [JsonPropertyName("verified_income")]
        public decimal? VerifiedIncome { get; set; }

        [JsonPropertyName("income_to_rent_ratio")]
        public decimal? IncomeToRentRatio { get; set; }

        [JsonPropertyName("details")]
        public string? Details { get; set; }
    }

    public class RentSpreeSummaryDto
    {
        [JsonPropertyName("overall_pass")]
        public bool? OverallPass { get; set; }

        [JsonPropertyName("rejection_reason")]
        public string? RejectionReason { get; set; }

        [JsonPropertyName("recommendation")]
        public string? Recommendation { get; set; } // "approve", "review", "reject"
    }
}

