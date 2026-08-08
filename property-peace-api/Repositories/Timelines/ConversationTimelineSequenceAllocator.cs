using brownstone_hub_api.Data;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.Timelines;

public interface IConversationTimelineSequenceAllocator
{
    Task<long> AllocateAsync(DataContext context, long conversationId, CancellationToken cancellationToken = default);
}

/// <summary>
/// Allocates from one row per conversation. The counter update and new entry are committed by the
/// caller's SaveChanges transaction. SQL Server's rowversion turns concurrent writers into a safe
/// optimistic-concurrency failure instead of allowing duplicate/max+1 ordering.
/// </summary>
public sealed class ConversationTimelineSequenceAllocator : IConversationTimelineSequenceAllocator
{
    public async Task<long> AllocateAsync(DataContext context, long conversationId, CancellationToken cancellationToken = default)
    {
        var counter = context.ConversationTimelineSequences.Local.FirstOrDefault(x => x.ConversationId == conversationId)
            ?? await context.ConversationTimelineSequences.SingleOrDefaultAsync(x => x.ConversationId == conversationId, cancellationToken);

        if (counter == null)
        {
            counter = new ConversationTimelineSequence { ConversationId = conversationId, NextSequence = 2 };
            context.ConversationTimelineSequences.Add(counter);
            return 1;
        }

        if (counter.NextSequence < 1)
            throw new InvalidOperationException("Timeline sequence counter is invalid.");

        var allocated = counter.NextSequence;
        counter.NextSequence++;
        return allocated;
    }
}
