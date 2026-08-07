global using brownstone_hub_api.Models;
using AspNetCoreRateLimit;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Principal;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Swashbuckle.AspNetCore.Filters;
using brownstone_hub_api.Data;
using brownstone_hub_api.Controllers;
using Newtonsoft.Json;
using brownstone_hub_api.Services.HealthService;
using brownstone_hub_api.Services.UserService;
using brownstone_hub_api.Services.ImpersonationService;
using brownstone_hub_api.Services.UserContextService;
using brownstone_hub_api.Services.LoggingService;
using Azure.Storage.Blobs;
using Azure.Identity;
using Microsoft.Extensions.Configuration.AzureAppConfiguration;
using brownstone_hub_api.Services.PropertyService;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Repositories.Properties;
using System.Text;
using System.Linq;
using brownstone_hub_api.Repositories.Roles;
using brownstone_hub_api.Services.MaintenanceRequestService;
using brownstone_hub_api.Repositories.MaintenanceRequests;
using brownstone_hub_api.Services.UnitService;
using brownstone_hub_api.Repositories.Units;
using brownstone_hub_api.Repositories.MaintenanceImages;
using brownstone_hub_api.Services.MaintenanceImageService;
using brownstone_hub_api.Services.ExpenseReceiptService;
using brownstone_hub_api.Services.GoogleAuthService;
using brownstone_hub_api.Services.AppleAuthService;
using brownstone_hub_api.Services.AzureBlobService;
using brownstone_hub_api.Services.LeaseService;
using brownstone_hub_api.Repositories.Leases;
using brownstone_hub_api.Services.LeaseTemplateService;
using brownstone_hub_api.Repositories.LeaseTemplates;
using brownstone_hub_api.Services.PolicyPackService;
using brownstone_hub_api.Repositories.PolicyPacks;
using brownstone_hub_api.Services.LeaseGenerationService;
using brownstone_hub_api.Repositories.LeaseInstances;
using brownstone_hub_api.Services.LeaseDocumentService;
using brownstone_hub_api.Services.LeaseAutoRenewService;
using brownstone_hub_api.Services.LeaseChecklistSchedulingService;
using brownstone_hub_api.Services.OpenAIService;
using brownstone_hub_api.Services.PolicyAIService;
using brownstone_hub_api.Config;
using brownstone_hub_api.Repositories.Tenants;
using brownstone_hub_api.Services.TenantService;
using brownstone_hub_api.Services.TenantInviteService;
using brownstone_hub_api.Services.LandlordInviteService;
using brownstone_hub_api.Repositories.LandlordInvites;
using brownstone_hub_api.Services.ApplicationInviteService;
using brownstone_hub_api.Repositories.ApplicationInvites;
using brownstone_hub_api.Services.ApplicationPdfService;
using brownstone_hub_api.Utils;
using System.Text.Json.Serialization;
using System.Text.Json;
using System.Security.Claims;
using brownstone_hub_api.Services.DashboardService;
using brownstone_hub_api.Services.AICopilotService;
using brownstone_hub_api.Services.RentCollectionService;
using brownstone_hub_api.Repositories.Payments;
using brownstone_hub_api.Services.HouseholdService;
using brownstone_hub_api.Services.PaymentService;
using brownstone_hub_api.Services.StripeService;
using brownstone_hub_api.Services.StripeRentPayments;
using brownstone_hub_api.Services.StorageService;
using brownstone_hub_api.Repositories.Images;
using brownstone_hub_api.Services.ImageService;
using brownstone_hub_api.Dtos.Image;
using brownstone_hub_api.Services.NotificationSettingService;
using brownstone_hub_api.Repositories.NotificationSettings;
using brownstone_hub_api.Services.NotificationService;
using brownstone_hub_api.Repositories.Notifications;
using brownstone_hub_api.Services.ScheduledNotificationService;
using brownstone_hub_api.Services.ActivityService;
using brownstone_hub_api.Services.ExpenseService;
using brownstone_hub_api.Services.VendorService;
using brownstone_hub_api.Services.RecurringExpenseService;
using brownstone_hub_api.Services.FutureExpenseService;
using brownstone_hub_api.Repositories.Expenses;
using brownstone_hub_api.Repositories.RecurringExpenses;
using brownstone_hub_api.Repositories.FutureExpenses;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.DataProtection;
using System.Net;
using brownstone_hub_api.Hubs;
using brownstone_hub_api.Middleware;
using brownstone_hub_api.Repositories.ExpenseReceipts;
using brownstone_hub_api.Services.RecurringExpenseGenerationService;
using brownstone_hub_api.Services.ExpenseReportService;
using brownstone_hub_api.Services.TaxReportService;
using brownstone_hub_api.Services.ScheduleEPdfService;
using brownstone_hub_api.Services.ExpenseCategorizationService;
using brownstone_hub_api.Repositories.TaxCategories;
using brownstone_hub_api.Services.KPIReportService;
using brownstone_hub_api.Services.TenantDocumentService;
using brownstone_hub_api.Services.FileService;
using brownstone_hub_api.Services.FileCategoryService;
using brownstone_hub_api.Services.ApplicationService;
using brownstone_hub_api.Services.ChecklistService;
using brownstone_hub_api.Services.ESignatureService;
using brownstone_hub_api.Services.LeaseFinalizationLock;
using brownstone_hub_api.Services.ConversationService;
using brownstone_hub_api.Services.MessageService;
using brownstone_hub_api.Services.MessageAnalysisService;
using brownstone_hub_api.Services.PropertyPortfolioService;
using brownstone_hub_api.Services.SearchService;
using brownstone_hub_api.Repositories.Applications;
using brownstone_hub_api.Repositories.Checklists;
using brownstone_hub_api.Repositories.TenantDocuments;
using brownstone_hub_api.Repositories.Files;
using brownstone_hub_api.Repositories.FileCategories;
using brownstone_hub_api.Repositories.Conversations;
using brownstone_hub_api.Repositories.Messages;
using brownstone_hub_api.Services.EmailService;
using brownstone_hub_api.Services.SmsService;
using brownstone_hub_api.Services.CommunicationService;
using brownstone_hub_api.Services.SubscriptionService;
using brownstone_hub_api.Services.FeatureReadiness;
using brownstone_hub_api.Services.LeasingPipeline;
using brownstone_hub_api.Services.Leads;
using brownstone_hub_api.Services.OrganizationSmsNumberService;
using brownstone_hub_api.Repositories.OrganizationSmsNumbers;
using brownstone_hub_api.Repositories.Subscriptions;
using brownstone_hub_api.Services.BackgroundServices;
using brownstone_hub_api.Services.DailySummaryEmailService;
using brownstone_hub_api.Services.EmailVerificationService;
using brownstone_hub_api.Repositories.StateLateFeeLaws;
using brownstone_hub_api.Repositories.StateDepositLaws;
using brownstone_hub_api.Repositories.JobRunHistories;
using brownstone_hub_api.Repositories.StateLawSources;
using brownstone_hub_api.Repositories.LeaseShield;
using brownstone_hub_api.Services.LeaseShieldService;
using brownstone_hub_api.Services.StateLateFeeLawService;
using brownstone_hub_api.Services.StateDepositLawService;
using brownstone_hub_api.Services.JobRunnerService;
using brownstone_hub_api.Services.StateLawSourceService;
using brownstone_hub_api.Services.SupportRequestService;
using brownstone_hub_api.Services.AdminSettingsService;
using brownstone_hub_api.Repositories.AdminSettings;
using brownstone_hub_api.Repositories.Vendors;
using brownstone_hub_api.Services.BackgroundCheckService;
using brownstone_hub_api.Services.Screening;
using brownstone_hub_api.Services.UpcomingFeatureService;
using brownstone_hub_api.Repositories.UpcomingFeatures;
using brownstone_hub_api.Services.DemoRequestService;
using brownstone_hub_api.Repositories.DemoRequests;
using brownstone_hub_api.Repositories.Listings;
using brownstone_hub_api.Repositories.Amenities;
using brownstone_hub_api.Repositories.AdminDashboard;
using brownstone_hub_api.Services.AdminDashboardService;
using Fido2NetLib;
using brownstone_hub_api.Services.MfaService;
using brownstone_hub_api.Dtos.Mfa;

