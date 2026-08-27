import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { alpha, Box, Button, Chip, Skeleton, Stack, Typography, useTheme } from '@mui/material';
import { ArrowRightOutlined, FileTextOutlined } from '@ant-design/icons';
import MainCard from 'components/MainCard';
import useAuth from 'hooks/useAuth';
import { useOrganization } from 'contexts/OrganizationContext';
import { applicationAPI } from 'api';
import { selectProperty } from 'store/property/property.selector';

const APPLICATION_STATUSES = {
  0: { label: 'Draft', color: 'default' },
  1: { label: 'Submitted', color: 'info' },
  2: { label: 'Under review', color: 'warning' },
  3: { label: 'Approved', color: 'success' },
  4: { label: 'Rejected', color: 'error' },
  5: { label: 'Withdrawn', color: 'default' },
  6: { label: 'On hold', color: 'warning' },
  7: { label: 'Lease signed', color: 'success' },
  8: { label: 'Pending', color: 'warning' }
};

const STATUS_VALUES = {
  draft: 0,
  submitted: 1,
  underreview: 2,
  approved: 3,
  rejected: 4,
  withdrawn: 5,
  onhold: 6,
  leasesigned: 7,
  pending: 8
};

const read = (item, camel, pascal) => item?.[camel] ?? item?.[pascal];
const normalize = (value) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[-_\s]/g, '');

function statusDetails(application) {
  const rawStatus = read(application, 'status', 'Status');
  const numericStatus = typeof rawStatus === 'number' ? rawStatus : (STATUS_VALUES[normalize(rawStatus)] ?? Number(rawStatus));
  const fallbackLabel = read(application, 'statusName', 'StatusName');
  return APPLICATION_STATUSES[numericStatus] || { label: fallbackLabel || 'Pending', color: 'default' };
}

function applicationTime(application) {
  const value = read(application, 'submittedAt', 'SubmittedAt') || read(application, 'createdAt', 'CreatedAt');
  const time = value ? new Date(value).getTime() : 0;
  return Number.isNaN(time) ? 0 : time;
}

function ApplicationsRow({ application, isLast, onClick }) {
  const theme = useTheme();
  const status = statusDetails(application);
  const name =
    [read(application, 'firstName', 'FirstName'), read(application, 'lastName', 'LastName')].filter(Boolean).join(' ') ||
    'Unnamed applicant';
  const property = [read(application, 'propertyName', 'PropertyName'), read(application, 'unitName', 'UnitName')]
    .filter(Boolean)
    .join(' · ');

  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      aria-label={`Open application for ${name}`}
      sx={{
        width: '100%',
        minHeight: 62,
        px: 0.5,
        py: 1.1,
        border: 0,
        borderBottom: isLast ? 0 : `1px solid ${alpha(theme.palette.divider, 0.7)}`,
        bgcolor: 'transparent',
        color: 'text.primary',
        font: 'inherit',
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'background-color 150ms ease, transform 150ms ease',
        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.045), transform: 'translateX(2px)' },
        '&:focus-visible': { outline: `2px solid ${alpha(theme.palette.primary.main, 0.5)}`, outlineOffset: -2, borderRadius: 1 }
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1.25}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2" fontWeight={700} noWrap>
            {name}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', mt: 0.25 }}>
            {property || 'Portfolio application'}
          </Typography>
        </Box>
        <Chip label={status.label} color={status.color} size="small" variant="outlined" sx={{ flexShrink: 0, fontWeight: 650 }} />
      </Stack>
    </Box>
  );
}

