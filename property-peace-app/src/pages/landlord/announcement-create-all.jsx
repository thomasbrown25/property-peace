import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

// material-ui
import { Box, Typography, Alert, Button, Stack, Chip, alpha, useTheme } from '@mui/material';
import { ArrowLeftOutlined, NotificationOutlined, TeamOutlined } from '@ant-design/icons';

// project imports
import OrganizationSelector from 'sections/announcements/OrganizationSelector';
import AllPropertiesAnnouncementWizard from 'sections/announcements/AllPropertiesAnnouncementWizard';
import AnnouncementSendingStep from 'sections/announcements/AnnouncementSendingStep';
import AnnouncementCompleteStep from 'sections/announcements/AnnouncementCompleteStep';
import { announcementAPI } from 'api';
import { openSnackbar } from 'api/snackbar';
import MainCard from 'components/MainCard';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import { organizationAPI } from 'api';

// ==============================|| ANNOUNCEMENT CREATE ALL PROPERTIES ||============================== //

export default function AnnouncementCreateAllPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');

  // State management
  const [selectedOrganizations, setSelectedOrganizations] = useState(new Set());
  const [wizardData, setWizardData] = useState(null);
  const [sending, setSending] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const [organizationsLoaded, setOrganizationsLoaded] = useState(false);
  const [initialData, setInitialData] = useState(null);
  const [loading, setLoading] = useState(!!editId);

  // Load announcement data if editing
  useEffect(() => {
    const loadAnnouncementForEdit = async () => {
      if (!editId) {
        setLoading(false);
        return;
      }

      try {
        const result = await announcementAPI.getAnnouncementById(editId);
        if (result.success && result.data) {
          const announcement = result.data;
          // Parse the announcement data into wizard format
          const orgIds = announcement.organizationIds 
            ? (typeof announcement.organizationIds === 'string' 
                ? JSON.parse(announcement.organizationIds) 
                : announcement.organizationIds)
            : [];
          
          // Strip signature from message if present (format: "\n\nBest regards,\n{name}")
          let messageText = announcement.message || '';
          if (messageText) {
            // Remove signature pattern: "\n\nBest regards,\n{name}" or similar
            const signaturePattern = /\n\nBest regards,.*$/i;
            messageText = messageText.replace(signaturePattern, '').trim();
          }
          
          setInitialData({
            deliveryMethods: {
              inApp: announcement.sendAsNotification ?? true,
              email: announcement.sendAsEmail ?? false
            },
            message: messageText,
            scheduleType: announcement.scheduledAt ? 'scheduled' : 'now',
            scheduledDateTime: announcement.scheduledAt 
              ? new Date(announcement.scheduledAt).toISOString().slice(0, 16)
              : null
          });
          
          // Set selected organizations
          if (orgIds.length > 0) {
            setSelectedOrganizations(new Set(orgIds));
          }
        }
      } catch (error) {
        console.error('Error loading announcement for edit:', error);
        openSnackbar({
          open: true,
          message: 'Failed to load announcement for editing',
          variant: 'alert',
          alert: { color: 'error' },
          autoHideDuration: 5000
        });
        navigate('/landlord/announcements');
      } finally {
        setLoading(false);
        setOrganizationsLoaded(true);
      }
    };

    loadAnnouncementForEdit();
  }, [editId, navigate]);

  // Auto-select all organizations when they're loaded (only if not editing)
  useEffect(() => {
    if (editId || loading) return; // Skip if editing or still loading
    
    const loadAndSelectAllOrganizations = async () => {
      try {
        const response = await organizationAPI.getUserOrganizations();
        if (response.success && response.data) {
          // Filter to only show organizations where user has Owner or Manager role
          const orgsWithAccess = response.data.filter(org => {
            const role = org.userRole || org.role;
            return role === 'Owner' || role === 'Manager';
          });
          
          if (orgsWithAccess.length > 0 && selectedOrganizations.size === 0) {
            // Auto-select all organizations
            const allOrgIds = orgsWithAccess.map(org => org.id);
            setSelectedOrganizations(new Set(allOrgIds));
          }
          setOrganizationsLoaded(true);
        }
      } catch (error) {
        console.error('Error loading organizations:', error);
        setOrganizationsLoaded(true);
      }
    };

    loadAndSelectAllOrganizations();
  }, [editId, loading]); // Run when editId or loading changes

  const handleWizardComplete = (data) => {
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
    setWizardData(data);
    // Go directly to sending (review step is the confirmation)
    handleConfirmSend(data);
  };

  const handleConfirmSend = async (data = null) => {
    const announcementData = data || wizardData;
    
    setSending(true);
    setCompleted(false);

    try {
      // Prepare scheduled time if applicable
      let scheduledAt = null;
      if (announcementData.scheduleType === 'scheduled' && announcementData.scheduledDateTime) {
        scheduledAt = new Date(announcementData.scheduledDateTime).toISOString();
      }

      const payload = {
        organizationIds: Array.from(selectedOrganizations),
        propertyIds: null, // null means all properties
        unitIds: null, // null means all units
        message: announcementData.message.trim(),
        sendEmail: announcementData.deliveryMethods.email,
        sendNotification: announcementData.deliveryMethods.inApp,
        scheduledAt: scheduledAt // Add scheduled time (backend may not support yet, but we'll send it)
      };

      // If editing, include the announcement ID
      if (editId) {
        payload.id = editId;
      }

      // Send to all properties in selected organizations
      const result = await announcementAPI.sendAnnouncement(payload);

      if (result.success) {
        const sentCount = result.data?.sentCount || 0;
        const failedCount = result.data?.failedCount || 0;
        
        setSendResult({
          sentCount,
          failedCount,
          message: result.message
        });
        setCompleted(true);
      } else {
        openSnackbar({
          open: true,
          message: result.message || 'Failed to send announcement',
          variant: 'alert',
          alert: { color: 'error' },
          autoHideDuration: 5000
        });
        setSending(false);
      }
    } catch (error) {
      openSnackbar({
        open: true,
        message: error.message || 'Failed to send announcement',
        variant: 'alert',
        alert: { color: 'error' },
        autoHideDuration: 5000
      });
      setSending(false);
    }
  };

  // Show sending step
  if (sending && !completed) {
    const isScheduled = wizardData?.scheduleType === 'scheduled';
    return (
      <Box sx={{ py: 4 }}>
        <PageBreadcrumbs
          items={[
            { label: 'Dashboard', path: '/landlord/dashboard' },
            { label: 'Announcements', path: '/landlord/announcements' },
            { label: editId ? 'Updating' : 'Sending' }
          ]}
        />
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '420px' }}>
          <Box sx={{ width: '100%', maxWidth: { xs: '100%', sm: 520 } }}>
            <MainCard>
              <AnnouncementSendingStep isScheduled={isScheduled} />
            </MainCard>
          </Box>
        </Box>
      </Box>
    );
  }

  // Show completion step
  if (completed && sendResult) {
    const isScheduled = wizardData?.scheduleType === 'scheduled';
    return (
      <Box sx={{ py: 4 }}>
        <PageBreadcrumbs
          items={[
            { label: 'Dashboard', path: '/landlord/dashboard' },
            { label: 'Announcements', path: '/landlord/announcements' },
            { label: editId ? 'Updated' : 'Complete' }
          ]}
        />
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '420px' }}>
          <Box sx={{ width: '100%', maxWidth: { xs: '100%', sm: 520 } }}>
            <MainCard>
              <AnnouncementCompleteStep
                sentCount={sendResult.sentCount}
                failedCount={sendResult.failedCount}
                onBack={() => navigate('/landlord/announcements')}
                isScheduled={isScheduled}
              />
            </MainCard>
          </Box>
        </Box>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography variant="body1">Loading announcement...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ overflow: 'visible' }}>
      <PageBreadcrumbs
        items={[
          { label: 'Dashboard', path: '/landlord/dashboard' },
          { label: 'Announcements', path: '/landlord/announcements' },
          { label: editId ? 'Edit all properties' : 'All properties' }
        ]}
      />

      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mb: 2.5 }}>
        <Box>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <Chip size="small" label="All properties" color="primary" variant="outlined" sx={{ fontWeight: 700 }} />
            <Chip size="small" icon={<TeamOutlined />} label={`${selectedOrganizations.size || 0} organization${selectedOrganizations.size === 1 ? '' : 's'}`} sx={{ fontWeight: 600 }} />
          </Stack>
          <Typography variant="h4" fontWeight={700} sx={{ lineHeight: 1.2 }}>
            {editId ? 'Edit announcement' : 'Announcement for all properties'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, maxWidth: 760 }}>
            {editId
              ? 'Update the audience, delivery method, message, and schedule before sending again.'
              : 'Use this for portfolio-wide updates. We auto-select eligible organizations, and you can refine that audience before composing the message.'}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<ArrowLeftOutlined />}
          onClick={() => navigate('/landlord/announcements/selection')}
          sx={{ textTransform: 'none', borderRadius: 1.5 }}
        >
          Change audience
        </Button>
      </Box>

      <Alert
        severity="info"
        icon={<NotificationOutlined />}
        sx={{
          mb: 2.5,
          borderRadius: 2,
          border: `1px solid ${alpha(theme.palette.info.main, 0.18)}`,
          bgcolor: alpha(theme.palette.info.main, 0.06)
        }}
      >
        Announcements only go to tenants with portal accounts. Tenants without accounts will not receive the announcement.
      </Alert>

      <Box
        sx={{
          mb: 2.5,
          p: 2.25,
          bgcolor: 'background.paper',
          border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
          borderRadius: 2
        }}
      >
        <OrganizationSelector
          selectedOrganizations={selectedOrganizations}
          onSelectionChange={(orgIds) => setSelectedOrganizations(new Set(orgIds))}
        />
      </Box>

      <AllPropertiesAnnouncementWizard
        onComplete={handleWizardComplete}
        onCancel={() => navigate('/landlord/announcements')}
        initialData={initialData}
      />
    </Box>
  );
}
