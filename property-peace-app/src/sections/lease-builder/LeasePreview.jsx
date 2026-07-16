import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

// material-ui
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Stack,
  Alert,
  CircularProgress,
  Divider,
  Grid,
  Chip
} from '@mui/material';
import { CheckCircleOutlined } from '@ant-design/icons';

// project imports
import {
  getLeaseInstance,
  validatePlaceholders
} from 'api/leaseGeneration';
import { openSnackbar } from 'api/snackbar';

// ==============================|| LEASE PREVIEW ||============================== //

export default function LeasePreview({
  leaseInstanceId,
  template,
  property,
  unit,
  tenants,
  leaseTerms,
  onCreateInstance
}) {
  const [instance, setInstance] = useState(null);
  const [localLeaseInstanceId, setLocalLeaseInstanceId] = useState(leaseInstanceId);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [missingPlaceholders, setMissingPlaceholders] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLocalLeaseInstanceId(leaseInstanceId);
  }, [leaseInstanceId]);

  useEffect(() => {
    if (localLeaseInstanceId) {
      loadInstance();
    }
  }, [localLeaseInstanceId]);

  const loadInstance = async () => {
    try {
      setLoading(true);
      const response = await getLeaseInstance(localLeaseInstanceId);
      if (response.success && response.data) {
        setInstance(response.data);
      }
    } catch (err) {
      setError(err.message || 'Error loading lease instance');
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async () => {
    let instanceIdToValidate = localLeaseInstanceId;
    
    // If no instance ID exists, create the instance first
    if (!instanceIdToValidate) {
      const created = await onCreateInstance();
      if (!created || !created.id) {
        openSnackbar('error', 'Failed to create lease instance');
        return;
      }
      instanceIdToValidate = created.id;
      setLocalLeaseInstanceId(instanceIdToValidate);
    }

    setValidating(true);
    try {
      const response = await validatePlaceholders(instanceIdToValidate);
      if (response.success && response.data) {
        setMissingPlaceholders(response.data);
        if (response.data.length === 0) {
          openSnackbar('success', 'All placeholders are filled');
        } else {
          openSnackbar('warning', `${response.data.length} placeholders are missing`);
        }
      } else {
        openSnackbar('error', response.message || 'Validation failed');
      }
    } catch (err) {
      openSnackbar('error', err.message || 'Failed to validate');
    } finally {
      setValidating(false);
    }
  };


  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>
        Preview & Export
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Review the lease details and generate documents. Finalize when ready.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Lease Summary */}
        <Grid size={{ xs: 12 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                Lease Summary
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Template:</strong> {template?.name || 'N/A'}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Property:</strong> {property?.name || 'N/A'}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Unit:</strong> {unit?.name || 'N/A'}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Tenants:</strong> {tenants && tenants.length > 0 ? tenants.map(t => `${t.firstname || ''} ${t.lastname || ''}`).filter(Boolean).join(', ') || 'None' : 'None'}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Monthly Rent:</strong> {leaseTerms.monthlyRent != null && !isNaN(leaseTerms.monthlyRent) ? `$${leaseTerms.monthlyRent.toLocaleString()}` : 'N/A'}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Term:</strong> {leaseTerms.startDate && !isNaN(new Date(leaseTerms.startDate).getTime()) ? new Date(leaseTerms.startDate).toLocaleDateString() : 'N/A'} - {leaseTerms.endDate && !isNaN(new Date(leaseTerms.endDate).getTime()) ? new Date(leaseTerms.endDate).toLocaleDateString() : 'N/A'}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Validation */}
        <Grid size={{ xs: 12 }}>
          <Card variant="outlined">
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Placeholder Validation
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleValidate}
                  disabled={validating}
                  startIcon={validating ? <CircularProgress size={16} /> : null}
                >
                  {validating ? 'Validating...' : 'Validate'}
                </Button>
              </Stack>
              {missingPlaceholders.length > 0 ? (
                <Alert severity="warning">
                  Missing placeholders: {missingPlaceholders.join(', ')}
                </Alert>
              ) : (
                <Alert severity="success" icon={<CheckCircleOutlined />}>
                  All required placeholders are filled
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>


        {/* Generated Documents */}
        {instance && instance.documents && instance.documents.length > 0 && (
          <Grid size={{ xs: 12 }}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                  Generated Documents
                </Typography>
                <Stack spacing={1}>
                  {instance.documents.map((doc) => (
                    <Box key={doc.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip label={doc.documentType} size="small" />
                        <Typography variant="body2">
                          Generated {doc.generatedAt && !isNaN(new Date(doc.generatedAt).getTime()) ? new Date(doc.generatedAt).toLocaleString() : 'Unknown date'}
                        </Typography>
                      </Stack>
                      <Button
                        size="small"
                        href={doc.blobUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Download
                      </Button>
                    </Box>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Warnings */}
        {instance && instance.warnings && Array.isArray(instance.warnings) && instance.warnings.length > 0 && (
          <Grid size={{ xs: 12 }}>
            <Card variant="outlined" sx={{ borderColor: 'warning.main' }}>
              <CardContent>
                <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, color: 'warning.main' }}>
                  ⚠️ Warnings & Recommendations
                </Typography>
                <Stack spacing={1}>
                  {instance.warnings.map((warning, index) => {
                    const warningStr = typeof warning === 'string' ? warning : String(warning);
                    const isHigh = warningStr.includes('[High]');
                    const isMedium = warningStr.includes('[Medium]');
                    return (
                      <Alert
                        key={index}
                        severity={isHigh ? 'error' : isMedium ? 'warning' : 'info'}
                        sx={{ fontSize: '0.875rem' }}
                      >
                        {warningStr.replace(/\[(High|Medium|Low)\]\s*/, '')}
                      </Alert>
                    );
                  })}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Finalization Warning */}
        <Grid size={{ xs: 12 }}>
          <Alert severity="info">
            Once finalized, this lease instance will be immutable. Make sure all information is correct before finalizing.
          </Alert>
        </Grid>
      </Grid>
    </Box>
  );
}

LeasePreview.propTypes = {
  leaseInstanceId: PropTypes.number,
  template: PropTypes.object,
  property: PropTypes.object,
  unit: PropTypes.object,
  tenants: PropTypes.array.isRequired,
  leaseTerms: PropTypes.object.isRequired,
  onCreateInstance: PropTypes.func
};
