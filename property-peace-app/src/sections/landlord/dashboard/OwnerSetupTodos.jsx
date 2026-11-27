import { useEffect, useRef, useState } from 'react';
import CloseOutlined from '@ant-design/icons/CloseOutlined';
import LeftOutlined from '@ant-design/icons/LeftOutlined';
import RightOutlined from '@ant-design/icons/RightOutlined';
import { alpha, Box, Button, IconButton, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useOrganization } from 'contexts/OrganizationContext';
import useAuth from 'hooks/useAuth';
import useRentPaymentAccess from 'hooks/useRentPaymentAccess';
import axiosServices from 'utils/axios';
import { openSnackbar } from 'api/snackbar';
import { makeRentPaymentAccessScopeKey } from 'utils/rentPaymentAccess';
import {
  ONLINE_PAYMENT_TODO_ID,
  canSetUpOnlinePayments,
  getOwnerSetupCompletion,
  getOwnerSetupTodos
} from './ownerSetupTodoModel';
import { loadOnlinePaymentSetupDismissal, saveOnlinePaymentSetupDismissal } from './onlinePaymentSetupDismissal';

export default function OwnerSetupTodos({ paymentAccountStatus, propertyCount, propertiesStatus }) {
  const { user } = useAuth();
  const { currentOrganization, loading } = useOrganization();
  const organizationId = currentOrganization?.id ?? currentOrganization?.Id;
  const scope = makeRentPaymentAccessScopeKey({
    userId: user?.id ?? user?.Id,
    organizationId
  });
  if (!scope || loading || user?.isDemo === true || user?.IsDemo === true) return null;

  return (
    <OwnerSetupTodoList
      key={scope}
      scope={scope}
      organizationId={organizationId}
      paymentAccountStatus={paymentAccountStatus}
      propertyCount={propertyCount}
      propertiesStatus={propertiesStatus}
    />
  );
}

function OwnerSetupTodoList({ scope, organizationId, paymentAccountStatus, propertyCount, propertiesStatus }) {
  const [activeId, setActiveId] = useState(null);
  const [paymentSetupDismissed, setPaymentSetupDismissed] = useState(null);
  const [isDismissingPayments, setIsDismissingPayments] = useState(false);
  const dismissControllerRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    let isCurrent = true;

    const loadPreference = async () => {
      try {
        const dismissed = await loadOnlinePaymentSetupDismissal({
          scope,
          organizationId,
          signal: controller.signal,
          get: axiosServices.get,
          put: axiosServices.put
        });
        if (!isCurrent) return;
        setPaymentSetupDismissed(dismissed);
      } catch (error) {
        if (controller.signal.aborted || !isCurrent) return;
        setPaymentSetupDismissed(null);
      }
    };

    loadPreference();
    return () => {
      isCurrent = false;
      controller.abort();
      dismissControllerRef.current?.abort();
    };
  }, [organizationId, scope]);

  const paymentAccess = useRentPaymentAccess({
    enabled: canSetUpOnlinePayments(paymentAccountStatus) && paymentSetupDismissed === false
  });
  const todos = getOwnerSetupTodos(paymentAccountStatus, paymentAccess, {
    propertyCount,
    propertiesStatus,
    paymentSetupDismissed: paymentSetupDismissed !== false
  });

  if (!todos.length) return null;

  const completion = getOwnerSetupCompletion({ remainingCount: todos.length, propertiesStatus, propertyCount, paymentAccountStatus });
  const index = Math.max(0, todos.findIndex(({ id }) => id === activeId));
  const todo = todos[index];
  const hasPaymentSetup = todos.some(({ id }) => id === ONLINE_PAYMENT_TODO_ID);
  const move = (direction) => setActiveId(todos[(index + direction + todos.length) % todos.length].id);
  const dismissPayments = async () => {
    if (isDismissingPayments) return;

    setIsDismissingPayments(true);
    const controller = new AbortController();
    dismissControllerRef.current = controller;
    try {
      await saveOnlinePaymentSetupDismissal({
        organizationId,
        signal: controller.signal,
        put: axiosServices.put
      });
      if (controller.signal.aborted) return;
      setPaymentSetupDismissed(true);
    } catch (error) {
      if (controller.signal.aborted) return;
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || 'We could not dismiss online payments setup. Please try again.',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      if (dismissControllerRef.current === controller) {
        dismissControllerRef.current = null;
        setIsDismissingPayments(false);
      }
    }
  };

  return (
    <Stack
      component="section"
      aria-label="Setup progress"
      sx={(theme) => ({
        mt: { xs: 3, md: 4 },
        p: 2.5,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 3,
        bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.16 : 0.10)
      })}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        flexWrap="wrap"
        sx={{ position: 'relative', minHeight: 44, pr: hasPaymentSetup ? 5.5 : 0 }}
      >
        <Typography component="p" variant="caption" fontWeight={700}
          sx={{ px: 1, py: 0.5, bgcolor: 'background.paper', borderRadius: 1, fontVariantNumeric: 'tabular-nums' }}>
          {completion}% complete
        </Typography>
        <Stack direction="row" alignItems="center">
          {todos.length > 1 && (
            <>
              <IconButton aria-label="Previous setup step" onClick={() => move(-1)} sx={{ width: 44, height: 44 }}>
                <LeftOutlined style={{ fontSize: 14 }} />
              </IconButton>
              <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                {index + 1} of {todos.length}
              </Typography>
              <IconButton aria-label="Next setup step" onClick={() => move(1)} sx={{ width: 44, height: 44 }}>
                <RightOutlined style={{ fontSize: 14 }} />
              </IconButton>
            </>
          )}
        </Stack>
        {todo.id === ONLINE_PAYMENT_TODO_ID && (
          <IconButton
            aria-label="Dismiss online payments setup"
            onClick={dismissPayments}
            disabled={isDismissingPayments}
            sx={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: 44,
              height: 44,
              '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 }
            }}
          >
            <CloseOutlined style={{ fontSize: 18 }} />
          </IconButton>
        )}
      </Stack>
      {/* Both steps size the shared row, including when their text wraps. */}
      <Box aria-live="polite" sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', mt: 1.5 }}>
        {todos.map((step) => {
          const isActive = step.id === todo.id;
          return (
            <Stack alignItems="center" spacing={1.5} useFlexGap key={step.id} inert={!isActive}
              sx={{ gridArea: '1 / 1', visibility: isActive ? 'visible' : 'hidden', textAlign: 'center' }}>
              <Box component="img" src={step.image} alt="" width={88} height={88} sx={{ display: 'block', objectFit: 'contain' }} />
              <Box>
                <Typography component="h2" variant="h5" fontWeight={700}>{step.title}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{step.description}</Typography>
              </Box>
              <Button component={RouterLink} to={step.href} variant="contained" sx={{ minHeight: 40, mt: 'auto', textTransform: 'none' }}>
                {step.actionLabel}
              </Button>
            </Stack>
          );
        })}
      </Box>
    </Stack>
  );
}
