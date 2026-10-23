import { IconViewFront, IconViewLeft, IconViewLower, IconViewOverview, IconViewRight, IconViewUpper } from '@/ui/icons';
import type { ViewKey } from '../brush-map/useMapKeyboard';

// пациент видит модель как в зеркале: правая сторона справа, поэтому иконки боковых ракурсов и их порядок отражены
export const VIEW_ORDER_PUBLIC: ViewKey[] = ['overview', 'upper', 'lower', 'left', 'front', 'right'];

export const viewIconsPublic: Record<ViewKey, React.ReactNode> = {
  overview: <IconViewOverview size={22} />,
  upper: <IconViewUpper size={22} />,
  lower: <IconViewLower size={22} />,
  right: <IconViewLeft size={22} />,
  front: <IconViewFront size={22} />,
  left: <IconViewRight size={22} />,
};
