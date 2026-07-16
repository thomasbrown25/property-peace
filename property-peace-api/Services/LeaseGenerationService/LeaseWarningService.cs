using System.Text.RegularExpressions;

namespace brownstone_hub_api.Services.LeaseGenerationService
{
    public static class LeaseWarningService
    {
        private static readonly List<WarningRule> WarningRules = new()
        {
            new WarningRule
            {
                Pattern = @"non-?refundable",
                Message = "Non-refundable deposits may be illegal in some jurisdictions. Consider making it refundable or clearly stating conditions.",
                Severity = "High"
            },
            new WarningRule
            {
                Pattern = @"application.*fee.*non-?refundable",
                Message = "Non-refundable application fees may be restricted by state law. Verify local regulations.",
                Severity = "High"
            },
            new WarningRule
            {
                Pattern = @"late.*fee.*(\d+).*%",
                Message = "Percentage-based late fees may exceed legal limits in some states. Consider a flat fee or verify percentage is legal.",
                Severity = "Medium"
            },
            new WarningRule
            {
                Pattern = @"pet.*fee.*(\d+)",
                Message = "Pet fees may be subject to state restrictions. Some states only allow pet deposits (refundable).",
                Severity = "Medium"
            },
            new WarningRule
            {
                Pattern = @"no.*pets.*allowed",
                Message = "Service animals and emotional support animals are protected by law and cannot be prohibited.",
                Severity = "High"
            },
            new WarningRule
            {
                Pattern = @"tenant.*waives.*right",
                Message = "Tenants cannot waive certain legal rights. This clause may be unenforceable.",
                Severity = "High"
            },
            new WarningRule
            {
                Pattern = @"landlord.*not.*liable",
                Message = "Broad liability waivers may be unenforceable. Consider more specific language.",
                Severity = "Medium"
            },
            new WarningRule
            {
                Pattern = @"automatic.*renewal",
                Message = "Automatic renewal clauses may require specific notice requirements by state law.",
                Severity = "Low"
            }
        };

        public static List<string> CheckForWarnings(string text)
        {
            if (string.IsNullOrWhiteSpace(text))
                return new List<string>();

            var warnings = new List<string>();
            var lowerText = text.ToLower();

            foreach (var rule in WarningRules)
            {
                if (Regex.IsMatch(lowerText, rule.Pattern, RegexOptions.IgnoreCase))
                {
                    warnings.Add($"[{rule.Severity}] {rule.Message}");
                }
            }

            return warnings;
        }

        public static List<string> CheckLeaseTerms(decimal? monthlyRent, decimal? securityDeposit, decimal? lateFeeAmount, int? gracePeriodDays)
        {
            var warnings = new List<string>();

            // Security deposit checks
            if (securityDeposit.HasValue && monthlyRent.HasValue)
            {
                var depositRatio = securityDeposit.Value / monthlyRent.Value;
                if (depositRatio > 3)
                {
                    warnings.Add("[Medium] Security deposit exceeds 3 months' rent. Some states limit deposit amounts.");
                }
            }

            // Late fee checks
            if (lateFeeAmount.HasValue && monthlyRent.HasValue)
            {
                var lateFeeRatio = lateFeeAmount.Value / monthlyRent.Value;
                if (lateFeeRatio > 0.1m) // More than 10% of rent
                {
                    warnings.Add("[High] Late fee exceeds 10% of monthly rent. This may exceed legal limits in some states.");
                }
            }

            if (gracePeriodDays.HasValue && gracePeriodDays.Value < 3)
            {
                warnings.Add("[Low] Grace period is less than 3 days. Consider providing at least 3-5 days.");
            }

            return warnings;
        }

        private class WarningRule
        {
            public string Pattern { get; set; } = string.Empty;
            public string Message { get; set; } = string.Empty;
            public string Severity { get; set; } = "Medium";
        }
    }
}
