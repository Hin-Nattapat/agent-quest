// Horizontal rest positions (right %) for up to 3 ambient pack mobs. The hit-effect layer reuses
// these so a slash lands on its mob — keep the two in sync by importing, never re-listing.
export const MOB_SLOT_RIGHT = ["14%", "23%", "32%"];

export const slotRight = (slot: number): string => {
  return MOB_SLOT_RIGHT[slot] ?? MOB_SLOT_RIGHT[MOB_SLOT_RIGHT.length - 1];
};
