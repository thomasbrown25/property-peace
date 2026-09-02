import logoDark from 'assets/images/logos/logo-dark.png';
import logoLight from 'assets/images/logos/favicon-transparent.png';

// ==============================|| LOGO ICON SVG ||============================== //

export default function LogoIcon({ width = 35, darkSurface = false }) {
  return <img src={darkSurface ? logoLight : logoDark} alt="Property Peace" width={width} style={{ maxWidth: '100%', height: 'auto' }} />;
}
