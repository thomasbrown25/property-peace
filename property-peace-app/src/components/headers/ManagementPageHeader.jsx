import PropTypes from 'prop-types';
import { Box, Stack, Typography } from '@mui/material';

import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import {
  managementPageHeaderContainerSx,
  managementPageHeaderDescriptionSx,
  managementPageHeaderTitleSx
} from './managementPageHeaderStyles';

export default function ManagementPageHeader({ title, description, actions, breadcrumbLabel = title, marginBottom = 2.5 }) {
  return (
    <Box sx={{ ...managementPageHeaderContainerSx, mb: marginBottom }}>
      <PageBreadcrumbs items={[{ label: 'Dashboard', path: '/landlord/dashboard' }, { label: breadcrumbLabel }]} />

      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} justifyContent="space-between" spacing={2}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="h3" sx={managementPageHeaderTitleSx}>
            {title}
          </Typography>
          {description && (
            <Typography variant="body1" sx={managementPageHeaderDescriptionSx}>
              {description}
            </Typography>
          )}
        </Box>

        {actions && <Box sx={{ flexShrink: 0, alignSelf: { xs: 'stretch', sm: 'center' } }}>{actions}</Box>}
      </Stack>
    </Box>
  );
}

ManagementPageHeader.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.node,
  actions: PropTypes.node,
  breadcrumbLabel: PropTypes.string,
  marginBottom: PropTypes.number
};
