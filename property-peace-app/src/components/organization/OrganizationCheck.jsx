import { useState, useEffect } from 'react';
import { useOrganization } from 'contexts/OrganizationContext';
import useAuth from 'hooks/useAuth';
import CreateOrganizationDialog from './CreateOrganizationDialog';
import OrganizationCreatingOverlay from './OrganizationCreatingOverlay';

export default function OrganizationCheck() {
  const { currentOrganization, organizations, loading } = useOrganization();
  const { isLoggedIn } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    // Only check on dashboard pages and if user is logged in
    const isDashboardPage = window.location.pathname.includes('/dashboard');
    
    if (!isLoggedIn || !isDashboardPage || loading || hasChecked) {
      return;
    }

    // Check if user has no organizations - check immediately when organizations finish loading
    if (!loading) {
      if (!currentOrganization && (!organizations || organizations.length === 0)) {
        // Check if dialog was already shown in this session
        const dialogShown = sessionStorage.getItem('createOrgDialogShown');
        if (!dialogShown) {
          setDialogOpen(true);
          sessionStorage.setItem('createOrgDialogShown', 'true');
        }
      }
      setHasChecked(true);
    }
  }, [isLoggedIn, currentOrganization, organizations, loading, hasChecked]);

  const handleClose = () => {
    setDialogOpen(false);
  };

  const handleCreatingStart = () => {
    setIsCreating(true);
  };

  // Reset creating state when organization is created
  useEffect(() => {
    if (currentOrganization && isCreating) {
      // Organization was created, overlay will be removed on page reload
      // But we can also reset it here in case reload doesn't happen
      const timer = setTimeout(() => {
        setIsCreating(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [currentOrganization, isCreating]);

  // Reset check when user logs out
  useEffect(() => {
    if (!isLoggedIn) {
      setHasChecked(false);
      setIsCreating(false);
      sessionStorage.removeItem('createOrgDialogShown');
    }
  }, [isLoggedIn]);

  return (
    <>
      {isCreating && <OrganizationCreatingOverlay />}
      <CreateOrganizationDialog
        open={dialogOpen}
        onClose={handleClose}
        onCreatingStart={handleCreatingStart}
      />
    </>
  );
}

