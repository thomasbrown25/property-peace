using brownstone_hub_api.Dtos.LeaseShield;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.LeaseShield;
using brownstone_hub_api.Services.OpenAIService;
using brownstone_hub_api.Services.StateLawSourceService;

namespace brownstone_hub_api.Services.LeaseShieldService
{
    public class LeaseShieldService : ILeaseShieldService
    {
        private const string PlaceholderResponse = "LeaseShield is designed to help you with landlord-tenant legal questions. We're building out full AI-powered answers—for now, your question has been saved to this conversation. Check back soon for detailed guidance on evictions, security deposits, lease terms, and more.";
        private const int MaxInjectedContextChars = 12000;
        private const int MaxSectionsToInject = 5;

        private readonly ILeaseShieldConversationRepository _conversationRepository;
        private readonly ILeaseShieldMessageRepository _messageRepository;
        private readonly ILeaseShieldStateLawSourceRepository _stateLawSourceRepository;
        private readonly ILeaseShieldStateLawSectionRepository _stateLawSectionRepository;
        private readonly IStateLawSourceService _stateLawSourceService;
        private readonly IOpenAIService _openAIService;
        private readonly ILogger<LeaseShieldService> _logger;

        public LeaseShieldService(
            ILeaseShieldConversationRepository conversationRepository,
            ILeaseShieldMessageRepository messageRepository,
            ILeaseShieldStateLawSourceRepository stateLawSourceRepository,
            ILeaseShieldStateLawSectionRepository stateLawSectionRepository,
            IStateLawSourceService stateLawSourceService,
            IOpenAIService openAIService,
            ILogger<LeaseShieldService> logger)
        {
            _conversationRepository = conversationRepository;
            _messageRepository = messageRepository;
            _stateLawSourceRepository = stateLawSourceRepository;
            _stateLawSectionRepository = stateLawSectionRepository;
            _stateLawSourceService = stateLawSourceService;
            _openAIService = openAIService;
            _logger = logger;
        }

        public async Task<ServiceResponse<List<LeaseShieldConversationListItemDto>>> GetConversationsAsync(long userId, long organizationId, CancellationToken cancellationToken = default)
        {
            try
            {
                var list = await _conversationRepository.GetByUserIdAsync(userId, organizationId, cancellationToken);
                var dtos = list.Select(c => new LeaseShieldConversationListItemDto
                {
                    Id = c.Id,
                    State = c.State,
                    Title = c.Title,
                    CreatedAt = c.CreatedAt,
                    UpdatedAt = c.UpdatedAt
                }).ToList();
                return ServiceResponse<List<LeaseShieldConversationListItemDto>>.CreateSuccess(dtos);
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting LeaseShield conversations for user {UserId}", userId);
                return ServiceResponse<List<LeaseShieldConversationListItemDto>>.CreateError("LeaseShield is temporarily unavailable.", statusCode: 500, suppressDetailedErrors: true);
            }
        }

        public async Task<ServiceResponse<LeaseShieldConversationDetailDto>> GetConversationAsync(long conversationId, long userId, long organizationId, CancellationToken cancellationToken = default)
        {
            try
            {
                var conv = await _conversationRepository.GetByIdAsync(conversationId, userId, organizationId, cancellationToken);
                if (conv == null)
                    return ServiceResponse<LeaseShieldConversationDetailDto>.CreateError("Conversation not found", "The conversation does not exist or you do not have access.", statusCode: 404);

                var messages = await MapMessagesWithSourceUrlsAsync(conv.Messages.ToList(), cancellationToken);

                var dto = new LeaseShieldConversationDetailDto
                {
                    Id = conv.Id,
                    State = conv.State,
                    Title = conv.Title,
                    CreatedAt = conv.CreatedAt,
                    UpdatedAt = conv.UpdatedAt,
                    Messages = messages
                };
                return ServiceResponse<LeaseShieldConversationDetailDto>.CreateSuccess(dto);
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting LeaseShield conversation {ConversationId}", conversationId);
                return ServiceResponse<LeaseShieldConversationDetailDto>.CreateError("LeaseShield is temporarily unavailable.", statusCode: 500, suppressDetailedErrors: true);
            }
        }

