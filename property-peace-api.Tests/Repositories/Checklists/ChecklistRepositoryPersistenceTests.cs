using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Checklist;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Checklists;
using brownstone_hub_api.Tests.Helpers;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace brownstone_hub_api.Tests.Repositories.Checklists;

public sealed class ChecklistRepositoryPersistenceTests : IDisposable
{
    private readonly DataContext _context = DbContextFactory.Create();

    [Fact]
    public async Task UpdateChecklist_ClearsCompletedAtWhenChecklistReopens()
    {
        _context.Properties.Add(new Property { Id = 4, Name = "Oak House", LandlordId = 42 });
        _context.Checklists.Add(new Checklist
        {
            Id = 9,
            PropertyId = 4,
            LandlordId = 42,
            ChecklistType = ETenantDocumentType.MoveInChecklist,
            Title = "Move in",
            IsCompleted = true,
            CompletedAt = new DateTime(2026, 8, 22, 12, 0, 0),
            Items =
            [
                new ChecklistItem { Id = 10, Name = "Sink", Condition = "Good", IsChecked = true }
            ]
        });
        await _context.SaveChangesAsync();
        var repository = new ChecklistRepository(
            _context,
            MapperFactory.Create(),
            NullLogger<ChecklistRepository>.Instance);

        await repository.UpdateChecklist(new UpdateChecklistDto
        {
            Id = 9,
            IsCompleted = false,
            CompletedAt = null
        });

        var saved = await _context.Checklists.FindAsync(9L);
        saved!.IsCompleted.Should().BeFalse();
        saved.CompletedAt.Should().BeNull();
    }

    public void Dispose() => _context.Dispose();
}
