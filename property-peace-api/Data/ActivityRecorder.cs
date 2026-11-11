using System.Security.Claims;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Storage;

namespace brownstone_hub_api.Data;

/// <summary>Context-owned, payload-free mutation recorder. Raw SQL/ExecuteUpdate intentionally bypass EF tracking.</summary>
internal static class ActivityRecorder
{
    internal static int Save(DataContext db, ClaimsPrincipal? actor, bool accept, Func<int> save) =>
        SaveAsync(db, actor, accept, () => Task.FromResult(save()), default).GetAwaiter().GetResult();

    internal static async Task<int> SaveAsync(DataContext db, ClaimsPrincipal? actor, bool accept,
        Func<Task<int>> save, CancellationToken ct)
    {
        // An existing transaction belongs to the caller's execution strategy. Starting a nested
        // retry strategy here would reject valid caller-owned SQL Server transactions.
        return db.Database.CurrentTransaction is not null
            ? await PersistAsync()
            : await db.Database.CreateExecutionStrategy().ExecuteAsync(PersistAsync);

        async Task<int> PersistAsync()
        {
            db.ChangeTracker.DetectChanges();
            var pending = Capture(db, actor);
            if (pending.Count == 0)
            {
                var count = await save();
                if (accept) db.ChangeTracker.AcceptAllChanges();
                return count;
            }

            var snapshots = db.ChangeTracker.Entries().Where(e => e.State is EntityState.Added or EntityState.Modified or EntityState.Deleted)
                .Select(e => new Snapshot(e)).ToArray();
            var events = new List<ActivityEvent>();
            IDbContextTransaction? owned = null;
            var transaction = db.Database.IsRelational() ? db.Database.CurrentTransaction : null;
            var savepoint = "activity_" + Guid.NewGuid().ToString("N");
            var autoDetect = db.ChangeTracker.AutoDetectChangesEnabled;
            try
            {
                if (db.Database.IsRelational())
                {
                    if (transaction is null) owned = await db.Database.BeginTransactionAsync(ct);
                    else
                    {
                        if (!transaction.SupportsSavepoints)
                            throw new InvalidOperationException("Atomic activity recording requires transaction savepoints (disable MARS).");
                        await transaction.CreateSavepointAsync(savepoint, ct);
                    }
                }
                var count = await save(); // Keep originals until the first write succeeds.
                // EF keeps database-generated keys in a sidecar until acceptance. Accept before building
                // events so both the CLR IDs and relationship FKs contain the final database values.
                // Snapshots below restore caller state on any failure (or SaveChanges(false)).
                db.ChangeTracker.AcceptAllChanges();
                events = pending.Select(p => p.Build()).ToList();
                db.ChangeTracker.AutoDetectChangesEnabled = false;
                db.ActivityEvents.AddRange(events);
                await save();
                if (owned is not null) await owned.CommitAsync(ct);
                else if (transaction is not null) await transaction.ReleaseSavepointAsync(savepoint, ct);
                db.ChangeTracker.AcceptAllChanges();
                if (!accept)
                {
                    foreach (var snapshot in snapshots) snapshot.Restore(failed: false);
                }
                return count;
            }
            catch
            {
                if (owned is not null) await owned.RollbackAsync(CancellationToken.None);
                else if (transaction is not null && transaction.SupportsSavepoints)
                    await transaction.RollbackToSavepointAsync(savepoint, CancellationToken.None);
                foreach (var activity in events) db.Entry(activity).State = EntityState.Detached;
                foreach (var snapshot in snapshots) snapshot.Restore(failed: true);
                throw;
            }
            finally
            {
                db.ChangeTracker.AutoDetectChangesEnabled = autoDetect;
                if (owned is not null) await owned.DisposeAsync();
            }
        }
    }

    private sealed class Snapshot(EntityEntry entry)
    {
        public EntityEntry Entry { get; } = entry;
        public EntityState State { get; } = entry.State;
        private readonly PropertyValues originals = entry.OriginalValues.Clone();
        private readonly PropertyValues current = entry.CurrentValues.Clone();
        private readonly string[] modified = entry.Properties.Where(p => p.IsModified).Select(p => p.Metadata.Name).ToArray();
        private readonly string[] temporary = entry.Properties.Where(p => p.IsTemporary).Select(p => p.Metadata.Name).ToArray();
        public void Restore(bool failed)
        {
            if (failed && State == EntityState.Added && Entry.State != EntityState.Added)
            {
                Entry.State = EntityState.Detached;
                Entry.CurrentValues.SetValues(current);
            }
            Entry.State = State;
            Entry.OriginalValues.SetValues(originals);
            if (State == EntityState.Modified)
                foreach (var property in Entry.Properties) property.IsModified = modified.Contains(property.Metadata.Name);
            if (failed)
                foreach (var name in temporary) Entry.Property(name).IsTemporary = true;
        }
    }

    private sealed record Scope(long? OrganizationId, object? Property = null, object? Lease = null, bool Valid = true)
    {
        public long? PropertyId => Id(Property);
        public long? LeaseId => Id(Lease);
    }

