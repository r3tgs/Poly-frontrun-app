import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface IconProps {
  width?: number;
  height?: number;
  color?: string;
}

export function KalshiIcon({ width = 16, height = 16, color = '#868686' }: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 16 16" fill="none">
      <Path
        d="M2 1.33334H4.88107V7.31425L10.2674 1.33334H13.7609L8.81994 6.81583L14.081 14.6519H10.6293L6.78786 9.03099L4.88107 11.1492V14.6519H2V1.33334Z"
        fill={color}
      />
    </Svg>
  );
}
