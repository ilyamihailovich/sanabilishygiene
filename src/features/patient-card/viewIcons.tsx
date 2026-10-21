import { IconViewFront, IconViewLeft, IconViewLower, IconViewOverview, IconViewRight, IconViewUpper } from '@/ui/icons';
import type { ViewKey } from '../brush-map/useMapKeyboard';

export const viewIconsPublic: Record<ViewKey, React.ReactNode> = {
  overview: <IconViewOverview size={22} />,
  upper: <IconViewUpper size={22} />,
  lower: <IconViewLower size={22} />,
  right: <IconViewRight size={22} />,
  front: <IconViewFront size={22} />,
  left: <IconViewLeft size={22} />,
};
