import * as z from "zod";
import { conn } from "./duckdb";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";

// ============================================
// Zod Schema for Plan Type Results
// ============================================

export const PlanTypeSummary = z.object({
  _id: z.string(),
  utilityName: z.string(),
  rateName: z.string(),
  effectiveDate: z
    .number()
    .nullable()
    .transform((arg) => (arg ? dayjs(arg).format("L") : "")),
  endDate: z.string().nullable(),
});

export type PlanTypeSummary = z.infer<typeof PlanTypeSummary>;

export const PlanTypeSummaryArray = z.array(PlanTypeSummary);

// Extended schema with classification flags (useful for debugging/verification)
export const PlanTypeClassification = PlanTypeSummary.extend({
  hasEnergyTiers: z.boolean(),
  energyTierCount: z.number(),
  hasEnergySchedule: z.boolean(),
  hasCoincidentDemand: z.boolean(),
  hasDemand: z.boolean(),
  hasFlatDemand: z.boolean(),
});

export type PlanTypeClassification = z.infer<typeof PlanTypeClassification>;

// ============================================
// Base CTE for active plans (reusable)
// ============================================

const activeFilterCTE = (paramIndex: number) => `
  active_plans AS (
    SELECT *
    FROM flattened.usurdb
    WHERE
      (enddate IS NULL OR enddate >= $${paramIndex}) AND
      (effectiveDate IS NULL OR effectiveDate <= $${paramIndex})
  )
`;

const baseSelect = `
  _id,
  utilityName,
  rateName,
  effectiveDate as effectiveDate,
  enddate as endDate
`;

// ============================================
// 1. Flat Rate Plans
// Single energy tier, no time-varying schedules, no demand
// ============================================

export const FLAT_RATE_QUERY = `
WITH ${activeFilterCTE(1)}
SELECT ${baseSelect}
FROM active_plans
WHERE
  -- Has energy tiers
  energyRate_tiers IS NOT NULL
  AND len(energyRate_tiers) = 1
  AND len(energyRate_tiers[1]) = 1
  -- No time-of-use schedules (or uniform schedule)
  AND (
    energyWeekdaySched IS NULL
    OR list_distinct(flatten(energyWeekdaySched)) = [0]
  )
  AND (
    energyWeekendSched IS NULL
    OR list_distinct(flatten(energyWeekendSched)) = [0]
  )
  -- No demand charges
  AND coincidentRate_tiers IS NULL
  AND demandRate_tiers IS NULL
  AND flatDemand_tiers IS NULL
ORDER BY utilityName, rateName
`;

// ============================================
// 2. Tiered Rate Plans (No TOU)
// Multiple energy tiers, but no time-varying schedules
// ============================================

export const TIERED_RATE_QUERY = `
WITH ${activeFilterCTE(1)}
SELECT ${baseSelect}
FROM active_plans
WHERE
  -- Has multiple energy tiers
  energyRate_tiers IS NOT NULL
  AND (
    len(energyRate_tiers) > 1
    OR (len(energyRate_tiers) = 1 AND len(energyRate_tiers[1]) > 1)
  )
  -- No time-of-use variation (single period)
  AND (
    energyWeekdaySched IS NULL
    OR list_distinct(flatten(energyWeekdaySched)) = [0]
  )
  AND (
    energyWeekendSched IS NULL
    OR list_distinct(flatten(energyWeekendSched)) = [0]
  )
  -- No demand charges
  AND coincidentRate_tiers IS NULL
  AND demandRate_tiers IS NULL
  AND flatDemand_tiers IS NULL
ORDER BY utilityName, rateName
`;

// ============================================
// 3. Time of Use Plans
// Has time-varying energy schedules
// ============================================

