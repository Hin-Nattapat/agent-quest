export enum Facing {
  South = "south",
  North = "north",
  East = "east",
  West = "west",
}

// Movement vector → cardinal facing. Ties (|dx| == |dy|) fall through to vertical, which reads
// more naturally for a top-down sprite than a flickering diagonal.
export const facingFromDelta = (dx: number, dy: number): Facing => {
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? Facing.East : Facing.West;
  }
  return dy > 0 ? Facing.South : Facing.North;
};
