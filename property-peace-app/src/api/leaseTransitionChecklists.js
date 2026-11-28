import axiosServices from 'utils/axios';

const transitionPath = '/api/lease-transition-checklists';
const reportPath = '/api/condition-reports';

async function readResult(request) {
  const { data } = await request;
  if (!data?.success) throw new Error(data?.message || 'The request could not be completed.');
  return data.data;
}

export const listTransitionChecklists = (params) => readResult(axiosServices.get(transitionPath, { params }));
export const getTransitionChecklist = (id) => readResult(axiosServices.get(`${transitionPath}/${id}`));
export const startTransitionChecklist = (input) => readResult(axiosServices.post(transitionPath, input));
export const saveTransitionItem = (id, key, status, notApplicableReason) => readResult(
  axiosServices.put(`${transitionPath}/${id}/items/${encodeURIComponent(key)}`, { status, notApplicableReason })
);
export const listConditionReports = (params) => readResult(axiosServices.get(reportPath, { params }));
export const startConditionReport = (input) => readResult(axiosServices.post(reportPath, input));
export const linkConditionReport = (id, conditionReportId) => readResult(axiosServices.put(`${transitionPath}/${id}/condition-report`, { conditionReportId }));
export const detachConditionReport = (id) => readResult(axiosServices.delete(`${transitionPath}/${id}/condition-report`));
