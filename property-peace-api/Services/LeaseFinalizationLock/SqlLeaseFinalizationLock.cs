using Microsoft.Data.SqlClient;
using System.Data;

namespace brownstone_hub_api.Services.LeaseFinalizationLock;

/// <summary>
/// Holds a SQL Server session-owned application lock on a dedicated connection. No EF transaction
/// is involved, so the lock can safely cover blob publication without keeping a database transaction open.
/// </summary>
public sealed class SqlLeaseFinalizationLock(
    IConfiguration configuration,
    ILogger<SqlLeaseFinalizationLock> logger) : ILeaseFinalizationLock
{
    private const int DefaultTimeoutMilliseconds = 30_000;
    private readonly string _connectionString = configuration.GetConnectionString("AzureSQLDatabase")
        ?? throw new InvalidOperationException("AzureSQLDatabase connection string is required for lease finalization locking.");
    private readonly int _timeoutMilliseconds = configuration.GetValue<int?>("LeaseFinalization:LockTimeoutMilliseconds")
        ?? DefaultTimeoutMilliseconds;
    private readonly ILogger<SqlLeaseFinalizationLock> _logger = logger;

    public async Task<IAsyncDisposable> AcquireAsync(
        long organizationId,
        long leaseId,
        CancellationToken cancellationToken = default)
    {
        var resource = $"property-peace:lease-finalize:{organizationId}:{leaseId}";
        var connection = new SqlConnection(_connectionString);
        try
        {
            await connection.OpenAsync(cancellationToken);
            await using var command = connection.CreateCommand();
            command.CommandType = CommandType.Text;
            command.CommandText = """
                DECLARE @result int;
                EXEC @result = sys.sp_getapplock
                    @Resource = @resource,
                    @LockMode = 'Exclusive',
                    @LockOwner = 'Session',
                    @LockTimeout = @timeout;
                SELECT @result;
                """;
            command.Parameters.Add(new SqlParameter("@resource", SqlDbType.NVarChar, 255) { Value = resource });
            command.Parameters.Add(new SqlParameter("@timeout", SqlDbType.Int) { Value = _timeoutMilliseconds });

            var result = Convert.ToInt32(await command.ExecuteScalarAsync(cancellationToken));
            if (result < 0)
            {
                await connection.DisposeAsync();
                throw result switch
                {
                    -1 => new TimeoutException($"Timed out waiting for finalization lock for lease {leaseId}."),
                    -2 => new OperationCanceledException("Lease finalization lock request was canceled.", cancellationToken),
                    -3 => new InvalidOperationException($"Lease finalization lock for lease {leaseId} was selected as a deadlock victim."),
                    _ => new InvalidOperationException($"Could not acquire lease finalization lock for lease {leaseId} (sp_getapplock result {result}).")
                };
            }

            return new Releaser(connection, resource, _logger);
        }
        catch
        {
            await connection.DisposeAsync();
            throw;
        }
    }

    private sealed class Releaser(
        SqlConnection connection,
        string resource,
        ILogger logger) : IAsyncDisposable
    {
        private SqlConnection? _connection = connection;

        public async ValueTask DisposeAsync()
        {
            var current = Interlocked.Exchange(ref _connection, null);
            if (current == null)
                return;

            try
            {
                if (current.State == ConnectionState.Open)
                {
                    await using var command = current.CreateCommand();
                    command.CommandText = "EXEC sys.sp_releaseapplock @Resource = @resource, @LockOwner = 'Session';";
                    command.Parameters.Add(new SqlParameter("@resource", SqlDbType.NVarChar, 255) { Value = resource });
                    await command.ExecuteNonQueryAsync();
                }
            }
            catch (Exception ex)
            {
                // Closing the dedicated session releases any remaining session-owned lock.
                logger.LogError(ex, "Explicit release failed for SQL application lock {Resource}; closing its session.", resource);
            }
            finally
            {
                await current.DisposeAsync();
            }
        }
    }
}