var builder = WebApplication.CreateBuilder(args);
var services = builder.Services;
var configBuilder = new ConfigurationBuilder();
var allowMyOrigins = "AllowMyOrigins";
var configuration = builder.Configuration;

builder.Logging.ClearProviders();

// 1) Add local files + env FIRST
builder.Configuration
    .SetBasePath(Directory.GetCurrentDirectory())
    .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
    .AddJsonFile($"appsettings.{builder.Environment.EnvironmentName}.json", optional: true)
    .AddEnvironmentVariables();

// 2) Connect Azure App Configuration
// Preferred: endpoint + DefaultAzureCredential (Managed Identity in Azure)
// Fallback: connection string from env var or configuration
// Ignore redacted/placeholder values so local launch settings can override renamed/sanitized appsettings.
static string? CleanAppConfigValue(string? value)
{
    if (string.IsNullOrWhiteSpace(value)) return null;

    var trimmed = value.Trim();
    var lower = trimmed.ToLowerInvariant();
    if (lower is "[redacted]" or "redacted" or "changeme" or "todo") return null;

    return trimmed;
}

var appConfigConnectionString = CleanAppConfigValue(Environment.GetEnvironmentVariable("AZURE_APP_CONFIG_CONNECTION_STRING"))
    ?? CleanAppConfigValue(Environment.GetEnvironmentVariable("AzureAppConfigEndpoint"))
    ?? CleanAppConfigValue(builder.Configuration["AZURE_APP_CONFIG_CONNECTION_STRING"])
    ?? CleanAppConfigValue(builder.Configuration["AzureAppConfigEndpoint"]);
var environmentName = builder.Environment.EnvironmentName;

// Log environment and App Config connection status
Console.WriteLine($"[Config] ASPNETCORE_ENVIRONMENT: {environmentName}");
Console.WriteLine($"[Config] AZURE_APP_CONFIG_CONNECTION_STRING: {(string.IsNullOrWhiteSpace(appConfigConnectionString) ? "NOT SET" : "SET")}");

if (!string.IsNullOrWhiteSpace(appConfigConnectionString))
{
    try
    {
        builder.Configuration.AddAzureAppConfiguration(options =>
        {
            options.Connect(appConfigConnectionString);

            // Load keys (label strategy: null + environment label)
            options.Select(KeyFilter.Any, LabelFilter.Null)
                .Select(KeyFilter.Any, builder.Environment.EnvironmentName);

            // dynamic refresh: change the sentinel key to trigger reloads
            options.ConfigureRefresh(refresh =>
                refresh.Register(key: "App:Settings:Sentinel", refreshAll: true)
                    .SetRefreshInterval(TimeSpan.FromMinutes(5))); // Use SetRefreshInterval instead of obsolete SetCacheExpiration
        });
        Console.WriteLine($"[Config] Azure App Configuration connected. Loading keys with labels: null, {environmentName}");
    }
    catch (ArgumentException ex) when (builder.Environment.IsDevelopment())
    {
        Console.WriteLine($"[Config] WARNING: Azure App Configuration value is invalid and was skipped for local Development: {ex.Message}");
    }
}
else
{
    Console.WriteLine("[Config] WARNING: AZURE_APP_CONFIG_CONNECTION_STRING is not set. Azure App Configuration will not be loaded.");
}

// 3) Add the service so middleware can refresh
services.AddAzureAppConfiguration();

builder.Logging.ClearProviders();
builder.Logging.AddConsole();                // keep console
builder.Logging.AddEventSourceLogger();

// Optional: turn down framework noise
builder.Logging.AddFilter("Microsoft", LogLevel.Warning);
builder.Logging.AddFilter("System", LogLevel.Warning);

// Send ASP.NET Core telemetry + ILogger to AI (only in non-Development environments)
if (!builder.Environment.IsDevelopment())
{
    services.AddApplicationInsightsTelemetry();
    builder.Logging.AddApplicationInsights();    // bridge ILogger -> AI after ClearProviders()
    builder.Logging.AddFilter<Microsoft.Extensions.Logging.ApplicationInsights.ApplicationInsightsLoggerProvider>(
        "",
        LogLevel.Information);
    Console.WriteLine("[Config] Application Insights enabled for environment: " + builder.Environment.EnvironmentName);
}
else
{
    Console.WriteLine("[Config] Application Insights disabled for Development environment");
}

services.AddSingleton<IConfiguration>(builder.Configuration);

// Connect to storage account
services.AddSingleton(x =>
{
    var configuration = x.GetRequiredService<IConfiguration>();
    var connectionString = configuration.GetConnectionString("AzureBlobStorage");
    return new BlobServiceClient(connectionString);
});

// Services
services.AddHttpClient();
services.AddHttpClient("StateLawSources").ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler
{
    AllowAutoRedirect = false,
    UseProxy = false,
    // Resolve, validate, and connect to the same address set to close the DNS
    // rebinding gap between application validation and the transport connection.
    ConnectCallback = StateRequiredDisclosureService.ConnectToSafeHostAsync
});

// Add services to the container.
services.AddDbContext<DataContext>(
    options =>
    {
        options.UseSqlServer(builder.Configuration.GetConnectionString("AzureSQLDatabase"));
    }
);
services.AddSingleton<TimeProvider>(TimeProvider.System);
services.AddSingleton<ILeadAbuseGuard, MemoryLeadAbuseGuard>();
services.AddScoped<ILeadTokenDelivery, ProtectedLeadTokenDelivery>();
services.AddScoped<ILeadTokenDispatcher, LeadTokenDispatcher>();
services.AddScoped<ILeadNotificationDispatcher, LeadNotificationDispatcher>();
services.AddScoped<IPublicLeadSessionService, PublicLeadSessionService>();
services.AddScoped<ILeadService, LeadService>();
services.AddSingleton(new StripeWebhookLeaseOptions());

// Honor proxy scheme/client information only from explicitly trusted proxies (loopback remains trusted
// by framework default). Configure additional production proxy addresses under ForwardedHeaders:KnownProxies.
services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.ForwardLimit = 1;
    foreach (var configuredProxy in builder.Configuration.GetSection("ForwardedHeaders:KnownProxies").Get<string[]>() ?? [])
    {
        if (IPAddress.TryParse(configuredProxy, out var proxy)) options.KnownProxies.Add(proxy);
    }
});

