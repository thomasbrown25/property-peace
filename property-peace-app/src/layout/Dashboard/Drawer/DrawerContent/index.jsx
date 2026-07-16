// project imports
import Navigation from './Navigation';
import SidebarBottomSection from './SidebarBottomSection';
import SimpleBar from 'components/third-party/SimpleBar';
import { Box } from '@mui/material';

// ==============================|| DRAWER CONTENT ||============================== //

export default function DrawerContent() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <SimpleBar sx={{ flex: 1, minHeight: 0, '& .simplebar-content': { display: 'flex', flexDirection: 'column', height: '100%' }, '& .simplebar-wrapper': { height: '100%' }, '& .simplebar-scrollbar': { height: '100%' } }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            <Navigation />
          </Box>
        </Box>
      </SimpleBar>
      <Box sx={{ flexShrink: 0 }}>
        <SidebarBottomSection />
      </Box>
    </Box>
  );
}