    private sealed record Pending(EntityEntry Entry, object Target, string Type, string Operation, Scope Scope,
        long? ActorId, DateTime At)
    {
        public ActivityEvent Build() => new()
        {
            ActivityType = Type, Operation = Operation, RelatedId = Id(Target) ?? 0,
            OrganizationId = Scope.OrganizationId!.Value, PropertyId = Scope.PropertyId, LeaseId = Scope.LeaseId,
            PerformedByUserId = ActorId,
            // A stable safe actor label: do not copy email/name claims into the audit payload.
            PerformedByName = ActorId.HasValue ? $"User #{ActorId}" : "System",
            CreatedAt = At, Title = $"{Label(Type)} {Operation.ToLowerInvariant()}",
            Message = $"{Label(Type)} #{Id(Target)} was {Operation.ToLowerInvariant()}."
        };
    }

    private static string Label(string type) => type switch
    {
        "LeaseAgreement" => "Lease agreement", "BankAccount" => "Bank account", "TeamMember" => "Team member", _ => type
    };

    private static List<Pending> Capture(DataContext db, ClaimsPrincipal? actor)
    {
        long? actorId = actor?.Identity?.IsAuthenticated == true
            ? new[] { ClaimTypes.NameIdentifier, "userId", "sub" }
                .Select(type => long.TryParse(actor.FindFirst(type)?.Value, out var id) && id > 0 ? (long?)id : null)
                .FirstOrDefault(id => id.HasValue)
            : null;
        var pending = new List<Pending>();
        foreach (var entry in db.ChangeTracker.Entries().ToArray())
        {
            if (entry.State is not (EntityState.Added or EntityState.Modified or EntityState.Deleted)) continue;
            if (entry.State == EntityState.Modified && !entry.Properties.Any(p => p.IsModified && !Equals(p.OriginalValue, p.CurrentValue))) continue;
            var type = Type(entry.Entity);
            if (type is null) continue;
            object target = entry.Entity;
            if (target is ChecklistItem item)
                target = Lookup<Checklist>(db, item.ChecklistId, item.Checklist) ?? target;
            var scope = Resolve(db, target);
            if (!scope.Valid || scope.OrganizationId is not > 0) continue; // Never infer ownership from the requesting actor.
            var operation = entry.State switch
            {
                EntityState.Added => "Created", EntityState.Deleted => "Deleted", _ => SoftDeleted(entry) ? "Deleted" : "Updated"
            };
            if (entry.Entity is ChecklistItem) operation = "Updated";
            // Child mutations collapse into the parent checklist event for this save.
            var existing = pending.FindIndex(p => ReferenceEquals(p.Target, target));
            var next = new Pending(entry, target, type, operation, scope, actorId, DateTime.UtcNow);
            if (existing < 0) pending.Add(next);
            else if (entry.Entity is not ChecklistItem) pending[existing] = next;
        }
        return pending;
    }

    private static bool SoftDeleted(EntityEntry entry) => entry.Properties.Any(p =>
        (p.Metadata.Name == "IsDeleted" && Equals(p.CurrentValue, true) && !Equals(p.OriginalValue, true)) ||
        (entry.Entity is OrganizationMember or StaffMember or BankAccount && p.Metadata.Name == "IsActive" &&
            Equals(p.CurrentValue, false) && Equals(p.OriginalValue, true)));

    private static string? Type(object entity) => entity switch
    {
        LeaseAgreement => "LeaseAgreement", Lease => "Lease", Property => "Property", BankAccount => "BankAccount",
        OrganizationMember => "TeamMember", StaffMember => "TeamMember", Listing or ShortStayListing => "Listing",
        LandlordTask or ShortStayBlock or ShortStayIcalSubscription or ShortStayIcalOccurrence or ShortStayNightlyRateOverride or ShowingAvailability => "Calendar",
        ShortStayReservation or Showing => "Booking", Tenant => "Tenant", Checklist or ChecklistItem or OrganizationChecklistItem => "Checklist",
        Announcement => "Announcement", Payment => "Payment", _ => null
    };

    private static long? Id(object? entity) => entity switch
    {
        null => null, long id => id > 0 ? id : null,
        _ => entity.GetType().GetProperty("Id")?.GetValue(entity) is long id && id > 0 ? id : null
    };

    private static T? Lookup<T>(DataContext db, long? id, T? navigation = null) where T : class
    {
        if (navigation is not null) return navigation;
        if (id is null or 0) return null;
        var tracked = db.ChangeTracker.Entries<T>().FirstOrDefault(e => Equals(e.Property("Id").CurrentValue, id))?.Entity;
        return tracked ?? db.Set<T>().AsNoTracking().FirstOrDefault(e => EF.Property<long>(e, "Id") == id);
    }

    private static Scope Combine(long? direct, Scope inherited) =>
        inherited with { OrganizationId = direct is > 0 ? direct : inherited.OrganizationId,
            Valid = inherited.Valid && !(direct is > 0 && inherited.OrganizationId is > 0 && direct != inherited.OrganizationId) };