// Rate limiting configuration
services.AddMemoryCache();
services.Configure<IpRateLimitOptions>(options =>
{
    options.EnableEndpointRateLimiting = true;
    options.StackBlockedRequests = false;
    options.HttpStatusCode = 429; // Too Many Requests
    options.RealIpHeader = "X-Real-IP";
    options.ClientIdHeader = "X-ClientId";
    options.GeneralRules = new List<RateLimitRule>
    {
        // Stricter limits for authentication endpoints
        new RateLimitRule
        {
            Endpoint = "POST:/api/user/login",
            Period = "1m",
            Limit = 5 // 5 login attempts per minute
        },
        new RateLimitRule
        {
            Endpoint = "POST:/api/mfa/login/verify",
            Period = "1m",
            Limit = 10
        },
        new RateLimitRule
        {
            Endpoint = "POST:/api/mfa/enrollment/*",
            Period = "1m",
            Limit = 5
        },
        new RateLimitRule
        {
            Endpoint = "POST:/api/passkey/authentication/options",
            Period = "1m",
            Limit = 10
        },
        new RateLimitRule
        {
            Endpoint = "POST:/api/passkey/authentication/verify",
            Period = "1m",
            Limit = 10
        },
        new RateLimitRule
        {
            Endpoint = "POST:/api/user/register",
            Period = "1m",
            Limit = 3 // 3 registration attempts per minute
        },
        new RateLimitRule
        {
            Endpoint = "POST:/api/user/forgot-password",
            Period = "1h",
            Limit = 3 // 3 password reset requests per hour
        },
        new RateLimitRule
        {
            Endpoint = "POST:/api/user/reset-password",
            Period = "1h",
            Limit = 5 // 5 password reset attempts per hour
        },
        // Anonymous, tab-isolated impersonation refresh is limited per source IP.
        new RateLimitRule
        {
            Endpoint = "POST:/api/admin/impersonation/refresh",
            Period = "1m",
            Limit = 10
        },
        // Webhook endpoints should not be rate limited (they come from external services)
        new RateLimitRule
        {
            Endpoint = "POST:/api/stripe/webhook",
            Period = "1m",
            Limit = 1000 // High limit for webhooks from Stripe
        },
        new RateLimitRule
        {
            Endpoint = "POST:/api/docusign/connect",
            Period = "1m",
            Limit = 1000 // High limit for DocuSign Connect webhooks
        },
        // Public config endpoint - allow reasonable rate for mobile apps
        new RateLimitRule
        {
            Endpoint = "GET:/api/config/public",
            Period = "1m",
            Limit = 10 // 10 requests per minute per IP (mobile apps cache this)
        },
        new RateLimitRule
        {
            Endpoint = "POST:/api/admin/impersonation/start*",
            Period = "1m",
            Limit = 5
        },
        new RateLimitRule
        {
            Endpoint = "POST:/api/admin/impersonation/refresh",
            Period = "1m",
            Limit = 20
        },
        new RateLimitRule
        {
            Endpoint = "POST:/api/admin/impersonation/stop",
            Period = "1m",
            Limit = 10
        },
        // General API rate limiting
        new RateLimitRule
        {
            Endpoint = "*",
            Period = "1m",
            Limit = 100 // 100 requests per minute for authenticated users
        }
    };
});
services.AddInMemoryRateLimiting();
services.AddSingleton<IRateLimitConfiguration, RateLimitConfiguration>();

services.AddControllers().AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.Converters.Add(
            new JsonStringEnumConverter(JsonNamingPolicy.CamelCase)
        );
        o.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase; // props
    });
// Turn off claim mapping for Microsoft middleware
JwtSecurityTokenHandler.DefaultInboundClaimTypeMap.Clear();

// Swagger disabled - not needed for local development
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
// services.AddEndpointsApiExplorer();
// services.AddSwaggerGen(c =>
// {
//     c.AddSecurityDefinition(
//         "oauth2",
//         new OpenApiSecurityScheme
//         {
//             Description =
//                 "Standard Authorization header using the Bearer scheme, e.g. \"bearer {token} \"",
//             In = ParameterLocation.Header,
//             Name = "Authorization",
//             Type = SecuritySchemeType.ApiKey
//         }
//     );
//     c.OperationFilter<SecurityRequirementsOperationFilter>();
// });
// services.AddSwaggerGenNewtonsoftSupport();
services.AddAutoMapper(cfg =>
{
    var autoMapperLicenseKey = configuration["AutoMapper:LicenseKey"];
    if (!string.IsNullOrWhiteSpace(autoMapperLicenseKey))
    {
        cfg.LicenseKey = autoMapperLicenseKey;
    }
}, typeof(Program).Assembly);

// Services
services.AddHttpClient<IGoogleAuthService, GoogleAuthService>();
services.AddHttpClient<IAppleAuthService, AppleAuthService>();
services.AddScoped<IUserService, UserService>();
var dataProtectionKeysPath = configuration["DataProtection:KeysPath"];
if (string.IsNullOrWhiteSpace(dataProtectionKeysPath))
    dataProtectionKeysPath = Path.Combine(builder.Environment.ContentRootPath, "App_Data", "DataProtectionKeys");
Directory.CreateDirectory(dataProtectionKeysPath);
services.AddDataProtection()
    .SetApplicationName("PropertyPeace")
    .PersistKeysToFileSystem(new DirectoryInfo(dataProtectionKeysPath));
services.Configure<MfaOptions>(builder.Configuration.GetSection("Mfa"));
services.AddScoped<IMfaService, MfaService>();
services.AddSingleton<ImpersonationConnectionRegistry>();
services.AddSingleton<ImpersonationHubFilter>();
services.AddScoped<IImpersonationService, ImpersonationService>();
services.AddScoped<IUserContextService, UserContextService>();
services.AddScoped<IEmailVerificationService, EmailVerificationService>();
services.AddScoped<IPropertyService, PropertyService>();
services.AddScoped<IPropertyPortfolioService, PropertyPortfolioService>();
services.AddScoped<IMaintenanceRequestService, MaintenanceRequestService>();
services.AddScoped<IDemoRequestRepository, DemoRequestRepository>();
services.AddScoped<IDemoRequestService, DemoRequestService>();
services.AddScoped<IMaintenanceImageService, MaintenanceImageService>();
services.AddScoped<IUnitService, UnitService>();
services.AddScoped<IAzureBlobService, AzureBlobService>();
services.AddScoped<ILeaseService, LeaseService>();
services.AddScoped<ILeaseTemplateService, LeaseTemplateService>();
services.AddScoped<IPolicyPackService, PolicyPackService>();
services.AddScoped<ILeaseGenerationService, LeaseGenerationService>();
services.AddScoped<IStateRequiredDisclosureService, StateRequiredDisclosureService>();
services.AddScoped<ILeaseDocumentService, LeaseDocumentService>();
services.AddSingleton<ILeaseFinalizationLock, SqlLeaseFinalizationLock>();
services.AddScoped<ILeaseAutoRenewService, LeaseAutoRenewService>();
services.AddScoped<ILeaseChecklistSchedulingService, LeaseChecklistSchedulingService>();
services.AddScoped<IOpenAIService, OpenAIService>();
services.AddScoped<IPolicyAIService, PolicyAIService>();
services.AddScoped<ITenantService, TenantService>();
services.AddScoped<ITenantInviteService, TenantInviteService>();
services.AddScoped<brownstone_hub_api.Services.ClientService.IClientService, brownstone_hub_api.Services.ClientService.ClientService>();
services.AddScoped<brownstone_hub_api.Services.ClientStatementService.IClientStatementService, brownstone_hub_api.Services.ClientStatementService.ClientStatementService>();
services.AddScoped<ILandlordInviteService, LandlordInviteService>();
services.AddScoped<IApplicationInviteService, ApplicationInviteService>();
services.AddScoped<IDashboardService, DashboardService>();
services.AddScoped<IAICopilotService, AICopilotService>();
services.AddScoped<brownstone_hub_api.Services.ActionSuppressionService.IActionSuppressionService, brownstone_hub_api.Services.ActionSuppressionService.ActionSuppressionService>();
services.AddScoped<brownstone_hub_api.Services.AIFollowUpService.IAIFollowUpService, brownstone_hub_api.Services.AIFollowUpService.AIFollowUpService>();
services.AddScoped<IRentCollectionService, RentCollectionService>();
services.AddScoped<IHouseholdService, HouseholdService>();
services.AddScoped<IPaymentService, PaymentService>();
services.AddScoped<INotificationSettingService, NotificationSettingService>();
services.AddScoped<INotificationService, NotificationService>();
services.AddScoped<IScheduledNotificationService, ScheduledNotificationService>();
services.AddScoped<brownstone_hub_api.Services.AnnouncementService.IAnnouncementService, brownstone_hub_api.Services.AnnouncementService.AnnouncementService>();
services.AddScoped<IActivityService, ActivityService>();
services.AddScoped<IExpenseService, ExpenseService>();
services.AddScoped<IVendorService, VendorService>();
services.AddScoped<IRecurringExpenseService, RecurringExpenseService>();
services.AddScoped<IFutureExpenseService, FutureExpenseService>();
services.AddScoped<IExpenseReportService, ExpenseReportService>();
services.AddScoped<ITaxReportService, TaxReportService>();
services.AddScoped<IScheduleEPdfService, ScheduleEPdfService>();
services.AddScoped<IExpenseCategorizationService, ExpenseCategorizationService>();
services.AddScoped<IKPIReportService, KPIReportService>();
services.AddScoped<ITenantDocumentService, TenantDocumentService>();
services.AddScoped<IFileService, FileService>();
services.AddScoped<IFileCategoryService, FileCategoryService>();
services.AddScoped<IApplicationService, ApplicationService>();
services.AddScoped<IApplicationPdfService, ApplicationPdfService>();

