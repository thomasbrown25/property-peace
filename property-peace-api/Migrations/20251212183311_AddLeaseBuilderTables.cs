using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddLeaseBuilderTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ClauseLibraries",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ClauseKey = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Title = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Content = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Category = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Version = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "1.0"),
                    IsSystemClause = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    State = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    OrganizationId = table.Column<long>(type: "bigint", nullable: true),
                    LandlordId = table.Column<long>(type: "bigint", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedBy = table.Column<long>(type: "bigint", nullable: true),
                    UpdatedBy = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClauseLibraries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ClauseLibraries_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_ClauseLibraries_Users_LandlordId",
                        column: x => x.LandlordId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "LeaseTemplates",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    State = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    PropertyType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    TemplateStructure = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    IsDefault = table.Column<bool>(type: "bit", nullable: false),
                    IsDefaultForLandlord = table.Column<bool>(type: "bit", nullable: false),
                    Version = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "1.0"),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    OrganizationId = table.Column<long>(type: "bigint", nullable: true),
                    LandlordId = table.Column<long>(type: "bigint", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedBy = table.Column<long>(type: "bigint", nullable: true),
                    UpdatedBy = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LeaseTemplates", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LeaseTemplates_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_LeaseTemplates_Users_LandlordId",
                        column: x => x.LandlordId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "PolicyPacks",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    IsDefault = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    OrganizationId = table.Column<long>(type: "bigint", nullable: true),
                    LandlordId = table.Column<long>(type: "bigint", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedBy = table.Column<long>(type: "bigint", nullable: true),
                    UpdatedBy = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PolicyPacks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PolicyPacks_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_PolicyPacks_Users_LandlordId",
                        column: x => x.LandlordId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "LeaseInstances",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    LeaseId = table.Column<long>(type: "bigint", nullable: false),
                    LeaseTemplateId = table.Column<long>(type: "bigint", nullable: false),
                    TemplateVersion = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    IsDraft = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    IsFinalized = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    FinalizedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Warnings = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    GeneratedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    GeneratedBy = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LeaseInstances", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LeaseInstances_LeaseTemplates_LeaseTemplateId",
                        column: x => x.LeaseTemplateId,
                        principalTable: "LeaseTemplates",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LeaseInstances_Leases_LeaseId",
                        column: x => x.LeaseId,
                        principalTable: "Leases",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LeaseInstances_Users_GeneratedBy",
                        column: x => x.GeneratedBy,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "LeaseTemplateSections",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    LeaseTemplateId = table.Column<long>(type: "bigint", nullable: false),
                    SectionName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    SectionOrder = table.Column<int>(type: "int", nullable: false),
                    IsEnabled = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    Content = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LeaseTemplateSections", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LeaseTemplateSections_LeaseTemplates_LeaseTemplateId",
                        column: x => x.LeaseTemplateId,
                        principalTable: "LeaseTemplates",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PolicyPackItems",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PolicyPackId = table.Column<long>(type: "bigint", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Content = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Category = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Order = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PolicyPackItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PolicyPackItems_PolicyPacks_PolicyPackId",
                        column: x => x.PolicyPackId,
                        principalTable: "PolicyPacks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "LeaseDocuments",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    LeaseInstanceId = table.Column<long>(type: "bigint", nullable: false),
                    DocumentType = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    BlobName = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    BlobUrl = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    FileHash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    GeneratedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    GeneratedBy = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LeaseDocuments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LeaseDocuments_LeaseInstances_LeaseInstanceId",
                        column: x => x.LeaseInstanceId,
                        principalTable: "LeaseInstances",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_LeaseDocuments_Users_GeneratedBy",
                        column: x => x.GeneratedBy,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "LeasePolicySections",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    LeaseInstanceId = table.Column<long>(type: "bigint", nullable: false),
                    OriginalPolicies = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    AiFormattedPolicies = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    AiFormattedMarkdown = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Tone = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "Neutral"),
                    AiModifiedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    AiModifiedBy = table.Column<long>(type: "bigint", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LeasePolicySections", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LeasePolicySections_LeaseInstances_LeaseInstanceId",
                        column: x => x.LeaseInstanceId,
                        principalTable: "LeaseInstances",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_LeasePolicySections_Users_AiModifiedBy",
                        column: x => x.AiModifiedBy,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "LeaseVariables",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    LeaseInstanceId = table.Column<long>(type: "bigint", nullable: false),
                    VariableKey = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    VariableValue = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    VariableType = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "String"),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LeaseVariables", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LeaseVariables_LeaseInstances_LeaseInstanceId",
                        column: x => x.LeaseInstanceId,
                        principalTable: "LeaseInstances",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ClauseLibraries_Category_IsSystemClause",
                table: "ClauseLibraries",
                columns: new[] { "Category", "IsSystemClause" });

            migrationBuilder.CreateIndex(
                name: "IX_ClauseLibraries_ClauseKey",
                table: "ClauseLibraries",
                column: "ClauseKey",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ClauseLibraries_LandlordId",
                table: "ClauseLibraries",
                column: "LandlordId");

            migrationBuilder.CreateIndex(
                name: "IX_ClauseLibraries_OrganizationId",
                table: "ClauseLibraries",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_LeaseDocuments_GeneratedBy",
                table: "LeaseDocuments",
                column: "GeneratedBy");

            migrationBuilder.CreateIndex(
                name: "IX_LeaseDocuments_LeaseInstanceId",
                table: "LeaseDocuments",
                column: "LeaseInstanceId");

            migrationBuilder.CreateIndex(
                name: "IX_LeaseDocuments_LeaseInstanceId_DocumentType",
                table: "LeaseDocuments",
                columns: new[] { "LeaseInstanceId", "DocumentType" });

            migrationBuilder.CreateIndex(
                name: "IX_LeaseInstances_GeneratedBy",
                table: "LeaseInstances",
                column: "GeneratedBy");

            migrationBuilder.CreateIndex(
                name: "IX_LeaseInstances_LeaseId",
                table: "LeaseInstances",
                column: "LeaseId");

            migrationBuilder.CreateIndex(
                name: "IX_LeaseInstances_LeaseId_IsFinalized",
                table: "LeaseInstances",
                columns: new[] { "LeaseId", "IsFinalized" });

            migrationBuilder.CreateIndex(
                name: "IX_LeaseInstances_LeaseTemplateId",
                table: "LeaseInstances",
                column: "LeaseTemplateId");

            migrationBuilder.CreateIndex(
                name: "IX_LeasePolicySections_AiModifiedBy",
                table: "LeasePolicySections",
                column: "AiModifiedBy");

            migrationBuilder.CreateIndex(
                name: "IX_LeasePolicySections_LeaseInstanceId",
                table: "LeasePolicySections",
                column: "LeaseInstanceId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LeaseTemplates_IsDefault_IsDeleted",
                table: "LeaseTemplates",
                columns: new[] { "IsDefault", "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_LeaseTemplates_LandlordId",
                table: "LeaseTemplates",
                column: "LandlordId");

            migrationBuilder.CreateIndex(
                name: "IX_LeaseTemplates_OrganizationId",
                table: "LeaseTemplates",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_LeaseTemplates_OrganizationId_IsDeleted",
                table: "LeaseTemplates",
                columns: new[] { "OrganizationId", "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_LeaseTemplateSections_LeaseTemplateId_SectionOrder",
                table: "LeaseTemplateSections",
                columns: new[] { "LeaseTemplateId", "SectionOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_LeaseVariables_LeaseInstanceId_VariableKey",
                table: "LeaseVariables",
                columns: new[] { "LeaseInstanceId", "VariableKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PolicyPackItems_PolicyPackId_Order",
                table: "PolicyPackItems",
                columns: new[] { "PolicyPackId", "Order" });

            migrationBuilder.CreateIndex(
                name: "IX_PolicyPacks_IsDefault_OrganizationId",
                table: "PolicyPacks",
                columns: new[] { "IsDefault", "OrganizationId" });

            migrationBuilder.CreateIndex(
                name: "IX_PolicyPacks_LandlordId",
                table: "PolicyPacks",
                column: "LandlordId");

            migrationBuilder.CreateIndex(
                name: "IX_PolicyPacks_OrganizationId",
                table: "PolicyPacks",
                column: "OrganizationId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ClauseLibraries");

            migrationBuilder.DropTable(
                name: "LeaseDocuments");

            migrationBuilder.DropTable(
                name: "LeasePolicySections");

            migrationBuilder.DropTable(
                name: "LeaseTemplateSections");

            migrationBuilder.DropTable(
                name: "LeaseVariables");

            migrationBuilder.DropTable(
                name: "PolicyPackItems");

            migrationBuilder.DropTable(
                name: "LeaseInstances");

            migrationBuilder.DropTable(
                name: "PolicyPacks");

            migrationBuilder.DropTable(
                name: "LeaseTemplates");
        }
    }
}