    private static Scope UnitScope(DataContext db, long? id, Unit? unit = null)
    {
        // Ownership reads need only keys, not the full unit/property payload. Preserve tracked
        // instances for generated keys and relationship fixup during aggregate creation.
        unit ??= db.ChangeTracker.Entries<Unit>().FirstOrDefault(e => e.Entity.Id == id)?.Entity;
        if (unit is null && id is > 0)
            unit = db.Units.AsNoTracking().Where(u => u.Id == id)
                .Select(u => new Unit { Id = u.Id, PropertyId = u.PropertyId, OrganizationId = u.OrganizationId }).FirstOrDefault();
        if (unit is null) return new(null);
        return Combine(unit.OrganizationId, PropertyScope(db, unit.PropertyId, unit.Property));
    }

    private static Scope LeaseScope(DataContext db, long? id, Lease? lease = null)
    {
        // Resolve authoritative ownership keys only; unrelated lease payload is not needed.
        // Keep tracked instances so generated IDs and relationship fixup survive aggregate creation.
        lease ??= db.ChangeTracker.Entries<Lease>().FirstOrDefault(e => e.Entity.Id == id)?.Entity;
        if (lease is null && id is > 0)
            lease = db.Leases.AsNoTracking().Where(l => l.Id == id)
                .Select(l => new Lease { Id = l.Id, UnitId = l.UnitId, OrganizationId = l.OrganizationId }).FirstOrDefault();
        return lease is null ? new(null) : Combine(lease.OrganizationId, UnitScope(db, lease.UnitId, lease.Unit)) with { Lease = lease };
    }

    private static Scope PropertyScope(DataContext db, long id, Property? property = null)
    {
        property ??= db.ChangeTracker.Entries<Property>().FirstOrDefault(e => e.Entity.Id == id)?.Entity;
        if (property is null && id > 0)
            property = db.Properties.AsNoTracking().Where(p => p.Id == id)
                .Select(p => new Property { Id = p.Id, OrganizationId = p.OrganizationId }).FirstOrDefault();
        return new(property?.OrganizationId, property);
    }

    private static Scope ChecklistScope(DataContext db, Checklist checklist)
    {
        var property = Combine(checklist.OrganizationId, PropertyScope(db, checklist.PropertyId, checklist.Property));
        if (checklist.LeaseId is null && checklist.Lease is null) return property;
        var lease = LeaseScope(db, checklist.LeaseId, checklist.Lease);
        // Never attach an unverified lease from another organization/property to a scoped event.
        if (lease.OrganizationId != property.OrganizationId ||
            (lease.PropertyId.HasValue && property.PropertyId.HasValue && lease.PropertyId != property.PropertyId))
            return property with { Valid = false };
        return property with { Lease = lease.Lease };
    }

    private static Scope Resolve(DataContext db, object entity) => entity switch
    {
        Property p => new(p.OrganizationId, p),
        Lease l => LeaseScope(db, l.Id, l),
        LeaseAgreement a => LeaseScope(db, a.LeaseId, a.Lease),
        BankAccount b => new(b.OrganizationId),
        OrganizationMember m => new(m.OrganizationId),
        StaffMember s => new(s.OrganizationId),
        Listing l => Combine(l.OrganizationId, PropertyScope(db, l.PropertyId, l.Property)),
        ShortStayListing l => UnitScope(db, l.UnitId, l.Unit),
        Tenant t => Combine(t.OrganizationId, UnitScope(db, t.UnitId, t.Unit)),
        Checklist c => ChecklistScope(db, c),
        OrganizationChecklistItem c => new(c.OrganizationId),
        Payment p => Combine(p.OrganizationId, Combine(PropertyScope(db, p.PropertyId).OrganizationId, LeaseScope(db, p.LeaseId, p.Lease))),
        Announcement a => new(a.OrganizationId),
        LandlordTask t => t.PropertyId.HasValue
            ? Combine(t.OrganizationId, PropertyScope(db, t.PropertyId.Value, t.Property)) : new(t.OrganizationId),
        ShortStayBlock b => UnitScope(db, b.UnitId, b.Unit),
        ShortStayNightlyRateOverride r => UnitScope(db, r.UnitId, r.Unit),
        ShortStayIcalSubscription s => Combine(s.OrgId, UnitScope(db, s.UnitId, s.Unit)),
        ShortStayIcalOccurrence o => Lookup(db, o.SubscriptionId, o.Subscription) is { } s ? Resolve(db, s) : new(null),
        ShortStayReservation r => Combine(r.OrganizationId, PropertyScope(db, r.PropertyId)),
        Showing s => Combine(s.OrganizationId, PropertyScope(db, s.PropertyId)),
        ShowingAvailability s => Lookup<Listing>(db, s.ListingId) is { } l ? Combine(s.OrganizationId, Resolve(db, l)) : new(s.OrganizationId),
        _ => new(null)
    };
}