// The legacy application screening path is retained only as a fail-closed compatibility service.
services.AddScoped<IBackgroundCheckService, BackgroundCheckService>();
services.AddFailClosedTenantScreening(configuration);
services.AddScoped<IChecklistService, ChecklistService>();
services.AddScoped<IOrganizationChecklistItemService, OrganizationChecklistItemService>();
services.AddScoped<IMoveInReportTemplateService, MoveInReportTemplateService>();
services.AddScoped<IConversationService, ConversationService>();
services.AddScoped<IMessageService, MessageService>();
services.AddScoped<IMessageAnalysisService, MessageAnalysisService>();
services.AddScoped<IAdminSettingsService, AdminSettingsService>();
services.AddScoped<ISupportRequestService, SupportRequestService>();
services.AddScoped<IAdminDashboardService, AdminDashboardService>();
services.AddSingleton(TimeProvider.System);
services.AddScoped<IStripeService, StripeService>();
services.AddScoped<IStripeSyncService, StripeSyncService>();
services.AddScoped<IStripeWebhookService, StripeWebhookService>();
services.AddScoped<IStripeRentGateway, StripeRentGateway>();
services.AddScoped<IStripeConnectedAccountGateway, StripeConnectedAccountGateway>();
services.AddScoped<IStripeConnectedPayeeService, StripeConnectedPayeeService>();
services.AddScoped<IStripeRentRiskService, StripeRentRiskService>();
services.AddScoped<IStripeRentPaymentService, StripeRentPaymentService>();
services.AddScoped<IStripeRentAllocationService, StripeRentAllocationService>();
services.AddScoped<IStripeRentLossAccountingService, StripeRentLossAccountingService>();
services.AddScoped<IStorageService, StorageService>();

// State Late Fee Law Service
services.AddScoped<brownstone_hub_api.Services.StateLateFeeLawService.IStateLateFeeLawService, brownstone_hub_api.Services.StateLateFeeLawService.StateLateFeeLawService>();
// State Deposit Law Service
services.AddScoped<IStateDepositLawService, StateDepositLawService>();
services.AddScoped<ISearchService, SearchService>();
services.AddScoped<IUpcomingFeatureService, UpcomingFeatureService>();
services.AddScoped<IDailySummaryEmailService, DailySummaryEmailService>();

// Subscription Services
services.AddOptions<FeatureReadinessOptions>()
    .Bind(configuration.GetSection(FeatureReadinessOptions.SectionName));
services.AddScoped<IFeatureReadinessService, FeatureReadinessService>();
services.AddScoped<ILeasingPipelineService, LeasingPipelineService>();
services.AddScoped<ISubscriptionService, SubscriptionService>();
services.AddScoped<ISubscriptionPlanService, SubscriptionPlanService>();
services.AddScoped<IFeatureGateService, FeatureGateService>();
services.AddScoped<IOrganizationSmsNumberService, OrganizationSmsNumberService>();
services.AddScoped<ITwilioPhoneNumberService, TwilioPhoneNumberService>();

// Anthropic (Claude) Configuration
services.Configure<AnthropicSettings>(configuration.GetSection("Anthropic"));
services.AddScoped<brownstone_hub_api.Services.AgentFollowUpService.IAgentFollowUpService, brownstone_hub_api.Services.AgentFollowUpService.AgentFollowUpService>();
services.AddScoped<brownstone_hub_api.Services.MaintenanceAgentService.IMaintenanceAgentService, brownstone_hub_api.Services.MaintenanceAgentService.MaintenanceAgentService>();
services.AddScoped<brownstone_hub_api.Services.LandlordMaintenanceAgentService.ILandlordMaintenanceAgentService, brownstone_hub_api.Services.LandlordMaintenanceAgentService.LandlordMaintenanceAgentService>();

// OpenAI Configuration
services.Configure<OpenAISettings>(configuration.GetSection("OpenAI"));

// Message Analysis Configuration
services.Configure<MessageAnalysisSettings>(configuration.GetSection("MessageAnalysis"));

// Log OpenAI configuration status for debugging
var openAISection = configuration.GetSection("OpenAI");
var openAIApiKey = openAISection["ApiKey"];
Console.WriteLine($"[Config] OpenAI:ApiKey from configuration: {(string.IsNullOrEmpty(openAIApiKey) ? "NOT SET" : "SET (length: " + openAIApiKey.Length + ")")}");
Console.WriteLine($"[Config] OpenAI:Model: {openAISection["Model"] ?? "not set"}");
Console.WriteLine($"[Config] OpenAI:OrganizationId: {openAISection["OrganizationId"] ?? "not set"}");

// DocuSign Configuration
services.Configure<DocuSignSettings>(configuration.GetSection("DocuSign"));

// E-Signature Service - Use DocuSign if configured, otherwise use stub
var docuSignSettings = configuration.GetSection("DocuSign").Get<DocuSignSettings>();
if (docuSignSettings != null && !string.IsNullOrEmpty(docuSignSettings.IntegrationKey) && !string.IsNullOrEmpty(docuSignSettings.UserId))
{
    services.AddScoped<IESignatureService, DocuSignService>();
    builder.Logging.AddConsole().AddFilter("DocuSign", LogLevel.Information);
}
else
{
    services.AddScoped<IESignatureService, ESignatureService>();
    builder.Logging.AddConsole().AddFilter("ESignatureService", LogLevel.Warning);
}

// Azure Communication Services Configuration (Email & SMS)
var azureCommSection = configuration.GetSection("AzureCommunication");
var connectionString = azureCommSection["ConnectionString"];
var senderAddress = azureCommSection["SenderAddress"];

// Log configuration loading for debugging
Console.WriteLine($"[Config] AzureCommunication:ConnectionString - HasValue: {!string.IsNullOrWhiteSpace(connectionString)}, Length: {connectionString?.Length ?? 0}");
Console.WriteLine($"[Config] AzureCommunication:SenderAddress - HasValue: {!string.IsNullOrWhiteSpace(senderAddress)}, Value: {(string.IsNullOrWhiteSpace(senderAddress) ? "(empty)" : senderAddress)}");

// Log all AzureCommunication keys for debugging
var allKeys = configuration.GetSection("AzureCommunication").GetChildren();
Console.WriteLine($"[Config] AzureCommunication section has {allKeys.Count()} child keys");
foreach (var key in allKeys)
{
    Console.WriteLine($"[Config]   - {key.Key}: {(string.IsNullOrWhiteSpace(key.Value) ? "(empty)" : "***HIDDEN***")}");
}

services.Configure<AzureCommunicationSettings>(azureCommSection);
services.AddScoped<IEmailService, AzureCommunicationEmailService>();

// SMS Service Configuration - Support both Azure and Twilio
var smsProvider = configuration["SmsProvider"] ?? "Azure"; // Default to Azure for backward compatibility
var twilioSection = configuration.GetSection("Twilio");
var twilioAccountSid = twilioSection["AccountSid"];
var twilioAuthToken = twilioSection["AuthToken"];
var twilioFromPhoneNumber = twilioSection["FromPhoneNumber"];
var twilioMessagingServiceSid = twilioSection["MessagingServiceSid"];
var maskedTwilioAccountSid = string.IsNullOrWhiteSpace(twilioAccountSid)
    ? "(empty)"
    : $"{twilioAccountSid[..Math.Min(2, twilioAccountSid.Length)]}*** len={twilioAccountSid.Length}, startsWithAC={twilioAccountSid.StartsWith("AC", StringComparison.Ordinal)}";
