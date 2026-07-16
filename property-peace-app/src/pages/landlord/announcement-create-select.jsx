import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

// material-ui
import { Box, Typography, Alert, Button, Stack, Chip, alpha, useTheme } from '@mui/material';
import { ArrowLeftOutlined, NotificationOutlined, SelectOutlined } from '@ant-design/icons';

// project imports
import SelectPropertiesAnnouncementWizard from 'sections/announcements/SelectPropertiesAnnouncementWizard';
import AnnouncementSendingStep from 'sections/announcements/AnnouncementSendingStep';
import AnnouncementCompleteStep from 'sections/announcements/AnnouncementCompleteStep';
import { announcementAPI } from 'api';
import { openSnackbar } from 'api/snackbar';
import MainCard from 'components/MainCard';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';

// ==============================|| ANNOUNCEMENT CREATE SELECT PROPERTIES & UNITS ||============================== //

export default function AnnouncementCreateSelectPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');

  // State management
  const [wizardData, setWizardData] = useState(null);
  const [sending, setSending] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [sendResult, setSendResult] = useState(null);
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
        // TODO: Implement API call to get announcement by ID
        // For now, we'll need to add this endpoint
        const result = await announcementAPI.getAnnouncementById(editId);
        if (result.success && result.data) {
          const announcement = result.data;
          // Parse the announcement data into wizard format
          const parseIds = (ids) => {
            if (!ids) return [];
            if (Array.isArray(ids)) return ids;
            if (typeof ids === 'string') {
              try {
                return JSON.parse(ids);
              } catch {
                return [];
              }
            }
            return [];
          };
          
          // Strip signature from message if present (format: "\n\nBest regards,\n{name}")
          let messageText = announcement.message || '';
          if (messageText) {
            // Remove signature pattern: "\n\nBest regards,\n{name}" or similar
            const signaturePattern = /\n\nBest regards,.*$/i;
            messageText = messageText.replace(signaturePattern, '').trim();
          }
          
          setInitialData({
            selectedOrganizations: new Set(parseIds(announcement.organizationIds)),
            selectedProperties: new Set(parseIds(announcement.propertyIds)),
            selectedUnits: new Set(parseIds(announcement.unitIds)),
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
      }
    };

    loadAnnouncementForEdit();
  }, [editId, navigate]);

  const handleWizardComplete = (data) => {
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
        organizationIds: announcementData.selectedOrganizations.size > 0 
          ? Array.from(announcementData.selectedOrganizations) 
          : null,
        propertyIds: announcementData.selectedProperties.size > 0 
          ? Array.from(announcementData.selectedProperties) 
          : null,
        unitIds: announcementData.selectedUnits.size > 0 
          ? Array.from(announcementData.selectedUnits) 
          : null,
        message: announcementData.message.trim(),
        sendEmail: announcementData.deliveryMethods.email,
        sendNotification: announcementData.deliveryMethods.inApp,
        scheduledAt: scheduledAt
      };

      // If editing, include the announcement ID
      if (editId) {
        payload.id = editId;
      }

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
          { label: editId ? 'Edit targeted' : 'Targeted audience' }
        ]}
      />

      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mb: 2.5 }}>
        <Box>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <Chip size="small" icon={<SelectOutlined />} label="Targeted audience" color="primary" variant="outlined" sx={{ fontWeight: 700 }} />
          </Stack>
          <Typography variant="h4" fontWeight={700} sx={{ lineHeight: 1.2 }}>
            {editId ? 'Edit targeted announcement' : 'Choose who should receive it'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, maxWidth: 760 }}>
            {editId
              ? 'Update the selected organizations, properties, units, delivery method, message, and schedule.'
              : 'Start with organizations, narrow to properties or units, then compose and confirm the announcement in one guided flow.'}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<ArrowLeftOutlined />}
          onClick={() => navigate('/landlord/announcements/selection')}
          sx={{ textTransform: 'none', borderRadius: 1.5 }}
        >
          Change audience type
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

      <SelectPropertiesAnnouncementWizard
        onComplete={handleWizardComplete}
        onCancel={() => navigate('/landlord/announcements')}
        initialData={initialData}
      />
    </Box>
  );
}