        public async Task<ServiceResponse<LeaseShieldConversationDetailDto>> CreateConversationAsync(long userId, CreateLeaseShieldConversationRequest request, long organizationId, CancellationToken cancellationToken = default)
        {
            try
            {
                var state = request.State?.Trim().ToUpperInvariant() ?? string.Empty;
                if (string.IsNullOrEmpty(state))
                    return ServiceResponse<LeaseShieldConversationDetailDto>.CreateError("State is required", "Please select a state.", statusCode: 400);

                var title = request.Title?.Trim() ?? "New conversation";
                var conv = await _conversationRepository.CreateAsync(userId, organizationId, state, title, cancellationToken);
                var dto = new LeaseShieldConversationDetailDto
                {
                    Id = conv.Id,
                    State = conv.State,
                    Title = conv.Title,
                    CreatedAt = conv.CreatedAt,
                    UpdatedAt = conv.UpdatedAt,
                    Messages = []
                };
                return ServiceResponse<LeaseShieldConversationDetailDto>.CreateSuccess(dto);
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating LeaseShield conversation for user {UserId}", userId);
                return ServiceResponse<LeaseShieldConversationDetailDto>.CreateError("LeaseShield is temporarily unavailable.", statusCode: 500, suppressDetailedErrors: true);
            }
        }

        public async Task<ServiceResponse<bool>> UpdateConversationTitleAsync(long conversationId, long userId, long organizationId, UpdateLeaseShieldConversationRequest request, CancellationToken cancellationToken = default)
        {
            try
            {
                var updated = await _conversationRepository.UpdateTitleAsync(conversationId, userId, organizationId, request.Title, cancellationToken);
                if (!updated)
                    return ServiceResponse<bool>.CreateError("Conversation not found", "The conversation does not exist or you do not have access.", statusCode: 404);
                return ServiceResponse<bool>.CreateSuccess(true);
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating LeaseShield conversation {ConversationId}", conversationId);
                return ServiceResponse<bool>.CreateError("LeaseShield is temporarily unavailable.", statusCode: 500, suppressDetailedErrors: true);
            }
        }

        public async Task<ServiceResponse<bool>> DeleteConversationAsync(long conversationId, long userId, long organizationId, CancellationToken cancellationToken = default)
        {
            try
            {
                var deleted = await _conversationRepository.DeleteAsync(conversationId, userId, organizationId, cancellationToken);
                if (!deleted)
                    return ServiceResponse<bool>.CreateError("Conversation not found", "The conversation does not exist or you do not have access.", statusCode: 404);
                return ServiceResponse<bool>.CreateSuccess(true);
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting LeaseShield conversation {ConversationId}", conversationId);
                return ServiceResponse<bool>.CreateError("LeaseShield is temporarily unavailable.", statusCode: 500, suppressDetailedErrors: true);
            }
        }

        public async Task<ServiceResponse<LeaseShieldConversationDetailDto>> SendMessageAsync(long? conversationId, long userId, SendLeaseShieldMessageRequest request, long organizationId, CancellationToken cancellationToken = default)
        {
            try
            {
                var state = request.State?.Trim().ToUpperInvariant() ?? string.Empty;
                if (string.IsNullOrEmpty(state))
                    return ServiceResponse<LeaseShieldConversationDetailDto>.CreateError("State is required", "Please select a state to send your question.", statusCode: 400);

                var content = request.Content?.Trim() ?? string.Empty;
                if (string.IsNullOrEmpty(content))
                    return ServiceResponse<LeaseShieldConversationDetailDto>.CreateError("Content is required", "Message content cannot be empty.", statusCode: 400);

                long convId;
                bool isNewConversation = false;
                string? titleToSet = null;

                if (conversationId == null || conversationId.Value == 0)
                {
                    titleToSet = content.Length > 45 ? content[..45] + "…" : content;
                    var conv = await _conversationRepository.CreateAsync(userId, organizationId, state, titleToSet, cancellationToken);
                    convId = conv.Id;
                    isNewConversation = true;
                }
                else
                {
                    var existing = await _conversationRepository.GetByIdAsync(conversationId.Value, userId, organizationId, cancellationToken);
                    if (existing == null)
                        return ServiceResponse<LeaseShieldConversationDetailDto>.CreateError("Conversation not found", "The conversation does not exist or you do not have access.", statusCode: 404);
                    convId = existing.Id;
                    if (existing.Messages.Count == 0)
                    {
                        titleToSet = await GenerateConversationTitleFromQuestionAsync(content, cancellationToken);
                        if (string.IsNullOrWhiteSpace(titleToSet))
                            titleToSet = content.Length > 45 ? content[..45] + "…" : content;
                    }
                }

                await _messageRepository.AddAsync(convId, "user", content, null, state, cancellationToken);
                await _messageRepository.UpdateConversationUpdatedAtAsync(convId, cancellationToken);

                if (!string.IsNullOrEmpty(titleToSet) && !isNewConversation)
                    await _conversationRepository.UpdateTitleAsync(convId, userId, organizationId, titleToSet, cancellationToken);

                var assistantContent = await GenerateLeaseShieldAnswerAsync(state, content, cancellationToken);
                await _messageRepository.AddAsync(convId, "assistant", assistantContent, null, state, cancellationToken);
                await _messageRepository.UpdateConversationUpdatedAtAsync(convId, cancellationToken);

                var detail = await _conversationRepository.GetByIdAsync(convId, userId, organizationId, cancellationToken);
                if (detail == null)
                    return ServiceResponse<LeaseShieldConversationDetailDto>.CreateError("Error loading conversation", "Conversation was created but could not be loaded.", statusCode: 500);

                var messages = await MapMessagesWithSourceUrlsAsync(detail.Messages.ToList(), cancellationToken);

                var dto = new LeaseShieldConversationDetailDto
                {
                    Id = detail.Id,
                    State = detail.State,
                    Title = detail.Title,
                    CreatedAt = detail.CreatedAt,
                    UpdatedAt = detail.UpdatedAt,
                    Messages = messages
                };
                return ServiceResponse<LeaseShieldConversationDetailDto>.CreateSuccess(dto);
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending LeaseShield message for user {UserId}", userId);
                return ServiceResponse<LeaseShieldConversationDetailDto>.CreateError("LeaseShield is temporarily unavailable.", statusCode: 500, suppressDetailedErrors: true);
            }
        }

