using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using brownstone_hub_api.Dtos.Lease;
using brownstone_hub_api.Dtos.LeaseGeneration;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.OpenAIService;
using AutoMapper;
using Microsoft.AspNetCore.Http;
using brownstone_hub_api.Repositories.LeaseInstances;
using DocumentFormat.OpenXml.Packaging;
using WordDoc = DocumentFormat.OpenXml.Wordprocessing.Document;
using WordBody = DocumentFormat.OpenXml.Wordprocessing.Body;
using WordParagraph = DocumentFormat.OpenXml.Wordprocessing.Paragraph;
using WordRun = DocumentFormat.OpenXml.Wordprocessing.Run;
using WordRunProperties = DocumentFormat.OpenXml.Wordprocessing.RunProperties;
using WordBold = DocumentFormat.OpenXml.Wordprocessing.Bold;
using WordFontSize = DocumentFormat.OpenXml.Wordprocessing.FontSize;
using WordText = DocumentFormat.OpenXml.Wordprocessing.Text;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using QuestPdfUnit = QuestPDF.Infrastructure.Unit;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace brownstone_hub_api.Services.LeaseDocumentService
{
    public class LeaseDocumentService : ILeaseDocumentService
    {
        private readonly ILeaseInstanceRepository _leaseInstanceRepository;
        private readonly BlobServiceClient _blobServiceClient;
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly IOpenAIService _openAIService;
        private readonly ILogger<LeaseDocumentService> _logger;
        private const string ContainerName = "lease-documents";

        public LeaseDocumentService(
            ILeaseInstanceRepository leaseInstanceRepository,
            BlobServiceClient blobServiceClient,
            IHttpContextAccessor httpContextAccessor,
            IOpenAIService openAIService,
            ILogger<LeaseDocumentService> logger)
        {
            _leaseInstanceRepository = leaseInstanceRepository;
            _blobServiceClient = blobServiceClient;
            _httpContextAccessor = httpContextAccessor;
            _openAIService = openAIService;
            _logger = logger;
        }

        private long? GetUserIdFromContext()
        {
            // First try to get from HTTP context Items (set by OrganizationContextMiddleware)
            if (_httpContextAccessor.HttpContext?.Items.TryGetValue("UserId", out var userIdObj) == true && userIdObj is long userId)
            {
                return userId;
            }
            
            // Fallback to claims
            var userIdClaim = _httpContextAccessor.HttpContext?.User?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                ?? _httpContextAccessor.HttpContext?.User?.FindFirst("userId")?.Value
                ?? _httpContextAccessor.HttpContext?.User?.FindFirst("sub")?.Value;
            
            if (!string.IsNullOrEmpty(userIdClaim) && long.TryParse(userIdClaim, out var parsedUserId))
            {
                return parsedUserId;
            }
            
            return null;
        }

        public async Task<ServiceResponse<byte[]>> GeneratePdfAsync(long leaseInstanceId)
        {
            try
            {
                QuestPDF.Settings.License = LicenseType.Community;

                var instance = await _leaseInstanceRepository.GetLeaseInstanceByIdAsync(leaseInstanceId);
                if (instance == null)
                {
                    return ServiceResponse<byte[]>.CreateError("Instance not found", "The specified lease instance does not exist.");
                }

                var template = instance.LeaseTemplate;
                var lease = instance.Lease;
                var variables = instance.Variables.ToDictionary(v => v.VariableKey, v => v.VariableValue);

                // Build document content from template structure
                var documentContent = BuildDocumentContent(template.TemplateStructure, variables, instance);
                var documentTitle = BuildLeaseAgreementTitle(variables.GetValueOrDefault("Property.State", string.Empty));

                var pdfBytes = QuestPDF.Fluent.Document.Create(container =>
                {
                    container.Page(page =>
                    {
                        page.Size(PageSizes.A4);
                        page.MarginHorizontal(1.65f, QuestPdfUnit.Centimetre);
                        page.MarginVertical(1.35f, QuestPdfUnit.Centimetre);
                        page.PageColor(Colors.White);
                        page.DefaultTextStyle(x => x.FontSize(9.5f).FontColor(Colors.Black));

                        page.Header().Element(c => CreateLeaseHeader(c, documentTitle, false));

                        page.Content()
                            .PaddingTop(12)
                            .Column(column =>
                            {
                                column.Item().Element(c => CreateAgreementPreamble(c, variables));
                                column.Item().Height(12);

                                var sectionNumber = 1;
                                foreach (var section in documentContent.Sections.Where(s => s.Enabled))
                                {
                                    column.Item().Element(container => CreateSection(container, section.Title, section.Content, sectionNumber));
                                    column.Item().Height(8);
                                    sectionNumber++;
                                }

                                column.Item().PaddingTop(14).Element(container => CreateSignatureSection(container, lease));
                            });

                        page.Footer().Element(CreateLeaseFooter);
                    });
                })
                .GeneratePdf();

                return ServiceResponse<byte[]>.CreateSuccess(pdfBytes);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating PDF for lease instance {InstanceId}", leaseInstanceId);
                return ServiceResponse<byte[]>.CreateError("Error generating PDF", ex.Message);
            }
        }

        public async Task<ServiceResponse<byte[]>> GeneratePreviewPdfFromLeaseAsync(LoadLeaseDto lease)
        {
            try
            {
                QuestPDF.Settings.License = LicenseType.Community;

                // Use AI to generate professional lease sections when available; otherwise use static content
                var sections = await GetAIPreviewSectionsAsync(lease) ?? BuildPreviewSectionsFromLease(lease);
                var documentTitle = BuildLeaseAgreementTitle(null);

                var pdfBytes = QuestPDF.Fluent.Document.Create(container =>
                {
                    container.Page(page =>
                    {
                        page.Size(PageSizes.A4);
                        page.MarginHorizontal(1.65f, QuestPdfUnit.Centimetre);
                        page.MarginVertical(1.35f, QuestPdfUnit.Centimetre);
                        page.PageColor(Colors.White);
                        page.DefaultTextStyle(x => x.FontSize(9.5f).FontColor(Colors.Black));

                        page.Header().Element(c => CreateLeaseHeader(c, documentTitle, true));

                        page.Content()
                            .PaddingTop(12)
                            .Column(column =>
                            {
                                column.Item().Element(c => CreatePreviewAgreementPreamble(c, lease));
                                column.Item().Height(12);

                                var sectionNumber = 1;
                                foreach (var section in sections.Where(s => s.Enabled))
                                {
                                    column.Item().Element(c => CreateSection(c, section.Title, section.Content, sectionNumber));
                                    column.Item().Height(8);
                                    sectionNumber++;
                                }
                                column.Item().PaddingTop(14).Element(CreateSignatureBlock);
                            });

                        page.Footer().Element(CreateLeaseFooter);
                    });
                })
                .GeneratePdf();

                return ServiceResponse<byte[]>.CreateSuccess(pdfBytes);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating preview PDF for lease {LeaseId}", lease.Id);
                return ServiceResponse<byte[]>.CreateError("Error generating preview PDF", ex.Message);
            }
        }

        /// <summary>
        /// Calls AI to generate professional lease section content from lease data. Returns null if AI is unavailable or fails.
        /// </summary>
        private async Task<List<DocumentSection>?> GetAIPreviewSectionsAsync(LoadLeaseDto lease)
        {
            try
            {
                var dataSummary = BuildLeaseDataSummary(lease);
                var prompt = GetLeasePreviewPrompt(dataSummary);
                var response = await _openAIService.GenerateJsonAsync<AiLeasePreviewResponse>(prompt, maxTokens: 4000);
                if (!response.Success || response.Data?.Sections == null || !response.Data.Sections.Any())
                {
                    _logger.LogDebug("AI lease preview not used: {Reason}", response.Success ? "no sections" : response.Message);
                    return null;
                }
                return response.Data.Sections
                    .Where(s => !string.IsNullOrWhiteSpace(s.Title) && !string.IsNullOrWhiteSpace(s.Content))
                    .Select(s => new DocumentSection { Title = s.Title.Trim(), Content = s.Content.Trim(), Enabled = true })
                    .ToList();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "AI lease preview failed for lease {LeaseId}, using static content", lease.Id);
                return null;
            }
        }

        private static string BuildLeaseDataSummary(LoadLeaseDto lease)
        {
            var sb = new StringBuilder();
            var landlord = !string.IsNullOrWhiteSpace(lease.LandlordName) ? lease.LandlordName : "Landlord";
            var tenants = lease.Tenants?.Any() == true
                ? string.Join(", ", lease.Tenants.Select(t => $"{t.Firstname} {t.Lastname}".Trim()).Where(n => !string.IsNullOrEmpty(n)))
                : (lease.AddTenantsLater ? "To be added" : "Tenant(s)");
            sb.AppendLine($"Landlord: {landlord}");
            sb.AppendLine($"Tenant(s): {tenants}");
            sb.AppendLine($"Property: {lease.PropertyName ?? "N/A"}, Unit: {lease.UnitName ?? "N/A"}");
            sb.AppendLine($"Term: {lease.StartDate?.ToString("MM/dd/yyyy") ?? "N/A"} to {lease.EndDate?.ToString("MM/dd/yyyy") ?? "N/A"}");
            sb.AppendLine($"Rent: {(lease.RentAmount.HasValue ? lease.RentAmount.Value.ToString("C") : "N/A")} {lease.RentFrequency ?? "monthly"}, due on day {lease.RentDueDay ?? 1}");
            sb.AppendLine($"Security deposit: {(lease.DepositAmount.HasValue ? lease.DepositAmount.Value.ToString("C") : "N/A")}");
            if (lease.IsProratedRent == true) sb.AppendLine("Prorated rent applies at move-in.");
            if (lease.Fees != null && lease.Fees.Any())
                sb.AppendLine("Fees: " + string.Join("; ", lease.Fees.Select(f => $"{f.Name} {f.Amount:C}")));
            if (lease.UtilityServiceResponsibilities != null && lease.UtilityServiceResponsibilities.Any())
                sb.AppendLine("Utilities: " + string.Join("; ", lease.UtilityServiceResponsibilities.Select(u => $"{u.Name} ({u.Responsibility})")));
            if (lease.MaintenanceResponsibilities != null && lease.MaintenanceResponsibilities.Any())
                sb.AppendLine("Maintenance: " + string.Join("; ", lease.MaintenanceResponsibilities.Select(m => $"{m.Name} ({m.Responsibility})")));
            if (lease.LeaseKeys != null && lease.LeaseKeys.Any())
                sb.AppendLine("Keys: " + string.Join("; ", lease.LeaseKeys.Select(k => $"{k.KeyType} {k.Copies}")));
            sb.AppendLine($"Pets allowed: {lease.PetsAllowed == true}");
            if (lease.PetsAllowed == true && lease.Pets != null && lease.Pets.Any())
                sb.AppendLine("Pets: " + string.Join("; ", lease.Pets.Select(p => $"{p.Type} {p.Breed} {p.Weight}lbs")));
            if (lease.Parking != null && lease.Parking.IncludeParkingRules)
                sb.AppendLine($"Parking: {lease.Parking.ParkingTypes ?? "N/A"} | {lease.Parking.CustomRules ?? ""}");
            sb.AppendLine($"Smoking: {lease.SmokingAllowed ?? "no"}");
            if (lease.IncludeEarlyTerminationClause == true && !string.IsNullOrWhiteSpace(lease.EarlyTerminationClauseText))
                sb.AppendLine($"Early termination: {lease.EarlyTerminationClauseText}");
            if (!string.IsNullOrWhiteSpace(lease.AdditionalTerms))
                sb.AppendLine($"Additional terms: {lease.AdditionalTerms}");
            if (lease.BuiltBefore1978 == true)
            {
                sb.AppendLine("Built before 1978 (lead-based paint disclosure applies).");
                if (lease.AwareOfLeadPaint == true && !string.IsNullOrWhiteSpace(lease.LeadPaintExplanation))
                    sb.AppendLine($"Lead paint awareness: {lease.LeadPaintExplanation}");
                if (lease.HasLeadPaintRecords == true && !string.IsNullOrWhiteSpace(lease.LeadPaintRecordsExplanation))
                    sb.AppendLine($"Lead paint records: {lease.LeadPaintRecordsExplanation}");
            }
            return sb.ToString();
        }

        private static string GetLeasePreviewPrompt(string leaseDataSummary)
        {
            return $@"You are an expert in residential lease agreements. Using ONLY the following lease data, write a complete, professional residential lease agreement.

Lease data:
{leaseDataSummary}

Requirements:
- Output valid JSON only, with a single root object that has a property ""Sections"" which is an array of objects.
- Each object in Sections must have ""Title"" (string) and ""Content"" (string).
- Include these sections in order when the data supports them: Parties, Property and Unit, Term, Rent and Deposit, Lease Fees (if any), Utilities and Services (if any), Maintenance (if any), Keys (if any), Pets (if applicable), Parking (if applicable), Smoking, Early Termination (if applicable), Additional Terms (if any), Lead-Based Paint Disclosure (if built before 1978).
- Write in formal legal style, clear and professional. Each section's Content should be one or more full paragraphs suitable for a lease document.
- Use only the facts provided; do not invent terms or parties.
- Omit sections that have no applicable data (e.g. no pets means omit Pets section, or state briefly that no pets are allowed if that was specified).

Respond with JSON in this exact shape: {{ ""Sections"": [ {{ ""Title"": ""Parties"", ""Content"": ""..."" }}, ... ] }}";
        }

        private static void CreateFirstPageSummaryContent(IContainer container, LoadLeaseDto lease)
        {
            var landlordName = !string.IsNullOrWhiteSpace(lease.LandlordName) ? lease.LandlordName : "Landlord";
            var tenantNames = lease.Tenants?.Any() == true
                ? string.Join(", ", lease.Tenants.Select(t => $"{t.Firstname} {t.Lastname}".Trim()).Where(n => !string.IsNullOrEmpty(n)))
                : (lease.AddTenantsLater ? "To be added" : "Tenant(s)");
            if (string.IsNullOrWhiteSpace(tenantNames)) tenantNames = "Tenant(s)";
            var agreementDate = lease.StartDate?.ToString("MM/dd/yyyy") ?? DateTime.Now.ToString("MM/dd/yyyy");

            var totalDeposit = (lease.DepositAmount ?? 0) + (lease.PetDepositAmount ?? 0);
            if (lease.LeaseDeposits != null && lease.LeaseDeposits.Any())
                totalDeposit += lease.LeaseDeposits.Sum(d => d.Amount);
            var otherDeposit = lease.LeaseDeposits != null && lease.LeaseDeposits.Any()
                ? lease.LeaseDeposits.Sum(d => d.Amount).ToString("C")
                : "N/A";
            var moveInFee = lease.Fees?.FirstOrDefault(f => f.Name?.Contains("Move-in", StringComparison.OrdinalIgnoreCase) == true
                || f.Name?.Contains("Application", StringComparison.OrdinalIgnoreCase) == true);
            var lateFee = lease.Fees?.FirstOrDefault(f => f.Name?.Contains("Late", StringComparison.OrdinalIgnoreCase) == true);
            var monthlyPetRent = lease.Fees?.FirstOrDefault(f => f.Name?.Contains("Pet", StringComparison.OrdinalIgnoreCase) == true);

            var propertyAddress = string.IsNullOrWhiteSpace(lease.PropertyName) && string.IsNullOrWhiteSpace(lease.UnitName)
                ? "N/A"
                : $"{lease.PropertyName ?? ""}, {lease.UnitName ?? ""}".Trim(',', ' ').Replace("  ", " ");

            var summaryRows = new List<(string Label, string Value)>
            {
                ("Property Address:", propertyAddress),
                ("Lease Start Date:", lease.StartDate?.ToString("M/d/yyyy") ?? "N/A"),
                ("Lease End Date:", lease.EndDate?.ToString("M/d/yyyy") ?? "N/A"),
                ("Total Monthly Rent:", lease.RentAmount.HasValue ? lease.RentAmount.Value.ToString("C") : "N/A"),
                ("Monthly Rent Amount:", lease.RentAmount.HasValue ? lease.RentAmount.Value.ToString("C") : "N/A"),
                ("Monthly Pet Rent:", monthlyPetRent != null ? monthlyPetRent.Amount.ToString("C") : "N/A"),
                ("Pro-Rated Rent Amount:", lease.IsProratedRent == true ? (lease.RentAmount?.ToString("C") ?? "N/A") : "N/A"),
                ("Total Deposit(s):", totalDeposit > 0 ? totalDeposit.ToString("C") : "N/A"),
                ("Security Deposit:", lease.DepositAmount.HasValue ? lease.DepositAmount.Value.ToString("C") : "N/A"),
                ("Pet Deposit:", lease.PetDepositAmount.HasValue ? lease.PetDepositAmount.Value.ToString("C") : "N/A"),
                ("Other Deposit:", otherDeposit),
                ("Move-in Fee Amount:", moveInFee != null ? moveInFee.Amount.ToString("C") : "N/A"),
                ("Late Fee:", lateFee != null ? lateFee.Amount.ToString("C") : (lease.OverdueAmount.HasValue ? lease.OverdueAmount.Value.ToString("C") : "N/A"))
            };

            container.Column(column =>
            {
                column.Item().PaddingBottom(12).Text("Rental Agreement between:")
                    .FontSize(11);
                column.Item().PaddingBottom(4).Row(row =>
                {
                    row.RelativeItem().Text(landlordName).Bold();
                });
                column.Item().PaddingBottom(2).Row(row =>
                {
                    row.RelativeItem();
                    row.AutoItem().Text("and").FontSize(11);
                    row.RelativeItem();
                });
                column.Item().PaddingBottom(4).Row(row =>
                {
                    row.RelativeItem().Text(tenantNames).Bold();
                });
                column.Item().PaddingBottom(16).Text(text =>
                {
                    text.DefaultTextStyle(x => x.FontSize(11));
                    text.Span("Dated: ");
                    text.Span(agreementDate);
                });

                column.Item().PaddingBottom(10).Text("Summary of Key Information")
                    .FontSize(14)
                    .Bold()
                    .FontColor(Colors.Blue.Darken2);

                foreach (var (label, value) in summaryRows)
                {
                    column.Item().PaddingBottom(4).Row(row =>
                    {
                        row.RelativeItem().Text(label).FontSize(10);
                        row.RelativeItem().Row(r =>
                        {
                            r.RelativeItem();
                            r.AutoItem().Text(value).FontSize(10);
                        });
                    });
                }
            });
        }

        private static List<DocumentSection> BuildPreviewSectionsFromLease(LoadLeaseDto lease)
        {
            var sections = new List<DocumentSection>();

            var landlordName = !string.IsNullOrWhiteSpace(lease.LandlordName) ? lease.LandlordName : "Landlord";
            var tenantNames = lease.Tenants?.Any() == true
                ? string.Join(", ", lease.Tenants.Select(t => $"{t.Firstname} {t.Lastname}".Trim()).Where(n => !string.IsNullOrEmpty(n)))
                : (lease.AddTenantsLater ? "To be added" : "Tenant(s)");
            if (string.IsNullOrWhiteSpace(tenantNames)) tenantNames = "Tenant(s)";

            sections.Add(new DocumentSection
            {
                Title = "Parties",
                Content = $"This lease agreement is entered into between {landlordName} (Landlord) and {tenantNames} (Tenant(s)).",
                Enabled = true
            });

            var propertyUnit = $"Property: {lease.PropertyName ?? "N/A"}, Unit: {lease.UnitName ?? "N/A"}.";
            sections.Add(new DocumentSection
            {
                Title = "Property & Unit",
                Content = propertyUnit,
                Enabled = true
            });

            var startStr = lease.StartDate?.ToString("MM/dd/yyyy") ?? "N/A";
            var endStr = lease.EndDate?.ToString("MM/dd/yyyy") ?? "N/A";
            sections.Add(new DocumentSection
            {
                Title = "Term",
                Content = $"The term of this lease shall commence on {startStr} and end on {endStr}.",
                Enabled = true
            });

            var rentStr = lease.RentAmount.HasValue ? lease.RentAmount.Value.ToString("C") : "N/A";
            var dueDay = lease.RentDueDay ?? 1;
            var freq = !string.IsNullOrWhiteSpace(lease.RentFrequency) ? lease.RentFrequency : "Monthly";
            var depositStr = lease.DepositAmount.HasValue ? lease.DepositAmount.Value.ToString("C") : "N/A";
            var rentDeposit = $"Tenant agrees to pay Landlord {freq.ToLower()} rent in the amount of {rentStr}, due on the {dueDay} day of each month. Security deposit: {depositStr}.";
            if (lease.IsProratedRent == true)
                rentDeposit += " Prorated rent may apply at move-in.";
            sections.Add(new DocumentSection
            {
                Title = "Rent & Deposit",
                Content = rentDeposit,
                Enabled = true
            });

            if (lease.Fees != null && lease.Fees.Any())
            {
                var feeLines = lease.Fees.Select(f => $"{f.Name}: {f.Amount:C}").ToList();
                sections.Add(new DocumentSection
                {
                    Title = "Lease Fees",
                    Content = string.Join("\n", feeLines),
                    Enabled = true
                });
            }

            if (lease.UtilityServiceResponsibilities != null && lease.UtilityServiceResponsibilities.Any())
            {
                var utilLines = lease.UtilityServiceResponsibilities.Select(u => $"{u.Name}: {u.Responsibility}").ToList();
                var utilContent = "Utilities and services responsibility:\n" + string.Join("\n", utilLines);
                if (lease.HasSharedUtilities == true && !string.IsNullOrWhiteSpace(lease.SharedUtilitiesDisclosure))
                    utilContent += "\n\nShared utilities: " + lease.SharedUtilitiesDisclosure;
                sections.Add(new DocumentSection
                {
                    Title = "Utilities & Services",
                    Content = utilContent,
                    Enabled = true
                });
            }

            if (lease.MaintenanceResponsibilities != null && lease.MaintenanceResponsibilities.Any())
            {
                var maintLines = lease.MaintenanceResponsibilities.Select(m => $"{m.Name}: {m.Responsibility}").ToList();
                var maintContent = string.Join("\n", maintLines);
                if (!string.IsNullOrWhiteSpace(lease.MaintenanceNotificationMethods))
                {
                    try
                    {
                        var methods = JsonSerializer.Deserialize<List<string>>(lease.MaintenanceNotificationMethods);
                        if (methods?.Any() == true)
                            maintContent += "\n\nTenant shall report maintenance requests via: " + string.Join(", ", methods);
                    }
                    catch { /* ignore */ }
                }
                sections.Add(new DocumentSection
                {
                    Title = "Maintenance",
                    Content = maintContent,
                    Enabled = true
                });
            }

            if (lease.LeaseKeys != null && lease.LeaseKeys.Any())
            {
                var keyLines = lease.LeaseKeys.Select(k => $"{k.KeyType}: {k.Copies} copy(ies)").ToList();
                sections.Add(new DocumentSection
                {
                    Title = "Keys",
                    Content = "Keys to be provided to Tenant(s):\n" + string.Join("\n", keyLines) + "\n\nTenant(s) must return all keys at lease end.",
                    Enabled = true
                });
            }

            var petsAllowed = lease.PetsAllowed == true;
            if (petsAllowed && lease.Pets != null && lease.Pets.Any())
            {
                var petLines = lease.Pets.Select(p =>
                {
                    var parts = new List<string> { p.Type ?? "Pet" };
                    if (!string.IsNullOrWhiteSpace(p.Breed)) parts.Add(p.Breed);
                    if (p.Weight.HasValue) parts.Add($"{p.Weight} lbs");
                    if (p.Age.HasValue) parts.Add($"Age {p.Age}");
                    return string.Join(", ", parts);
                }).ToList();
                sections.Add(new DocumentSection
                {
                    Title = "Pets",
                    Content = "Pets allowed. Details:\n" + string.Join("\n", petLines),
                    Enabled = true
                });
            }
            else if (petsAllowed)
            {
                sections.Add(new DocumentSection { Title = "Pets", Content = "Pets allowed. Details to be specified.", Enabled = true });
            }

            if (lease.Parking != null && lease.Parking.IncludeParkingRules)
            {
                var parkingContent = "";
                if (!string.IsNullOrWhiteSpace(lease.Parking.ParkingTypes))
                {
                    try
                    {
                        var types = JsonSerializer.Deserialize<List<string>>(lease.Parking.ParkingTypes);
                        if (types?.Any() == true)
                            parkingContent = "Parking types: " + string.Join(", ", types) + ".\n\n";
                    }
                    catch { /* ignore */ }
                }
                if (!string.IsNullOrWhiteSpace(lease.Parking.CustomRules))
                    parkingContent += lease.Parking.CustomRules;
                if (string.IsNullOrWhiteSpace(parkingContent)) parkingContent = "Parking rules apply as specified.";
                sections.Add(new DocumentSection { Title = "Parking", Content = parkingContent, Enabled = true });
            }

            var smoking = lease.SmokingAllowed?.ToLowerInvariant() ?? "no";
            var smokingText = smoking == "yes" ? "Smoking is permitted." : (smoking == "outsideonly" ? "Smoking permitted outside only." : "No smoking is permitted on the premises.");
            sections.Add(new DocumentSection { Title = "Smoking", Content = smokingText, Enabled = true });

            if (lease.IncludeEarlyTerminationClause == true && !string.IsNullOrWhiteSpace(lease.EarlyTerminationClauseText))
            {
                sections.Add(new DocumentSection
                {
                    Title = "Early Termination",
                    Content = lease.EarlyTerminationClauseText,
                    Enabled = true
                });
            }

            if (!string.IsNullOrWhiteSpace(lease.AdditionalTerms))
            {
                sections.Add(new DocumentSection
                {
                    Title = "Additional Terms",
                    Content = lease.AdditionalTerms,
                    Enabled = true
                });
            }

            if (lease.BuiltBefore1978 == true)
            {
                var leadContent = "This property was built prior to January 1, 1978. The federal pamphlet \"Protect Your Family From Lead In Your Home\" will be provided to Tenant(s).";
                if (lease.AwareOfLeadPaint == true && !string.IsNullOrWhiteSpace(lease.LeadPaintExplanation))
                    leadContent += "\n\nLandlord is aware of lead-based paint and/or hazards. Explanation: " + lease.LeadPaintExplanation;
                if (lease.HasLeadPaintRecords == true && !string.IsNullOrWhiteSpace(lease.LeadPaintRecordsExplanation))
                    leadContent += "\n\nRecords/reports regarding lead-based paint: " + lease.LeadPaintRecordsExplanation;
                sections.Add(new DocumentSection { Title = "Lead-Based Paint Disclosure", Content = leadContent, Enabled = true });
            }

            return sections;
        }

        private static void CreateSignatureBlock(IContainer container)
        {
            container.Column(column =>
            {
                column.Item().Text("SIGNATURES")
                    .FontSize(11)
                    .Bold()
                    .FontColor(Colors.Black);
                column.Item().Height(12);
                column.Item().Row(row =>
                {
                    row.RelativeItem().Column(sig =>
                    {
                        sig.Item().Text("Landlord Signature").FontSize(8).Bold();
                        sig.Item().PaddingTop(18).BorderBottom(0.75f).BorderColor(Colors.Black).Text(" ");
                        sig.Item().PaddingTop(3).Text("Date: __________________").FontSize(8.5f);
                    });
                    row.ConstantItem(28);
                    row.RelativeItem().Column(sig =>
                    {
                        sig.Item().Text("Tenant Signature").FontSize(8).Bold();
                        sig.Item().PaddingTop(18).BorderBottom(0.75f).BorderColor(Colors.Black).Text(" ");
                        sig.Item().PaddingTop(3).Text("Date: __________________").FontSize(8.5f);
                    });
                });
            });
        }

        public async Task<ServiceResponse<byte[]>> GenerateDocxAsync(long leaseInstanceId)
        {
            try
            {
                var instance = await _leaseInstanceRepository.GetLeaseInstanceByIdAsync(leaseInstanceId);
                if (instance == null)
                {
                    return ServiceResponse<byte[]>.CreateError("Instance not found", "The specified lease instance does not exist.");
                }

                var template = instance.LeaseTemplate;
                var lease = instance.Lease;
                var variables = instance.Variables.ToDictionary(v => v.VariableKey, v => v.VariableValue);

                // Build document content
                var documentContent = BuildDocumentContent(template.TemplateStructure, variables, instance);

                using var stream = new MemoryStream();
                using (var wordDocument = WordprocessingDocument.Create(stream, DocumentFormat.OpenXml.WordprocessingDocumentType.Document))
                {
                    var mainPart = wordDocument.AddMainDocumentPart();
                    mainPart.Document = new WordDoc();
                    var body = mainPart.Document.AppendChild(new WordBody());

                    // Title
                    var titlePara = body.AppendChild(new WordParagraph());
                    var titleRun = titlePara.AppendChild(new WordRun());
                    titleRun.AppendChild(new WordRunProperties(new WordBold()));
                    titleRun.AppendChild(new WordText("RESIDENTIAL LEASE AGREEMENT") { Space = DocumentFormat.OpenXml.SpaceProcessingModeValues.Preserve });

                    // Sections
                    foreach (var section in documentContent.Sections)
                    {
                        if (section.Enabled)
                        {
                            // Section heading
                            var headingPara = body.AppendChild(new WordParagraph());
                            var headingRun = headingPara.AppendChild(new WordRun());
                            headingRun.AppendChild(new WordRunProperties(new WordBold(), new WordFontSize { Val = "14" }));
                            headingRun.AppendChild(new WordText(section.Title) { Space = DocumentFormat.OpenXml.SpaceProcessingModeValues.Preserve });

                            // Section content
                            var contentPara = body.AppendChild(new WordParagraph());
                            var contentRun = contentPara.AppendChild(new WordRun());
                            contentRun.AppendChild(new WordText(section.Content) { Space = DocumentFormat.OpenXml.SpaceProcessingModeValues.Preserve });

                            // Spacing
                            body.AppendChild(new WordParagraph());
                        }
                    }

                    // Signature section
                    var sigPara = body.AppendChild(new WordParagraph());
                    sigPara.AppendChild(new WordRun(new WordText("LANDLORD SIGNATURE: _________________________ Date: ________")));
                    body.AppendChild(new WordParagraph());
                    var tenantSigPara = body.AppendChild(new WordParagraph());
                    tenantSigPara.AppendChild(new WordRun(new WordText("TENANT SIGNATURE(S): _________________________ Date: ________")));
                }

                stream.Position = 0;
                return ServiceResponse<byte[]>.CreateSuccess(stream.ToArray());
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating DOCX for lease instance {InstanceId}", leaseInstanceId);
                return ServiceResponse<byte[]>.CreateError("Error generating DOCX", ex.Message);
            }
        }

        private DocumentContent BuildDocumentContent(string templateStructure, Dictionary<string, string> variables, LeaseInstance instance)
        {
            var content = new DocumentContent();

            try
            {
                var template = JsonSerializer.Deserialize<JsonElement>(templateStructure);
                
                if (template.TryGetProperty("sections", out var sectionsElement))
                {
                    foreach (var sectionElement in sectionsElement.EnumerateArray())
                    {
                        var sectionName = sectionElement.GetProperty("sectionName").GetString() ?? "";
                        var enabled = sectionElement.TryGetProperty("enabled", out var enabledProp) && enabledProp.GetBoolean();

                        var sectionContent = new StringBuilder();
                        
                        // Replace placeholders in section content
                        if (sectionElement.TryGetProperty("content", out var contentProp))
                        {
                            var rawContent = contentProp.GetString() ?? "";
                            sectionContent.Append(ReplacePlaceholders(rawContent, variables));
                        }
                        else
                        {
                            // Generate default content based on section name
                            sectionContent.Append(GenerateDefaultSectionContent(sectionName, variables, instance));
                        }

                        content.Sections.Add(new DocumentSection
                        {
                            Title = sectionName,
                            Content = sectionContent.ToString(),
                            Enabled = enabled
                        });
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error building document content from template");
                // Fallback to basic content
                content.Sections.Add(new DocumentSection
                {
                    Title = "Lease Agreement",
                    Content = "This lease agreement is between the parties listed above.",
                    Enabled = true
                });
            }

            return content;
        }

        private string ReplacePlaceholders(string text, Dictionary<string, string> variables)
        {
            var regex = new Regex(@"\{\{([^}]+)\}\}");
            return regex.Replace(text, match =>
            {
                var key = match.Groups[1].Value.Trim();
                return variables.TryGetValue(key, out var value) ? value : match.Value;
            });
        }

        private string GenerateDefaultSectionContent(string sectionName, Dictionary<string, string> variables, LeaseInstance instance)
        {
            var lease = instance.Lease;
            var unit = lease?.Unit;
            var property = unit?.Property;

            var sectionKey = sectionName.ToLower().Trim();
            return sectionKey switch
            {
                "parties" => GeneratePartiesContent(variables),
                "property description" or "property & unit" or "property and unit" => GeneratePropertyContent(variables),
                "term" => $"The term of this lease shall commence on {variables.GetValueOrDefault("Lease.StartDate", "[Start Date]")} and end on {variables.GetValueOrDefault("Lease.EndDate", "[End Date]")}. The lease type is {(variables.ContainsKey("Lease.AutoRenew") ? (variables["Lease.AutoRenew"] == "Yes" ? "fixed-term with auto-renewal" : "fixed-term") : "fixed-term")}.",
                "rent" or "rent & deposit" or "rent and deposit" => GenerateRentContent(variables),
                "security deposit" => $"Tenant has deposited with Landlord the sum of {variables.GetValueOrDefault("Lease.SecurityDeposit", "[Deposit]")} as security deposit, to be held in accordance with applicable state law.",
                "fees" or "lease fees" => variables.TryGetValue("Fees.Summary", out var feeSummary) ? feeSummary : "No additional fees apply to this lease.",
                "utilities" or "utilities & services" or "utilities and services" => GenerateUtilitiesContent(unit, variables),
                "maintenance" => GenerateMaintenanceContent(lease, variables),
                "keys" => GenerateKeysContent(variables),
                "pets" or "pets policy" or "pets & animals" => GeneratePetsContent(variables),
                "parking" => variables.TryGetValue("Parking.Summary", out var parkingSum) ? parkingSum : "No specific parking arrangements are included in this lease.",
                "smoking" or "smoking policy" => variables.GetValueOrDefault("Smoking.Policy", "No smoking is permitted on the premises."),
                "occupants" => variables.TryGetValue("Tenant.OccupantList", out var occupants) ? $"In addition to the named Tenant(s), the following occupants are authorized to reside at the property: {occupants}. No other persons may occupy the premises without prior written consent of the Landlord." : "Only the named Tenant(s) are authorized to occupy the premises.",
                "early termination" => variables.TryGetValue("Lease.EarlyTerminationClause", out var etClause) ? etClause : $"This lease shall terminate on {variables.GetValueOrDefault("Lease.EndDate", "[End Date]")} unless terminated earlier in accordance with applicable law.",
                "additional terms" or "additional provisions" => variables.TryGetValue("Lease.AdditionalTerms", out var addTerms) ? addTerms : "No additional terms or provisions apply.",
                "lead-based paint disclosure" or "lead paint" or "lead paint disclosure" => variables.TryGetValue("LeadPaint.Disclosure", out var leadDisc) ? leadDisc : "No lead-based paint disclosure required.",
                "state disclosures" or "legal disclosures" or "state required disclosures" => GenerateStateDisclosuresContent(variables),
                "policies" => GeneratePoliciesContent(instance),
                "defaults" => GenerateDefaultsContent(lease, variables),
                "termination" => GenerateTerminationContent(lease, variables),
                _ => $"{sectionName} section content."
            };
        }

        private static string GeneratePartiesContent(Dictionary<string, string> variables)
        {
            var landlord = variables.GetValueOrDefault("Landlord.LegalName", "[Landlord]");
            var tenants = variables.GetValueOrDefault("Tenant.FullNameList", "[Tenant]");
            var sb = new StringBuilder($"This Residential Lease Agreement (\"Agreement\") is entered into between {landlord} (\"Landlord\") and {tenants} (\"Tenant\").");
            if (variables.TryGetValue("Tenant.CoSignerList", out var coSigners))
                sb.Append($" The following co-signer(s) are also party to this Agreement: {coSigners}.");
            if (variables.TryGetValue("Landlord.MailingAddress", out var landlordAddr))
                sb.Append($" Landlord's address for notices: {landlordAddr}.");
            if (variables.TryGetValue("Tenant.MailingAddress", out var tenantAddr))
                sb.Append($" Tenant's mailing address (if different from rental property): {tenantAddr}.");
            return sb.ToString();
        }

        private static string GeneratePropertyContent(Dictionary<string, string> variables)
        {
            var addr = variables.GetValueOrDefault("Property.FullAddress", "[Property Address]");
            var sb = new StringBuilder($"The rental property subject to this Agreement is located at {addr}");
            if (variables.TryGetValue("Unit.Number", out var unit) && !string.IsNullOrWhiteSpace(unit))
                sb.Append($", Unit {unit}");
            sb.Append(".");
            var details = new List<string>();
            if (variables.TryGetValue("Unit.Bedrooms", out var beds) && !string.IsNullOrWhiteSpace(beds)) details.Add($"{beds} bedroom(s)");
            if (variables.TryGetValue("Unit.Bathrooms", out var baths) && !string.IsNullOrWhiteSpace(baths)) details.Add($"{baths} bathroom(s)");
            if (variables.TryGetValue("Unit.SquareFeet", out var sqft) && !string.IsNullOrWhiteSpace(sqft) && sqft != "0") details.Add($"{sqft} sq. ft.");
            if (details.Any()) sb.Append($" The unit features {string.Join(", ", details)}.");
            return sb.ToString();
        }

        private static string GenerateRentContent(Dictionary<string, string> variables)
        {
            var freq = variables.GetValueOrDefault("Lease.RentFrequency", "Monthly").ToLower();
            var rent = variables.GetValueOrDefault("Lease.MonthlyRent", "[Rent]");
            var dueDay = variables.GetValueOrDefault("Lease.RentDueDay", "1");
            var deposit = variables.GetValueOrDefault("Lease.SecurityDeposit", "[Deposit]");
            var sb = new StringBuilder($"Tenant agrees to pay Landlord {freq} rent in the amount of {rent}, due on the {dueDay} day of each {freq.TrimEnd('l', 'y')}. ");
            sb.Append($"A security deposit of {deposit} is required and will be held in accordance with applicable state law. ");
            if (variables.TryGetValue("Lease.PetDeposit", out var petDeposit))
                sb.Append($"An additional pet deposit of {petDeposit} is required. ");
            if (variables.GetValueOrDefault("Lease.ProratedRent", "No") == "Yes")
                sb.Append("Prorated rent will apply for the first partial month of occupancy. ");
            if (variables.TryGetValue("LateFee.Amount", out var lateFee))
            {
                var grace = variables.TryGetValue("LateFee.GracePeriodDays", out var g) ? g : "5";
                sb.Append($"Rent not received within {grace} days of the due date will incur a late fee of {lateFee}. ");
            }
            if (variables.TryGetValue("Lease.RentCollectionMethods", out var methods))
                sb.Append($"Accepted payment methods: {methods}.");
            return sb.ToString().TrimEnd();
        }

        private static string GenerateKeysContent(Dictionary<string, string> variables)
        {
            if (variables.TryGetValue("Keys.Summary", out var keySummary))
                return $"The following keys will be provided to Tenant(s) upon commencement of the lease:\n{keySummary}\n\nAll keys must be returned to Landlord upon termination of the lease. Failure to return keys may result in a charge for rekeying the property.";
            return "Keys to the property will be provided to Tenant upon commencement of the lease. All keys must be returned upon lease termination.";
        }

        private static string GeneratePetsContent(Dictionary<string, string> variables)
        {
            var allowed = variables.GetValueOrDefault("Pets.Allowed", "No");
            if (allowed == "Yes")
            {
                var sb = new StringBuilder("Pets are permitted subject to the following terms. ");
                if (variables.TryGetValue("Pets.PolicySummary", out var summary))
                    sb.Append($"Approved pet(s):\n{summary}\n\n");
                if (variables.TryGetValue("Lease.PetDeposit", out var petDeposit))
                    sb.Append($"A non-refundable pet deposit of {petDeposit} is required. ");
                sb.Append("Tenant is responsible for any damage caused by pets and must ensure pets do not disturb other residents.");
                return sb.ToString();
            }
            return "No pets of any kind are permitted on the premises without prior written consent from the Landlord.";
        }

        private string GenerateUtilitiesContent(Models.Unit? unit, Dictionary<string, string> variables)
        {
            var sb = new StringBuilder();

            // Use lease-specific responsibility table if available
            if (variables.TryGetValue("Utilities.ResponsibilityTable", out var respTable))
            {
                sb.AppendLine("Utility and service responsibilities are as follows:");
                sb.AppendLine(respTable);
            }
            else if (unit?.IncludedUtility != null && unit.IncludedUtility.Any())
            {
                var utilityNames = unit.IncludedUtility.Select(u => u.Label ?? u.Value).ToList();
                sb.Append($"The following utilities are included in the monthly rent: {string.Join(", ", utilityNames)}. ");
                sb.Append("Tenant is responsible for all other utilities not listed above, including but not limited to electricity, gas, internet, and cable services.");
            }
            else
            {
                sb.Append("Tenant is responsible for all utilities, including but not limited to electricity, gas, water, sewer, trash, internet, and cable services. ");
                sb.Append("Tenant must arrange for utility service in their name and ensure all accounts are properly maintained throughout the lease term.");
            }

            if (variables.TryGetValue("Utilities.SharedDisclosure", out var sharedDisc))
                sb.Append($"\n\nShared utilities: {sharedDisc}");

            return sb.ToString().TrimEnd();
        }

        private string GenerateMaintenanceContent(Lease? lease, Dictionary<string, string> variables)
        {
            var sb = new StringBuilder();

            if (variables.TryGetValue("Maintenance.ResponsibilityList", out var maintList))
            {
                sb.AppendLine("Maintenance responsibilities are as follows:");
                sb.AppendLine(maintList);
                sb.AppendLine();
            }
            else
            {
                sb.Append("Tenant is responsible for minor repairs and maintenance, including changing light bulbs, replacing air filters, and maintaining cleanliness. Landlord is responsible for major repairs and structural issues. ");
            }

            if (variables.TryGetValue("Maintenance.NotificationMethods", out var methods))
                sb.Append($"Tenant shall report maintenance issues via: {methods}. ");
            else
                sb.Append("Tenant must promptly report any maintenance issues to Landlord in writing. ");

            sb.Append("Tenant must not make any alterations to the property without prior written consent from Landlord. Any damage caused by Tenant's negligence may be deducted from the security deposit.");
            return sb.ToString().TrimEnd();
        }

        private string GeneratePoliciesContent(LeaseInstance instance)
        {
            if (instance.PolicySection?.AiFormattedMarkdown != null && !string.IsNullOrWhiteSpace(instance.PolicySection.AiFormattedMarkdown))
            {
                // Convert markdown to plain text (remove markdown formatting for PDF)
                var plainText = instance.PolicySection.AiFormattedMarkdown
                    .Replace("**", "")
                    .Replace("*", "")
                    .Replace("#", "")
                    .Replace("##", "")
                    .Replace("###", "")
                    .Replace("####", "")
                    .Replace("#####", "")
                    .Replace("######", "")
                    .Replace("```", "")
                    .Replace("`", "")
                    .Replace("---", "")
                    .Replace("___", "")
                    .Replace(">", "")
                    .Replace("[", "")
                    .Replace("]", "")
                    .Replace("(", "")
                    .Replace(")", "")
                    .Trim();
                
                // Clean up multiple newlines
                while (plainText.Contains("\n\n\n"))
                {
                    plainText = plainText.Replace("\n\n\n", "\n\n");
                }
                
                if (!string.IsNullOrWhiteSpace(plainText))
                {
                    return plainText;
                }
            }

            // Fallback to standard policies if no custom policies are provided
            return "The following house rules and policies apply to this tenancy:\n\n" +
                   "1. No smoking is permitted inside the property.\n" +
                   "2. No pets are allowed without written consent from the Landlord.\n" +
                   "3. Quiet hours are from 10:00 PM to 7:00 AM.\n" +
                   "4. Tenant must obtain renter's insurance and provide proof to Landlord.\n" +
                   "5. No subletting or assignment of the lease without Landlord's written consent.\n" +
                   "6. Tenant must maintain the property in a clean and sanitary condition.\n" +
                   "7. All guests must comply with property rules and regulations.";
        }

        private string GenerateDefaultsContent(Lease? lease, Dictionary<string, string> variables)
        {
            var content = new StringBuilder();
            
            content.Append("If Tenant fails to pay rent when due, Tenant shall be in default. ");
            content.Append("Landlord may charge a late fee as specified in the lease terms. ");
            content.Append("If Tenant fails to cure any default within the time specified by law or this agreement, Landlord may terminate this lease. ");
            content.Append("Tenant's failure to comply with any term of this lease, including but not limited to non-payment of rent, violation of house rules, or damage to the property, constitutes a default. ");
            content.Append("Upon default, Landlord may pursue all remedies available under law, including eviction and recovery of damages.");

            return content.ToString();
        }

        private string GenerateTerminationContent(Lease? lease, Dictionary<string, string> variables)
        {
            var content = new StringBuilder();
            
            content.Append($"This lease shall terminate on {variables.GetValueOrDefault("Lease.EndDate", "[End Date]")}, unless terminated earlier in accordance with this agreement. ");
            content.Append("Either party may terminate this lease in accordance with applicable state and local laws. ");
            content.Append("Tenant must provide at least 30 days written notice before vacating the property. ");
            content.Append("Upon termination, Tenant must return the property in the same condition as when received, reasonable wear and tear excepted. ");
            content.Append("Landlord will conduct a final inspection and return the security deposit, less any deductions for damages or unpaid rent, within the time period required by law.");

            return content.ToString();
        }

        private static string GenerateStateDisclosuresContent(Dictionary<string, string> variables)
        {
            var state = variables.GetValueOrDefault("State.Name", string.Empty);
            var disclosures = variables.GetValueOrDefault("State.RequiredDisclosures", string.Empty);
            var note = variables.GetValueOrDefault("State.Note", string.Empty);

            if (string.IsNullOrWhiteSpace(disclosures))
                return string.IsNullOrWhiteSpace(state)
                    ? "No state-specific disclosures have been generated for this lease."
                    : $"No state-specific disclosures were found for {state}.";

            var sb = new StringBuilder();
            if (!string.IsNullOrWhiteSpace(state))
                sb.AppendLine($"The following disclosures are required under {state} law:");
            sb.AppendLine(disclosures);
            if (!string.IsNullOrWhiteSpace(note))
                sb.AppendLine($"\nNote: {note}");
            return sb.ToString().TrimEnd();
        }

        private static string BuildLeaseAgreementTitle(string? state)
        {
            var stateName = NormalizeStateName(state);
            return string.IsNullOrWhiteSpace(stateName)
                ? "RESIDENTIAL LEASE AGREEMENT"
                : $"{stateName.ToUpperInvariant()} LEASE AGREEMENT";
        }

        private static string NormalizeStateName(string? state)
        {
            if (string.IsNullOrWhiteSpace(state)) return string.Empty;
            var trimmed = state.Trim();
            var states = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["AL"] = "Alabama", ["AK"] = "Alaska", ["AZ"] = "Arizona", ["AR"] = "Arkansas", ["CA"] = "California",
                ["CO"] = "Colorado", ["CT"] = "Connecticut", ["DE"] = "Delaware", ["FL"] = "Florida", ["GA"] = "Georgia",
                ["HI"] = "Hawaii", ["ID"] = "Idaho", ["IL"] = "Illinois", ["IN"] = "Indiana", ["IA"] = "Iowa",
                ["KS"] = "Kansas", ["KY"] = "Kentucky", ["LA"] = "Louisiana", ["ME"] = "Maine", ["MD"] = "Maryland",
                ["MA"] = "Massachusetts", ["MI"] = "Michigan", ["MN"] = "Minnesota", ["MS"] = "Mississippi", ["MO"] = "Missouri",
                ["MT"] = "Montana", ["NE"] = "Nebraska", ["NV"] = "Nevada", ["NH"] = "New Hampshire", ["NJ"] = "New Jersey",
                ["NM"] = "New Mexico", ["NY"] = "New York", ["NC"] = "North Carolina", ["ND"] = "North Dakota", ["OH"] = "Ohio",
                ["OK"] = "Oklahoma", ["OR"] = "Oregon", ["PA"] = "Pennsylvania", ["RI"] = "Rhode Island", ["SC"] = "South Carolina",
                ["SD"] = "South Dakota", ["TN"] = "Tennessee", ["TX"] = "Texas", ["UT"] = "Utah", ["VT"] = "Vermont",
                ["VA"] = "Virginia", ["WA"] = "Washington", ["WV"] = "West Virginia", ["WI"] = "Wisconsin", ["WY"] = "Wyoming"
            };
            return states.TryGetValue(trimmed, out var fullName) ? fullName : trimmed;
        }

        private static void CreateLeaseHeader(IContainer container, string title, bool isDraft)
        {
            container.Column(column =>
            {
                column.Item().AlignCenter().Text(title)
                    .FontSize(17)
                    .Bold()
                    .Underline()
                    .FontColor(Colors.Black);

                if (isDraft)
                {
                    column.Item().PaddingTop(3).AlignCenter().Text("DRAFT – For review only. Not legally binding until finalized and signed.")
                        .FontSize(8)
                        .FontColor(Colors.Grey.Darken1);
                }
            });
        }

        private static void CreateLeaseFooter(IContainer container)
        {
            container.Row(row =>
            {
                row.RelativeItem().Text("Property Peace lease agreement")
                    .FontSize(7.5f)
                    .FontColor(Colors.Grey.Darken1);
                row.AutoItem().Text(text =>
                {
                    text.DefaultTextStyle(x => x.FontSize(7.5f).FontColor(Colors.Grey.Darken1));
                    text.Span("Page ");
                    text.CurrentPageNumber();
                    text.Span(" of ");
                    text.TotalPages();
                });
            });
        }

        private static void CreateAgreementPreamble(IContainer container, Dictionary<string, string> variables)
        {
            var landlord = variables.GetValueOrDefault("Landlord.LegalName", "Landlord");
            var tenants = variables.GetValueOrDefault("Tenant.FullNameList", "Tenant(s)");
            var agreementDate = variables.GetValueOrDefault("Lease.StartDate", DateTime.Now.ToString("MM/dd/yyyy"));
            var premises = variables.GetValueOrDefault("Property.FullAddress", "Premises");
            var unit = variables.GetValueOrDefault("Unit.Number", string.Empty);
            if (!string.IsNullOrWhiteSpace(unit)) premises = $"{premises}, Unit {unit}";

            container.Column(column =>
            {
                column.Item().Text($"This Lease Agreement (this \"Agreement\") is made this {agreementDate}, by and between:")
                    .FontSize(9.5f);
                column.Item().PaddingTop(8).Element(c => CreateFormLine(c, "Landlord:", landlord, "(\"Landlord\") AND"));
                column.Item().PaddingTop(6).Element(c => CreateFormLine(c, "Tenant(s):", tenants, "(\"Tenant\")"));
                column.Item().PaddingTop(8).Text("If there is more than one Tenant, each reference to Tenant applies to each of them, jointly and severally. Each Tenant is jointly and severally liable to Landlord for payment of rent and performance of all other terms of this Agreement.")
                    .FontSize(8.5f)
                    .LineHeight(1.15f);
                column.Item().PaddingTop(8).Element(c => CreateFormLine(c, "Premises:", premises, string.Empty));
            });
        }

        private static void CreatePreviewAgreementPreamble(IContainer container, LoadLeaseDto lease)
        {
            var landlord = !string.IsNullOrWhiteSpace(lease.LandlordName) ? lease.LandlordName : "Landlord";
            var tenants = lease.Tenants?.Any() == true
                ? string.Join(", ", lease.Tenants.Select(t => $"{t.Firstname} {t.Lastname}".Trim()).Where(n => !string.IsNullOrWhiteSpace(n)))
                : (lease.AddTenantsLater ? "To be added" : "Tenant(s)");
            var agreementDate = lease.StartDate?.ToString("MM/dd/yyyy") ?? DateTime.Now.ToString("MM/dd/yyyy");
            var premises = $"{lease.PropertyName ?? "Premises"}{(!string.IsNullOrWhiteSpace(lease.UnitName) ? $", Unit {lease.UnitName}" : string.Empty)}";

            container.Column(column =>
            {
                column.Item().Text($"This Lease Agreement (this \"Agreement\") is made this {agreementDate}, by and between:")
                    .FontSize(9.5f);
                column.Item().PaddingTop(8).Element(c => CreateFormLine(c, "Landlord:", landlord, "(\"Landlord\") AND"));
                column.Item().PaddingTop(6).Element(c => CreateFormLine(c, "Tenant(s):", tenants, "(\"Tenant\")"));
                column.Item().PaddingTop(8).Text("If there is more than one Tenant, each reference to Tenant applies to each of them, jointly and severally. Each Tenant is jointly and severally liable to Landlord for payment of rent and performance of all other terms of this Agreement.")
                    .FontSize(8.5f)
                    .LineHeight(1.15f);
                column.Item().PaddingTop(8).Element(c => CreateFormLine(c, "Premises:", premises, string.Empty));
            });
        }

        private static void CreateFormLine(IContainer container, string label, string value, string suffix)
        {
            container.Row(row =>
            {
                row.AutoItem().Text(label).FontSize(9).Bold();
                row.RelativeItem().PaddingLeft(4).PaddingRight(4).BorderBottom(0.75f).BorderColor(Colors.Black).Text(value)
                    .FontSize(9);
                if (!string.IsNullOrWhiteSpace(suffix))
                {
                    row.AutoItem().Text(suffix).FontSize(8.5f);
                }
            });
        }

        private void CreateSection(IContainer container, string title, string content, int sectionNumber)
        {
            container.Column(column =>
            {
                column.Item().Text($"{sectionNumber}. {title}")
                    .FontSize(10)
                    .Bold()
                    .FontColor(Colors.Black);

                column.Item().Height(3);

                var paragraphs = (content ?? string.Empty)
                    .Replace("\r\n", "\n")
                    .Split('\n', StringSplitOptions.None)
                    .Select(p => p.Trim())
                    .Where(p => !string.IsNullOrWhiteSpace(p))
                    .ToList();

                if (!paragraphs.Any())
                {
                    column.Item().PaddingLeft(8).Text("________________________________________________________________________________")
                        .FontSize(9);
                    return;
                }

                foreach (var paragraph in paragraphs)
                {
                    column.Item().PaddingLeft(8).PaddingBottom(3).Text(paragraph)
                        .FontSize(9)
                        .LineHeight(1.15f);
                }
            });
        }

        private void CreateSignatureSection(IContainer container, Lease lease)
        {
            container.Column(column =>
            {
                column.Item().Text("SIGNATURES")
                    .FontSize(11)
                    .Bold()
                    .FontColor(Colors.Black);

                column.Item().Height(12);

                column.Item().Row(row =>
                {
                    row.RelativeItem().Column(sig =>
                    {
                        sig.Item().Text("Landlord Signature").FontSize(8).Bold();
                        sig.Item().PaddingTop(18).BorderBottom(0.75f).BorderColor(Colors.Black).Text(" ");
                        sig.Item().PaddingTop(3).Text("Date: __________________").FontSize(8.5f);
                    });
                    row.ConstantItem(28);
                    row.RelativeItem().Column(sig =>
                    {
                        sig.Item().Text("Tenant Signature").FontSize(8).Bold();
                        sig.Item().PaddingTop(18).BorderBottom(0.75f).BorderColor(Colors.Black).Text(" ");
                        sig.Item().PaddingTop(3).Text("Date: __________________").FontSize(8.5f);
                    });
                });
            });
        }

        public async Task<ServiceResponse<string>> SaveDocumentToBlobAsync(byte[] documentBytes, string fileName, long leaseInstanceId, string documentType)
        {
            try
            {
                var instance = await _leaseInstanceRepository.GetLeaseInstanceByIdAsync(leaseInstanceId);
                if (instance == null)
                {
                    return ServiceResponse<string>.CreateError("Instance not found", "The specified lease instance does not exist.");
                }

                var containerClient = _blobServiceClient.GetBlobContainerClient(ContainerName);
                await containerClient.CreateIfNotExistsAsync(PublicAccessType.None);

                var sanitizedFileName = Regex.Replace(fileName, @"[^a-zA-Z0-9._-]", "_");
                var blobName = $"lease-{leaseInstanceId}-{sanitizedFileName}-{DateTime.UtcNow:yyyyMMddHHmmss}";
                var blobClient = containerClient.GetBlobClient(blobName);

                using (var stream = new MemoryStream(documentBytes))
                {
                    await blobClient.UploadAsync(stream, overwrite: true);
                    var contentType = documentType.ToLower() == "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
                    await blobClient.SetHttpHeadersAsync(new BlobHttpHeaders { ContentType = contentType });
                }

                var blobUrl = blobClient.Uri.ToString();
                
                // Calculate file hash
                using var sha256 = System.Security.Cryptography.SHA256.Create();
                var hashBytes = sha256.ComputeHash(documentBytes);
                var fileHash = BitConverter.ToString(hashBytes).Replace("-", "").ToLowerInvariant();

                // Save document record to database
                var userId = GetUserIdFromContext();
                var document = new LeaseDocument
                {
                    LeaseInstanceId = leaseInstanceId,
                    DocumentType = documentType.ToUpper(),
                    BlobName = blobName,
                    BlobUrl = blobUrl,
                    FileHash = fileHash,
                    GeneratedBy = userId ?? instance.GeneratedBy,
                    GeneratedAt = DateTime.Now
                };

                instance.Documents.Add(document);
                await _leaseInstanceRepository.UpdateLeaseInstanceAsync(instance);

                _logger.LogInformation("Lease document saved to blob storage: {BlobName} for instance {InstanceId}", blobName, leaseInstanceId);
                
                return ServiceResponse<string>.CreateSuccess(blobUrl);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving lease document to blob storage for instance {InstanceId}", leaseInstanceId);
                return ServiceResponse<string>.CreateError("Error saving document", ex.Message);
            }
        }

        public async Task<ServiceResponse<byte[]>> GetDocumentAsync(long documentId)
        {
            try
            {
                // This would need a document repository to fetch by ID
                // For now, return error
                return ServiceResponse<byte[]>.CreateError("Not implemented", "Document retrieval by ID not yet implemented.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving document {DocumentId}", documentId);
                return ServiceResponse<byte[]>.CreateError("Error retrieving document", ex.Message);
            }
        }

        public async Task<ServiceResponse<List<LoadLeaseDocumentDto>>> GetDocumentsByInstanceAsync(long leaseInstanceId)
        {
            try
            {
                var instance = await _leaseInstanceRepository.GetLeaseInstanceByIdAsync(leaseInstanceId);
                if (instance == null)
                {
                    return ServiceResponse<List<LoadLeaseDocumentDto>>.CreateError("Instance not found", "The specified lease instance does not exist.");
                }

                var documents = instance.Documents.Select(d => new LoadLeaseDocumentDto
                {
                    Id = d.Id,
                    DocumentType = d.DocumentType,
                    BlobName = d.BlobName,
                    BlobUrl = d.BlobUrl,
                    GeneratedAt = d.GeneratedAt
                }).ToList();

                return ServiceResponse<List<LoadLeaseDocumentDto>>.CreateSuccess(documents);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving documents for instance {InstanceId}", leaseInstanceId);
                return ServiceResponse<List<LoadLeaseDocumentDto>>.CreateError("Error retrieving documents", ex.Message);
            }
        }

        private class DocumentContent
        {
            public List<DocumentSection> Sections { get; set; } = [];
        }

        private class DocumentSection
        {
            public string Title { get; set; } = string.Empty;
            public string Content { get; set; } = string.Empty;
            public bool Enabled { get; set; } = true;
        }
    }
}
