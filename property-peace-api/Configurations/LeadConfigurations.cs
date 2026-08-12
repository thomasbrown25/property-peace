using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations;

public sealed class LeadConfig : IEntityTypeConfiguration<Lead>
{
    public void Configure(EntityTypeBuilder<Lead> b)
    {
        b.ToTable("Leads", "leasing");
        b.HasKey(x => x.Id);
        b.Property(x => x.RowVersion).IsRowVersion();
        b.Property(x => x.Email).HasMaxLength(320).IsRequired();
        b.Property(x => x.NormalizedEmail).HasMaxLength(320).IsRequired();
        b.Property(x => x.ContactIdentityHash).HasMaxLength(64).IsRequired();
        b.Property(x => x.VerificationTokenHash).HasMaxLength(64).IsRequired();
        b.Property(x => x.PublicAccessTokenHash).HasMaxLength(64);
        b.HasIndex(x => new { x.OrganizationId, x.ListingId, x.ContactIdentityHash }).IsUnique();
        b.HasIndex(x => new { x.OrganizationId, x.Status, x.NextFollowUpAtUtc });
        b.HasIndex(x => x.RentalApplicationId).IsUnique().HasFilter("[RentalApplicationId] IS NOT NULL");
        b.HasOne<Organization>().WithMany().HasForeignKey(x => x.OrganizationId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<Listing>().WithMany().HasForeignKey(x => x.ListingId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<Property>().WithMany().HasForeignKey(x => x.PropertyId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<Unit>().WithMany().HasForeignKey(x => x.UnitId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<User>().WithMany().HasForeignKey(x => x.OwnerUserId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<User>().WithMany().HasForeignKey(x => x.AssignedTeamMemberId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<RentalApplication>().WithMany().HasForeignKey(x => x.RentalApplicationId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class LeadSourceConfig : IEntityTypeConfiguration<LeadSource>
{
    public void Configure(EntityTypeBuilder<LeadSource> b)
    {
        b.ToTable("LeadSources", "leasing");
        b.HasKey(x => x.Id);
        b.Property(x => x.RequestHash).HasMaxLength(64).IsRequired();
        b.Property(x => x.Receipt).HasMaxLength(64).IsRequired();
        b.HasIndex(x => new { x.OrganizationId, x.IdempotencyKeyHash }).IsUnique();
        b.HasOne<Organization>().WithMany().HasForeignKey(x => x.OrganizationId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<Lead>().WithMany().HasForeignKey(x => x.LeadId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class PreScreenConfigurationConfig : IEntityTypeConfiguration<PreScreenConfiguration>
{
    public void Configure(EntityTypeBuilder<PreScreenConfiguration> b)
    {
        b.ToTable("PreScreenConfigurations", "leasing");
        b.HasKey(x => x.Id);
        b.Property(x => x.RowVersion).IsRowVersion();
        b.HasIndex(x => new { x.OrganizationId, x.ListingId }).IsUnique();
        b.HasOne<Organization>().WithMany().HasForeignKey(x => x.OrganizationId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<Listing>().WithMany().HasForeignKey(x => x.ListingId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class PreScreenResponseConfig : IEntityTypeConfiguration<PreScreenResponse>
{
    public void Configure(EntityTypeBuilder<PreScreenResponse> b)
    {
        b.ToTable("PreScreenResponses", "leasing");
        b.HasKey(x => x.Id);
        b.HasIndex(x => x.LeadId).IsUnique();
        b.HasOne<Organization>().WithMany().HasForeignKey(x => x.OrganizationId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<Lead>().WithMany().HasForeignKey(x => x.LeadId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class ShowingAvailabilityConfig : IEntityTypeConfiguration<ShowingAvailability>
{
    public void Configure(EntityTypeBuilder<ShowingAvailability> b)
    {
        b.ToTable("ShowingAvailabilities", "leasing");
        b.HasKey(x => x.Id);
        b.Property(x => x.RowVersion).IsRowVersion();
        b.HasIndex(x => new { x.OrganizationId, x.ListingId, x.StartsAtUtc, x.EndsAtUtc }).IsUnique();
        b.HasOne<Organization>().WithMany().HasForeignKey(x => x.OrganizationId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<Listing>().WithMany().HasForeignKey(x => x.ListingId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class ShowingConfig : IEntityTypeConfiguration<Showing>
{
    public void Configure(EntityTypeBuilder<Showing> b)
    {
        b.ToTable("Showings", "leasing");
        b.HasKey(x => x.Id);
        b.Property(x => x.RowVersion).IsRowVersion();
        b.Property(x => x.RequestHash).HasMaxLength(64).IsRequired();
        b.HasIndex(x => x.AvailabilityId).IsUnique().HasFilter("[Status] <> 1");
        b.HasIndex(x => new { x.OrganizationId, x.LeadId, x.IdempotencyKeyHash }).IsUnique();
        b.HasIndex(x => new { x.OrganizationId, x.Id, x.RescheduleIdempotencyKeyHash }).IsUnique()
            .HasFilter("[RescheduleIdempotencyKeyHash] IS NOT NULL");
        b.HasOne<Organization>().WithMany().HasForeignKey(x => x.OrganizationId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<Lead>().WithMany().HasForeignKey(x => x.LeadId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<Listing>().WithMany().HasForeignKey(x => x.ListingId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<Property>().WithMany().HasForeignKey(x => x.PropertyId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<Unit>().WithMany().HasForeignKey(x => x.UnitId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<ShowingAvailability>().WithMany().HasForeignKey(x => x.AvailabilityId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class LeadNoteConfig : IEntityTypeConfiguration<LeadNote>
{
    public void Configure(EntityTypeBuilder<LeadNote> b)
    {
        b.ToTable("LeadNotes", "leasing"); b.HasKey(x => x.Id);
        b.Property(x => x.Body).HasMaxLength(2000).IsRequired();
        b.HasOne<Organization>().WithMany().HasForeignKey(x => x.OrganizationId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<Lead>().WithMany().HasForeignKey(x => x.LeadId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<User>().WithMany().HasForeignKey(x => x.AuthorUserId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class LeadTaskConfig : IEntityTypeConfiguration<LeadTask>
{
    public void Configure(EntityTypeBuilder<LeadTask> b)
    {
        b.ToTable("LeadTasks", "leasing"); b.HasKey(x => x.Id);
        b.Property(x => x.Title).HasMaxLength(200).IsRequired();
        b.Property(x => x.RowVersion).IsRowVersion();
        b.HasOne<Organization>().WithMany().HasForeignKey(x => x.OrganizationId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<Lead>().WithMany().HasForeignKey(x => x.LeadId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<User>().WithMany().HasForeignKey(x => x.AssigneeUserId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class LeadNotificationIntentConfig : IEntityTypeConfiguration<LeadNotificationIntent>
{
    public void Configure(EntityTypeBuilder<LeadNotificationIntent> b)
    {
        b.ToTable("LeadNotificationIntents", "leasing"); b.HasKey(x => x.Id);
        b.Property(x => x.LastError).HasMaxLength(500);
        b.HasIndex(x => new { x.Status, x.NotBeforeUtc, x.NextAttemptAtUtc });
        b.HasOne<Organization>().WithMany().HasForeignKey(x => x.OrganizationId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<Lead>().WithMany().HasForeignKey(x => x.LeadId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<Showing>().WithMany().HasForeignKey(x => x.ShowingId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class LeadTokenDeliveryConfig : IEntityTypeConfiguration<LeadTokenDelivery>
{
    public void Configure(EntityTypeBuilder<LeadTokenDelivery> b)
    {
        b.ToTable("LeadTokenDeliveries", "leasing"); b.HasKey(x => x.Id);
        b.Property(x => x.ProtectedPayload).HasMaxLength(4000).IsRequired();
        b.Property(x => x.Destination).HasMaxLength(320).IsRequired();
        b.Property(x => x.LastError).HasMaxLength(500);
        b.HasIndex(x => new { x.Status, x.NextAttemptAtUtc, x.LeaseUntilUtc, x.CreatedAtUtc });
        b.HasOne<Organization>().WithMany().HasForeignKey(x => x.OrganizationId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<Lead>().WithMany().HasForeignKey(x => x.LeadId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class ShowingOperationConfig : IEntityTypeConfiguration<ShowingOperation>
{
    public void Configure(EntityTypeBuilder<ShowingOperation> b)
    {
        b.ToTable("ShowingOperations", "leasing"); b.HasKey(x => x.Id);
        b.Property(x => x.Operation).HasMaxLength(30).IsRequired();
        b.Property(x => x.IdempotencyKeyHash).HasMaxLength(64).IsRequired();
        b.Property(x => x.RequestHash).HasMaxLength(64).IsRequired();
        b.Property(x => x.ResultTimeZoneId).HasMaxLength(100).IsRequired();
        b.HasIndex(x => new { x.OrganizationId, x.IdempotencyKeyHash }).IsUnique();
        b.HasOne<Organization>().WithMany().HasForeignKey(x => x.OrganizationId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<Showing>().WithMany().HasForeignKey(x => x.ShowingId).OnDelete(DeleteBehavior.Restrict);
    }
}
