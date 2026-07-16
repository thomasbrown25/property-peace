using brownstone_hub_api.Dtos.Tax;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.TaxReportService;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using QuestPdfUnit = QuestPDF.Infrastructure.Unit;

namespace brownstone_hub_api.Services.ScheduleEPdfService
{
    public class ScheduleEPdfService(
        ITaxReportService taxReportService,
        IUserRepository userRepository,
        ILogger<ScheduleEPdfService> logger) : IScheduleEPdfService
    {
        private readonly ITaxReportService _taxReportService = taxReportService;
        private readonly IUserRepository _userRepository = userRepository;
        private readonly ILogger<ScheduleEPdfService> _logger = logger;

        public async Task<ServiceResponse<byte[]>> GenerateScheduleEPdfAsync(long landlordId, int year, bool perProperty = false)
        {
            try
            {
                QuestPDF.Settings.License = LicenseType.Community;

                // Get tax report data
                var taxReportResponse = await _taxReportService.GetTaxYearReport(landlordId, year);
                if (!taxReportResponse.Success || taxReportResponse.Data == null)
                {
                    return ServiceResponse<byte[]>.CreateError("Failed to retrieve tax data", taxReportResponse.Message ?? "Tax report data not available");
                }

                var taxReport = taxReportResponse.Data;

                // Get landlord information
                var landlord = await _userRepository.GetUser(landlordId);
                if (landlord == null)
                {
                    return ServiceResponse<byte[]>.CreateError("Landlord not found", "Unable to retrieve landlord information");
                }

                var landlordName = !string.IsNullOrWhiteSpace(landlord.BusinessName) 
                    ? landlord.BusinessName 
                    : $"{landlord.FirstName} {landlord.LastName}".Trim();

                // Generate PDF
                byte[] pdfBytes;
                if (perProperty)
                {
                    pdfBytes = GeneratePerPropertyPdf(taxReport, landlordName, year);
                }
                else
                {
                    pdfBytes = GenerateCombinedPdf(taxReport, landlordName, year);
                }

                return new ServiceResponse<byte[]> { Data = pdfBytes };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating Schedule E PDF for landlord {LandlordId}, year {Year}", landlordId, year);
                return ServiceResponse<byte[]>.CreateError("Error generating Schedule E PDF", ex.Message);
            }
        }

        private byte[] GenerateCombinedPdf(TaxYearReportDto taxReport, string landlordName, int year)
        {
            return Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.Letter);
                    page.Margin(1, QuestPdfUnit.Inch);
                    page.PageColor(Colors.White);
                    page.DefaultTextStyle(x => x.FontSize(10));

                    // Header
                    page.Header()
                        .Column(column =>
                        {
                            column.Item().Text("Schedule E - Supplemental Income and Loss")
                                .FontSize(18)
                                .Bold()
                                .FontColor(Colors.Blue.Darken3);

                            column.Item().PaddingTop(5).Row(row =>
                            {
                                row.RelativeColumn().Text($"Landlord: {landlordName}")
                                    .FontSize(11)
                                    .FontColor(Colors.Grey.Darken2);
                                row.ConstantColumn(150).AlignRight().Text($"Tax Year: {year}")
                                    .FontSize(11)
                                    .FontColor(Colors.Grey.Darken2);
                            });

                            column.Item().PaddingTop(2).Text("Report Type: Combined Properties")
                                .FontSize(10)
                                .FontColor(Colors.Grey.Darken1);
                        });

                    // Content
                    page.Content()
                        .PaddingVertical(10)
                        .Column(column =>
                        {
                            // Income Section
                            column.Item().Element(container => CreateIncomeSection(container, taxReport.TotalIncome));

                            column.Item().Height(15);

                            // Expenses Section
                            column.Item().Element(container => CreateExpensesSection(container, taxReport.CategorySummaries));

                            column.Item().Height(15);

                            // Summary Section
                            column.Item().Element(container => CreateSummarySection(container, taxReport.TotalIncome, taxReport.TotalExpenses, taxReport.NetIncome));
                        });

                    // Footer
                    page.Footer()
                        .Column(column =>
                        {
                            column.Item().BorderTop(1).BorderColor(Colors.Grey.Lighten2).PaddingTop(5)
                                .Text($"Generated on {DateTime.Now:MM/dd/yyyy HH:mm} | Property Peace")
                                .FontSize(8)
                                .FontColor(Colors.Grey.Medium);

                            column.Item().PaddingTop(3)
                                .Text("This report is for informational purposes only. Please consult with a tax professional for proper tax filing.")
                                .FontSize(7)
                                .FontColor(Colors.Grey.Medium)
                                .Italic();
                        });
                });
            })
            .GeneratePdf();
        }

        private byte[] GeneratePerPropertyPdf(TaxYearReportDto taxReport, string landlordName, int year)
        {
            // Group expenses by property
            var propertyGroups = taxReport.DeductibleExpenses
                .GroupBy(e => new { e.PropertyId, e.PropertyName })
                .ToList();

            // Get property-level income from payments
            // Note: We need to get payments separately since TaxYearReportDto doesn't include per-property income
            // For now, we'll estimate based on expenses or use a placeholder
            // TODO: Enhance TaxYearReportDto to include per-property income breakdown

            return Document.Create(container =>
            {
                foreach (var propertyGroup in propertyGroups)
                {
                    var propertyName = propertyGroup.Key.PropertyName ?? "Unknown Property";
                    var propertyId = propertyGroup.Key.PropertyId;
                    var propertyExpenses = propertyGroup.ToList();
                    
                    // Calculate property totals
                    // Note: Property-level income calculation requires additional data
                    // For now, we'll show expenses only and note that income needs to be calculated separately
                    // In a full implementation, we'd need to query payments by property ID
                    var propertyExpensesTotal = propertyExpenses.Sum(e => e.Amount);
                    
                    // Placeholder for property income - in production, this should come from TaxYearReportDto
                    // or be calculated from payments grouped by property
                    var propertyIncome = 0m; // Will be calculated from payments if available
                    var propertyNetIncome = propertyIncome - propertyExpensesTotal;

                    // Group expenses by category for this property
                    var propertyCategorySummaries = propertyExpenses
                        .GroupBy(e => e.TaxCategory ?? ETaxCategory.None)
                        .Select(g => new TaxCategorySummaryDto
                        {
                            TaxCategory = g.Key,
                            CategoryName = GetTaxCategoryName(g.Key),
                            TotalAmount = g.Sum(e => e.Amount),
                            ExpenseCount = g.Count(),
                            IsFullyDeductible = IsCategoryFullyDeductible(g.Key)
                        })
                        .OrderByDescending(c => c.TotalAmount)
                        .ToList();

                    container.Page(page =>
                    {
                        page.Size(PageSizes.Letter);
                        page.Margin(1, QuestPdfUnit.Inch);
                        page.PageColor(Colors.White);
                        page.DefaultTextStyle(x => x.FontSize(10));

                        // Header
                        page.Header()
                            .Column(column =>
                            {
                                column.Item().Text("Schedule E - Supplemental Income and Loss")
                                    .FontSize(18)
                                    .Bold()
                                    .FontColor(Colors.Blue.Darken3);

                                column.Item().PaddingTop(5).Row(row =>
                                {
                                    row.RelativeColumn().Text($"Landlord: {landlordName}")
                                        .FontSize(11)
                                        .FontColor(Colors.Grey.Darken2);
                                    row.ConstantColumn(150).AlignRight().Text($"Tax Year: {year}")
                                        .FontSize(11)
                                        .FontColor(Colors.Grey.Darken2);
                                });

                                column.Item().PaddingTop(2).Text($"Property: {propertyName}")
                                    .FontSize(10)
                                    .FontColor(Colors.Grey.Darken1);
                            });

                        // Content
                        page.Content()
                            .PaddingVertical(10)
                            .Column(column =>
                            {
                                // Income Section
                                column.Item().Element(container => CreateIncomeSection(container, propertyIncome));

                                column.Item().Height(15);

                                // Expenses Section
                                column.Item().Element(container => CreateExpensesSection(container, propertyCategorySummaries));

                                column.Item().Height(15);

                                // Summary Section
                                column.Item().Element(container => CreateSummarySection(container, propertyIncome, propertyExpensesTotal, propertyNetIncome));
                            });

                        // Footer
                        page.Footer()
                            .Column(column =>
                            {
                                column.Item().BorderTop(1).BorderColor(Colors.Grey.Lighten2).PaddingTop(5)
                                    .Text($"Generated on {DateTime.Now:MM/dd/yyyy HH:mm} | Property Peace")
                                    .FontSize(8)
                                    .FontColor(Colors.Grey.Medium);

                                column.Item().PaddingTop(3)
                                    .Text("This report is for informational purposes only. Please consult with a tax professional for proper tax filing.")
                                    .FontSize(7)
                                    .FontColor(Colors.Grey.Medium)
                                    .Italic();
                            });
                    });
                }
            })
            .GeneratePdf();
        }

        private void CreateIncomeSection(IContainer container, decimal totalIncome)
        {
            container.Column(column =>
            {
                column.Item().Text("Rental Income")
                    .FontSize(14)
                    .Bold()
                    .FontColor(Colors.Blue.Darken2);

                column.Item().Height(5);

                column.Item().Border(1).BorderColor(Colors.Grey.Lighten2).Padding(10).Row(row =>
                {
                    row.RelativeItem().Text("Total Rental Income")
                        .FontSize(11)
                        .Bold();
                    row.ConstantItem(120).AlignRight().Text($"${totalIncome:N2}")
                        .FontSize(11)
                        .Bold()
                        .FontColor(Colors.Green.Darken2);
                });
            });
        }

        private void CreateExpensesSection(IContainer container, List<TaxCategorySummaryDto> categorySummaries)
        {
            container.Column(column =>
            {
                column.Item().Text("Rental Expenses")
                    .FontSize(14)
                    .Bold()
                    .FontColor(Colors.Blue.Darken2);

                column.Item().Height(5);

                // Map categories to Schedule E line items
                var scheduleELines = MapToScheduleELines(categorySummaries);
                
                // Get all Schedule E line items (even if $0)
                var allScheduleELines = GetAllScheduleELineItems(scheduleELines);

                column.Item().Border(1).BorderColor(Colors.Grey.Lighten2).Padding(10).Column(innerColumn =>
                {
                    foreach (var line in allScheduleELines.OrderBy(l => l.LineNumber))
                    {
                        innerColumn.Item().PaddingBottom(5).Row(row =>
                        {
                            row.RelativeItem().Text($"{line.LineNumber}. {line.Description}")
                                .FontSize(10)
                                .FontColor(line.Amount == 0 ? Colors.Grey.Medium : Colors.Black);
                            row.ConstantItem(120).AlignRight().Text(line.Amount == 0 ? "-" : $"${line.Amount:N2}")
                                .FontSize(10)
                                .FontColor(line.Amount == 0 ? Colors.Grey.Medium : Colors.Black);
                        });
                    }
                });
            });
        }

        private void CreateSummarySection(IContainer container, decimal totalIncome, decimal totalExpenses, decimal netIncome)
        {
            container.Column(column =>
            {
                column.Item().Text("Summary")
                    .FontSize(14)
                    .Bold()
                    .FontColor(Colors.Blue.Darken2);

                column.Item().Height(5);

                column.Item().Border(1).BorderColor(Colors.Grey.Lighten2).Padding(10).Column(innerColumn =>
                {
                    innerColumn.Item().PaddingBottom(5).Row(row =>
                    {
                        row.RelativeItem().Text("Total Income")
                            .FontSize(11)
                            .Bold();
                        row.ConstantItem(120).AlignRight().Text($"${totalIncome:N2}")
                            .FontSize(11)
                            .Bold();
                    });

                    innerColumn.Item().PaddingBottom(5).Row(row =>
                    {
                        row.RelativeItem().Text("Total Expenses")
                            .FontSize(11)
                            .Bold();
                        row.ConstantItem(120).AlignRight().Text($"${totalExpenses:N2}")
                            .FontSize(11)
                            .Bold();
                    });

                    innerColumn.Item().BorderTop(1).BorderColor(Colors.Grey.Lighten1).PaddingTop(5).Row(row =>
                    {
                        row.RelativeItem().Text("Net Income (Loss)")
                            .FontSize(12)
                            .Bold();
                        row.ConstantItem(120).AlignRight().Text($"${netIncome:N2}")
                            .FontSize(12)
                            .Bold()
                            .FontColor(netIncome >= 0 ? Colors.Green.Darken2 : Colors.Red.Darken2);
                    });
                });
            });
        }

        private List<ScheduleELineItem> MapToScheduleELines(List<TaxCategorySummaryDto> categorySummaries)
        {
            var lines = new List<ScheduleELineItem>();

            foreach (var category in categorySummaries)
            {
                var lineItem = MapCategoryToScheduleELine(category);
                if (lineItem != null)
                {
                    // Check if line already exists and add to it
                    var existingLine = lines.FirstOrDefault(l => l.LineNumber == lineItem.LineNumber);
                    if (existingLine != null)
                    {
                        existingLine.Amount += lineItem.Amount;
                    }
                    else
                    {
                        lines.Add(lineItem);
                    }
                }
            }

            return lines;
        }

        private List<ScheduleELineItem> GetAllScheduleELineItems(List<ScheduleELineItem> existingLines)
        {
            // Define all Schedule E line items
            var allLines = new List<ScheduleELineItem>
            {
                new ScheduleELineItem { LineNumber = 1, Description = "Advertising", Amount = 0 },
                new ScheduleELineItem { LineNumber = 2, Description = "Auto and Travel", Amount = 0 },
                new ScheduleELineItem { LineNumber = 3, Description = "Cleaning and Maintenance", Amount = 0 },
                new ScheduleELineItem { LineNumber = 4, Description = "Commissions", Amount = 0 },
                new ScheduleELineItem { LineNumber = 5, Description = "Insurance", Amount = 0 },
                new ScheduleELineItem { LineNumber = 6, Description = "Legal and Professional Fees", Amount = 0 },
                new ScheduleELineItem { LineNumber = 7, Description = "Management Fees", Amount = 0 },
                new ScheduleELineItem { LineNumber = 8, Description = "Mortgage Interest", Amount = 0 },
                new ScheduleELineItem { LineNumber = 9, Description = "Other Interest", Amount = 0 },
                new ScheduleELineItem { LineNumber = 10, Description = "Repairs", Amount = 0 },
                new ScheduleELineItem { LineNumber = 11, Description = "Supplies", Amount = 0 },
                new ScheduleELineItem { LineNumber = 12, Description = "Taxes", Amount = 0 },
                new ScheduleELineItem { LineNumber = 13, Description = "Utilities", Amount = 0 },
                new ScheduleELineItem { LineNumber = 14, Description = "Depreciation", Amount = 0 },
                new ScheduleELineItem { LineNumber = 15, Description = "Other Expenses", Amount = 0 }
            };

            // Merge existing amounts
            foreach (var existingLine in existingLines)
            {
                var line = allLines.FirstOrDefault(l => l.LineNumber == existingLine.LineNumber);
                if (line != null)
                {
                    line.Amount = existingLine.Amount;
                }
            }

            return allLines;
        }

        private ScheduleELineItem? MapCategoryToScheduleELine(TaxCategorySummaryDto category)
        {
            return category.TaxCategory switch
            {
                ETaxCategory.Advertising or ETaxCategory.Marketing => new ScheduleELineItem { LineNumber = 1, Description = "Advertising", Amount = category.TotalAmount },
                ETaxCategory.Travel or ETaxCategory.Transportation or ETaxCategory.VehicleExpenses => new ScheduleELineItem { LineNumber = 2, Description = "Auto and Travel", Amount = category.TotalAmount },
                ETaxCategory.Cleaning or ETaxCategory.Maintenance or ETaxCategory.Landscaping => new ScheduleELineItem { LineNumber = 3, Description = "Cleaning and Maintenance", Amount = category.TotalAmount },
                // Commissions (Line 4) - typically from broker/agent fees
                ETaxCategory.Insurance or ETaxCategory.LiabilityInsurance or ETaxCategory.PropertyInsurance => new ScheduleELineItem { LineNumber = 5, Description = "Insurance", Amount = category.TotalAmount },
                ETaxCategory.LegalFees or ETaxCategory.AccountingFees or ETaxCategory.ProfessionalServices => new ScheduleELineItem { LineNumber = 6, Description = "Legal and Professional Fees", Amount = category.TotalAmount },
                ETaxCategory.PropertyManagement => new ScheduleELineItem { LineNumber = 7, Description = "Management Fees", Amount = category.TotalAmount },
                ETaxCategory.MortgageInterest => new ScheduleELineItem { LineNumber = 8, Description = "Mortgage Interest", Amount = category.TotalAmount },
                ETaxCategory.Interest => new ScheduleELineItem { LineNumber = 9, Description = "Other Interest", Amount = category.TotalAmount },
                ETaxCategory.Repairs => new ScheduleELineItem { LineNumber = 10, Description = "Repairs", Amount = category.TotalAmount },
                ETaxCategory.Supplies or ETaxCategory.OfficeExpenses => new ScheduleELineItem { LineNumber = 11, Description = "Supplies", Amount = category.TotalAmount },
                ETaxCategory.PropertyTaxes or ETaxCategory.LocalTaxes or ETaxCategory.StateTaxes => new ScheduleELineItem { LineNumber = 12, Description = "Taxes", Amount = category.TotalAmount },
                ETaxCategory.Utilities or ETaxCategory.Water or ETaxCategory.Sewer or ETaxCategory.Garbage or ETaxCategory.Internet or ETaxCategory.Phone => new ScheduleELineItem { LineNumber = 13, Description = "Utilities", Amount = category.TotalAmount },
                ETaxCategory.Depreciation => new ScheduleELineItem { LineNumber = 14, Description = "Depreciation", Amount = category.TotalAmount },
                ETaxCategory.Other or ETaxCategory.BankFees or ETaxCategory.ContractLabor or ETaxCategory.Services => new ScheduleELineItem { LineNumber = 15, Description = "Other Expenses", Amount = category.TotalAmount },
                _ => new ScheduleELineItem { LineNumber = 15, Description = category.CategoryName, Amount = category.TotalAmount }
            };
        }

        private static string GetTaxCategoryName(ETaxCategory category)
        {
            return category switch
            {
                ETaxCategory.Repairs => "Repairs",
                ETaxCategory.Maintenance => "Maintenance",
                ETaxCategory.Cleaning => "Cleaning",
                ETaxCategory.Landscaping => "Landscaping",
                ETaxCategory.Utilities => "Utilities",
                ETaxCategory.Water => "Water",
                ETaxCategory.Sewer => "Sewer",
                ETaxCategory.Garbage => "Garbage",
                ETaxCategory.Internet => "Internet",
                ETaxCategory.Phone => "Phone",
                ETaxCategory.Insurance => "Insurance",
                ETaxCategory.LiabilityInsurance => "Liability Insurance",
                ETaxCategory.PropertyInsurance => "Property Insurance",
                ETaxCategory.PropertyTaxes => "Property Taxes",
                ETaxCategory.LocalTaxes => "Local Taxes",
                ETaxCategory.StateTaxes => "State Taxes",
                ETaxCategory.PropertyManagement => "Property Management",
                ETaxCategory.LegalFees => "Legal Fees",
                ETaxCategory.AccountingFees => "Accounting Fees",
                ETaxCategory.ProfessionalServices => "Professional Services",
                ETaxCategory.Advertising => "Advertising",
                ETaxCategory.Marketing => "Marketing",
                ETaxCategory.Travel => "Travel",
                ETaxCategory.Transportation => "Transportation",
                ETaxCategory.VehicleExpenses => "Vehicle Expenses",
                ETaxCategory.Depreciation => "Depreciation",
                ETaxCategory.Improvements => "Improvements",
                ETaxCategory.Other => "Other",
                ETaxCategory.Supplies => "Supplies",
                ETaxCategory.OfficeExpenses => "Office Expenses",
                ETaxCategory.BankFees => "Bank Fees",
                ETaxCategory.Interest => "Interest",
                ETaxCategory.MortgageInterest => "Mortgage Interest",
                ETaxCategory.ContractLabor => "Contract Labor",
                ETaxCategory.Services => "Services",
                _ => "Uncategorized"
            };
        }

        private static bool IsCategoryFullyDeductible(ETaxCategory category)
        {
            return category != ETaxCategory.Depreciation && category != ETaxCategory.Improvements;
        }

        private class ScheduleELineItem
        {
            public int LineNumber { get; set; }
            public string Description { get; set; } = string.Empty;
            public decimal Amount { get; set; }
        }
    }
}