        private async Task<List<LeaseShieldMessageDto>> MapMessagesWithSourceUrlsAsync(List<LeaseShieldMessage> messages, CancellationToken cancellationToken = default)
        {
            var ordered = messages.OrderBy(m => m.CreatedAt).ToList();
            var dtos = new List<LeaseShieldMessageDto>();
            foreach (var m in ordered)
            {
                var dto = new LeaseShieldMessageDto { Id = m.Id, Role = m.Role, State = m.State, Content = m.Content, CreatedAt = m.CreatedAt };
                if (m.Role == "assistant" && !string.IsNullOrWhiteSpace(m.State))
                {
                    var source = await _stateLawSourceRepository.GetByStateAsync(m.State, cancellationToken);
                    dto.SourceUrl = source?.BaseUrl;
                }
                dtos.Add(dto);
            }
            return dtos;
        }

        private async Task<string?> GenerateConversationTitleFromQuestionAsync(string question, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(question)) return null;
            var prompt = $"Generate a very short conversation title (maximum 6-8 words) that summarizes this landlord-tenant legal question. Reply with only the title, no quotes or punctuation at the end.\n\nQuestion: {question.Trim()}";
            var response = await GenerateTextWithCancellationAsync(prompt, 50, cancellationToken);
            if (!response.Success || string.IsNullOrWhiteSpace(response.Data))
                return null;
            var title = response.Data.Trim();
            if (title.Length > 500) title = title[..500];
            return title;
        }