export const TOU_RATE_QUERY = `
WITH ${activeFilterCTE(1)}
SELECT ${baseSelect}
FROM active_plans
WHERE
  -- Has time-varying energy schedule (more than one period)
  (
    (energyWeekdaySched IS NOT NULL AND len(list_distinct(flatten(energyWeekdaySched))) > 1)
    OR
    (energyWeekendSched IS NOT NULL AND len(list_distinct(flatten(energyWeekendSched))) > 1)
  )
  -- No demand charges (pure TOU)
  AND coincidentRate_tiers IS NULL
  AND demandRate_tiers IS NULL
  AND flatDemand_tiers IS NULL
ORDER BY utilityName, rateName
`;

// ============================================
// 4. Coincident Demand Plans
// Has coincident demand schedule and rates
// ============================================

export const COINCIDENT_DEMAND_QUERY = `
WITH ${activeFilterCTE(1)}
SELECT ${baseSelect}
FROM active_plans
WHERE
  -- Has coincident demand
  coincidentSched IS NOT NULL
  AND coincidentRate_tiers IS NOT NULL
  -- No other demand types (pure coincident)
  AND demandRate_tiers IS NULL
  AND flatDemand_tiers IS NULL
ORDER BY utilityName, rateName
`;

// ============================================
// 5. Demand Plans (Time-varying or standard)
// Has demand rate tiers or demand schedules
// ============================================

export const DEMAND_RATE_QUERY = `
WITH ${activeFilterCTE(1)}
SELECT ${baseSelect}
FROM active_plans
WHERE
  -- Has demand charges
  demandRate_tiers IS NOT NULL
  -- No coincident or flat demand (pure demand)
  AND coincidentRate_tiers IS NULL
  AND flatDemand_tiers IS NULL
ORDER BY utilityName, rateName
LIMIT 50
`;

// ============================================
// 6. Flat Demand Plans
// Has flat demand tiers
// ============================================

export const FLAT_DEMAND_QUERY = `
WITH ${activeFilterCTE(1)}
SELECT ${baseSelect}
FROM active_plans
WHERE
  -- Has flat demand
  flatDemand_tiers IS NOT NULL
  -- No other demand types (pure flat demand)
  AND coincidentRate_tiers IS NULL
  AND demandRate_tiers IS NULL
ORDER BY utilityName, rateName
LIMIT 50
`;

// ============================================
// 7. Complex Plans (Multiple mechanisms)
// Has 2+ of: TOU, coincident, demand, flat demand
// ============================================

export const COMPLEX_RATE_QUERY = `
WITH ${activeFilterCTE(1)},
classified AS (
  SELECT
    *,
    CASE WHEN (
      (energyWeekdaySched IS NOT NULL AND len(list_distinct(flatten(energyWeekdaySched))) > 1)
      OR (energyWeekendSched IS NOT NULL AND len(list_distinct(flatten(energyWeekendSched))) > 1)
    ) THEN 1 ELSE 0 END as has_tou,
    CASE WHEN coincidentRate_tiers IS NOT NULL THEN 1 ELSE 0 END as has_coincident,
    CASE WHEN demandRate_tiers IS NOT NULL THEN 1 ELSE 0 END as has_demand,
    CASE WHEN flatDemand_tiers IS NOT NULL THEN 1 ELSE 0 END as has_flat_demand
  FROM active_plans
)
SELECT ${baseSelect}
FROM classified
WHERE (has_tou + has_coincident + has_demand + has_flat_demand) >= 2
ORDER BY utilityName, rateName
LIMIT 50
`;

// ============================================
// Query Executor Functions
// ============================================

export type PlanType =
  | "flat"
  | "tiered"
  | "tou"
  | "coincident"
  | "demand"
  | "flatDemand"
  | "complex";

const QUERY_MAP: Record<PlanType, string> = {
  flat: FLAT_RATE_QUERY,
  tiered: TIERED_RATE_QUERY,
  tou: TOU_RATE_QUERY,
  coincident: COINCIDENT_DEMAND_QUERY,
  demand: DEMAND_RATE_QUERY,
  flatDemand: FLAT_DEMAND_QUERY,
  complex: COMPLEX_RATE_QUERY,
};

