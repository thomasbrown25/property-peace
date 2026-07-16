export const selectMessages = (state) => state.message.messages;
export const selectSelectedMessage = (state) => state.message.selectedMessage;
export const selectCurrentConversationId = (state) => state.message.currentConversationId;
export const selectMessageLoading = (state) => state.message.loading;
export const selectMessageError = (state) => state.message.error;

