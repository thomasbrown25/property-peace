import { useState, useEffect } from 'react';
import { Alert, AlertTitle, Typography, IconButton, Box } from '@mui/material';
import { CloseOutlined } from '@ant-design/icons';
import { useOrganization } from 'contexts/OrganizationContext';
import CreateOrganizationDialog from './CreateOrganizationDialog';
import OrganizationCreatingOverlay from './OrganizationCreatingOverlay';

export default function CreateOrganizationBanner() {
  const { currentOrganization, loading } = useOrganization();
  const [showBanner, setShowBanner] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    // Only show banner if no organization and not loading
    if (!loading && !currentOrganization) {
      // Check if banner was dismissed in this session
      const dismissed = sessionStorage.getItem('createOrgBannerDismissed');
      if (!dismissed) {
        setShowBanner(true);
      } else {
        setShowBanner(false);
      }
    } else {
      setShowBanner(false);
    }
  }, [loading, currentOrganization]);

  const handleDismiss = (e) => {
    e.stopPropagation(); // Prevent triggering the banner click
    setShowBanner(false);
    sessionStorage.setItem('createOrgBannerDismissed', 'true');
  };

  const handleBannerClick = () => {
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    // If organization was created, the banner will hide automatically via useEffect
  };

  const handleCreatingStart = () => {
    setIsCreating(true);
  };

  // Reset creating state when organization is created
  useEffect(() => {
    if (currentOrganization && isCreating) {
      const timer = setTimeout(() => {
        setIsCreating(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [currentOrganization, isCreating]);

  if (!showBanner) {
    return (
      <>
        {isCreating && <OrganizationCreatingOverlay />}
        <CreateOrganizationDialog
          open={dialogOpen}
          onClose={handleDialogClose}
          onCreatingStart={handleCreatingStart}
        />
      </>
    );
  }

  return (
    <>
      {isCreating && <OrganizationCreatingOverlay />}
      <Alert
        severity="warning"
        onClick={handleBannerClick}
        sx={{
          mb: 3,
          position: 'relative',
          cursor: 'pointer',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            bgcolor: 'action.hover',
            transform: 'translateY(-1px)',
            boxShadow: 2
          },
          '& .MuiAlert-action': {
            alignItems: 'flex-start',
            paddingTop: 1
          }
        }}
        action={
          <IconButton
            size="small"
            onClick={handleDismiss}
            sx={{
              color: 'text.secondary',
              '&:hover': {
                bgcolor: 'action.hover',
                color: 'text.primary'
              }
            }}
          >
            <CloseOutlined />
          </IconButton>
        }
      >
        <AlertTitle sx={{ fontWeight: 600, mb: 0.5 }}>Get Started - Create Your Organization</AlertTitle>
        <Typography variant="body2">
          Click anywhere on this banner to create your organization and start managing properties.
        </Typography>
      </Alert>
      <CreateOrganizationDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        onCreatingStart={handleCreatingStart}
      />
    </>
  );
}

