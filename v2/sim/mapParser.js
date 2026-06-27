/**
 * Parse an ASCII map into a validated, ordered path.
 *
 * Legend: S=start, E=end, #=path, .=open/buildable.
 *
 * Validation is strict by design — it is the structural guard against V1's
 * open-tile pathfinding bug class. A parsed map guarantees: exactly one S and
 * one E; the path is a single contiguous orthogonal chain (S and E have exactly
 * one path-neighbour, every interior path cell has exactly two); no branches, no
 * loops. The returned `path` is the ordered list of grid cells from S to E, so
 * enemies can move by exact segment-lerp and never leave the path.
 */
export function parseMap(map) {
  const grid = map.grid;
  const rows = grid.length;
  const cols = grid[0].length;

  for (let y = 0; y < rows; y++) {
    if (grid[y].length !== cols) {
      throw new Error(`Map "${map.name}" row ${y} has width ${grid[y].length}, expected ${cols}`);
    }
  }

  const isPath = (x, y) => {
    if (x < 0 || y < 0 || x >= cols || y >= rows) return false;
    const c = grid[y][x];
    return c === '#' || c === 'S' || c === 'E';
  };

  let start = null, end = null;
  const buildable = []; // [y][x] -> boolean
  for (let y = 0; y < rows; y++) {
    buildable[y] = [];
    for (let x = 0; x < cols; x++) {
      const c = grid[y][x];
      buildable[y][x] = c === '.';
      if (c === 'S') { if (start) throw new Error(`Map "${map.name}" has multiple S`); start = { x, y }; }
      else if (c === 'E') { if (end) throw new Error(`Map "${map.name}" has multiple E`); end = { x, y }; }
      else if (c !== '#' && c !== '.') { throw new Error(`Map "${map.name}" has illegal char '${c}' at ${x},${y}`); }
    }
  }
  if (!start) throw new Error(`Map "${map.name}" has no S`);
  if (!end) throw new Error(`Map "${map.name}" has no E`);

  const neighbours = (x, y) =>
    [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => isPath(x + dx, y + dy)).map(([dx, dy]) => ({ x: x + dx, y: y + dy }));

  // S and E must be degree-1; build the ordered path by walking.
  if (neighbours(start.x, start.y).length !== 1) throw new Error(`Map "${map.name}" start must have exactly one path neighbour`);
  if (neighbours(end.x, end.y).length !== 1) throw new Error(`Map "${map.name}" end must have exactly one path neighbour`);

  const path = [start];
  const seen = new Set([`${start.x},${start.y}`]);
  let cur = start;
  let prev = null;
  while (!(cur.x === end.x && cur.y === end.y)) {
    const opts = neighbours(cur.x, cur.y).filter(n => !(prev && n.x === prev.x && n.y === prev.y));
    if (opts.length !== 1) {
      throw new Error(`Map "${map.name}" path branches/dead-ends at ${cur.x},${cur.y} (found ${opts.length} ways forward)`);
    }
    prev = cur;
    cur = opts[0];
    const key = `${cur.x},${cur.y}`;
    if (seen.has(key)) throw new Error(`Map "${map.name}" path loops at ${cur.x},${cur.y}`);
    seen.add(key);
    path.push(cur);
  }

  // Every path cell must be on the walked chain (no detached path segments).
  let totalPathCells = 0;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (isPath(x, y)) totalPathCells++;
  if (totalPathCells !== path.length) {
    throw new Error(`Map "${map.name}" has ${totalPathCells - path.length} disconnected path cell(s)`);
  }

  return { name: map.name, cols, rows, start, end, path, buildable };
}

export default parseMap;
