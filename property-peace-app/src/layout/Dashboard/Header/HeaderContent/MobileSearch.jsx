import { useState } from 'react';

import { Box, Dialog, DialogContent, DialogTitle, IconButton, Tooltip, Typography } from '@mui/material';
import { CloseOutlined, SearchOutlined } from '@ant-design/icons';

import Search from './Search';

// ==============================|| HEADER CONTENT - MOBILE SEARCH ||============================== //

export default function MobileSearch() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Tooltip title="Search">
        <IconButton
          aria-label="open global search"
          color="secondary"
          onClick={() => setOpen(true)}
          sx={(theme) => ({
            color: theme.palette.mode === 'dark' ? 'common.white' : 'text.primary',
            flexShrink: 0,
            '&:hover': { bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'action.hover' }
          })}
        >
          <SearchOutlined />
        </IconButton>
      </Tooltip>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm" fullScreen>
        <DialogTitle sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
            <Typography variant="h5" fontWeight={700}>Search Property Peace</Typography>
            <IconButton aria-label="close search" onClick={() => setOpen(false)}>
              <CloseOutlined />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 2 }}>
          <Search />
        </DialogContent>
      </Dialog>
    </>
  );
}
