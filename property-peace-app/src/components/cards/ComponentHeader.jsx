import PropTypes from 'prop-types';
// material-ui
import { Typography } from '@mui/material';
import { Grid } from '@mui/material';
import { Link } from '@mui/material';
import { Stack } from '@mui/material';
import { Box } from '@mui/material';

// assets
import GlobalOutlined from '@ant-design/icons/GlobalOutlined';
import NodeExpandOutlined from '@ant-design/icons/NodeExpandOutlined';

export default function ComponentHeader({ title, caption, directory, link }) {
  return (
    <Box sx={{ pl: 3, pr: 1 }}>
      <Stack sx={{ gap: 1.25 }}>
        <Typography variant="h2">{title}</Typography>
        {caption && (
          <Typography variant="h6" color="text.secondary">
            {caption}
          </Typography>
        )}
      </Stack>
      <Grid container spacing={0.75} sx={{ mt: 2.5 }}>
        {directory && (
          <Grid size={12}>
            <Typography variant="caption" color="text.secondary">
              <NodeExpandOutlined style={{ marginRight: 10 }} />
              {directory}
            </Typography>
          </Grid>
        )}
        {link && (
          <Grid size={12}>
            <Link variant="caption" color="primary" href={link} target="_blank">
              <GlobalOutlined style={{ marginRight: 10 }} />
              {link}
            </Link>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}

ComponentHeader.propTypes = { title: PropTypes.string, caption: PropTypes.string, directory: PropTypes.string, link: PropTypes.string };
