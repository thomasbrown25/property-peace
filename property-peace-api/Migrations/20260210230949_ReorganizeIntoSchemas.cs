using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class ReorganizeIntoSchemas : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_FutureExpenses_Organizations_OrganizationId",
                table: "FutureExpenses");

            migrationBuilder.DropForeignKey(
                name: "FK_FutureExpenses_Properties_PropertyId",
                table: "FutureExpenses");

            migrationBuilder.EnsureSchema(
                name: "financial");

            migrationBuilder.EnsureSchema(
                name: "core");

            migrationBuilder.EnsureSchema(
                name: "communication");

            migrationBuilder.EnsureSchema(
                name: "invite");

            migrationBuilder.EnsureSchema(
                name: "listing");

            migrationBuilder.EnsureSchema(
                name: "checklist");

            migrationBuilder.EnsureSchema(
                name: "lease_builder");

            migrationBuilder.EnsureSchema(
                name: "client");

            migrationBuilder.EnsureSchema(
                name: "admin");

            migrationBuilder.EnsureSchema(
                name: "document");

            migrationBuilder.EnsureSchema(
                name: "lease");

            migrationBuilder.EnsureSchema(
                name: "maintenance");

            migrationBuilder.EnsureSchema(
                name: "organization");

            migrationBuilder.EnsureSchema(
                name: "property");

            migrationBuilder.EnsureSchema(
                name: "tenant");

            migrationBuilder.EnsureSchema(
                name: "staff");

            migrationBuilder.EnsureSchema(
                name: "subscription");

            migrationBuilder.RenameTable(
                name: "Vendors",
                newName: "Vendors",
                newSchema: "financial");

            migrationBuilder.RenameTable(
                name: "Users",
                newName: "Users",
                newSchema: "core");

            migrationBuilder.RenameTable(
                name: "UserRoles",
                newName: "UserRoles",
                newSchema: "core");

            migrationBuilder.RenameTable(
                name: "UpcomingFeatures",
                newName: "UpcomingFeatures",
                newSchema: "admin");

            migrationBuilder.RenameTable(
                name: "Units",
                newName: "Units",
                newSchema: "property");

            migrationBuilder.RenameTable(
                name: "TimeTrackingSettings",
                newName: "TimeTrackingSettings",
                newSchema: "staff");

            migrationBuilder.RenameTable(
                name: "TimeEntries",
                newName: "TimeEntries",
                newSchema: "staff");

            migrationBuilder.RenameTable(
                name: "TimeBreaks",
                newName: "TimeBreaks",
                newSchema: "staff");

            migrationBuilder.RenameTable(
                name: "Tenants",
                newName: "Tenants",
                newSchema: "tenant");

            migrationBuilder.RenameTable(
                name: "TenantLeases",
                newName: "TenantLeases",
                newSchema: "lease");

            migrationBuilder.RenameTable(
                name: "TenantInvites",
                newName: "TenantInvites",
                newSchema: "tenant");

            migrationBuilder.RenameTable(
                name: "TenantDocuments",
                newName: "TenantDocuments",
                newSchema: "tenant");

            migrationBuilder.RenameTable(
                name: "TaxCategories",
                newName: "TaxCategories",
                newSchema: "financial");

            migrationBuilder.RenameTable(
                name: "SupportAndFeedbacks",
                newName: "SupportAndFeedbacks",
                newSchema: "admin");

            migrationBuilder.RenameTable(
                name: "Subscriptions",
                newName: "Subscriptions",
                newSchema: "subscription");

            migrationBuilder.RenameTable(
                name: "SubscriptionPlans",
                newName: "SubscriptionPlans",
                newSchema: "subscription");

            migrationBuilder.RenameTable(
                name: "SubscriptionHistories",
                newName: "SubscriptionHistories",
                newSchema: "subscription");

            migrationBuilder.RenameTable(
                name: "StateLateFeeLaws",
                newName: "StateLateFeeLaws",
                newSchema: "lease");

            migrationBuilder.RenameTable(
                name: "StaffMembers",
                newName: "StaffMembers",
                newSchema: "staff");

            migrationBuilder.RenameTable(
                name: "StaffMemberInvites",
                newName: "StaffMemberInvites",
                newSchema: "staff");

            migrationBuilder.RenameTable(
                name: "RentalApplications",
                newName: "RentalApplications",
                newSchema: "tenant");

            migrationBuilder.RenameTable(
                name: "RecurringExpenses",
                newName: "RecurringExpenses",
                newSchema: "financial");

            migrationBuilder.RenameTable(
                name: "Properties",
                newName: "Properties",
                newSchema: "property");

            migrationBuilder.RenameTable(
                name: "PolicyPacks",
                newName: "PolicyPacks",
                newSchema: "lease_builder");

            migrationBuilder.RenameTable(
                name: "PolicyPackItems",
                newName: "PolicyPackItems",
                newSchema: "lease_builder");

            migrationBuilder.RenameTable(
                name: "Payments",
                newName: "Payments",
                newSchema: "financial");

            migrationBuilder.RenameTable(
                name: "Organizations",
                newName: "Organizations",
                newSchema: "organization");

            migrationBuilder.RenameTable(
                name: "OrganizationMembers",
                newName: "OrganizationMembers",
                newSchema: "organization");

            migrationBuilder.RenameTable(
                name: "OrganizationInvites",
                newName: "OrganizationInvites",
                newSchema: "organization");

            migrationBuilder.RenameTable(
                name: "OrganizationChecklistItems",
                newName: "OrganizationChecklistItems",
                newSchema: "checklist");

            migrationBuilder.RenameTable(
                name: "NotificationSettings",
                newName: "NotificationSettings",
                newSchema: "communication");

            migrationBuilder.RenameTable(
                name: "Notifications",
                newName: "Notifications",
                newSchema: "communication");

            migrationBuilder.RenameTable(
                name: "Messages",
                newName: "Messages",
                newSchema: "communication");

            migrationBuilder.RenameTable(
                name: "MessageReads",
                newName: "MessageReads",
                newSchema: "communication");

            migrationBuilder.RenameTable(
                name: "MaintenanceRequests",
                newName: "MaintenanceRequests",
                newSchema: "maintenance");

            migrationBuilder.RenameTable(
                name: "MaintenanceEvents",
                newName: "MaintenanceEvents",
                newSchema: "maintenance");

            migrationBuilder.RenameTable(
                name: "Listings",
                newName: "Listings",
                newSchema: "listing");

            migrationBuilder.RenameTable(
                name: "ListingImages",
                newName: "ListingImages",
                newSchema: "listing");

            migrationBuilder.RenameTable(
                name: "ListingFeatures",
                newName: "ListingFeatures",
                newSchema: "listing");

            migrationBuilder.RenameTable(
                name: "ListingAmenities",
                newName: "ListingAmenities",
                newSchema: "listing");

            migrationBuilder.RenameTable(
                name: "LeaseVariables",
                newName: "LeaseVariables",
                newSchema: "lease_builder");

            migrationBuilder.RenameTable(
                name: "LeaseTemplateSections",
                newName: "LeaseTemplateSections",
                newSchema: "lease_builder");

            migrationBuilder.RenameTable(
                name: "LeaseTemplates",
                newName: "LeaseTemplates",
                newSchema: "lease_builder");

            migrationBuilder.RenameTable(
                name: "LeaseTemplatePolicies",
                newName: "LeaseTemplatePolicies",
                newSchema: "lease_builder");

            migrationBuilder.RenameTable(
                name: "LeaseTemplateDefaultPolicies",
                newName: "LeaseTemplateDefaultPolicies",
                newSchema: "lease_builder");

            migrationBuilder.RenameTable(
                name: "Leases",
                newName: "Leases",
                newSchema: "lease");

            migrationBuilder.RenameTable(
                name: "LeasePolicySections",
                newName: "LeasePolicySections",
                newSchema: "lease_builder");

            migrationBuilder.RenameTable(
                name: "LeaseInstances",
                newName: "LeaseInstances",
                newSchema: "lease_builder");

            migrationBuilder.RenameTable(
                name: "LeaseHistories",
                newName: "LeaseHistories",
                newSchema: "lease");

            migrationBuilder.RenameTable(
                name: "LeaseFees",
                newName: "LeaseFees",
                newSchema: "lease");

            migrationBuilder.RenameTable(
                name: "LeaseDocuments",
                newName: "LeaseDocuments",
                newSchema: "lease_builder");

            migrationBuilder.RenameTable(
                name: "LandlordInvites",
                newName: "LandlordInvites",
                newSchema: "invite");

            migrationBuilder.RenameTable(
                name: "GeneralLedgerEntries",
                newName: "GeneralLedgerEntries",
                newSchema: "financial");

            migrationBuilder.RenameTable(
                name: "FutureExpenses",
                newName: "FutureExpenses",
                newSchema: "financial");

            migrationBuilder.RenameTable(
                name: "Files",
                newName: "Files",
                newSchema: "document");

            migrationBuilder.RenameTable(
                name: "FileCategories",
                newName: "FileCategories",
                newSchema: "document");

            migrationBuilder.RenameTable(
                name: "Expenses",
                newName: "Expenses",
                newSchema: "financial");

            migrationBuilder.RenameTable(
                name: "ExpenseReceipts",
                newName: "ExpenseReceipts",
                newSchema: "financial");

            migrationBuilder.RenameTable(
                name: "DocumentTemplates",
                newName: "DocumentTemplates",
                newSchema: "document");

            migrationBuilder.RenameTable(
                name: "Deposits",
                newName: "Deposits",
                newSchema: "financial");

            migrationBuilder.RenameTable(
                name: "DemoRequests",
                newName: "DemoRequests",
                newSchema: "admin");

            migrationBuilder.RenameTable(
                name: "DefaultAmenities",
                newName: "DefaultAmenities",
                newSchema: "listing");

            migrationBuilder.RenameTable(
                name: "CustomAmenities",
                newName: "CustomAmenities",
                newSchema: "listing");

            migrationBuilder.RenameTable(
                name: "Conversations",
                newName: "Conversations",
                newSchema: "communication");

            migrationBuilder.RenameTable(
                name: "ConversationParticipants",
                newName: "ConversationParticipants",
                newSchema: "communication");

            migrationBuilder.RenameTable(
                name: "Clients",
                newName: "Clients",
                newSchema: "client");

            migrationBuilder.RenameTable(
                name: "ClientInvites",
                newName: "ClientInvites",
                newSchema: "client");

            migrationBuilder.RenameTable(
                name: "ClauseLibraries",
                newName: "ClauseLibraries",
                newSchema: "lease_builder");

            migrationBuilder.RenameTable(
                name: "Checklists",
                newName: "Checklists",
                newSchema: "checklist");

            migrationBuilder.RenameTable(
                name: "ChecklistItems",
                newName: "ChecklistItems",
                newSchema: "checklist");

            migrationBuilder.RenameTable(
                name: "BasicAmenities",
                newName: "BasicAmenities",
                newSchema: "listing");

            migrationBuilder.RenameTable(
                name: "BankStatementTransactions",
                newName: "BankStatementTransactions",
                newSchema: "financial");

            migrationBuilder.RenameTable(
                name: "BankStatements",
                newName: "BankStatements",
                newSchema: "financial");

            migrationBuilder.RenameTable(
                name: "BankReconciliations",
                newName: "BankReconciliations",
                newSchema: "financial");

            migrationBuilder.RenameTable(
                name: "BankAccounts",
                newName: "BankAccounts",
                newSchema: "financial");

            migrationBuilder.RenameTable(
                name: "ApplicationInvites",
                newName: "ApplicationInvites",
                newSchema: "invite");

            migrationBuilder.RenameTable(
                name: "Announcements",
                newName: "Announcements",
                newSchema: "communication");

            migrationBuilder.RenameTable(
                name: "AnnouncementRecipients",
                newName: "AnnouncementRecipients",
                newSchema: "communication");

            migrationBuilder.RenameTable(
                name: "ActionSuppressions",
                newName: "ActionSuppressions",
                newSchema: "core");

            migrationBuilder.RenameTable(
                name: "Accounts",
                newName: "Accounts",
                newSchema: "financial");

            migrationBuilder.CreateIndex(
                name: "IX_FutureExpenses_DueDate",
                schema: "financial",
                table: "FutureExpenses",
                column: "DueDate");

            migrationBuilder.CreateIndex(
                name: "IX_FutureExpenses_LandlordId_PropertyId",
                schema: "financial",
                table: "FutureExpenses",
                columns: new[] { "LandlordId", "PropertyId" });

            migrationBuilder.AddForeignKey(
                name: "FK_FutureExpenses_Organizations_OrganizationId",
                schema: "financial",
                table: "FutureExpenses",
                column: "OrganizationId",
                principalSchema: "organization",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_FutureExpenses_Properties_PropertyId",
                schema: "financial",
                table: "FutureExpenses",
                column: "PropertyId",
                principalSchema: "property",
                principalTable: "Properties",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_FutureExpenses_Organizations_OrganizationId",
                schema: "financial",
                table: "FutureExpenses");

            migrationBuilder.DropForeignKey(
                name: "FK_FutureExpenses_Properties_PropertyId",
                schema: "financial",
                table: "FutureExpenses");

            migrationBuilder.DropIndex(
                name: "IX_FutureExpenses_DueDate",
                schema: "financial",
                table: "FutureExpenses");

            migrationBuilder.DropIndex(
                name: "IX_FutureExpenses_LandlordId_PropertyId",
                schema: "financial",
                table: "FutureExpenses");

            migrationBuilder.RenameTable(
                name: "Vendors",
                schema: "financial",
                newName: "Vendors");

            migrationBuilder.RenameTable(
                name: "Users",
                schema: "core",
                newName: "Users");

            migrationBuilder.RenameTable(
                name: "UserRoles",
                schema: "core",
                newName: "UserRoles");

            migrationBuilder.RenameTable(
                name: "UpcomingFeatures",
                schema: "admin",
                newName: "UpcomingFeatures");

            migrationBuilder.RenameTable(
                name: "Units",
                schema: "property",
                newName: "Units");

            migrationBuilder.RenameTable(
                name: "TimeTrackingSettings",
                schema: "staff",
                newName: "TimeTrackingSettings");

            migrationBuilder.RenameTable(
                name: "TimeEntries",
                schema: "staff",
                newName: "TimeEntries");

            migrationBuilder.RenameTable(
                name: "TimeBreaks",
                schema: "staff",
                newName: "TimeBreaks");

            migrationBuilder.RenameTable(
                name: "Tenants",
                schema: "tenant",
                newName: "Tenants");

            migrationBuilder.RenameTable(
                name: "TenantLeases",
                schema: "lease",
                newName: "TenantLeases");

            migrationBuilder.RenameTable(
                name: "TenantInvites",
                schema: "tenant",
                newName: "TenantInvites");

            migrationBuilder.RenameTable(
                name: "TenantDocuments",
                schema: "tenant",
                newName: "TenantDocuments");

            migrationBuilder.RenameTable(
                name: "TaxCategories",
                schema: "financial",
                newName: "TaxCategories");

            migrationBuilder.RenameTable(
                name: "SupportAndFeedbacks",
                schema: "admin",
                newName: "SupportAndFeedbacks");

            migrationBuilder.RenameTable(
                name: "Subscriptions",
                schema: "subscription",
                newName: "Subscriptions");

            migrationBuilder.RenameTable(
                name: "SubscriptionPlans",
                schema: "subscription",
                newName: "SubscriptionPlans");

            migrationBuilder.RenameTable(
                name: "SubscriptionHistories",
                schema: "subscription",
                newName: "SubscriptionHistories");

            migrationBuilder.RenameTable(
                name: "StateLateFeeLaws",
                schema: "lease",
                newName: "StateLateFeeLaws");

            migrationBuilder.RenameTable(
                name: "StaffMembers",
                schema: "staff",
                newName: "StaffMembers");

            migrationBuilder.RenameTable(
                name: "StaffMemberInvites",
                schema: "staff",
                newName: "StaffMemberInvites");

            migrationBuilder.RenameTable(
                name: "RentalApplications",
                schema: "tenant",
                newName: "RentalApplications");

            migrationBuilder.RenameTable(
                name: "RecurringExpenses",
                schema: "financial",
                newName: "RecurringExpenses");

            migrationBuilder.RenameTable(
                name: "Properties",
                schema: "property",
                newName: "Properties");

            migrationBuilder.RenameTable(
                name: "PolicyPacks",
                schema: "lease_builder",
                newName: "PolicyPacks");

            migrationBuilder.RenameTable(
                name: "PolicyPackItems",
                schema: "lease_builder",
                newName: "PolicyPackItems");

            migrationBuilder.RenameTable(
                name: "Payments",
                schema: "financial",
                newName: "Payments");

            migrationBuilder.RenameTable(
                name: "Organizations",
                schema: "organization",
                newName: "Organizations");

            migrationBuilder.RenameTable(
                name: "OrganizationMembers",
                schema: "organization",
                newName: "OrganizationMembers");

            migrationBuilder.RenameTable(
                name: "OrganizationInvites",
                schema: "organization",
                newName: "OrganizationInvites");

            migrationBuilder.RenameTable(
                name: "OrganizationChecklistItems",
                schema: "checklist",
                newName: "OrganizationChecklistItems");

            migrationBuilder.RenameTable(
                name: "NotificationSettings",
                schema: "communication",
                newName: "NotificationSettings");

            migrationBuilder.RenameTable(
                name: "Notifications",
                schema: "communication",
                newName: "Notifications");

            migrationBuilder.RenameTable(
                name: "Messages",
                schema: "communication",
                newName: "Messages");

            migrationBuilder.RenameTable(
                name: "MessageReads",
                schema: "communication",
                newName: "MessageReads");

            migrationBuilder.RenameTable(
                name: "MaintenanceRequests",
                schema: "maintenance",
                newName: "MaintenanceRequests");

            migrationBuilder.RenameTable(
                name: "MaintenanceEvents",
                schema: "maintenance",
                newName: "MaintenanceEvents");

            migrationBuilder.RenameTable(
                name: "Listings",
                schema: "listing",
                newName: "Listings");

            migrationBuilder.RenameTable(
                name: "ListingImages",
                schema: "listing",
                newName: "ListingImages");

            migrationBuilder.RenameTable(
                name: "ListingFeatures",
                schema: "listing",
                newName: "ListingFeatures");

            migrationBuilder.RenameTable(
                name: "ListingAmenities",
                schema: "listing",
                newName: "ListingAmenities");

            migrationBuilder.RenameTable(
                name: "LeaseVariables",
                schema: "lease_builder",
                newName: "LeaseVariables");

            migrationBuilder.RenameTable(
                name: "LeaseTemplateSections",
                schema: "lease_builder",
                newName: "LeaseTemplateSections");

            migrationBuilder.RenameTable(
                name: "LeaseTemplates",
                schema: "lease_builder",
                newName: "LeaseTemplates");

            migrationBuilder.RenameTable(
                name: "LeaseTemplatePolicies",
                schema: "lease_builder",
                newName: "LeaseTemplatePolicies");

            migrationBuilder.RenameTable(
                name: "LeaseTemplateDefaultPolicies",
                schema: "lease_builder",
                newName: "LeaseTemplateDefaultPolicies");

            migrationBuilder.RenameTable(
                name: "Leases",
                schema: "lease",
                newName: "Leases");

            migrationBuilder.RenameTable(
                name: "LeasePolicySections",
                schema: "lease_builder",
                newName: "LeasePolicySections");

            migrationBuilder.RenameTable(
                name: "LeaseInstances",
                schema: "lease_builder",
                newName: "LeaseInstances");

            migrationBuilder.RenameTable(
                name: "LeaseHistories",
                schema: "lease",
                newName: "LeaseHistories");

            migrationBuilder.RenameTable(
                name: "LeaseFees",
                schema: "lease",
                newName: "LeaseFees");

            migrationBuilder.RenameTable(
                name: "LeaseDocuments",
                schema: "lease_builder",
                newName: "LeaseDocuments");

            migrationBuilder.RenameTable(
                name: "LandlordInvites",
                schema: "invite",
                newName: "LandlordInvites");

            migrationBuilder.RenameTable(
                name: "GeneralLedgerEntries",
                schema: "financial",
                newName: "GeneralLedgerEntries");

            migrationBuilder.RenameTable(
                name: "FutureExpenses",
                schema: "financial",
                newName: "FutureExpenses");

            migrationBuilder.RenameTable(
                name: "Files",
                schema: "document",
                newName: "Files");

            migrationBuilder.RenameTable(
                name: "FileCategories",
                schema: "document",
                newName: "FileCategories");

            migrationBuilder.RenameTable(
                name: "Expenses",
                schema: "financial",
                newName: "Expenses");

            migrationBuilder.RenameTable(
                name: "ExpenseReceipts",
                schema: "financial",
                newName: "ExpenseReceipts");

            migrationBuilder.RenameTable(
                name: "DocumentTemplates",
                schema: "document",
                newName: "DocumentTemplates");

            migrationBuilder.RenameTable(
                name: "Deposits",
                schema: "financial",
                newName: "Deposits");

            migrationBuilder.RenameTable(
                name: "DemoRequests",
                schema: "admin",
                newName: "DemoRequests");

            migrationBuilder.RenameTable(
                name: "DefaultAmenities",
                schema: "listing",
                newName: "DefaultAmenities");

            migrationBuilder.RenameTable(
                name: "CustomAmenities",
                schema: "listing",
                newName: "CustomAmenities");

            migrationBuilder.RenameTable(
                name: "Conversations",
                schema: "communication",
                newName: "Conversations");

            migrationBuilder.RenameTable(
                name: "ConversationParticipants",
                schema: "communication",
                newName: "ConversationParticipants");

            migrationBuilder.RenameTable(
                name: "Clients",
                schema: "client",
                newName: "Clients");

            migrationBuilder.RenameTable(
                name: "ClientInvites",
                schema: "client",
                newName: "ClientInvites");

            migrationBuilder.RenameTable(
                name: "ClauseLibraries",
                schema: "lease_builder",
                newName: "ClauseLibraries");

            migrationBuilder.RenameTable(
                name: "Checklists",
                schema: "checklist",
                newName: "Checklists");

            migrationBuilder.RenameTable(
                name: "ChecklistItems",
                schema: "checklist",
                newName: "ChecklistItems");

            migrationBuilder.RenameTable(
                name: "BasicAmenities",
                schema: "listing",
                newName: "BasicAmenities");

            migrationBuilder.RenameTable(
                name: "BankStatementTransactions",
                schema: "financial",
                newName: "BankStatementTransactions");

            migrationBuilder.RenameTable(
                name: "BankStatements",
                schema: "financial",
                newName: "BankStatements");

            migrationBuilder.RenameTable(
                name: "BankReconciliations",
                schema: "financial",
                newName: "BankReconciliations");

            migrationBuilder.RenameTable(
                name: "BankAccounts",
                schema: "financial",
                newName: "BankAccounts");

            migrationBuilder.RenameTable(
                name: "ApplicationInvites",
                schema: "invite",
                newName: "ApplicationInvites");

            migrationBuilder.RenameTable(
                name: "Announcements",
                schema: "communication",
                newName: "Announcements");

            migrationBuilder.RenameTable(
                name: "AnnouncementRecipients",
                schema: "communication",
                newName: "AnnouncementRecipients");

            migrationBuilder.RenameTable(
                name: "ActionSuppressions",
                schema: "core",
                newName: "ActionSuppressions");

            migrationBuilder.RenameTable(
                name: "Accounts",
                schema: "financial",
                newName: "Accounts");

            migrationBuilder.AddForeignKey(
                name: "FK_FutureExpenses_Organizations_OrganizationId",
                table: "FutureExpenses",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_FutureExpenses_Properties_PropertyId",
                table: "FutureExpenses",
                column: "PropertyId",
                principalTable: "Properties",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
