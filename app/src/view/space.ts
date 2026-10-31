// The view's units: tile size on screen, camera angle, and height per level.
/**
 * The world's units. A tile is a unit square, x and z on the ground, y up; the camera looks down on it at the classic
 * 2:1 isometric angle, where at zoom 1 a tile spans TILE_W screen pixels across and TILE_H down.
 */
export const TILE_W = 56
export const TILE_H = 28
/** The camera's turn about the vertical, and its tilt down from level, when it holds still. */
export const YAW = Math.PI / 4
export const PITCH = Math.asin(TILE_H / TILE_W)
/** Screen pixels per world unit at zoom 1: across the screen, and for a height straight up. */
export const ACROSS = TILE_W / Math.SQRT2
const UPRIGHT = ACROSS * Math.cos(PITCH)
/** World units a height of `px` screen pixels stands, seen from the still camera. */
export const tall = (px: number) => px / UPRIGHT
/** World units a tile rises for each level of height. */
export const LEVEL = tall(16)
