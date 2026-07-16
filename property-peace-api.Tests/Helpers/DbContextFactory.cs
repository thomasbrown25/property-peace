using brownstone_hub_api.Data;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Tests.Helpers
{
    /// <summary>
    /// Creates a fresh DataContext backed by an isolated in-memory database for each test.
    /// Note: DataContext's DbSet properties use expression-bodied => Set<T>() getters (non-virtual),
    /// which cannot be intercepted by Moq. The InMemory provider gives us the same isolation
    /// without requiring a real SQL Server connection.
    /// </summary>
    public static class DbContextFactory
    {
        public static DataContext Create()
        {
            var options = new DbContextOptionsBuilder<DataContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;

            return new DataContext(options);
        }
    }
}