export async function getPlansByType(
  planType: PlanType,
  date: Dayjs,
): Promise<PlanTypeSummary[]> {
  const query = QUERY_MAP[planType];
  const formattedDate = date.format("YYYY-MM-DD");

  try {
    const c = await conn;
    const stmt = await c.prepare(query);
    const result = await stmt.query(formattedDate);
    const rows = result.toArray();

    return PlanTypeSummaryArray.parse(rows);
  } catch (error) {
    console.error(`Error querying ${planType} plans:`, error);
    return [];
  }
}

// Get counts for all plan types (for summary display)
export async function getPlanTypeCounts(
  date: Dayjs,
): Promise<Record<PlanType, number>> {
  const formattedDate = date.format("YYYY-MM-DD");

  const countQuery = `
  WITH active_plans AS (
    SELECT *
    FROM flattened.usurdb
    WHERE
      (enddate IS NULL OR enddate >= $1) AND
      (effectiveDate IS NULL OR effectiveDate <= $1)
  ),
  classified AS (
    SELECT
      _id,
      -- Energy tier info
      energyRate_tiers IS NOT NULL as has_energy,
      CASE
        WHEN energyRate_tiers IS NULL THEN 0
        WHEN len(energyRate_tiers) = 1 AND len(energyRate_tiers[1]) = 1 THEN 1
        ELSE len(energyRate_tiers)
      END as tier_count,
      -- TOU check
      CASE WHEN (
        (energyWeekdaySched IS NOT NULL AND len(list_distinct(flatten(energyWeekdaySched))) > 1)
        OR (energyWeekendSched IS NOT NULL AND len(list_distinct(flatten(energyWeekendSched))) > 1)
      ) THEN true ELSE false END as has_tou,
      -- Demand types
      coincidentRate_tiers IS NOT NULL as has_coincident,
      demandRate_tiers IS NOT NULL as has_demand,
      flatDemand_tiers IS NOT NULL as has_flat_demand
    FROM active_plans
  )
  SELECT
    COUNT(*) FILTER (WHERE tier_count = 1 AND NOT has_tou AND NOT has_coincident AND NOT has_demand AND NOT has_flat_demand) as flat,
    COUNT(*) FILTER (WHERE tier_count > 1 AND NOT has_tou AND NOT has_coincident AND NOT has_demand AND NOT has_flat_demand) as tiered,
    COUNT(*) FILTER (WHERE has_tou AND NOT has_coincident AND NOT has_demand AND NOT has_flat_demand) as tou,
    COUNT(*) FILTER (WHERE has_coincident AND NOT has_demand AND NOT has_flat_demand) as coincident,
    COUNT(*) FILTER (WHERE has_demand AND NOT has_coincident AND NOT has_flat_demand) as demand,
    COUNT(*) FILTER (WHERE has_flat_demand AND NOT has_coincident AND NOT has_demand) as flat_demand,
    COUNT(*) FILTER (WHERE (has_tou::INT + has_coincident::INT + has_demand::INT + has_flat_demand::INT) >= 2) as complex
  FROM classified
  `;

  try {
    const c = await conn;
    const stmt = await c.prepare(countQuery);
    const result = await stmt.query(formattedDate);
    const row = result.toArray()[0];

    return {
      flat: Number(row.flat),
      tiered: Number(row.tiered),
      tou: Number(row.tou),
      coincident: Number(row.coincident),
      demand: Number(row.demand),
      flatDemand: Number(row.flat_demand),
      complex: Number(row.complex),
    };
  } catch (error) {
    console.error("Error getting plan type counts:", error);
    return {
      flat: 0,
      tiered: 0,
      tou: 0,
      coincident: 0,
      demand: 0,
      flatDemand: 0,
      complex: 0,
    };
  }
}