export default function Applications({ onLoadingChange }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const selectedProperty = useSelector(selectProperty);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loadedScope, setLoadedScope] = useState('');
  const userId = user?.id || user?.Id;
  const organizationId = currentOrganization?.id || currentOrganization?.Id || user?.organizationId || user?.OrganizationId;
  const propertyId = selectedProperty?.id || selectedProperty?.Id;
  const scopeKey = `${userId || ''}:${organizationId || ''}:${propertyId || ''}`;
  const hasCurrentScope = loadedScope === scopeKey;
  const visibleApplications = hasCurrentScope ? applications : [];
  const displayLoading = loading || (!hasCurrentScope && Boolean(userId));

  useEffect(() => {
    onLoadingChange?.(displayLoading);
  }, [displayLoading, onLoadingChange]);

  useEffect(() => () => onLoadingChange?.(false), [onLoadingChange]);

  useEffect(() => {
    let current = true;

    async function loadApplications() {
      if (!userId) {
        if (current) {
          setApplications([]);
          setError('');
          setLoadedScope(scopeKey);
          setLoading(false);
        }
        return;
      }

      setApplications([]);
      setLoading(true);
      setError('');
      try {
        const response = propertyId
          ? await applicationAPI.getApplicationsByProperty(propertyId)
          : await applicationAPI.getApplicationsByLandlord(userId);
        if (!current) return;
        if (!response?.success || !Array.isArray(response.data || []))
          throw new Error(response?.message || 'Applications could not be loaded.');
        setApplications(response.data || []);
        setLoadedScope(scopeKey);
      } catch {
        if (!current) return;
        setApplications([]);
        setError('Applications could not be loaded.');
        setLoadedScope(scopeKey);
      } finally {
        if (current) setLoading(false);
      }
    }

    loadApplications();
    return () => {
      current = false;
    };
  }, [organizationId, propertyId, scopeKey, userId]);

  const latestApplications = useMemo(
    () => [...visibleApplications].sort((a, b) => applicationTime(b) - applicationTime(a)).slice(0, 3),
    [visibleApplications]
  );
  const applicationsRoute = '/landlord/listings?tab=applications';

  return (
    <MainCard
      accentColor={theme.palette.primary.main}
      accentShadow
      title={
        <Stack direction="row" spacing={1} alignItems="center">
          <FileTextOutlined style={{ color: theme.palette.primary.main }} />
          <Typography variant="h5" fontWeight={700}>
            Applications
          </Typography>
        </Stack>
      }
      secondary={
        <Button
          size="small"
          endIcon={<ArrowRightOutlined style={{ fontSize: 12 }} />}
          onClick={() => navigate(applicationsRoute)}
          sx={{ color: 'text.secondary', fontSize: '0.78rem', fontWeight: 600, textTransform: 'none', whiteSpace: 'nowrap' }}
        >
          View all
        </Button>
      }
      sx={{ height: '100%' }}
      contentSX={{ pt: 0.75, pb: 1 }}
    >
      <Box aria-busy={displayLoading} aria-live="polite">
        {displayLoading ? (
          <Stack spacing={0.5} role="status" aria-label="Loading applications">
            {[0, 1, 2].map((item) => (
              <Skeleton key={item} variant="rounded" height={57} />
            ))}
          </Stack>
        ) : error ? (
          <Box role="alert" sx={{ minHeight: 184, display: 'grid', placeItems: 'center', textAlign: 'center', px: 2 }}>
            <Box>
              <Typography variant="subtitle2" fontWeight={700}>
                Unable to load applications
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Open Applications to try again.
              </Typography>
            </Box>
          </Box>
        ) : latestApplications.length ? (
          latestApplications.map((application, index) => {
            const id = read(application, 'id', 'Id');
            return (
              <ApplicationsRow
                key={id ?? index}
                application={application}
                isLast={index === latestApplications.length - 1}
                onClick={() => navigate(`${applicationsRoute}&applicationId=${id}`)}
              />
            );
          })
        ) : (
          <Box sx={{ minHeight: 184, display: 'grid', placeItems: 'center', textAlign: 'center', px: 2 }}>
            <Box>
              <Typography variant="subtitle2" fontWeight={700}>
                No applications yet
              </Typography>
              <Typography variant="caption" color="text.secondary">
                New rental applications will appear here.
              </Typography>
            </Box>
          </Box>
        )}
      </Box>
    </MainCard>
  );
}
