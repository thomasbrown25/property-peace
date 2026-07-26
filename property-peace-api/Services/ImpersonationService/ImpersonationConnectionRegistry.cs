using System.Collections.Concurrent;
using Microsoft.AspNetCore.SignalR;

namespace brownstone_hub_api.Services.ImpersonationService
{
    /// <summary>
    /// Tracks impersonated SignalR connections in this API process so stopping a session, or reaching
    /// the access-token expiry, immediately aborts every associated connection.
    /// </summary>
    public sealed class ImpersonationConnectionRegistry
    {
        private sealed record Registration(HubCallerContext Context, CancellationTokenSource ExpiryCancellation);

        private readonly ConcurrentDictionary<Guid, ConcurrentDictionary<string, Registration>> _sessions = new();

        public void Register(Guid sessionId, HubCallerContext context, DateTimeOffset expiresAt)
        {
            var connections = _sessions.GetOrAdd(sessionId, _ => new ConcurrentDictionary<string, Registration>());
            var cancellation = new CancellationTokenSource();
            var registration = new Registration(context, cancellation);

            if (connections.TryGetValue(context.ConnectionId, out var previous))
            {
                previous.ExpiryCancellation.Cancel();
                previous.ExpiryCancellation.Dispose();
            }
            connections[context.ConnectionId] = registration;

            _ = AbortAtExpiryAsync(sessionId, context.ConnectionId, registration, expiresAt);
        }

        public void Unregister(Guid sessionId, string connectionId)
        {
            if (!_sessions.TryGetValue(sessionId, out var connections) ||
                !connections.TryRemove(connectionId, out var registration)) return;

            registration.ExpiryCancellation.Cancel();
            registration.ExpiryCancellation.Dispose();
            if (connections.IsEmpty) _sessions.TryRemove(new KeyValuePair<Guid, ConcurrentDictionary<string, Registration>>(sessionId, connections));
        }

        public void AbortSession(Guid sessionId)
        {
            if (!_sessions.TryRemove(sessionId, out var connections)) return;

            foreach (var registration in connections.Values)
            {
                registration.ExpiryCancellation.Cancel();
                registration.Context.Abort();
                registration.ExpiryCancellation.Dispose();
            }
        }

        private async Task AbortAtExpiryAsync(Guid sessionId, string connectionId, Registration registration, DateTimeOffset expiresAt)
        {
            try
            {
                var delay = expiresAt - DateTimeOffset.UtcNow;
                if (delay > TimeSpan.Zero)
                {
                    await Task.Delay(delay, registration.ExpiryCancellation.Token);
                }

                if (!registration.ExpiryCancellation.IsCancellationRequested)
                {
                    registration.Context.Abort();
                    Unregister(sessionId, connectionId);
                }
            }
            catch (OperationCanceledException) when (registration.ExpiryCancellation.IsCancellationRequested)
            {
                // Normal stop/disconnect path.
            }
        }
    }
}
