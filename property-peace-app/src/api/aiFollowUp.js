import axiosServices from '../utils/axios';

export const previewAIFollowUp = async (actionType, entityId, context = null) => {
  const response = await axiosServices.post('/api/AIFollowUp/preview', { actionType, entityId, context });
  return response.data;
};

export const sendAIFollowUp = async (actionType, entityId, context = null, overrides = null) => {
  const response = await axiosServices.post('/api/AIFollowUp/send', {
    actionType,
    entityId,
    context,
    ...(overrides?.inAppMessage && { inAppMessageOverride: overrides.inAppMessage }),
    ...(overrides?.emailSubject && { emailSubjectOverride: overrides.emailSubject }),
    ...(overrides?.emailBody && { emailBodyOverride: overrides.emailBody })
  });
  return response.data;
};
