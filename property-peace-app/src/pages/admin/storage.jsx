import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  LinearProgress,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Typography,
  alpha,
  useTheme
} from '@mui/material';
import { CloudServerOutlined, DatabaseOutlined, FileOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons';
import MainCard from 'components/MainCard';
import { adminStorageAPI } from 'api/admin/storage';

const formatBytes = (bytes = 0) => {
  const value = Number(bytes || 0);
  if (value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

const formatDate = (date) => (date ? new Date(date).toLocaleString() : '—');

const StorageProgress = ({ usedBytes = 0, limitBytes = 0, percentUsed }) => {
  const theme = useTheme();
  const percent = Math.min(Number(percentUsed ?? (limitBytes ? (usedBytes / limitBytes) * 100 : 0)), 100);
  const color = percent >= 90 ? theme.palette.error.main : percent >= 75 ? theme.palette.warning.main : theme.palette.success.main;

  return (
    <Stack spacing={0.75} sx={{ minWidth: 180 }}>
      <Stack direction="row" justifyContent="space-between" spacing={1}>
        <Typography variant="caption" color="text.secondary">{formatBytes(usedBytes)}</Typography>
        <Typography variant="caption" color="text.secondary">{limitBytes ? `${percent.toFixed(1)}%` : '—'}</Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={percent}
        sx={{
          height: 8,
          borderRadius: 999,
          bgcolor: alpha(color, 0.12),
          '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 999 }
        }}
      />
      {limitBytes > 0 && (
        <Typography variant="caption" color="text.secondary">of {formatBytes(limitBytes)}</Typography>
      )}
    </Stack>
  );
};

const MetricCard = ({ title, value, subtitle, icon: Icon, color = 'primary' }) => {
  const theme = useTheme();
  const main = theme.palette[color]?.main || theme.palette.primary.main;
  return (
    <Card variant="outlined" sx={{ height: '100%', borderColor: alpha(main, 0.18), bgcolor: alpha(main, 0.035) }}>
      <CardContent>
        <Stack direction="row" spacing={2} alignItems="center">
          <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: alpha(main, 0.12), color: main, display: 'grid', placeItems: 'center' }}>
            <Icon style={{ fontSize: 22 }} />
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary">{title}</Typography>
            <Typography variant="h4">{value}</Typography>
            {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default function AdminStorage() {
  const [summary, setSummary] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [users, setUsers] = useState([]);
  const [tab, setTab] = useState('organizations');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedUserStorage, setSelectedUserStorage] = useState(null);
  const [loadingUserStorage, setLoadingUserStorage] = useState(false);

  const largestOrg = useMemo(() => organizations[0], [organizations]);

  useEffect(() => {
    const loadStorage = async () => {
      try {
        setLoading(true);
        setError(null);
        const [summaryResponse, orgResponse, userResponse] = await Promise.all([
          adminStorageAPI.getStorageSummary(),
          adminStorageAPI.getStorageOrganizations(),
          adminStorageAPI.getStorageUsers()
        ]);

        if (!summaryResponse.success || !orgResponse.success || !userResponse.success) {
          throw new Error(summaryResponse.message || orgResponse.message || userResponse.message || 'Failed to load storage usage');
        }

        setSummary(summaryResponse.data);
        setOrganizations(orgResponse.data || []);
        setUsers(userResponse.data || []);
      } catch (err) {
        console.error('Error loading admin storage:', err);
        setError(err.message || 'Failed to load storage usage');
      } finally {
        setLoading(false);
      }
    };

    loadStorage();
  }, []);


  const handleUserClick = async (user) => {
    if (!user?.userId) return;
    try {
      setLoadingUserStorage(true);
      const response = await adminStorageAPI.getStorageUser(user.userId);
      if (response.success) {
        setSelectedUserStorage(response.data);
      }
    } catch (err) {
      console.error('Error loading user storage detail:', err);
    } finally {
      setLoadingUserStorage(false);
    }
  };

  if (loading) {
    return (
      <MainCard>
        <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 360 }} spacing={2}>
          <CircularProgress />
          <Typography color="text.secondary">Loading storage usage…</Typography>
        </Stack>
      </MainCard>
    );
  }

  return (
    <Stack spacing={3}>
      <Stack spacing={0.5}>
        <Typography variant="h3">Storage</Typography>
        <Typography color="text.secondary">Track uploaded and generated file storage by organization and user.</Typography>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}

      <Grid container spacing={2.5}>
        <Grid item xs={12} sm={6} lg={3}>
          <MetricCard title="Active storage" value={formatBytes(summary?.activeBytes)} subtitle={`${summary?.activeFiles || 0} active files`} icon={CloudServerOutlined} color="success" />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <MetricCard title="Organizations" value={summary?.organizationCount || 0} subtitle={largestOrg ? `Largest: ${largestOrg.organizationName}` : 'No org storage yet'} icon={TeamOutlined} color="primary" />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <MetricCard title="Users" value={summary?.userCount || 0} subtitle="Users with tracked files" icon={UserOutlined} color="secondary" />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <MetricCard title="Deleted storage" value={formatBytes(summary?.deletedBytes)} subtitle="Soft-deleted tracked files" icon={DatabaseOutlined} color="warning" />
        </Grid>
      </Grid>

      <Grid container spacing={2.5}>
        <Grid item xs={12} lg={8}>
          <MainCard content={false}>
            <Box sx={{ px: 2.5, pt: 2 }}>
              <Tabs value={tab} onChange={(_, value) => setTab(value)}>
                <Tab value="organizations" label="By organization" />
                <Tab value="users" label="By user" />
              </Tabs>
            </Box>
            <Divider />
            {tab === 'organizations' ? (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Organization</TableCell>
                      <TableCell>Usage</TableCell>
                      <TableCell align="right">Files</TableCell>
                      <TableCell>Last upload</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {organizations.map((org) => (
                      <TableRow key={org.organizationId || 'unassigned'} hover>
                        <TableCell>
                          <Typography variant="subtitle2">{org.organizationName}</Typography>
                        </TableCell>
                        <TableCell><StorageProgress usedBytes={org.usedBytes} limitBytes={org.limitBytes} percentUsed={org.percentUsed} /></TableCell>
                        <TableCell align="right">{org.fileCount}</TableCell>
                        <TableCell>{formatDate(org.lastUploadAt)}</TableCell>
                      </TableRow>
                    ))}
                    {!organizations.length && (
                      <TableRow><TableCell colSpan={4}><Typography color="text.secondary">No tracked organization storage yet.</Typography></TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>User</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Storage used</TableCell>
                      <TableCell align="right">Files</TableCell>
                      <TableCell>Last upload</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.userId || 'unassigned'} hover onClick={() => handleUserClick(user)} sx={{ cursor: user.userId ? 'pointer' : 'default' }}>
                        <TableCell>
                          <Stack spacing={0.25}>
                            <Typography variant="subtitle2">{user.userName}</Typography>
                            {selectedUserStorage?.userId === user.userId && <Chip size="small" color="primary" label="Selected" sx={{ width: 'fit-content' }} />}
                          </Stack>
                        </TableCell>
                        <TableCell>{user.email || '—'}</TableCell>
                        <TableCell><Typography fontWeight={600}>{formatBytes(user.usedBytes)}</Typography></TableCell>
                        <TableCell align="right">{user.fileCount}</TableCell>
                        <TableCell>{formatDate(user.lastUploadAt)}</TableCell>
                      </TableRow>
                    ))}
                    {!users.length && (
                      <TableRow><TableCell colSpan={5}><Typography color="text.secondary">No tracked user storage yet.</Typography></TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </MainCard>

          {tab === 'users' && (selectedUserStorage || loadingUserStorage) && (
            <MainCard sx={{ mt: 2.5 }} title={loadingUserStorage ? 'Loading user storage…' : `${selectedUserStorage.userName} storage by org`}>
              {loadingUserStorage ? (
                <Stack direction="row" spacing={1.5} alignItems="center"><CircularProgress size={20} /><Typography>Loading organization breakdown…</Typography></Stack>
              ) : (
                <Stack spacing={1.5}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography color="text.secondary">{selectedUserStorage.email}</Typography>
                      <Typography variant="h5">{formatBytes(selectedUserStorage.usedBytes)} total</Typography>
                    </Box>
                    <Chip label={`${selectedUserStorage.fileCount} files`} />
                  </Stack>
                  <Divider />
                  {(selectedUserStorage.organizations || []).map((org) => (
                    <Stack key={org.organizationId || 'unassigned'} direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between" spacing={2}>
                      <Box>
                        <Typography variant="subtitle2">{org.organizationName}</Typography>
                        <Typography variant="caption" color="text.secondary">{org.fileCount} files • last upload {formatDate(org.lastUploadAt)}</Typography>
                      </Box>
                      <StorageProgress usedBytes={org.usedBytes} limitBytes={org.limitBytes} percentUsed={org.percentUsed} />
                    </Stack>
                  ))}
                  {!selectedUserStorage.organizations?.length && <Typography color="text.secondary">No organization-level storage for this user yet.</Typography>}
                </Stack>
              )}
            </MainCard>
          )}
        </Grid>

        <Grid item xs={12} lg={4}>
          <Stack spacing={2.5}>
            <MainCard title="By category">
              <Stack spacing={1.5}>
                {(summary?.categories || []).map((category) => (
                  <Stack key={category.category} direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <FileOutlined />
                      <Typography>{category.category}</Typography>
                    </Stack>
                    <Stack alignItems="flex-end">
                      <Typography variant="subtitle2">{formatBytes(category.usedBytes)}</Typography>
                      <Typography variant="caption" color="text.secondary">{category.fileCount} files</Typography>
                    </Stack>
                  </Stack>
                ))}
                {!summary?.categories?.length && <Typography color="text.secondary">No category data yet.</Typography>}
              </Stack>
            </MainCard>

            <MainCard title="Recent uploads">
              <Stack spacing={1.5}>
                {(summary?.recentObjects || []).map((item) => (
                  <Box key={item.id}>
                    <Stack direction="row" justifyContent="space-between" spacing={2}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle2" noWrap>{item.fileName || item.entityType || 'Tracked file'}</Typography>
                        <Typography variant="caption" color="text.secondary">{item.organizationName || 'Unassigned'} • {item.uploadedByUserName || item.uploadedByEmail || 'Unknown user'}</Typography>
                      </Box>
                      <Chip size="small" label={formatBytes(item.sizeBytes)} />
                    </Stack>
                  </Box>
                ))}
                {!summary?.recentObjects?.length && <Typography color="text.secondary">No recent tracked uploads.</Typography>}
              </Stack>
            </MainCard>
          </Stack>
        </Grid>
      </Grid>
    </Stack>
  );
}
