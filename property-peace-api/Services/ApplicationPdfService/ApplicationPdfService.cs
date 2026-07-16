using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using QuestPdfUnit = QuestPDF.Infrastructure.Unit;
using brownstone_hub_api.Models;

namespace brownstone_hub_api.Services.ApplicationPdfService
{
    public class ApplicationPdfService(
        BlobServiceClient blobServiceClient,
        ILogger<ApplicationPdfService> logger) : IApplicationPdfService
    {
        private readonly BlobServiceClient _blobServiceClient = blobServiceClient;
        private readonly ILogger<ApplicationPdfService> _logger = logger;

        public Task<byte[]> GenerateApplicationPdfAsync(Models.RentalApplication application)
        {
            QuestPDF.Settings.License = LicenseType.Community;

            try
            {
                var pdfBytes = Document.Create(container =>
                {
                    container.Page(page =>
                    {
                        page.Size(PageSizes.A4);
                        page.Margin(2, QuestPdfUnit.Centimetre);
                        page.PageColor(Colors.White);
                        page.DefaultTextStyle(x => x.FontSize(10));

                        // Header
                        page.Header()
                            .Row(row =>
                            {
                                row.RelativeColumn().Column(column =>
                                {
                                    column.Item().Text("RENTAL APPLICATION")
                                        .FontSize(24)
                                        .Bold()
                                        .FontColor(Colors.Blue.Darken3);
                                    
                                    column.Item().PaddingTop(5).Text($"Application #{application.Id}")
                                        .FontSize(10)
                                        .FontColor(Colors.Grey.Darken2);
                                });

                                row.ConstantColumn(100).AlignRight().Column(column =>
                                {
                                    column.Item().Text(DateTime.Now.ToString("MM/dd/yyyy"))
                                        .FontSize(10)
                                        .FontColor(Colors.Grey.Darken2);
                                    if (application.SubmittedAt.HasValue)
                                    {
                                        column.Item().Text($"Submitted: {application.SubmittedAt.Value:MM/dd/yyyy}")
                                            .FontSize(9)
                                            .FontColor(Colors.Grey.Darken2);
                                    }
                                });
                            });

                        // Content
                        page.Content()
                            .PaddingVertical(1, QuestPdfUnit.Centimetre)
                            .Column(column =>
                            {
                                column.Spacing(15);

                                // Property Information Section
                                column.Item().Element(container => CreateSection(container, "Property Information", new Dictionary<string, string?>
                                {
                                    { "Property", application.Property?.Name },
                                    { "Unit", application.Unit?.Name },
                                    { "Address", application.Property != null ? $"{application.Property.StreetAddress}, {application.Property.City}, {application.Property.State} {application.Property.ZipCode}".Trim() : null }
                                }));

                                // Applicant Information Section
                                var applicantFields = new Dictionary<string, string?>
                                {
                                    { "Full Name", $"{application.FirstName} {application.LastName}" },
                                    { "Email", application.Email },
                                    { "Phone Number", application.PhoneNumber },
                                    { "Date of Birth", application.DateOfBirth?.ToString("MM/dd/yyyy") }
                                };

                                if (!string.IsNullOrWhiteSpace(application.CurrentAddress))
                                {
                                    var currentAddress = application.CurrentAddress;
                                    if (!string.IsNullOrWhiteSpace(application.CurrentCity))
                                    {
                                        currentAddress += $", {application.CurrentCity}";
                                        if (!string.IsNullOrWhiteSpace(application.CurrentState))
                                        {
                                            currentAddress += $", {application.CurrentState}";
                                            if (!string.IsNullOrWhiteSpace(application.CurrentZipCode))
                                            {
                                                currentAddress += $" {application.CurrentZipCode}";
                                            }
                                        }
                                    }
                                    applicantFields["Current Address"] = currentAddress;
                                }

                                column.Item().Element(container => CreateSection(container, "Applicant Information", applicantFields));

                                // Employment Information Section
                                if (!string.IsNullOrWhiteSpace(application.EmployerName) || application.MonthlyIncome.HasValue)
                                {
                                    var employmentFields = new Dictionary<string, string?>();
                                    if (!string.IsNullOrWhiteSpace(application.EmployerName))
                                        employmentFields["Employer"] = application.EmployerName;
                                    if (!string.IsNullOrWhiteSpace(application.JobTitle))
                                        employmentFields["Job Title"] = application.JobTitle;
                                    if (application.MonthlyIncome.HasValue)
                                        employmentFields["Monthly Income"] = $"${application.MonthlyIncome.Value:N2}";
                                    if (application.EmploymentMonths.HasValue)
                                        employmentFields["Employment Duration"] = $"{application.EmploymentMonths.Value} month(s)";

                                    column.Item().Element(container => CreateSection(container, "Employment Information", employmentFields));
                                }

                                // References Section
                                if (!string.IsNullOrWhiteSpace(application.EmergencyContactName) || !string.IsNullOrWhiteSpace(application.PreviousLandlordName))
                                {
                                    var referenceFields = new Dictionary<string, string?>();
                                    if (!string.IsNullOrWhiteSpace(application.EmergencyContactName))
                                    {
                                        var emergencyContact = $"{application.EmergencyContactName}";
                                        if (!string.IsNullOrWhiteSpace(application.EmergencyContactPhone))
                                            emergencyContact += $" - {application.EmergencyContactPhone}";
                                        if (!string.IsNullOrWhiteSpace(application.EmergencyContactRelationship))
                                            emergencyContact += $" ({application.EmergencyContactRelationship})";
                                        referenceFields["Emergency Contact"] = emergencyContact;
                                    }
                                    if (!string.IsNullOrWhiteSpace(application.PreviousLandlordName))
                                    {
                                        var landlord = $"{application.PreviousLandlordName}";
                                        if (!string.IsNullOrWhiteSpace(application.PreviousLandlordPhone))
                                            landlord += $" - {application.PreviousLandlordPhone}";
                                        referenceFields["Previous Landlord"] = landlord;
                                    }
                                    column.Item().Element(container => CreateSection(container, "References", referenceFields));
                                }

                                // Application Details Section
                                var detailsFields = new Dictionary<string, string?>();
                                if (application.NumberOfOccupants.HasValue)
                                    detailsFields["Number of Occupants"] = application.NumberOfOccupants.Value.ToString();
                                if (application.DesiredMoveInDate.HasValue)
                                    detailsFields["Desired Move-In Date"] = application.DesiredMoveInDate.Value.ToString("MM/dd/yyyy");
                                detailsFields["Has Pets"] = application.HasPets ? "Yes" : "No";
                                if (application.HasPets && !string.IsNullOrWhiteSpace(application.PetDetails))
                                    detailsFields["Pet Details"] = application.PetDetails;
                                detailsFields["Has Vehicles"] = application.HasVehicles ? "Yes" : "No";
                                if (application.HasVehicles && !string.IsNullOrWhiteSpace(application.VehicleDetails))
                                    detailsFields["Vehicle Details"] = application.VehicleDetails;
                                if (!string.IsNullOrWhiteSpace(application.AdditionalNotes))
                                    detailsFields["Additional Notes"] = application.AdditionalNotes;

                                column.Item().Element(container => CreateSection(container, "Application Details", detailsFields));

                                // Status Section
                                var statusFields = new Dictionary<string, string?>
                                {
                                    { "Application Status", application.Status.ToString() }
                                };
                                if (application.SubmittedAt.HasValue)
                                    statusFields["Submitted Date"] = application.SubmittedAt.Value.ToString("MM/dd/yyyy HH:mm");

                                column.Item().PaddingTop(10).Element(container => CreateSection(container, "Status", statusFields));
                            });

                        // Footer
                        page.Footer()
                            .AlignCenter()
                            .Text($"Property Peace - Rental Application Form | Generated on {DateTime.Now:MM/dd/yyyy HH:mm}")
                            .FontSize(8)
                            .FontColor(Colors.Grey.Medium);
                    });
                })
                .GeneratePdf();

                return Task.FromResult(pdfBytes);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating PDF for application {ApplicationId}", application.Id);
                throw;
            }
        }

        private void CreateSection(IContainer container, string title, Dictionary<string, string?> fields)
        {
            container.Column(column =>
            {
                column.Item().Text(title)
                    .FontSize(14)
                    .Bold()
                    .FontColor(Colors.Blue.Darken2);

                column.Item().Height(5);

                column.Item().Border(1).BorderColor(Colors.Grey.Lighten2).Padding(10).Column(innerColumn =>
                {
                    foreach (var field in fields)
                    {
                        if (!string.IsNullOrWhiteSpace(field.Value))
                        {
                            innerColumn.Item().PaddingBottom(5).Row(row =>
                            {
                                row.ConstantColumn(150).Text(field.Key + ":")
                                    .FontSize(10)
                                    .Bold()
                                    .FontColor(Colors.Grey.Darken2);
                                row.RelativeColumn().Text(field.Value)
                                    .FontSize(10);
                            });
                        }
                    }
                });
            });
        }

        public async Task<string> SaveApplicationPdfToBlobAsync(byte[] pdfBytes, long applicationId, string applicantName)
        {
            try
            {
                var containerClient = _blobServiceClient.GetBlobContainerClient("application-pdfs");
                await containerClient.CreateIfNotExistsAsync(PublicAccessType.None);

                // Create a sanitized filename
                var sanitizedName = System.Text.RegularExpressions.Regex.Replace(applicantName, @"[^a-zA-Z0-9_-]", "_");
                var blobName = $"application-{applicationId}-{sanitizedName}-{DateTime.UtcNow:yyyyMMddHHmmss}.pdf";
                var blobClient = containerClient.GetBlobClient(blobName);

                // Upload the PDF
                using (var stream = new MemoryStream(pdfBytes))
                {
                    await blobClient.UploadAsync(stream, overwrite: true);
                    await blobClient.SetHttpHeadersAsync(new BlobHttpHeaders { ContentType = "application/pdf" });
                }

                _logger.LogInformation("Application PDF saved to blob storage: {BlobName} for application {ApplicationId}", blobName, applicationId);
                return blobName;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving application PDF to blob storage for application {ApplicationId}", applicationId);
                throw;
            }
        }
    }
}