Console.WriteLine($"[Config] Twilio:AccountSid: {maskedTwilioAccountSid}");
Console.WriteLine($"[Config] Twilio:AuthToken: {(string.IsNullOrWhiteSpace(twilioAuthToken) ? "(empty)" : $"SET len={twilioAuthToken.Length}")}");
Console.WriteLine($"[Config] Twilio:FromPhoneNumber: {(string.IsNullOrWhiteSpace(twilioFromPhoneNumber) ? "(empty)" : "SET")}");
Console.WriteLine($"[Config] Twilio:MessagingServiceSid: {(string.IsNullOrWhiteSpace(twilioMessagingServiceSid) ? "(empty)" : $"{twilioMessagingServiceSid[..Math.Min(2, twilioMessagingServiceSid.Length)]}*** len={twilioMessagingServiceSid.Length}")}");

if (smsProvider.Equals("Twilio", StringComparison.OrdinalIgnoreCase))
{
    services.Configure<TwilioSettings>(twilioSection);
    services.AddScoped<ISmsService, TwilioSmsService>();
    Console.WriteLine("[Config] Using Twilio as SMS provider");
}
else
{
    services.AddScoped<ISmsService, AzureCommunicationSmsService>();
    Console.WriteLine("[Config] Using Azure Communication Services as SMS provider");
}

services.AddScoped<IInboundSmsService, InboundSmsService>();
services.AddScoped<brownstone_hub_api.Services.EmailSyncService.IInboundEmailService, brownstone_hub_api.Services.EmailSyncService.InboundEmailService>();
services.AddScoped<ICommunicationService, CommunicationService>();
services.Configure<TwilioSettings>(twilioSection);

// SMS Template Configuration
services.Configure<SmsTemplateSettings>(configuration.GetSection("SmsTemplates"));
services.AddSingleton<SmsTemplateService>();

// Email Template Configuration
services.Configure<EmailTemplateSettings>(configuration.GetSection("EmailTemplates"));
services.AddSingleton<EmailTemplateService>();

// SignalR for real-time notifications
services.AddSignalR(options =>
{
    options.EnableDetailedErrors = builder.Environment.IsDevelopment();
    options.MaximumReceiveMessageSize = 65536; // 64KB
    options.AddFilter<ImpersonationHubFilter>();
});

// Background Services
services.AddHostedService<NotificationBackgroundService>();
services.AddHostedService<LeadTokenDeliveryBackgroundService>();
services.AddHostedService<LeadNotificationDeliveryBackgroundService>();
services.AddHostedService<RecurringExpenseGenerationBackgroundService>();
services.AddHostedService<SubscriptionBackgroundService>();
services.AddHostedService<StateLateFeeLawUpdateBackgroundService>();
services.AddHostedService<StateDepositLawUpdateBackgroundService>();
services.AddHostedService<LeaseAutoRenewBackgroundService>();
services.AddHostedService<LeaseChecklistSchedulingBackgroundService>();
services.AddHostedService<DailySummaryEmailBackgroundService>();
services.AddHostedService<brownstone_hub_api.Services.AgentFollowUpService.AgentFollowUpBackgroundService>();
services.AddHostedService<StripeRentTransferBackgroundService>();

// Repositories
services.AddScoped<IAdminDashboardRepository, AdminDashboardRepository>();
services.AddScoped<IUserRepository, UserRepository>();
services.AddScoped<IPropertyRepository, PropertyRepository>();
services.AddScoped<IMaintenanceRequestRepository, MaintenanceRequestRepository>();
services.AddScoped<IMaintenanceImageRepository, MaintenanceImageRepository>();
services.AddScoped<IDemoRequestRepository, DemoRequestRepository>();
services.AddScoped<IRoleRepository, RoleRepository>();
services.AddScoped<IUnitRepository, UnitRepository>();
services.AddScoped<ILeaseRepository, LeaseRepository>();
services.AddScoped<ILeaseTemplateRepository, LeaseTemplateRepository>();
services.AddScoped<IPolicyPackRepository, PolicyPackRepository>();
services.AddScoped<ILeaseInstanceRepository, LeaseInstanceRepository>();
services.AddScoped<ITenantRepository, TenantRepository>();
services.AddScoped<ITenantInviteRepository, TenantInviteRepository>();
services.AddScoped<ILandlordInviteRepository, LandlordInviteRepository>();
services.AddScoped<IVendorRepository, VendorRepository>();
services.AddScoped<IApplicationInviteRepository, ApplicationInviteRepository>();
services.AddScoped<IPaymentRepository, PaymentRepository>();
services.AddScoped<INotificationSettingRepository, NotificationSettingRepository>();
services.AddScoped<INotificationRepository, NotificationRepository>();
services.AddScoped<IExpenseRepository, ExpenseRepository>();
services.AddScoped<ITaxCategoryRepository, TaxCategoryRepository>();
services.AddScoped<IRecurringExpenseRepository, RecurringExpenseRepository>();
services.AddScoped<IFutureExpenseRepository, FutureExpenseRepository>();
services.AddScoped<IExpenseReceiptRepository, ExpenseReceiptRepository>();
services.AddScoped<IExpenseReceiptService, ExpenseReceiptService>();
services.AddScoped<ITenantDocumentRepository, TenantDocumentRepository>();
services.AddScoped<IFileRepository, FileRepository>();
services.AddScoped<IFileCategoryRepository, FileCategoryRepository>();
services.AddScoped<IApplicationRepository, ApplicationRepository>();
services.AddScoped<IChecklistRepository, ChecklistRepository>();
services.AddScoped<IOrganizationChecklistItemRepository, OrganizationChecklistItemRepository>();
services.AddScoped<IMoveInReportTemplateRepository, MoveInReportTemplateRepository>();
services.AddScoped<IAdminSettingsRepository, AdminSettingsRepository>();
services.AddScoped<IConversationRepository, ConversationRepository>();
services.AddScoped<IMessageRepository, MessageRepository>();
services.AddScoped<IUpcomingFeatureRepository, UpcomingFeatureRepository>();
services.AddScoped(typeof(IImageRepository<,,>), typeof(ImageRepository<,,>));
// Note: ImageRepository is generic and will work for ListingImage automatically

// State Late Fee Law Repository
services.AddScoped<IStateLateFeeLawRepository, StateLateFeeLawRepository>();
// State Deposit Law Repository
services.AddScoped<IStateDepositLawRepository, StateDepositLawRepository>();
// Job Run History Repository
services.AddScoped<IJobRunHistoryRepository, JobRunHistoryRepository>();
// State Law Source Repository
services.AddScoped<IStateLawSourceRepository, StateLawSourceRepository>();

// Rentcast Rent Estimate
services.Configure<brownstone_hub_api.Config.RentcastSettings>(configuration.GetSection("RentCast"));
services.AddHttpClient("Rentcast", (sp, client) =>
{
    var settings = sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<brownstone_hub_api.Config.RentcastSettings>>().Value;
    client.BaseAddress = new Uri(settings.BaseUrl.TrimEnd('/') + "/");
    client.DefaultRequestHeaders.Add("X-Api-Key", settings.ApiKey);
    client.DefaultRequestHeaders.Add("Accept", "application/json");
});
services.AddScoped<brownstone_hub_api.Services.RentEstimateService.IRentEstimateService, brownstone_hub_api.Services.RentEstimateService.RentEstimateService>();
services.AddScoped<brownstone_hub_api.Services.PropertyRecordService.IPropertyRecordService, brownstone_hub_api.Services.PropertyRecordService.PropertyRecordService>();

// LeaseShield Repositories and Service
services.AddScoped<ILeaseShieldConversationRepository, LeaseShieldConversationRepository>();
services.AddScoped<ILeaseShieldMessageRepository, LeaseShieldMessageRepository>();
services.AddScoped<ILeaseShieldStateLawSourceRepository, LeaseShieldStateLawSourceRepository>();
services.AddScoped<ILeaseShieldStateLawSectionRepository, LeaseShieldStateLawSectionRepository>();
services.AddScoped<ILeaseShieldService, LeaseShieldService>();

