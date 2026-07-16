import React from 'react';
import BackgroundLines from '../components/BackgroundLines';
import CursorSpotlight from '../components/CursorSpotlight';
import SideNav from './SideNav';

function Layout(props) {
  return (
    <div className="mi-wrapper">
      <BackgroundLines />
      <CursorSpotlight />
      <SideNav />
      {props.children}
    </div>
  );
}

export default Layout;
