// project imports
import other from './other';
import pages from './pages';
import tenantPages from './tenant-pages';
import adminPages from './admin-pages';

// ==============================|| MENU ITEMS ||============================== //

const menuItems = {
  items: [pages] // Default to landlord menu (filtered by role in Navigation component)
};

export default menuItems;
export { tenantPages, adminPages };