// Job Runner (admin manual run)
services.AddScoped<IJobRunnerService, JobRunnerService>();
services.AddScoped<IStateLawSourceService, StateLawSourceService>();

// Subscription Repositories
services.AddScoped<ISubscriptionRepository, SubscriptionRepository>();
services.AddScoped<ISubscriptionPlanRepository, SubscriptionPlanRepository>();
services.AddScoped<ISubscriptionHistoryRepository, SubscriptionHistoryRepository>();
services.AddScoped<IOrganizationSmsNumberRepository, OrganizationSmsNumberRepository>();

// Organization Repositories
services.AddScoped<brownstone_hub_api.Repositories.Organizations.IOrganizationRepository, brownstone_hub_api.Repositories.Organizations.OrganizationRepository>();
services.AddScoped<brownstone_hub_api.Repositories.Organizations.IOrganizationMemberRepository, brownstone_hub_api.Repositories.Organizations.OrganizationMemberRepository>();
services.AddScoped<brownstone_hub_api.Repositories.Organizations.IOrganizationInviteRepository, brownstone_hub_api.Repositories.Organizations.OrganizationInviteRepository>();

// Client Repositories
services.AddScoped<brownstone_hub_api.Repositories.Clients.IClientRepository, brownstone_hub_api.Repositories.Clients.ClientRepository>();
services.AddScoped<brownstone_hub_api.Repositories.BankAccounts.IBankAccountRepository, brownstone_hub_api.Repositories.BankAccounts.BankAccountRepository>();
services.AddScoped<brownstone_hub_api.Repositories.Accounts.IAccountRepository, brownstone_hub_api.Repositories.Accounts.AccountRepository>();
services.AddScoped<brownstone_hub_api.Repositories.GeneralLedger.IGeneralLedgerRepository, brownstone_hub_api.Repositories.GeneralLedger.GeneralLedgerRepository>();
services.AddScoped<brownstone_hub_api.Repositories.ActionSuppressions.IActionSuppressionRepository, brownstone_hub_api.Repositories.ActionSuppressions.ActionSuppressionRepository>();

// Time Tracking Repositories
services.AddScoped<brownstone_hub_api.Repositories.TimeEntries.ITimeEntryRepository, brownstone_hub_api.Repositories.TimeEntries.TimeEntryRepository>();
services.AddScoped<brownstone_hub_api.Repositories.TimeBreaks.ITimeBreakRepository, brownstone_hub_api.Repositories.TimeBreaks.TimeBreakRepository>();
services.AddScoped<brownstone_hub_api.Repositories.StaffMembers.IStaffMemberRepository, brownstone_hub_api.Repositories.StaffMembers.StaffMemberRepository>();
services.AddScoped<brownstone_hub_api.Repositories.StaffMembers.IStaffMemberInviteRepository, brownstone_hub_api.Repositories.StaffMembers.StaffMemberInviteRepository>();
services.AddScoped<brownstone_hub_api.Repositories.TimeTrackingSettings.ITimeTrackingSettingsRepository, brownstone_hub_api.Repositories.TimeTrackingSettings.TimeTrackingSettingsRepository>();
services.AddScoped<brownstone_hub_api.Repositories.Listings.IListingRepository, brownstone_hub_api.Repositories.Listings.ListingRepository>();
services.AddScoped<brownstone_hub_api.Repositories.Amenities.IAmenityRepository, brownstone_hub_api.Repositories.Amenities.AmenityRepository>();
services.AddScoped<brownstone_hub_api.Repositories.Features.IFeatureRepository, brownstone_hub_api.Repositories.Features.FeatureRepository>();

// Action Suppression Service
services.AddScoped<brownstone_hub_api.Services.ActionSuppressionService.IActionSuppressionService, brownstone_hub_api.Services.ActionSuppressionService.ActionSuppressionService>();

// Organization Services
services.AddScoped<brownstone_hub_api.Services.OrganizationService.IOrganizationService, brownstone_hub_api.Services.OrganizationService.OrganizationService>();
services.AddScoped<brownstone_hub_api.Services.OrganizationMemberService.IOrganizationMemberService, brownstone_hub_api.Services.OrganizationMemberService.OrganizationMemberService>();
services.AddScoped<brownstone_hub_api.Services.OrganizationInviteService.IOrganizationInviteService, brownstone_hub_api.Services.OrganizationInviteService.OrganizationInviteService>();
services.AddScoped<brownstone_hub_api.Services.BankAccountService.IBankAccountService, brownstone_hub_api.Services.BankAccountService.BankAccountService>();
services.AddScoped<brownstone_hub_api.Services.AccountService.IAccountService, brownstone_hub_api.Services.AccountService.AccountService>();
services.AddScoped<brownstone_hub_api.Services.GeneralLedgerService.IGeneralLedgerService, brownstone_hub_api.Services.GeneralLedgerService.GeneralLedgerService>();
services.AddScoped<brownstone_hub_api.Services.FinancialStatementService.IFinancialStatementService, brownstone_hub_api.Services.FinancialStatementService.FinancialStatementService>();
services.AddScoped<brownstone_hub_api.Services.AccountMappingService.IAccountMappingService, brownstone_hub_api.Services.AccountMappingService.AccountMappingService>();
services.AddScoped<brownstone_hub_api.Repositories.BankReconciliation.IBankReconciliationRepository, brownstone_hub_api.Repositories.BankReconciliation.BankReconciliationRepository>();
services.AddScoped<brownstone_hub_api.Services.BankReconciliationService.IBankReconciliationService, brownstone_hub_api.Services.BankReconciliationService.BankReconciliationService>();

// Time Tracking Services
services.AddScoped<brownstone_hub_api.Services.TimeEntryService.ITimeEntryService, brownstone_hub_api.Services.TimeEntryService.TimeEntryService>();
services.AddScoped<brownstone_hub_api.Services.TimeBreakService.ITimeBreakService, brownstone_hub_api.Services.TimeBreakService.TimeBreakService>();
services.AddScoped<brownstone_hub_api.Services.StaffMemberService.IStaffMemberService, brownstone_hub_api.Services.StaffMemberService.StaffMemberService>();
services.AddScoped<brownstone_hub_api.Services.StaffMemberInviteService.IStaffMemberInviteService, brownstone_hub_api.Services.StaffMemberInviteService.StaffMemberInviteService>();
services.AddScoped<brownstone_hub_api.Services.TimeTrackingSettingsService.ITimeTrackingSettingsService, brownstone_hub_api.Services.TimeTrackingSettingsService.TimeTrackingSettingsService>();

// Logging
services.AddTransient<ILoggingService, LoggingService>();

