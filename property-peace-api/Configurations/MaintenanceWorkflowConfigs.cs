using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations;

internal static class MaintenanceWorkflowConfig
{
    public static void ConfigureRequest<TEntity>(EntityTypeBuilder<TEntity> b, string table)
        where TEntity : class
    {
        b.ToTable(table, "maintenance");
        b.HasKey("Id");
        b.Property("RowVersion").IsRowVersion();
        b.HasIndex("MaintenanceRequestId");
    }
}

public sealed class MaintenancePreferredWindowConfig : IEntityTypeConfiguration<MaintenancePreferredWindow>
{
    public void Configure(EntityTypeBuilder<MaintenancePreferredWindow> b)
    {
        MaintenanceWorkflowConfig.ConfigureRequest(b, "MaintenancePreferredWindows");
        b.Property(x => x.Status).HasConversion<string>().HasMaxLength(30);
        b.Property(x => x.AccessInstructions).HasMaxLength(1000);
        b.HasIndex(x => new { x.MaintenanceRequestId, x.Status, x.StartsAtUtc });
        b.HasOne(x => x.MaintenanceRequest).WithMany(x => x.PreferredWindows).HasForeignKey(x => x.MaintenanceRequestId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class MaintenanceEstimateConfig : IEntityTypeConfiguration<MaintenanceEstimate>
{
    public void Configure(EntityTypeBuilder<MaintenanceEstimate> b)
    {
        MaintenanceWorkflowConfig.ConfigureRequest(b, "MaintenanceEstimates");
        b.Property(x => x.Status).HasConversion<string>().HasMaxLength(30);
        b.Property(x => x.Amount).HasPrecision(18, 2);
        b.Property(x => x.Currency).HasMaxLength(3).IsFixedLength();
        b.Property(x => x.Scope).HasMaxLength(4000);
        b.Property(x => x.DecisionReason).HasMaxLength(2000);
        b.HasIndex(x => new { x.MaintenanceRequestId, x.Version }).IsUnique();
        b.HasIndex(x => new { x.MaintenanceRequestId, x.Status });
        b.HasIndex(x => x.VendorId);
        b.HasOne(x => x.MaintenanceRequest).WithMany(x => x.Estimates).HasForeignKey(x => x.MaintenanceRequestId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.Vendor).WithMany().HasForeignKey(x => x.VendorId).OnDelete(DeleteBehavior.NoAction);
    }
}

public sealed class MaintenanceWorkOrderConfig : IEntityTypeConfiguration<MaintenanceWorkOrder>
{
    public void Configure(EntityTypeBuilder<MaintenanceWorkOrder> b)
    {
        MaintenanceWorkflowConfig.ConfigureRequest(b, "MaintenanceWorkOrders");
        b.Property(x => x.Status).HasConversion<string>().HasMaxLength(30);
        b.Property(x => x.Scope).HasMaxLength(4000);
        b.Property(x => x.CancellationReason).HasMaxLength(2000);
        b.Property(x => x.AuthorizedAmount).HasPrecision(18, 2);
        b.HasIndex(x => new { x.MaintenanceRequestId, x.Version }).IsUnique();
        b.HasIndex(x => new { x.MaintenanceRequestId, x.Status, x.DueAtUtc });
        b.HasIndex(x => x.MaintenanceEstimateId);
        b.HasIndex(x => x.VendorId);
        b.HasOne(x => x.MaintenanceRequest).WithMany(x => x.WorkOrders).HasForeignKey(x => x.MaintenanceRequestId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.Estimate).WithMany().HasForeignKey(x => x.MaintenanceEstimateId).OnDelete(DeleteBehavior.NoAction);
        b.HasOne(x => x.Vendor).WithMany().HasForeignKey(x => x.VendorId).OnDelete(DeleteBehavior.NoAction);
    }
}

public sealed class MaintenanceAppointmentConfig : IEntityTypeConfiguration<MaintenanceAppointment>
{
    public void Configure(EntityTypeBuilder<MaintenanceAppointment> b)
    {
        MaintenanceWorkflowConfig.ConfigureRequest(b, "MaintenanceAppointments");
        b.Property(x => x.Status).HasConversion<string>().HasMaxLength(30);
        b.Property(x => x.Notes).HasMaxLength(2000);
        b.Property(x => x.CancellationReason).HasMaxLength(2000);
        b.HasIndex(x => new { x.MaintenanceRequestId, x.Status, x.StartsAtUtc });
        b.HasIndex(x => x.MaintenanceWorkOrderId);
        b.HasOne(x => x.MaintenanceRequest).WithMany(x => x.Appointments).HasForeignKey(x => x.MaintenanceRequestId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.WorkOrder).WithMany().HasForeignKey(x => x.MaintenanceWorkOrderId).OnDelete(DeleteBehavior.NoAction);
    }
}

public sealed class MaintenanceCompletionConfig : IEntityTypeConfiguration<MaintenanceCompletion>
{
    public void Configure(EntityTypeBuilder<MaintenanceCompletion> b)
    {
        MaintenanceWorkflowConfig.ConfigureRequest(b, "MaintenanceCompletions");
        b.Property(x => x.Status).HasConversion<string>().HasMaxLength(30);
        b.Property(x => x.ResolutionNotes).HasMaxLength(4000);
        b.Property(x => x.CompletionEvidenceReference).HasMaxLength(1000);
        b.Property(x => x.DecisionReason).HasMaxLength(2000);
        b.Property(x => x.FinalCost).HasPrecision(18, 2);
        b.HasIndex(x => new { x.MaintenanceRequestId, x.CompletedAtUtc });
        b.HasIndex(x => x.MaintenanceWorkOrderId);
        b.HasOne(x => x.MaintenanceRequest).WithMany(x => x.Completions).HasForeignKey(x => x.MaintenanceRequestId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.WorkOrder).WithMany().HasForeignKey(x => x.MaintenanceWorkOrderId).OnDelete(DeleteBehavior.NoAction);
    }
}

public sealed class MaintenanceCommandReceiptConfig : IEntityTypeConfiguration<MaintenanceCommandReceipt>
{
    public void Configure(EntityTypeBuilder<MaintenanceCommandReceipt> b)
    {
        b.ToTable("MaintenanceCommandReceipts", "maintenance");
        b.HasKey(x => x.Id);
        b.Property(x => x.Operation).HasMaxLength(100).IsRequired();
        b.Property(x => x.IdempotencyKeyHash).HasMaxLength(64).IsFixedLength().IsRequired();
        b.Property(x => x.RequestHash).HasMaxLength(64).IsFixedLength().IsRequired();
        b.Property(x => x.ResponseJson).HasMaxLength(16000);
        b.Property(x => x.RowVersion).IsRowVersion();
        b.HasIndex(x => new { x.ActorUserId, x.Operation, x.IdempotencyKeyHash }).IsUnique();
    }
}

public sealed class MaintenanceTimelineOutboxConfig : IEntityTypeConfiguration<MaintenanceTimelineOutbox>
{
    public void Configure(EntityTypeBuilder<MaintenanceTimelineOutbox> b)
    {
        b.ToTable("MaintenanceTimelineOutbox", "maintenance");
        b.HasKey(x => x.Id);
        b.Property(x => x.LastErrorCode).HasMaxLength(100);
        b.Property(x => x.ProcessingLeaseId).HasColumnType("uniqueidentifier");
        b.Property(x => x.ProcessingLeaseUntilUtc).HasColumnType("datetimeoffset(7)");
        b.Property(x => x.RowVersion).IsRowVersion();
        b.HasIndex(x => x.MaintenanceActivityEventId).IsUnique();
        b.HasIndex(x => new { x.ProcessedAtUtc, x.DeadLetteredAtUtc, x.NextAttemptAtUtc, x.AvailableAtUtc, x.ProcessingLeaseUntilUtc });
        b.HasOne(x => x.MaintenanceActivityEvent).WithOne().HasForeignKey<MaintenanceTimelineOutbox>(x => x.MaintenanceActivityEventId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class MaintenanceTroubleshootingStepConfig : IEntityTypeConfiguration<MaintenanceTroubleshootingStep>
{
    public void Configure(EntityTypeBuilder<MaintenanceTroubleshootingStep> b)
    {
        MaintenanceWorkflowConfig.ConfigureRequest(b, "MaintenanceTroubleshootingSteps");
        b.Property(x => x.Outcome).HasConversion<string>().HasMaxLength(30);
        b.Property(x => x.ResolutionCycleKey).HasMaxLength(100).IsRequired();
        b.Property(x => x.StepKey).HasMaxLength(100).IsRequired();
        b.Property(x => x.StepCode).HasMaxLength(100).IsRequired();
        b.Property(x => x.Instruction).HasMaxLength(2000);
        b.Property(x => x.TenantResponse).HasMaxLength(2000);
        b.HasIndex(x => new { x.MaintenanceRequestId, x.Sequence }).IsUnique();
        b.HasIndex(x => new { x.MaintenanceRequestId, x.ResolutionCycleKey, x.StepKey }).IsUnique();
        b.HasIndex(x => new { x.MaintenanceRequestId, x.ResolutionCycleKey, x.StepCode }).IsUnique();
        b.HasOne(x => x.MaintenanceRequest).WithMany(x => x.TroubleshootingSteps).HasForeignKey(x => x.MaintenanceRequestId).OnDelete(DeleteBehavior.Cascade);
    }
}
