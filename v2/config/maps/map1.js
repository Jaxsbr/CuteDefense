/**
 * Map 1 — "Ribbon" (human-editable).
 * Legend:  S = start   E = end   # = path   . = open/buildable tile
 * Grid is 22 columns x 12 rows. The path must be one contiguous orthogonal
 * chain from S to E (validated at load by mapParser).
 */
export default {
  name: 'Ribbon',
  grid: [
    '......................',
    'S####################.',
    '....................#.',
    '.####################.',
    '.#....................',
    '.####################.',
    '....................#.',
    '.####################.',
    '.#....................',
    '.####################E',
    '......................',
    '......................',
  ],
};