// Images
services.AddScoped<
    IImageService<MaintenanceImage, LoadImageDto, AddImageDto>>(sp =>
{
    var blob = sp.GetRequiredService<BlobServiceClient>();
    var azureBlob = sp.GetRequiredService<IAzureBlobService>();
    var repo = sp.GetRequiredService<IImageRepository<MaintenanceImage, LoadImageDto, AddImageDto>>();
    var logger = sp.GetRequiredService<ILogger<ImageService<MaintenanceImage, LoadImageDto, AddImageDto>>>();
    var storage = sp.GetRequiredService<IStorageService>();
    var httpContextAccessor = sp.GetRequiredService<IHttpContextAccessor>();

    return new ImageService<MaintenanceImage, LoadImageDto, AddImageDto>(
        blob, azureBlob, repo, logger, storage, httpContextAccessor, "maintenance-images"
    );
});
services.AddScoped<
    IImageService<PropertyImage, LoadImageDto, AddImageDto>>(sp =>
{
    var blob = sp.GetRequiredService<BlobServiceClient>();
    var azureBlob = sp.GetRequiredService<IAzureBlobService>();
    var repo = sp.GetRequiredService<IImageRepository<PropertyImage, LoadImageDto, AddImageDto>>();
    var logger = sp.GetRequiredService<ILogger<ImageService<PropertyImage, LoadImageDto, AddImageDto>>>();
    var storage = sp.GetRequiredService<IStorageService>();
    var httpContextAccessor = sp.GetRequiredService<IHttpContextAccessor>();

    return new ImageService<PropertyImage, LoadImageDto, AddImageDto>(
        blob, azureBlob, repo, logger, storage, httpContextAccessor, "property-images"
    );
});
services.AddScoped<
    IImageService<ExpenseReceipt, LoadImageDto, AddImageDto>>(sp =>
{
    var blob = sp.GetRequiredService<BlobServiceClient>();
    var azureBlob = sp.GetRequiredService<IAzureBlobService>();
    var repo = sp.GetRequiredService<IImageRepository<ExpenseReceipt, LoadImageDto, AddImageDto>>();
    var logger = sp.GetRequiredService<ILogger<ImageService<ExpenseReceipt, LoadImageDto, AddImageDto>>>();
    var storage = sp.GetRequiredService<IStorageService>();
    var httpContextAccessor = sp.GetRequiredService<IHttpContextAccessor>();

    return new ImageService<ExpenseReceipt, LoadImageDto, AddImageDto>(
        blob, azureBlob, repo, logger, storage, httpContextAccessor, "expense-receipts"
    );
});
services.AddScoped<
    IImageService<ListingImage, LoadImageDto, AddImageDto>>(sp =>
{
    var blob = sp.GetRequiredService<BlobServiceClient>();
    var azureBlob = sp.GetRequiredService<IAzureBlobService>();
    var repo = sp.GetRequiredService<IImageRepository<ListingImage, LoadImageDto, AddImageDto>>();
    var logger = sp.GetRequiredService<ILogger<ImageService<ListingImage, LoadImageDto, AddImageDto>>>();
    var storage = sp.GetRequiredService<IStorageService>();
    var httpContextAccessor = sp.GetRequiredService<IHttpContextAccessor>();

    return new ImageService<ListingImage, LoadImageDto, AddImageDto>(
        blob, azureBlob, repo, logger, storage, httpContextAccessor, "listing-images"
    );
});

// Listing Services
services.AddScoped<brownstone_hub_api.Services.ListingService.IListingService, brownstone_hub_api.Services.ListingService.ListingService>();
services.AddScoped<brownstone_hub_api.Services.ListingAIService.IListingAIService, brownstone_hub_api.Services.ListingAIService.ListingAIService>();

// Task Services
services.AddScoped<brownstone_hub_api.Repositories.LandlordTask.ILandlordTaskRepository, brownstone_hub_api.Repositories.LandlordTask.LandlordTaskRepository>();
services.AddScoped<brownstone_hub_api.Services.LandlordTaskService.ILandlordTaskService, brownstone_hub_api.Services.LandlordTaskService.LandlordTaskService>();


// Authentication
services.Configure<JwtSettings>(builder.Configuration.GetSection("JwtSettings"));
services
    .AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    })
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = configuration["JwtSettings:Issuer"],
            ValidAudience = configuration["JwtSettings:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(
            Convert.FromBase64String(configuration["JwtSettings:SecretKey"] ?? throw new InvalidOperationException("JWT SecretKey is not configured"))
        ),
            ClockSkew = TimeSpan.Zero,
            RoleClaimType = ClaimTypes.Role,
            // (optional) catch alg drift fast
            ValidAlgorithms = [SecurityAlgorithms.HmacSha256]
        };

        // Configure JWT Bearer for SignalR and role claims
        options.Events = new Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerEvents
        {
            OnTokenValidated = async context =>
            {
                if (context.Principal == null)
                {
                    context.Fail("Token principal is unavailable.");
                    return;
                }

                if (string.Equals(context.Principal.FindFirstValue("is_impersonating"), "true", StringComparison.OrdinalIgnoreCase) &&
                    !context.HttpContext.Request.Path.Equals("/api/admin/impersonation/stop", StringComparison.OrdinalIgnoreCase))
                {
                    var impersonationService = context.HttpContext.RequestServices.GetRequiredService<IImpersonationService>();
                    if (!await impersonationService.ValidateAccessTokenSessionAsync(context.Principal))
                    {
                        context.Fail("Impersonation session is stopped, expired, or invalid.");
                        return;
                    }
                }

                // Ensure role claims are properly added to the identity
                // This is needed because DefaultInboundClaimTypeMap.Clear() might affect role claim mapping
                if (context.Principal?.Identity is ClaimsIdentity identity)
                {
                    // Find all role claims and ensure they're in the correct claim type
                    var roleClaims = context.Principal.FindAll(ClaimTypes.Role).ToList();
                    foreach (var roleClaim in roleClaims)
                    {
                        // Ensure the role claim is added to the identity with the correct type
                        if (!identity.HasClaim(ClaimTypes.Role, roleClaim.Value))
                        {
                            identity.AddClaim(new Claim(ClaimTypes.Role, roleClaim.Value));
                        }
                    }
                }
            },
            OnMessageReceived = context =>
            {
                var path = context.HttpContext.Request.Path;

                // SignalR can send the token in the query string or as a header
                if (path.StartsWithSegments("/notificationHub") || path.StartsWithSegments("/conversationHub"))
                {
                    // Try query string first (for WebSocket connection)
                    var accessToken = context.Request.Query["access_token"];

                    if (string.IsNullOrEmpty(accessToken))
                    {
                        // Try Authorization header
                        var authHeader = context.Request.Headers["Authorization"].FirstOrDefault();
                        if (!string.IsNullOrEmpty(authHeader) && authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
                        {
                            accessToken = authHeader.Substring("Bearer ".Length).Trim();
                        }
                    }

                    if (!string.IsNullOrEmpty(accessToken))
                    {
                        context.Token = accessToken;
                    }
                }
                return Task.CompletedTask;
            }
        };
    });
services.AddAuthorizationBuilder()
  .AddPolicy("AdminOnly", policy => policy.RequireRole("Admin"))
  .AddPolicy("LandlordOnly", policy => policy.RequireRole("Landlord"))
  .AddPolicy("TenantOnly", policy => policy.RequireRole("Tenant"));


services.AddHttpContextAccessor();
services.AddSingleton<IPrincipal>(
    provider => provider.GetService<IHttpContextAccessor>()?.HttpContext?.User ?? throw new InvalidOperationException("HttpContextAccessor is not available")
);

// Try to read CORS configuration - Azure App Config might store it as JSON or flat structure
string[]? allowed = null;

// First, try the flat structure (Cors:AllowedOrigins:0, Cors:AllowedOrigins:1, etc.)
var corsSection = builder.Configuration.GetSection("Cors:AllowedOrigins");
if (corsSection.Exists() && corsSection.GetChildren().Any())
{
    allowed = corsSection.Get<string[]>();
}

