import axiosServices from 'utils/axios';

/**
 * Get list of runnable jobs (Admin only)
 * GET: /api/admin/jobs
 */
export const getJobs = async () => {
  const response = await axiosServices.get('/api/admin/jobs');
  return response.data;
};

/**
 * Run a job manually (Admin only)
 * POST: /api/admin/jobs/run
 * @param {string} jobId - e.g. 'StateLateFeeLawUpdate', 'StateDepositLawUpdate', 'RentReminder'
 * @param {number} [leaseId] - Required for RentReminder job: lease to run rent reminder for
 */
export const runJob = async (jobId, leaseId) => {
  const response = await axiosServices.post('/api/admin/jobs/run', { jobId, leaseId: leaseId ?? undefined });
  return response.data;
};

/**
 * Get leases for admin job dropdown (e.g. rent reminder - select lease)
 * GET: /api/admin/jobs/leases
 */
export const getLeasesForJobs = async () => {
  const response = await axiosServices.get('/api/admin/jobs/leases');
  return response.data;
};

/**
 * Get job run history (Admin only)
 * GET: /api/admin/jobs/history?limit=100
 */
export const getJobHistory = async (limit = 100) => {
  const response = await axiosServices.get('/api/admin/jobs/history', { params: { limit } });
  return response.data;
};

/**
 * Get state law source configs (all states, Admin only)
 * GET: /api/admin/jobs/state-law-sources
 */
export const getStateLawSources = async () => {
  const response = await axiosServices.get('/api/admin/jobs/state-law-sources');
  return response.data;
};

/**
 * Update one state's law source URLs (Admin only)
 * PUT: /api/admin/jobs/state-law-sources
 * @param {{ state: string, lateFeeUrl?: string|null, securityDepositUrl?: string|null }} payload
 */
export const updateStateLawSource = async (payload) => {
  const response = await axiosServices.put('/api/admin/jobs/state-law-sources', payload);
  return response.data;
};

/**
 * Get all generated state law descriptions (deposit + late fee) (Admin only)
 * GET: /api/admin/jobs/generated-laws
 */
export const getGeneratedLaws = async () => {
  const response = await axiosServices.get('/api/admin/jobs/generated-laws');
  return response.data;
};
