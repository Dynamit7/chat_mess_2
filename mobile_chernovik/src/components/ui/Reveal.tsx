import { ReactNode } from 'react';
import { View, ViewStyle } from 'react-native';

/**
 * Entrance animations were removed by design — the interface is meant to feel
 * still and composed, not busy. This stays as a transparent pass-through so all
 * existing callers keep working without change.
 */
export function Reveal({
  children,
  style,
}: {
  children: ReactNode;
  delay?: number;
  from?: number;
  duration?: number;
  style?: ViewStyle | ViewStyle[];
}) {
  return <View style={style}>{children}</View>;
}
