import logoDark from 'assets/images/logos/logo-dark.png';

// ==============================|| LOGO ICON SVG ||============================== //

export default function LogoIcon({ width = 35 }) {
  return <img src={logoDark} alt="Property Peace" width={width} style={{ maxWidth: '100%', height: 'auto' }} />;
}
