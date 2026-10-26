/** Balance numbers `npm run tune` climbs toward the win-rate bands in sim/report.ts. It rewrites this file. */
export const TUNING = {
  /** Every alien's health, as a multiple of its kind's. */
  alienHp: 0.9,
  /** The alien force a battle has in each leg, before its risk and kind are counted. */
  legForce: [1, 4, 9, 15],
  /** Damage each hit on a marked unit adds. */
  markDamage: 1,
  /** Damage Accelerant Gel adds to hits on a burning target. */
  accelerantDamage: 1,
  /** Damage Shatterglass Edge adds to hits on a chilled target. */
  shatterDamage: 2,
  /** Damage Thermal Shock Core adds to hits on a target both burning and chilled. */
  thermalDamage: 3,
  /** Damage drop pods deal to each alien near a soldier landing in a breach. */
  impactDamage: 2,
  /** Supplies an overrun zone pays. */
  dangerSupplies: 4,
}
