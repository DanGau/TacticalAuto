// Balance numbers the tuner climbs; it rewrites this file.
/** Balance numbers `npm run tune` climbs toward the win-rate bands in sim/report.ts. It rewrites this file. */
export const TUNING = {
  /** Every alien's health, as a multiple of its kind's. */
  alienHp: 0.5,
  /** Damage every alien's attack adds. */
  alienDamage: 1,
  /** The alien force a battle has in each leg, before its risk and kind are counted. */
  legForce: [1, 6, 12, 16],
  /** Damage each hit on a marked unit adds. */
  markDamage: 1,
  /** Damage Accelerant Gel adds to hits on a burning target. */
  accelerantDamage: 1,
  /** Damage Shatterglass Edge adds to hits on a chilled target. */
  shatterDamage: 2,
  /** Damage Thermal Shock Core adds to hits on a target both burning and chilled. */
  thermalDamage: 3,
  /** Damage an entrance's impact deals each alien it hits. */
  impactDamage: 2,
  /** Supplies an overrun zone pays. */
  dangerSupplies: 4,
  /** The share of its own force the hunt adds to a battle at full threat. */
  hunt: 0.5,
}
