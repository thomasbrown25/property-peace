import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';

// material-ui
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  InputAdornment,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import {
  ClockCircleOutlined,
  FileTextOutlined,
  MailOutlined,
  NotificationOutlined,
  SearchOutlined,
  SendOutlined,
  TeamOutlined
} from '@ant-design/icons';
import { format } from 'date-fns';

// project imports
import { previewAnnouncementRecipients } from 'api/announcement';

// ==============================|| REVIEW STEP ||============================== //

export default function ReviewStep({
  deliveryMethods,
  message,
  scheduleType,
  scheduledDateTime,
  selectedOrganizations,
  selectedProperties,
  selectedUnits,
  onRecipientsReady
}) {
  const [recipients, setRecipients] = useState([]);
  const [recipientSearch, setRecipientSearch] = useState('');
  const [recipientsLoading, setRecipientsLoading] = useState(true);
  const [recipientsError, setRecipientsError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadRecipients = async () => {
      setRecipientsLoading(true);
      setRecipientsError('');

      const result = await previewAnnouncementRecipients({
        organizationIds: selectedOrganizations?.size > 0 ? Array.from(selectedOrganizations) : null,
        propertyIds: selectedProperties?.size > 0 ? Array.from(selectedProperties) : null,
        unitIds: selectedUnits?.size > 0 ? Array.from(selectedUnits) : null
      });

      if (cancelled) return;

      if (result.success) {
        setRecipients(Array.isArray(result.data) ? result.data : []);
      } else {
        setRecipients([]);
        setRecipientsError(result.message || 'Unable to load recipients.');
      }
      setRecipientsLoading(false);
    };

    loadRecipients();

    return () => {
      cancelled = true;
    };
  }, [selectedOrganizations, selectedProperties, selectedUnits]);

  useEffect(() => {
    onRecipientsReady?.(!recipientsLoading && !recipientsError && recipients.length > 0);
  }, [onRecipientsReady, recipients.length, recipientsError, recipientsLoading]);

  const filteredRecipients = useMemo(() => {
    const query = recipientSearch.trim().toLowerCase();
    if (!query) return recipients;

    return recipients.filter((recipient) =>
      `${recipient.name || ''} ${recipient.email || ''}`.toLowerCase().includes(query)
    );
  }, [recipientSearch, recipients]);

  const formatScheduledTime = (dateTimeString) => {
    if (!dateTimeString) return '';
    try {
      return format(new Date(dateTimeString), 'MMM dd, yyyy h:mm a');
    } catch {
      return dateTimeString;
    }
  };

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Review & Confirm
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Please review your announcement details before sending.
      </Typography>

      <Stack spacing={2}>
        <Card variant="outlined">
          <CardContent>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              <NotificationOutlined style={{ fontSize: 20 }} />
              <Typography variant="subtitle1" fontWeight={600}>
                Delivery Methods
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip
                label="In-App Notification"
                color={deliveryMethods.inApp ? 'primary' : 'default'}
                size="small"
                icon={<NotificationOutlined />}
                sx={
                  deliveryMethods.inApp
                    ? {}
                    : { opacity: 0.5, bgcolor: 'grey.100', color: 'text.disabled' }
                }
              />
              <Chip
                label="Email"
                color={deliveryMethods.email ? 'primary' : 'default'}
                size="small"
                icon={<MailOutlined />}
                sx={
                  deliveryMethods.email
                    ? {}
                    : { opacity: 0.5, bgcolor: 'grey.100', color: 'text.disabled' }
                }
              />
            </Stack>
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              <FileTextOutlined style={{ fontSize: 20 }} />
              <Typography variant="subtitle1" fontWeight={600}>
                Message
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {message || 'No message entered'}
            </Typography>
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              {scheduleType === 'now' ? (
                <SendOutlined style={{ fontSize: 20 }} />
              ) : (
                <ClockCircleOutlined style={{ fontSize: 20 }} />
              )}
              <Typography variant="subtitle1" fontWeight={600}>
                Schedule
              </Typography>
            </Stack>
            <Typography variant="body2">
              {scheduleType === 'now' ? (
                <Chip label="Send Immediately" color="primary" size="small" icon={<SendOutlined />} />
              ) : (
                <>
                  <Chip label="Scheduled" color="info" size="small" icon={<ClockCircleOutlined />} sx={{ mr: 1 }} />
                  {scheduledDateTime && formatScheduledTime(scheduledDateTime)}
                </>
              )}
            </Typography>
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.5}
              alignItems={{ xs: 'stretch', sm: 'center' }}
              justifyContent="space-between"
              sx={{ mb: 2 }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <TeamOutlined style={{ fontSize: 20 }} />
                <Typography variant="subtitle1" fontWeight={600}>
                  Receiving this message
                </Typography>
                {!recipientsLoading && !recipientsError && (
                  <Chip label={`${recipients.length} recipient${recipients.length === 1 ? '' : 's'}`} size="small" />
                )}
              </Stack>
              <TextField
                value={recipientSearch}
                onChange={(event) => setRecipientSearch(event.target.value)}
                placeholder="Search name or email"
                size="small"
                disabled={recipientsLoading || recipients.length === 0}
                sx={{ width: { xs: '100%', sm: 280 } }}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchOutlined />
                      </InputAdornment>
                    )
                  }
                }}
              />
            </Stack>

            {recipientsLoading ? (
              <Stack direction="row" spacing={1.25} alignItems="center" justifyContent="center" sx={{ py: 4 }}>
                <CircularProgress size={22} />
                <Typography variant="body2" color="text.secondary">
                  Loading recipients...
                </Typography>
              </Stack>
            ) : recipientsError ? (
              <Alert severity="error">{recipientsError}</Alert>
            ) : recipients.length === 0 ? (
              <Alert severity="info">No tenants with portal accounts match this announcement audience.</Alert>
            ) : (
              <TableContainer
                sx={{
                  maxHeight: 280,
                  overflow: 'auto',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1.5
                }}
              >
                <Table stickyHeader size="small" aria-label="Announcement recipients">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredRecipients.length > 0 ? (
                      filteredRecipients.map((recipient) => (
                        <TableRow key={recipient.userId} hover>
                          <TableCell>{recipient.name || 'Tenant'}</TableCell>
                          <TableCell>{recipient.email || 'No email address'}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={2} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                          No recipients match “{recipientSearch.trim()}”.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}

ReviewStep.propTypes = {
  deliveryMethods: PropTypes.shape({
    inApp: PropTypes.bool.isRequired,
    email: PropTypes.bool.isRequired
  }).isRequired,
  message: PropTypes.string.isRequired,
  scheduleType: PropTypes.oneOf(['now', 'scheduled']).isRequired,
  scheduledDateTime: PropTypes.string,
  selectedOrganizations: PropTypes.instanceOf(Set),
  selectedProperties: PropTypes.instanceOf(Set),
  selectedUnits: PropTypes.instanceOf(Set),
  onRecipientsReady: PropTypes.func
};
