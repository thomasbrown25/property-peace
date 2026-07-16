import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

// material-ui
import {
  Container,
  Box,
  Typography,
  Button,
  Stack,
  Alert,
  Divider,
  CircularProgress,
  Card,
  CardContent,
  Grid
} from '@mui/material';
import { SaveOutlined, ArrowLeftOutlined, ArrowRightOutlined } from '@ant-design/icons';

// project imports
import OrganizationSelector from 'sections/announcements/OrganizationSelector';
import RecipientSelector from 'sections/announcements/RecipientSelector';
import DeliveryMethodStep from 'sections/announcements/DeliveryMethodStep';
import MessageStep from 'sections/announcements/MessageStep';
import ScheduleStep from 'sections/announcements/ScheduleStep';
import ReviewStep from 'sections/announcements/ReviewStep';
import { announcementAPI, organizationAPI } from 'api';
import { openSnackbar } from 'api/snackbar';
import MainCard from 'components/MainCard';
import Chip from '@mui/material/Chip';

// ==============================|| ANNOUNCEMENT EDIT PAGE ||============================== //

export default function AnnouncementEditPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');

  // State management
  const [loading, setLoading] = useState(!!editId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [organizationNames, setOrganizationNames] = useState({}); // Map of orgId -> orgName
  const [showReview, setShowReview] = useState(false);

  // Form state
  const [selectedOrganizations, setSelectedOrganizations] = useState(new Set());
  const [selectedProperties, setSelectedProperties] = useState(new Set());
  const [selectedUnits, setSelectedUnits] = useState(new Set());
  const [deliveryMethods, setDeliveryMethods] = useState({
    inApp: true,
    email: false
  });
  const [message, setMessage] = useState('');
  const [scheduleType, setScheduleType] = useState('now');
  const [scheduledDateTime, setScheduledDateTime] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  });

  // Load announcement data if editing
  useEffect(() => {
    const loadAnnouncementForEdit = async () => {
      if (!editId) {
        setLoading(false);
        setError('No announcement ID provided');
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const result = await announcementAPI.getAnnouncementById(editId);
        
        if (result.success && result.data) {
          const announcement = result.data;
          
          // Parse the announcement data into form format
          const parseIds = (ids) => {
            if (!ids) return [];
            let parsed = [];
            if (Array.isArray(ids)) {
              parsed = ids;
            } else if (typeof ids === 'string') {
              try {
                parsed = JSON.parse(ids);
              } catch {
                return [];
              }
            } else {
              return [];
            }
            // Convert all IDs to numbers to ensure proper comparison
            return parsed.map(id => Number(id)).filter(id => !isNaN(id));
          };
          
          // Strip signature from message if present
          let messageText = announcement.message || announcement.Message || '';
          if (messageText) {
            const signaturePattern = /\n\nBest regards,.*$/i;
            messageText = messageText.replace(signaturePattern, '').trim();
          }
          
          // Set form state - ensure IDs are numbers
          const orgIds = parseIds(announcement.organizationIds || announcement.OrganizationIds);
          const propIds = parseIds(announcement.propertyIds || announcement.PropertyIds);
          const unitIds = parseIds(announcement.unitIds || announcement.UnitIds);
          
          console.log('[Edit Announcement] Loading data:', {
            rawOrgIds: announcement.organizationIds || announcement.OrganizationIds,
            parsedOrgIds: orgIds,
            rawPropIds: announcement.propertyIds || announcement.PropertyIds,
            parsedPropIds: propIds,
            rawUnitIds: announcement.unitIds || announcement.UnitIds,
            parsedUnitIds: unitIds
          });
          
          setSelectedOrganizations(new Set(orgIds));
          setSelectedProperties(new Set(propIds));
          setSelectedUnits(new Set(unitIds));
          setDeliveryMethods({
            inApp: announcement.sendAsNotification ?? announcement.SendAsNotification ?? true,
            email: announcement.sendAsEmail ?? announcement.SendAsEmail ?? false
          });
          setMessage(messageText);
          
          // Handle schedule
          const scheduledAt = announcement.scheduledAt || announcement.ScheduledAt;
          if (scheduledAt) {
            setScheduleType('scheduled');
            const scheduledDate = new Date(scheduledAt);
            const year = scheduledDate.getFullYear();
            const month = String(scheduledDate.getMonth() + 1).padStart(2, '0');
            const day = String(scheduledDate.getDate()).padStart(2, '0');
            const hours = String(scheduledDate.getHours()).padStart(2, '0');
            const minutes = String(scheduledDate.getMinutes()).padStart(2, '0');
            setScheduledDateTime(`${year}-${month}-${day}T${hours}:${minutes}`);
          } else {
            setScheduleType('now');
          }
        } else {
          setError('Failed to load announcement');
          openSnackbar({
            open: true,
            message: result.message || 'Failed to load announcement',
            variant: 'alert',
            alert: { color: 'error' },
            autoHideDuration: 5000
          });
        }
      } catch (err) {
        console.error('Error loading announcement for edit:', err);
        setError(err.message || 'Failed to load announcement');
        openSnackbar({
          open: true,
          message: 'Failed to load announcement for editing',
          variant: 'alert',
          alert: { color: 'error' },
          autoHideDuration: 5000
        });
      } finally {
        setLoading(false);
      }
    };

    loadAnnouncementForEdit();
  }, [editId]);

  // Fetch organization names when selected organizations change
  useEffect(() => {
    const fetchOrganizationNames = async () => {
      if (selectedOrganizations.size === 0) {
        setOrganizationNames({});
        return;
      }

      try {
        const response = await organizationAPI.getUserOrganizations();
        if (response.success && response.data) {
          const namesMap = {};
          response.data.forEach(org => {
            if (selectedOrganizations.has(org.id)) {
              namesMap[org.id] = org.name;
            }
          });
          setOrganizationNames(namesMap);
        }
      } catch (error) {
        console.error('Error fetching organization names:', error);
      }
    };

    fetchOrganizationNames();
  }, [selectedOrganizations]);

  // Filter out properties/units that don't belong to selected organizations
  // Note: RecipientSelector already filters properties/units by selectedOrganizations when fetching
  // This ensures the UI only shows properties/units from selected orgs

  const handleNext = () => {
    // Validation
    if (selectedOrganizations.size === 0) {
      openSnackbar({
        open: true,
        message: 'Please select at least one organization',
        variant: 'alert',
        alert: { color: 'warning' },
        autoHideDuration: 3000
      });
      return;
    }

    if (selectedProperties.size === 0 && selectedUnits.size === 0) {
      openSnackbar({
        open: true,
        message: 'Please select at least one property or unit',
        variant: 'alert',
        alert: { color: 'warning' },
        autoHideDuration: 3000
      });
      return;
    }

    if (!deliveryMethods.inApp && !deliveryMethods.email) {
      openSnackbar({
        open: true,
        message: 'Please select at least one delivery method',
        variant: 'alert',
        alert: { color: 'warning' },
        autoHideDuration: 3000
      });
      return;
    }

    if (!message.trim()) {
      openSnackbar({
        open: true,
        message: 'Please enter a message',
        variant: 'alert',
        alert: { color: 'warning' },
        autoHideDuration: 3000
      });
      return;
    }

    if (scheduleType === 'scheduled') {
      if (!scheduledDateTime) {
        openSnackbar({
          open: true,
          message: 'Please select a scheduled date and time',
          variant: 'alert',
          alert: { color: 'warning' },
          autoHideDuration: 3000
        });
        return;
      }
      const selectedDate = new Date(scheduledDateTime);
      const now = new Date();
      if (selectedDate <= now) {
        openSnackbar({
          open: true,
          message: 'Scheduled time must be in the future',
          variant: 'alert',
          alert: { color: 'warning' },
          autoHideDuration: 3000
        });
        return;
      }
    }

    // Show review step
    setShowReview(true);
  };

  const handleSave = async () => {
    // Validation
    if (selectedOrganizations.size === 0) {
      openSnackbar({
        open: true,
        message: 'Please select at least one organization',
        variant: 'alert',
        alert: { color: 'warning' },
        autoHideDuration: 3000
      });
      return;
    }

    if (selectedProperties.size === 0 && selectedUnits.size === 0) {
      openSnackbar({
        open: true,
        message: 'Please select at least one property or unit',
        variant: 'alert',
        alert: { color: 'warning' },
        autoHideDuration: 3000
      });
      return;
    }

    if (!deliveryMethods.inApp && !deliveryMethods.email) {
      openSnackbar({
        open: true,
        message: 'Please select at least one delivery method',
        variant: 'alert',
        alert: { color: 'warning' },
        autoHideDuration: 3000
      });
      return;
    }

    if (!message.trim()) {
      openSnackbar({
        open: true,
        message: 'Please enter a message',
        variant: 'alert',
        alert: { color: 'warning' },
        autoHideDuration: 3000
      });
      return;
    }

    if (scheduleType === 'scheduled') {
      if (!scheduledDateTime) {
        openSnackbar({
          open: true,
          message: 'Please select a scheduled date and time',
          variant: 'alert',
          alert: { color: 'warning' },
          autoHideDuration: 3000
        });
        return;
      }
      const selectedDate = new Date(scheduledDateTime);
      const now = new Date();
      if (selectedDate <= now) {
        openSnackbar({
          open: true,
          message: 'Scheduled time must be in the future',
          variant: 'alert',
          alert: { color: 'warning' },
          autoHideDuration: 3000
        });
        return;
      }
    }

    setSaving(true);
    setError(null);

    try {
      // Prepare scheduled time if applicable
      let scheduledAt = null;
      if (scheduleType === 'scheduled' && scheduledDateTime) {
        scheduledAt = new Date(scheduledDateTime).toISOString();
      }

      const payload = {
        id: editId,
        organizationIds: selectedOrganizations.size > 0 
          ? Array.from(selectedOrganizations) 
          : null,
        propertyIds: selectedProperties.size > 0 
          ? Array.from(selectedProperties) 
          : null,
        unitIds: selectedUnits.size > 0 
          ? Array.from(selectedUnits) 
          : null,
        message: message.trim(),
        sendEmail: deliveryMethods.email,
        sendNotification: deliveryMethods.inApp,
        scheduledAt: scheduledAt
      };

      const result = await announcementAPI.sendAnnouncement(payload);

      if (result.success) {
        openSnackbar({
          open: true,
          message: 'Announcement updated successfully',
          variant: 'alert',
          alert: { color: 'success' },
          autoHideDuration: 3000
        });
        navigate('/landlord/announcements');
      } else {
        setError(result.message || 'Failed to update announcement');
        openSnackbar({
          open: true,
          message: result.message || 'Failed to update announcement',
          variant: 'alert',
          alert: { color: 'error' },
          autoHideDuration: 5000
        });
        setSaving(false);
      }
    } catch (err) {
      const errorMsg = err.message || 'Failed to update announcement';
      setError(errorMsg);
      openSnackbar({
        open: true,
        message: errorMsg,
        variant: 'alert',
        alert: { color: 'error' },
        autoHideDuration: 5000
      });
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ py: 4, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <Stack spacing={2} alignItems="center">
            <CircularProgress />
            <Typography variant="body1">Loading announcement...</Typography>
          </Stack>
        </Box>
      </Container>
    );
  }

  if (error && !editId) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ py: 4 }}>
          <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
          <Button startIcon={<ArrowLeftOutlined />} onClick={() => navigate('/landlord/announcements')}>
            Back to Announcements
          </Button>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
          <Button
            startIcon={<ArrowLeftOutlined />}
            onClick={() => navigate('/landlord/announcements')}
            sx={{ minWidth: 'auto' }}
          >
            Back
          </Button>
          <Typography variant="h4" sx={{ flex: 1 }}>
            Edit Announcement
          </Typography>
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Show Review Step */}
        {showReview ? (
          <MainCard>
            <ReviewStep
              deliveryMethods={deliveryMethods}
              message={message}
              scheduleType={scheduleType}
              scheduledDateTime={scheduledDateTime}
              selectedOrganizations={selectedOrganizations}
              selectedProperties={selectedProperties}
              selectedUnits={selectedUnits}
              organizationNames={organizationNames}
            />
            {/* Action Buttons */}
            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between', gap: 2 }}>
              <Button
                variant="outlined"
                startIcon={<ArrowLeftOutlined />}
                onClick={() => setShowReview(false)}
                disabled={saving}
              >
                Back
              </Button>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  variant="outlined"
                  onClick={() => navigate('/landlord/announcements')}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  startIcon={saving ? <CircularProgress size={20} /> : <SaveOutlined />}
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </Box>
            </Box>
          </MainCard>
        ) : (
          <>
            {/* Current Recipients Summary */}
        {(selectedOrganizations.size > 0 || selectedProperties.size > 0 || selectedUnits.size > 0) && (
          <MainCard title="Current Recipients" sx={{ mb: 3 }}>
            <Stack spacing={2}>
              {selectedOrganizations.size > 0 && (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Organizations ({selectedOrganizations.size})
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {Array.from(selectedOrganizations).map(orgId => (
                      <Chip
                        key={orgId}
                        label={organizationNames[orgId] || `Organization ${orgId}`}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    ))}
                  </Stack>
                </Box>
              )}
              {selectedProperties.size > 0 && (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Properties ({selectedProperties.size})
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedProperties.size} propert{selectedProperties.size === 1 ? 'y' : 'ies'} selected
                  </Typography>
                </Box>
              )}
              {selectedUnits.size > 0 && (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Units ({selectedUnits.size})
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedUnits.size} unit{selectedUnits.size === 1 ? '' : 's'} selected
                  </Typography>
                </Box>
              )}
              {selectedOrganizations.size === 0 && selectedProperties.size === 0 && selectedUnits.size === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No recipients selected
                </Typography>
              )}
            </Stack>
          </MainCard>
        )}

        <Grid container spacing={3}>
          {/* Left Column - Recipients */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <MainCard title="Recipients" sx={{ mb: 3 }}>
              <Stack spacing={3}>
                <OrganizationSelector
                  selectedOrganizations={selectedOrganizations}
                  onSelectionChange={(orgIds) => setSelectedOrganizations(new Set(orgIds))}
                />
                <RecipientSelector
                  selectedOrganizations={selectedOrganizations}
                  selectedProperties={selectedProperties}
                  selectedUnits={selectedUnits}
                  onPropertiesChange={(props) => setSelectedProperties(new Set(props))}
                  onUnitsChange={(units) => setSelectedUnits(new Set(units))}
                  showEmptyWhenNoOrgs={true}
                />
              </Stack>
            </MainCard>

            <MainCard title="Delivery Methods" sx={{ mb: 3 }}>
              <DeliveryMethodStep
                deliveryMethods={deliveryMethods}
                onDeliveryMethodsChange={setDeliveryMethods}
              />
            </MainCard>
          </Grid>

          {/* Right Column - Message & Schedule */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <MainCard title="Message" sx={{ mb: 3 }}>
              <MessageStep
                message={message}
                onMessageChange={setMessage}
              />
            </MainCard>

            <MainCard title="Schedule" sx={{ mb: 3 }}>
              <ScheduleStep
                scheduleType={scheduleType}
                scheduledDateTime={scheduledDateTime}
                onScheduleTypeChange={setScheduleType}
                onScheduledDateTimeChange={setScheduledDateTime}
              />
            </MainCard>
          </Grid>
        </Grid>

            {/* Action Buttons */}
            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <Button
                variant="outlined"
                onClick={() => navigate('/landlord/announcements')}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                endIcon={<ArrowRightOutlined />}
                onClick={handleNext}
                disabled={saving}
              >
                Next
              </Button>
            </Box>
          </>
        )}
      </Box>
    </Container>
  );
}
