import Svg, { Path } from 'react-native-svg';
import { iconsaxIcons, type IconsaxIconName, type IconsaxIconVariant } from '@property-peace/shared/iconsax-icons';

type AppIconProps = {
  name: IconsaxIconName;
  variant: IconsaxIconVariant;
  size: number;
  color: string;
};

export default function AppIcon({ name, variant, size, color }: AppIconProps) {
  const icon = iconsaxIcons[name];
  const { viewBox, paths } = icon[variant] ?? icon.linear;

  return (
    <Svg accessible={false} pointerEvents="none" width={size} height={size} viewBox={viewBox} color={color} fill="none">
      {paths.map((path) => <Path key={path.d} {...path} />)}
    </Svg>
  );
}
