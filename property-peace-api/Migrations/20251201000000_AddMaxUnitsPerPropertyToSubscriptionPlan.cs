using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddMaxUnitsPerPropertyToSubscriptionPlan : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "MaxUnitsPerProperty",
                table: "SubscriptionPlans",
                type: "int",
                nullable: true);

            // Update existing plans with unit limits
            migrationBuilder.Sql(@"
                UPDATE SubscriptionPlans 
                SET MaxUnitsPerProperty = 1 
                WHERE Name = 'Free Trial' OR Name = 'Starter';
                
                UPDATE SubscriptionPlans 
                SET MaxUnitsPerProperty = 5 
                WHERE Name = 'Growth';
                
                UPDATE SubscriptionPlans 
                SET MaxUnitsPerProperty = 20 
                WHERE Name = 'Pro';
                
                UPDATE SubscriptionPlans 
                SET MaxUnitsPerProperty = NULL 
                WHERE Name = 'Business';
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MaxUnitsPerProperty",
                table: "SubscriptionPlans");
        }
    }
}