// If that didn't work, try parsing from the "Cors" key as JSON (Azure App Config format)
if (allowed == null || allowed.Length == 0)
{
    var corsJsonString = builder.Configuration["Cors"];
    if (!string.IsNullOrWhiteSpace(corsJsonString))
    {
        try
        {
            var corsConfig = JsonConvert.DeserializeObject<Dictionary<string, string[]>>(corsJsonString);
            if (corsConfig != null && corsConfig.TryGetValue("AllowedOrigins", out var origins))
            {
                allowed = origins;
                Console.WriteLine("[CORS] Parsed origins from JSON configuration");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[CORS] Error parsing CORS JSON configuration: {ex.Message}");
        }
    }
}

// Fallback to default origins if configuration is still empty
if (allowed == null || allowed.Length == 0)
{
    Console.WriteLine("[CORS] WARNING: No allowed origins configured, using default production origins");
    allowed = new[]
    {
        "https://app.brownstonehub.com",
        "https://www.app.brownstonehub.com",
        "https://landlord.brownstonehub.com",
        "https://www.landlord.brownstonehub.com"
    };
}

// Always allow common local dev origins in Development, even when Azure App Configuration supplies prod origins.
if (builder.Environment.IsDevelopment())
{
    allowed = allowed
        .Concat(new[]
        {
            "http://localhost:3000",
            "https://localhost:3000",
            "http://localhost:3001",
            "https://localhost:3001",
            "http://localhost:5173",
            "https://localhost:5173"
        })
        .ToArray();
}

// Always include the current Property Peace production frontend origins. Azure App Configuration
// may still contain only legacy Brownstone origins during the rebrand, so keep these code-level
// defaults as a safety net.
allowed = allowed
    .Concat(new[]
    {
        "https://app.propertypeace.io",
        "https://propertypeace.io",
        "https://www.propertypeace.io"
    })
    .ToArray();

// Remove duplicates and empty entries
allowed = allowed.Where(x => !string.IsNullOrWhiteSpace(x)).Distinct().ToArray();

var webAuthnServerDomain = builder.Configuration["WebAuthn:ServerDomain"]
    ?? (builder.Environment.IsDevelopment() ? "localhost" : "propertypeace.io");
var configuredWebAuthnOrigins = builder.Configuration.GetSection("WebAuthn:Origins").Get<string[]>();
var webAuthnOrigins = (configuredWebAuthnOrigins is { Length: > 0 }
        ? configuredWebAuthnOrigins
        : allowed.Where(origin =>
        {
            if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri)) return false;
            return string.Equals(uri.Host, webAuthnServerDomain, StringComparison.OrdinalIgnoreCase)
                || uri.Host.EndsWith($".{webAuthnServerDomain}", StringComparison.OrdinalIgnoreCase);
        }).ToArray())
    .Select(origin => origin.TrimEnd('/'))
    .ToHashSet(StringComparer.OrdinalIgnoreCase);

services.AddFido2(options =>
{
    options.ServerDomain = webAuthnServerDomain;
    options.ServerName = "Property Peace";
    options.Origins = webAuthnOrigins;
    options.TimestampDriftTolerance = 300000;
});

Console.WriteLine($"[WebAuthn] RP ID: {webAuthnServerDomain}; configured origins: {webAuthnOrigins.Count}");

Console.WriteLine($"[CORS] Configured allowed origins ({allowed.Length}): {string.Join(", ", allowed)}");

services.AddCors(options =>
{
    options.AddPolicy(
        allowMyOrigins,
        policyBuilder =>
        {
            var allowedOrigins = allowed.ToHashSet(StringComparer.OrdinalIgnoreCase);

            policyBuilder
                .SetIsOriginAllowed(origin =>
                {
                    if (allowedOrigins.Contains(origin))
                    {
                        return true;
                    }

                    // Credentialed requests must use an explicitly configured origin.
                    return false;
                })
                .WithHeaders(
                    "Authorization",
                    "Content-Type",
                    "X-Requested-With",
                    "Accept",
                    "Origin",
                    "x-signalr-user-agent", // Required for SignalR
                    "x-requested-with", // Alternative casing
                    "x-organization-id" // Required for organization context
                )
                .WithMethods("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS") // Specific methods only
                .AllowCredentials() // Required for SignalR - this means we CANNOT use wildcard *
                .SetPreflightMaxAge(TimeSpan.FromMinutes(10)); // Cache preflight requests
        }
    );
});

// Health check to database
services.AddHealthChecks()
.AddCheck<HealthService>("HealthCheck", failureStatus: HealthStatus.Degraded)
.AddDbContextCheck<DataContext>();

services.ConfigureHttpJsonOptions(o =>
{
    o.SerializerOptions.Converters.Add(
        new JsonStringEnumConverter(JsonNamingPolicy.CamelCase)
    );
});

var app = builder.Build();
// Must run before redirects, authentication, cookies, auditing, rate limits, and endpoint routing.
app.UseForwardedHeaders();
ServiceResponseSettings.ShowDetailedErrors = app.Environment.IsDevelopment() || app.Environment.IsEnvironment("Local");
Console.WriteLine($"[Config] Detailed API error responses: {(ServiceResponseSettings.ShowDetailedErrors ? "enabled" : "disabled")}");

app.MapHealthChecks("/health", new HealthCheckOptions
{
    ResultStatusCodes =
    {
        [HealthStatus.Healthy] = StatusCodes.Status200OK,
        [HealthStatus.Degraded] = StatusCodes.Status500InternalServerError,
        [HealthStatus.Unhealthy] = StatusCodes.Status500InternalServerError
    },
    ResponseWriter = async (context, report) =>
    {
        context.Response.ContentType = "application/json";
        var response = new HealthCheckResponse
        {
            Status = report.Status.ToString(),
            HealthChecks = report.Entries.Select(x => new IndividualHealthCheckResponse
            {
                Component = x.Key,
                Status = x.Value.Status.ToString()
            }),
            HealthCheckDuration = report.TotalDuration
        };
        await context.Response.WriteAsync(JsonConvert.SerializeObject(response));
    }
});

// Configure the HTTP request pipeline.
// Swagger disabled - not needed for local development
// if (app.Environment.IsDevelopment())
// {
//     app.UseSwagger();
//     app.UseSwaggerUI();
// }

// Security headers - add early in pipeline
app.UseSecurityHeaders();

// Rate limiting - should be early in pipeline, after security headers
app.UseIpRateLimiting();

// CORS must be BEFORE UseAuthentication/UseAuthorization for SignalR
// This handles preflight OPTIONS requests for SignalR negotiation
app.UseCors(allowMyOrigins);

// HTTPS redirection - redirect HTTP to HTTPS
app.UseHttpsRedirection();

if (!string.IsNullOrWhiteSpace(appConfigConnectionString))
{
    app.UseAzureAppConfiguration();
}

// Authentication must come after CORS for SignalR
// OPTIONS preflight requests will bypass authentication
app.UseAuthentication();

// Organization context middleware - sets organization context from header/user
app.UseOrganizationContext();

// Persist one post-completion, body-free record for every impersonated request.
app.UseImpersonationAudit();

app.UseAuthorization();

// Map SignalR Hubs - must be after UseCors and UseAuthentication/UseAuthorization
// SignalR will use the authorization configured in JWT Bearer for actual connections
// CORS middleware handles OPTIONS preflight requests before authentication
// We use [Authorize] on the hub methods to require authentication for connections
// IMPORTANT: Map hubs BEFORE MapControllers to ensure SignalR routes are registered first
var logger = app.Services.GetRequiredService<ILogger<Program>>();
logger.LogInformation("[SignalR] Registering SignalR hubs...");
app.MapHub<NotificationHub>("/notificationHub");
logger.LogInformation("[SignalR] NotificationHub registered at /notificationHub");
app.MapHub<ConversationHub>("/conversationHub");
logger.LogInformation("[SignalR] ConversationHub registered at /conversationHub");
logger.LogInformation("[SignalR] SignalR hubs registration complete");

app.MapControllers();

// Health check endpoint
app.MapGet("/", () => Results.Ok("API is up"));

// Diagnostic endpoint to verify SignalR hubs are registered
app.MapGet("/api/signalr/status", () => Results.Ok(new
{
    hubsRegistered = true,
    notificationHub = "/notificationHub",
    conversationHub = "/conversationHub",
    timestamp = DateTime.UtcNow
}));

// Seed subscription plans on startup
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<DataContext>();
    try
    {
        await SubscriptionPlanSeeder.SeedSubscriptionPlansAsync(context);
        await MaintenanceCategorySeeder.SeedMaintenanceCategoriesAsync(context);
    }
    catch (Exception ex)
    {
        var seedLogger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
        seedLogger.LogError(ex, "Error seeding subscription plans");
    }
}

// Seed lease builder data on startup
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<DataContext>();
    try
    {
        await LeaseBuilderSeeder.SeedLeaseBuilderDataAsync(context);
    }
    catch (Exception ex)
    {
        var leaseLogger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
        leaseLogger.LogError(ex, "Error seeding lease builder data");
    }
}



app.Run();

