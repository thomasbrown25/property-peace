using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace brownstone_hub_api.Data
{
    public sealed class DataContextFactory : IDesignTimeDbContextFactory<DataContext>
    {
        public DataContext CreateDbContext(string[] args)
        {
            var env = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Development";

            var cfg = new ConfigurationBuilder()
                .SetBasePath(Directory.GetCurrentDirectory())
                .AddJsonFile("appsettings.json", optional: false)
                .AddJsonFile($"appsettings.{env}.json", optional: true)
                .AddEnvironmentVariables()
                .Build();

            var cs = cfg.GetConnectionString("AzureSQLDatabase")
                     ?? cfg.GetConnectionString("DefaultConnection")
                     ?? throw new InvalidOperationException("No connection string found.");

            var opts = new DbContextOptionsBuilder<DataContext>()
                .UseSqlServer(cs)
                .Options;

            return new DataContext(opts);
        }
    }
}