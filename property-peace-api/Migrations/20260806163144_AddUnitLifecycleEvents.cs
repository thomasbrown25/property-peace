using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddUnitLifecycleEvents : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "UnitLifecycleEvents",
                schema: "property",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OrganizationId = table.Column<long>(type: "bigint", nullable: false),
                    PropertyId = table.Column<long>(type: "bigint", nullable: false),
                    UnitId = table.Column<long>(type: "bigint", nullable: false),
                    ActorUserId = table.Column<long>(type: "bigint", nullable: false),
                    PreviousStage = table.Column<int>(type: "int", nullable: false),
                    ResultingStage = table.Column<int>(type: "int", nullable: false),
                    EventType = table.Column<int>(type: "int", nullable: false),
                    ScheduledAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Reason = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    RequestHash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    PreviousRevision = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    CorrelationTrace = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    IdempotencyKeyHash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    ResultSnapshotJson = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: false),
                    OccurredAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UnitLifecycleEvents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UnitLifecycleEvents_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalSchema: "organization",
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_UnitLifecycleEvents_Properties_PropertyId",
                        column: x => x.PropertyId,
                        principalSchema: "property",
                        principalTable: "Properties",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_UnitLifecycleEvents_Units_UnitId",
                        column: x => x.UnitId,
                        principalSchema: "property",
                        principalTable: "Units",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_UnitLifecycleEvents_Users_ActorUserId",
                        column: x => x.ActorUserId,
                        principalSchema: "core",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UnitLifecycleEvents_ActorUserId",
                schema: "property",
                table: "UnitLifecycleEvents",
                column: "ActorUserId");

            migrationBuilder.CreateIndex(
                name: "IX_UnitLifecycleEvents_OrganizationId_IdempotencyKeyHash",
                schema: "property",
                table: "UnitLifecycleEvents",
                columns: new[] { "OrganizationId", "IdempotencyKeyHash" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UnitLifecycleEvents_OrganizationId_PropertyId_UnitId_OccurredAtUtc",
                schema: "property",
                table: "UnitLifecycleEvents",
                columns: new[] { "OrganizationId", "PropertyId", "UnitId", "OccurredAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_UnitLifecycleEvents_OrganizationId_PropertyId_UnitId_PreviousRevision",
                schema: "property",
                table: "UnitLifecycleEvents",
                columns: new[] { "OrganizationId", "PropertyId", "UnitId", "PreviousRevision" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UnitLifecycleEvents_PropertyId",
                schema: "property",
                table: "UnitLifecycleEvents",
                column: "PropertyId");

            migrationBuilder.CreateIndex(
                name: "IX_UnitLifecycleEvents_UnitId",
                schema: "property",
                table: "UnitLifecycleEvents",
                column: "UnitId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UnitLifecycleEvents",
                schema: "property");
        }
    }
}
