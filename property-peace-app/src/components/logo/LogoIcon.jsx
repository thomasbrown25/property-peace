import faviconTransparent from 'assets/images/logos/favicon-transparent.png';

// ==============================|| LOGO ICON SVG ||============================== //

export default function LogoIcon({ width = 35 }) {
  return <img src={faviconTransparent} alt="Property Peace" width={width} style={{ maxWidth: '100%', height: 'auto' }} />;
}
