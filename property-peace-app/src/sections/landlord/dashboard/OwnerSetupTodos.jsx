import { useState } from 'react';
import CloseOutlined from '@ant-design/icons/CloseOutlined';
import { Box, Button, IconButton, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import AppIcon from 'components/AppIcon';
import { useOrganization } from 'contexts/OrganizationContext';
import useAuth from 'hooks/useAuth';
import useRentPaymentAccess from 'hooks/useRentPaymentAccess';
import { makeRentPaymentAccessScopeKey } from 'utils/rentPaymentAccess';
import { dashboardRowHoverColor } from './dashboardEntrance.mjs';
import { ONLINE_PAYMENT_TODO_ID, canSetUpOnlinePayments, dismissOwnerSetupTodo, getOwnerSetupTodos, isOwnerSetupTodoDismissed } from './ownerSetupTodoModel';

export default function OwnerSetupTodos({ paymentAccountStatus }) {
  const { user } = useAuth();
  const { currentOrganization, loading } = useOrganization();
  const scope = makeRentPaymentAccessScopeKey({
    userId: user?.id ?? user?.Id,
    organizationId: currentOrganization?.id ?? currentOrganization?.Id
  });
  if (!scope || loading || user?.isDemo === true || user?.IsDemo === true) return null;

  return <OwnerSetupTodoList key={scope} scope={scope} paymentAccountStatus={paymentAccountStatus} />;
}

function OwnerSetupTodoList({ scope, paymentAccountStatus }) {
  const [dismissedIds, setDismissedIds] = useState([]);
  const isDismissed = (id) => dismissedIds.includes(id) || isOwnerSetupTodoDismissed(scope, id);
  const paymentAccess = useRentPaymentAccess({
    enabled: canSetUpOnlinePayments(paymentAccountStatus) && !isDismissed(ONLINE_PAYMENT_TODO_ID)
  });
  const todos = getOwnerSetupTodos(paymentAccountStatus, paymentAccess).filter(({ id }) => !isDismissed(id));

  const dismiss = (id) => {
    dismissOwnerSetupTodo(scope, id);
    setDismissedIds((ids) => [...ids, id]);
  };

  if (!todos.length) return null;

  return (
    <Stack component="section" aria-label="Setup to-dos" spacing={1.5}>
      {todos.map((todo) => (
        <Box
          key={todo.id}
          sx={{
            position: 'relative',
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr)',
            gridTemplateRows: '1fr auto 1fr',
            justifyItems: 'center',
            rowGap: 1,
            minHeight: 148,
            p: 2,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            bgcolor: dashboardRowHoverColor
          }}
        >
          <Typography
            component="h2"
            variant="subtitle1"
            sx={{ alignSelf: 'start', mx: 4, textAlign: 'center', fontWeight: 700, overflowWrap: 'anywhere' }}
          >
            {todo.title}
          </Typography>
          <IconButton
            aria-label={`Dismiss ${todo.title}`}
            onClick={() => dismiss(todo.id)}
            size="small"
            sx={{ position: 'absolute', top: 10, right: 10, width: 34, height: 34 }}
          >
            <CloseOutlined />
          </IconButton>
          <Button
            component={RouterLink}
            to={todo.href}
            variant="contained"
            size="small"
            endIcon={<AppIcon name="arrowRight" />}
            sx={{ textTransform: 'none' }}
          >
            {todo.actionLabel}
          </Button>
        </Box>
      ))}
    </Stack>
  );
}
