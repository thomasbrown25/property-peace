using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddAuditedAdminImpersonation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "audit");

            migrationBuilder.CreateTable(
                name: "ImpersonationAuditRecords",
                schema: "audit",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ImpersonationSessionId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ActorUserId = table.Column<long>(type: "bigint", nullable: true),
                    TargetUserId = table.Column<long>(type: "bigint", nullable: true),
                    Action = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Result = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Detail = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    IpAddress = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    UserAgent = table.Column<string>(type: "nvarchar(512)", maxLength: 512, nullable: true),
                    OrganizationId = table.Column<long>(type: "bigint", nullable: true),
                    HttpMethod = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: true),
                    Route = table.Column<string>(type: "nvarchar(512)", maxLength: 512, nullable: true),
                    StatusCode = table.Column<int>(type: "int", nullable: true),
                    TraceId = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    CorrelationId = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    DurationMilliseconds = table.Column<long>(type: "bigint", nullable: true),
                    EntityRouteIds = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    OccurredAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ImpersonationAuditRecords", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ImpersonationSessions",
                schema: "core",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ActorUserId = table.Column<long>(type: "bigint", nullable: false),
                    TargetUserId = table.Column<long>(type: "bigint", nullable: false),
                    Reason = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    SupportReference = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    RefreshTokenHash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    PreviousRefreshTokenHash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    StartedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    StoppedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    StopReason = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ImpersonationSessions", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ImpersonationAuditRecords_ActorUserId_OccurredAt",
                schema: "audit",
                table: "ImpersonationAuditRecords",
                columns: new[] { "ActorUserId", "OccurredAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ImpersonationAuditRecords_ImpersonationSessionId_OccurredAt",
                schema: "audit",
                table: "ImpersonationAuditRecords",
                columns: new[] { "ImpersonationSessionId", "OccurredAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ImpersonationSessions_ActorUserId_ExpiresAt",
                schema: "core",
                table: "ImpersonationSessions",
                columns: new[] { "ActorUserId", "ExpiresAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ImpersonationSessions_RefreshTokenHash",
                schema: "core",
                table: "ImpersonationSessions",
                column: "RefreshTokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ImpersonationSessions_TargetUserId_ExpiresAt",
                schema: "core",
                table: "ImpersonationSessions",
                columns: new[] { "TargetUserId", "ExpiresAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ImpersonationAuditRecords",
                schema: "audit");

            migrationBuilder.DropTable(
                name: "ImpersonationSessions",
                schema: "core");
        }
    }
}