        /// <summary>
        /// Uses the user's question to pick which section codes are most relevant (by section title).
        /// Returns up to MaxSectionsToInject section codes for use in context.
        /// </summary>
        private async Task<List<string>> SelectRelevantSectionCodesAsync(string userQuestion, IReadOnlyList<LeaseShieldStateLawSection> sections, CancellationToken cancellationToken)
        {
            if (sections == null || sections.Count == 0) return new List<string>();
            var list = string.Join("\n", sections.Select(s => $"{s.SectionCode}: {s.SectionTitle ?? ""}"));
            var prompt = "The user asked a landlord-tenant law question. Below are statute section codes and titles for their state. Which sections are most relevant to answering the question? Reply with only the section codes, comma-separated, up to " + MaxSectionsToInject + " codes (e.g. 42-46, 42-50). If none seem relevant, reply with the single most relevant code.\n\nUser question: " + (userQuestion?.Trim() ?? "") + "\n\nSections:\n" + list;
            var response = await GenerateTextWithCancellationAsync(prompt, 80, cancellationToken);
            if (!response.Success || string.IsNullOrWhiteSpace(response.Data)) return new List<string>();
            var codes = response.Data.Trim()
                .Split(new[] { ',', ';', '\n' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(c => c.Trim())
                .Where(c => sections.Any(s => s.SectionCode.Equals(c, StringComparison.OrdinalIgnoreCase)))
                .Take(MaxSectionsToInject)
                .ToList();
            return codes;
        }

        /// <summary>
        /// Builds context from state law sections: selects sections relevant to the question, then gets content (ContentText or fetch SourceUrl) and concatenates.
        /// Returns (null, empty) if no sections for state or no content could be assembled (caller falls back to StateLawSources).
        /// Links are the section labels and URLs used so the answer can end with "review the statute here" bullet points.
        /// </summary>
        private async Task<(string? Context, IReadOnlyList<(string Label, string Url)> Links)> BuildContextFromSectionsAsync(string state, string userQuestion, CancellationToken cancellationToken)
        {
            var sections = await _stateLawSectionRepository.GetByStateAsync(state, cancellationToken);
            if (sections == null || sections.Count == 0) return (null, Array.Empty<(string, string)>());

            var selectedCodes = await SelectRelevantSectionCodesAsync(userQuestion, sections, cancellationToken);
            if (selectedCodes.Count == 0) selectedCodes = sections.Take(2).Select(s => s.SectionCode).ToList();

            var sb = new System.Text.StringBuilder();
            var links = new List<(string Label, string Url)>();
            var charsLeft = MaxInjectedContextChars;
            foreach (var code in selectedCodes)
            {
                var section = sections.FirstOrDefault(s => s.SectionCode.Equals(code, StringComparison.OrdinalIgnoreCase));
                if (section == null) continue;
                string? text = section.ContentText;
                if (string.IsNullOrWhiteSpace(text) && !string.IsNullOrWhiteSpace(section.SourceUrl))
                    text = await _stateLawSourceService.FetchPageTextAsync(section.SourceUrl.Trim(), cancellationToken);
                if (string.IsNullOrWhiteSpace(text)) continue;
                var label = "§ " + section.SectionCode + (string.IsNullOrWhiteSpace(section.SectionTitle) ? "" : " – " + section.SectionTitle);
                if (!string.IsNullOrWhiteSpace(section.SourceUrl))
                    links.Add((label, section.SourceUrl.Trim()));
                var excerpt = text.Length > charsLeft ? text.Substring(0, charsLeft) + "\n[... truncated ...]" : text;
                sb.Append("\n\n--- § ").Append(section.SectionCode);
                if (!string.IsNullOrWhiteSpace(section.SectionTitle)) sb.Append(" ").Append(section.SectionTitle);
                sb.Append(" ---\n").Append(excerpt.Trim());
                charsLeft -= excerpt.Length;
                if (charsLeft <= 0) break;
            }
            if (sb.Length == 0) return (null, Array.Empty<(string, string)>());
            var context = "\n\nContext (official state law sections — use this to answer; you may state the law in plain language and do not have to quote verbatim; cite section numbers when helpful):" + sb.ToString();
            return (context, links);
        }

        /// <summary>
        /// Builds the context string for the AI: fetches official law text from ContentUrl (or BaseUrl when ContentUrl is not set)
        /// so the model can answer from actual statute content instead of only a URL and description.
        /// </summary>
        private async Task<string> BuildStateLawContextAsync(LeaseShieldStateLawSource? stateSource, CancellationToken cancellationToken)
        {
            if (stateSource == null)
                return "";

            var urlToFetch = !string.IsNullOrWhiteSpace(stateSource.ContentUrl)
                ? stateSource.ContentUrl.Trim()
                : !string.IsNullOrWhiteSpace(stateSource.BaseUrl)
                    ? stateSource.BaseUrl.Trim()
                    : null;

            if (string.IsNullOrEmpty(urlToFetch))
            {
                return string.IsNullOrWhiteSpace(stateSource.Description) && string.IsNullOrWhiteSpace(stateSource.BaseUrl)
                    ? ""
                    : "\n\nContext (official state law source): " + (string.IsNullOrWhiteSpace(stateSource.Description)
                        ? $"Base URL: {stateSource.BaseUrl ?? ""}"
                        : $"{stateSource.Description.Trim()}. Base URL: {stateSource.BaseUrl ?? ""}").Trim();
            }

            var officialText = await _stateLawSourceService.FetchPageTextAsync(urlToFetch, cancellationToken);
            if (!string.IsNullOrWhiteSpace(officialText))
            {
                var excerpt = officialText.Length > MaxInjectedContextChars
                    ? officialText.Substring(0, MaxInjectedContextChars) + "\n[... truncated ...]"
                    : officialText;
                var desc = string.IsNullOrWhiteSpace(stateSource.Description) ? "Official state law text" : stateSource.Description.Trim();
                return "\n\nContext (official state law text from government source — use this to answer; cite specific sections when relevant):\nSource: " + desc + ". URL: " + (stateSource.BaseUrl ?? urlToFetch) + "\n\n---\n" + excerpt.Trim() + "\n---";
            }

            _logger.LogWarning("LeaseShield: could not fetch content from {Url} for state {State}, using URL/description only", urlToFetch, stateSource.State);
            return "\n\nContext (official state law source; content could not be fetched): " + (string.IsNullOrWhiteSpace(stateSource.Description) ? $"Base URL: {stateSource.BaseUrl ?? urlToFetch}" : $"{stateSource.Description.Trim()}. Base URL: {stateSource.BaseUrl ?? urlToFetch}").Trim();
        }

        private async Task<string> GenerateLeaseShieldAnswerAsync(string state, string userQuestion, CancellationToken cancellationToken = default)
        {
            var (contextPart, sectionLinks) = await BuildContextFromSectionsAsync(state, userQuestion, cancellationToken);
            var statuteLinks = new List<(string Label, string Url)>(sectionLinks);

            if (string.IsNullOrEmpty(contextPart))
            {
                var stateSource = await _stateLawSourceRepository.GetByStateAsync(state, cancellationToken);
                contextPart = await BuildStateLawContextAsync(stateSource, cancellationToken);
                if (stateSource != null && !string.IsNullOrWhiteSpace(stateSource.BaseUrl))
                    statuteLinks.Add((stateSource.Description?.Trim() ?? "State law source", stateSource.BaseUrl.Trim()));
            }

            var prompt = "You are an experienced landlord-tenant attorney having a friendly, direct conversation. You are answering for the state with code \"" + state + "\"." + contextPart + "\n\n"
                + "**Response style — this is critical:**\n"
                + "- Keep answers SHORT by default. 2–4 sentences is ideal for a simple question. Only go longer if the question genuinely requires a step-by-step explanation or the user asks for more detail.\n"
                + "- Write like you’re texting a friend who is also a client—warm, plain, no legal jargon unless you explain it immediately.\n"
                + "- Never open with a preamble like ‘Great question!’ or restate the question back. Just answer it.\n"
                + "- Avoid numbered lists and bullet points for simple answers. Use them only when listing 3+ distinct steps or options that truly need to be separated.\n"
                + "- No bold section headers for short answers. Bold sparingly for a key term or amount if it helps.\n"
                + "- If the answer depends on facts you don’t have, ask a short follow-up question instead of giving a wall of caveats.\n\n"
                + "**Legal disclaimer:**\n"
                + "- Only suggest consulting an attorney when the situation is genuinely high-stakes (eviction, discrimination, large deposit dispute). Do not add a disclaimer to every message.\n\n"
                + "If the context does not contain enough information to answer, say so briefly and give your best general guidance.\n\n"
                + "Question:\n" + userQuestion.Trim();

            var response = await GenerateTextWithCancellationAsync(prompt, 800, cancellationToken);
            if (!response.Success || string.IsNullOrWhiteSpace(response.Data))
            {
                _logger.LogWarning("LeaseShield AI answer failed for state {State}, using placeholder. Error: {Error}", state, response.Message);
                return PlaceholderResponse;
            }

            var answer = response.Data.Trim();
            var linksWithUrl = statuteLinks.Where(l => !string.IsNullOrWhiteSpace(l.Url)).ToList();
            if (linksWithUrl.Count > 0)
            {
                answer += "\n\n**You can review the statute here:**\n\n";
                foreach (var (label, url) in linksWithUrl)
                    answer += "- [" + label + "](" + url + ")\n";
            }
            return answer;
        }

        /// <summary>
        /// IOpenAIService does not currently accept a CancellationToken. Fail closed by checking immediately
        /// before and after the non-cancellable provider call so cancelled requests cannot continue persistence.
        /// </summary>
        private async Task<ServiceResponse<string>> GenerateTextWithCancellationAsync(
            string prompt,
            int maxTokens,
            CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var response = await _openAIService.GenerateTextAsync(prompt, maxTokens);
            cancellationToken.ThrowIfCancellationRequested();
            return response;
        }
    }
}
