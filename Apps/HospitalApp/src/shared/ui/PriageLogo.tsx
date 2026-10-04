// The Priage logo mark, drawn from the official favicon artwork without its
// white background so it sits on any surface. The viewBox is the square around
// the mark itself.
const LOGO_PATHS = [
  'M515.354 1003.36C532.233 986.482 555.125 977 578.994 977L1023.29 977C1032.2 977 1036.66 987.771 1030.36 994.071L802.078 1222.35C785.199 1239.23 762.307 1248.71 738.438 1248.71L270 1248.71L515.354 1003.36Z',
  'M704.715 1581.92C704.715 1558.05 714.197 1535.16 731.075 1518.28L1258.78 990.571C1265.08 984.271 1275.86 988.733 1275.86 997.642L1275.86 1320.48C1275.86 1344.35 1266.37 1367.24 1249.5 1384.12L704.715 1928.9L704.715 1581.92Z',
  'M933.715 642.5L1085.21 841.887C1121.65 905 1069.34 941.5 1031.71 992L743.715 977.5C786.715 977.5 836.215 946 821.215 911.5L571.715 573H976.715C933.715 573 897.715 606.5 933.715 642.5Z',
  'M1453.21 292H752.215C491.715 292 499.215 500.5 571.715 573L1453.21 573.75V292Z',
  'M1453.21 292C2121.71 292 2108.21 1256 1453.21 1256V977C1735.71 901 1658.71 573.75 1453.21 573.75V292Z',
  'M1453.71 977V1256C1364.71 1256 1352.71 1279.5 1256.21 1376V993C1266.21 983 1287.21 977 1304.21 977H1453.71Z',
];

export const PRIAGE_LOGO_BLUE = '#2986FF';

export function PriageLogo({ size = 30, color = PRIAGE_LOGO_BLUE, title }: { size?: number; color?: string; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="270 270 1680 1680"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
      className="shrink-0"
    >
      {LOGO_PATHS.map((d) => <path key={d} d={d} fill={color} />)}
    </svg>
  );
}
