using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddOrganizationIdToAllEntities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Payments_Leases_LeaseId",
                table: "Payments");

            migrationBuilder.DropForeignKey(
                name: "FK_RecurringExpenses_MaintenanceRequests_MaintenanceRequestId",
                table: "RecurringExpenses");

            migrationBuilder.DropForeignKey(
                name: "FK_RecurringExpenses_Properties_PropertyId",
                table: "RecurringExpenses");

            migrationBuilder.DropForeignKey(
                name: "FK_RecurringExpenses_Units_UnitId",
                table: "RecurringExpenses");

            migrationBuilder.AddColumn<long>(
                name: "OrganizationId",
                table: "Vendors",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "OrganizationId",
                table: "Units",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "OrganizationId",
                table: "Tenants",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "OrganizationId",
                table: "TenantInvites",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "OrganizationId",
                table: "TenantDocuments",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "OrganizationId",
                table: "RentalApplications",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "OrganizationId",
                table: "RecurringExpenses",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "OrganizationId",
                table: "Payments",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "OrganizationId",
                table: "Messages",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "OrganizationId",
                table: "MaintenanceRequests",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "OrganizationId",
                table: "Leases",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "OrganizationId",
                table: "Expenses",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "OrganizationId",
                table: "DocumentTemplates",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "OrganizationId",
                table: "Deposits",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "OrganizationId",
                table: "Conversations",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "OrganizationId",
                table: "Checklists",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "OrganizationId",
                table: "ApplicationInvites",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Vendors_OrganizationId",
                table: "Vendors",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_Units_OrganizationId",
                table: "Units",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_Tenants_OrganizationId",
                table: "Tenants",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_TenantInvites_OrganizationId",
                table: "TenantInvites",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_TenantDocuments_OrganizationId",
                table: "TenantDocuments",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_RentalApplications_OrganizationId",
                table: "RentalApplications",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_RecurringExpenses_LandlordId_PropertyId",
                table: "RecurringExpenses",
                columns: new[] { "LandlordId", "PropertyId" });

            migrationBuilder.CreateIndex(
                name: "IX_RecurringExpenses_OrganizationId",
                table: "RecurringExpenses",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_Payments_OrganizationId",
                table: "Payments",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_Payments_PropertyId",
                table: "Payments",
                column: "PropertyId");

            migrationBuilder.CreateIndex(
                name: "IX_Messages_OrganizationId",
                table: "Messages",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_MaintenanceRequests_OrganizationId",
                table: "MaintenanceRequests",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_Leases_OrganizationId",
                table: "Leases",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_Expenses_OrganizationId",
                table: "Expenses",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_DocumentTemplates_OrganizationId",
                table: "DocumentTemplates",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_Deposits_OrganizationId",
                table: "Deposits",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_Conversations_OrganizationId",
                table: "Conversations",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_Checklists_OrganizationId",
                table: "Checklists",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_ApplicationInvites_OrganizationId",
                table: "ApplicationInvites",
                column: "OrganizationId");

            migrationBuilder.AddForeignKey(
                name: "FK_ApplicationInvites_Organizations_OrganizationId",
                table: "ApplicationInvites",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Checklists_Organizations_OrganizationId",
                table: "Checklists",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Conversations_Organizations_OrganizationId",
                table: "Conversations",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Deposits_Organizations_OrganizationId",
                table: "Deposits",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_DocumentTemplates_Organizations_OrganizationId",
                table: "DocumentTemplates",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Expenses_Organizations_OrganizationId",
                table: "Expenses",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Leases_Organizations_OrganizationId",
                table: "Leases",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_MaintenanceRequests_Organizations_OrganizationId",
                table: "MaintenanceRequests",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Messages_Organizations_OrganizationId",
                table: "Messages",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Payments_Leases_LeaseId",
                table: "Payments",
                column: "LeaseId",
                principalTable: "Leases",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Payments_Organizations_OrganizationId",
                table: "Payments",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_RecurringExpenses_MaintenanceRequests_MaintenanceRequestId",
                table: "RecurringExpenses",
                column: "MaintenanceRequestId",
                principalTable: "MaintenanceRequests",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_RecurringExpenses_Organizations_OrganizationId",
                table: "RecurringExpenses",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_RecurringExpenses_Properties_PropertyId",
                table: "RecurringExpenses",
                column: "PropertyId",
                principalTable: "Properties",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_RecurringExpenses_Units_UnitId",
                table: "RecurringExpenses",
                column: "UnitId",
                principalTable: "Units",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_RentalApplications_Organizations_OrganizationId",
                table: "RentalApplications",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_TenantDocuments_Organizations_OrganizationId",
                table: "TenantDocuments",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_TenantInvites_Organizations_OrganizationId",
                table: "TenantInvites",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Tenants_Organizations_OrganizationId",
                table: "Tenants",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Units_Organizations_OrganizationId",
                table: "Units",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Vendors_Organizations_OrganizationId",
                table: "Vendors",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ApplicationInvites_Organizations_OrganizationId",
                table: "ApplicationInvites");

            migrationBuilder.DropForeignKey(
                name: "FK_Checklists_Organizations_OrganizationId",
                table: "Checklists");

            migrationBuilder.DropForeignKey(
                name: "FK_Conversations_Organizations_OrganizationId",
                table: "Conversations");

            migrationBuilder.DropForeignKey(
                name: "FK_Deposits_Organizations_OrganizationId",
                table: "Deposits");

            migrationBuilder.DropForeignKey(
                name: "FK_DocumentTemplates_Organizations_OrganizationId",
                table: "DocumentTemplates");

            migrationBuilder.DropForeignKey(
                name: "FK_Expenses_Organizations_OrganizationId",
                table: "Expenses");

            migrationBuilder.DropForeignKey(
                name: "FK_Leases_Organizations_OrganizationId",
                table: "Leases");

            migrationBuilder.DropForeignKey(
                name: "FK_MaintenanceRequests_Organizations_OrganizationId",
                table: "MaintenanceRequests");

            migrationBuilder.DropForeignKey(
                name: "FK_Messages_Organizations_OrganizationId",
                table: "Messages");

            migrationBuilder.DropForeignKey(
                name: "FK_Payments_Leases_LeaseId",
                table: "Payments");

            migrationBuilder.DropForeignKey(
                name: "FK_Payments_Organizations_OrganizationId",
                table: "Payments");

            migrationBuilder.DropForeignKey(
                name: "FK_RecurringExpenses_MaintenanceRequests_MaintenanceRequestId",
                table: "RecurringExpenses");

            migrationBuilder.DropForeignKey(
                name: "FK_RecurringExpenses_Organizations_OrganizationId",
                table: "RecurringExpenses");

            migrationBuilder.DropForeignKey(
                name: "FK_RecurringExpenses_Properties_PropertyId",
                table: "RecurringExpenses");

            migrationBuilder.DropForeignKey(
                name: "FK_RecurringExpenses_Units_UnitId",
                table: "RecurringExpenses");

            migrationBuilder.DropForeignKey(
                name: "FK_RentalApplications_Organizations_OrganizationId",
                table: "RentalApplications");

            migrationBuilder.DropForeignKey(
                name: "FK_TenantDocuments_Organizations_OrganizationId",
                table: "TenantDocuments");

            migrationBuilder.DropForeignKey(
                name: "FK_TenantInvites_Organizations_OrganizationId",
                table: "TenantInvites");

            migrationBuilder.DropForeignKey(
                name: "FK_Tenants_Organizations_OrganizationId",
                table: "Tenants");

            migrationBuilder.DropForeignKey(
                name: "FK_Units_Organizations_OrganizationId",
                table: "Units");

            migrationBuilder.DropForeignKey(
                name: "FK_Vendors_Organizations_OrganizationId",
                table: "Vendors");

            migrationBuilder.DropIndex(
                name: "IX_Vendors_OrganizationId",
                table: "Vendors");

            migrationBuilder.DropIndex(
                name: "IX_Units_OrganizationId",
                table: "Units");

            migrationBuilder.DropIndex(
                name: "IX_Tenants_OrganizationId",
                table: "Tenants");

            migrationBuilder.DropIndex(
                name: "IX_TenantInvites_OrganizationId",
                table: "TenantInvites");

            migrationBuilder.DropIndex(
                name: "IX_TenantDocuments_OrganizationId",
                table: "TenantDocuments");

            migrationBuilder.DropIndex(
                name: "IX_RentalApplications_OrganizationId",
                table: "RentalApplications");

            migrationBuilder.DropIndex(
                name: "IX_RecurringExpenses_LandlordId_PropertyId",
                table: "RecurringExpenses");

            migrationBuilder.DropIndex(
                name: "IX_RecurringExpenses_OrganizationId",
                table: "RecurringExpenses");

            migrationBuilder.DropIndex(
                name: "IX_Payments_OrganizationId",
                table: "Payments");

            migrationBuilder.DropIndex(
                name: "IX_Payments_PropertyId",
                table: "Payments");

            migrationBuilder.DropIndex(
                name: "IX_Messages_OrganizationId",
                table: "Messages");

            migrationBuilder.DropIndex(
                name: "IX_MaintenanceRequests_OrganizationId",
                table: "MaintenanceRequests");

            migrationBuilder.DropIndex(
                name: "IX_Leases_OrganizationId",
                table: "Leases");

            migrationBuilder.DropIndex(
                name: "IX_Expenses_OrganizationId",
                table: "Expenses");

            migrationBuilder.DropIndex(
                name: "IX_DocumentTemplates_OrganizationId",
                table: "DocumentTemplates");

            migrationBuilder.DropIndex(
                name: "IX_Deposits_OrganizationId",
                table: "Deposits");

            migrationBuilder.DropIndex(
                name: "IX_Conversations_OrganizationId",
                table: "Conversations");

            migrationBuilder.DropIndex(
                name: "IX_Checklists_OrganizationId",
                table: "Checklists");

            migrationBuilder.DropIndex(
                name: "IX_ApplicationInvites_OrganizationId",
                table: "ApplicationInvites");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "Vendors");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "Units");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "TenantInvites");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "TenantDocuments");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "RentalApplications");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "RecurringExpenses");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "Messages");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "MaintenanceRequests");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "Leases");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "Expenses");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "DocumentTemplates");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "Deposits");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "Conversations");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "Checklists");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "ApplicationInvites");

            migrationBuilder.AddForeignKey(
                name: "FK_Payments_Leases_LeaseId",
                table: "Payments",
                column: "LeaseId",
                principalTable: "Leases",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_RecurringExpenses_MaintenanceRequests_MaintenanceRequestId",
                table: "RecurringExpenses",
                column: "MaintenanceRequestId",
                principalTable: "MaintenanceRequests",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_RecurringExpenses_Properties_PropertyId",
                table: "RecurringExpenses",
                column: "PropertyId",
                principalTable: "Properties",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_RecurringExpenses_Units_UnitId",
                table: "RecurringExpenses",
                column: "UnitId",
                principalTable: "Units",
                principalColumn: "Id");
        }
    }
}
