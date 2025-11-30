import dayjs from "dayjs";
import * as z from "zod";
import type { SomeType } from "zod/v4/core";

/**
 * https://github.com/colinhacks/zod/discussions/2790#discussioncomment-7096060
 */
function unionOfLiterals<T extends string | number>(constants: readonly T[]) {
  const literals = constants.map((x) =>
    z.literal(x),
  ) as unknown as readonly z.ZodLiteral<T>[];
  return z.union(literals);
}

const fixedChargeUnits = unionOfLiterals([
  "$/month",
  "$/day",
  "$/year",
] as const).nullish();
const optionalSchedule = z.preprocess(
  (arg) => {
    if (arg == null) {
      return null;
    }
    return Array.from(arg as unknown as unknown[][]).map((x) => Array.from(x));
  },
  z.array(z.array(z.number())).nullable(),
);
const dates = z
  .union([z.date(), z.number(), z.string()])
  .nullish()
  .transform((arg) => {
    if (arg instanceof Date) {
      return dayjs(arg);
    } else if (typeof arg === "number" || typeof arg === "string") {
      return dayjs(arg);
    }
  });

export const statesArray = z.preprocess(
  (arg) => (arg == null ? arg : Array.from(arg as unknown[])),
  z.array(z.string()).optional(),
);

function tierShape<T extends SomeType>(shape: T) {
  return z.preprocess(
    (arg) =>
      arg == null
        ? arg
        : Array.from(arg as unknown[]).map((x) => Array.from(x as unknown[])),
    z.array(z.array(shape)).nullish(),
  );
}

export const RatePlan = z.object({
  _id: z.string(),
  states: statesArray,
  is_default: z.boolean().nullish(),
  eiaId: z.optional(z.bigint()),
  rateName: z.string(),
  utilityName: z.string(),
  effectiveDate: dates,
  endDate: dates,
  supercedes: z.string().nullish(),
  fixedChargeFirstMeter: z.number().nullish(),
  fixedChargeUnits: fixedChargeUnits,
  fixedChargeEaAddl: z.number().nullish(),
  fixedKeyVals: z.preprocess(
    (arg) => (arg == null ? arg : Array.from(arg as unknown[])),
    z.array(z.object({ key: z.string(), val: z.string() })).nullish(),
  ),

  minCharge: z.number().nullable(),
  minChargeUnits: fixedChargeUnits,
  coincidentSched: optionalSchedule,
  coincidentRateUnits: unionOfLiterals(["kW"]).nullish(),
  coincidentRate_tiers: tierShape(
    z.object({ rate: z.number().nullish(), adj: z.number().nullish() }),
  ).nullish(),
  demandComments: z.string().nullish(),
  demandHist: z.number().nullish(),
  demandKeyVals: z.preprocess(
    (arg) => (arg == null ? arg : Array.from(arg as unknown[])),
    z.array(z.object({ key: z.string(), val: z.string() })).nullish(),
  ),
  demandMax: z.number().nullish(),
  demandMin: z.number().nullish(),
  demandRatchetPercentage: z.preprocess(
    (arg) => (arg == null ? arg : Array.from(arg as unknown[])),
    z.array(z.number()).nullish(),
  ),
  demandRateUnits: unionOfLiterals(["kW", "kVA", "hp", "kVA daily"]).nullish(),
  demandReactPwrCharge: z.number().nullish(),
  demandUnits: unionOfLiterals(["kW", "kVA"]).nullish(),
  demandWeekdaySched: optionalSchedule,
  demandWeekendSched: optionalSchedule,
  demandWindow: z.number().nullish(),
  demandRate_tiers: tierShape(
    z.object({
      rate: z.number().nullish(),
      adj: z.number().nullish(),
      max: z.number().nullish(),
    }),
  ).nullish(),
  description: z.string().nullish(),
  energycomments: z.string().nullish(),
  /** Hours of the day by months  */
  energyWeekdaySched: optionalSchedule,
  /** Hours of the day by months  */
  energyWeekendSched: optionalSchedule,
  energyRate_tiers: tierShape(
    z.object({
      adj: z.number().nullish(),
      rate: z.optional(z.number()),
      max: z.number().nullish(),
      unit: unionOfLiterals(["kWh", "kWh daily", "kWh/kW"] as const).nullish(),
    }),
  ).optional(),
  flatDemand_tiers: tierShape(
    z.object({
      rate: z.number().nullish(),
      adj: z.number().nullish(),
      max: z.number().nullish(),
    }),
  ).nullish(),
  flatDemandUnits: unionOfLiterals(["kVA", "kW", "kVA daily", "hp"]).nullish(),
  flatDemandMonths: z.preprocess(
    (arg) => (arg == null ? arg : Array.from(arg as unknown[])),
    z.array(z.number()).nullish(),
  ),
  revisions: z.preprocess(
    (arg) => (arg == null ? arg : Array.from(arg as unknown[])),
    z.array(
      z.object({
        date: z.string().transform((arg) => dayjs(arg)),
        userid: z.string().optional(),
      }),
    ),
  ),
  sourceParent: z.string().nullish(),
  sourceReference: z.string().nullish(),
});

export const RatePlanArray = z.array(RatePlan);

export const RatePlanSelect = z.array(
  z.object({
    value: z.string(),
    label: z.string(),
  }),
);

export type RatePlanSelect = z.infer<typeof RatePlanSelect>;
export type RatePlan = z.infer<typeof RatePlan>;

export const SynthData = z.object({
  hour: z.number(),
  usage_kw: z.number(),
  season: unionOfLiterals(["winter", "summer"]),
  region: unionOfLiterals(["New England", "Texas", "Southern California"]),
});

export type SynthData = z.infer<typeof SynthData>;
export const SynthDataArray = z.array(SynthData);

// Zod schemas for data structures
export const RetailPriceDataSchema = z.object({
  hour: z.number(),
  baseRate: z.number().optional(),
  value: z.number().nullish(),
  tier: z.number(),
  period: z.number(),
  adj: z.number().optional(),
});

export const WholesalePriceDataSchema = z.object({
  hour: z.number(),
  value: z.number(),
  line: z.string(),
});

export type RetailPriceData = z.infer<typeof RetailPriceDataSchema>;
export type WholesalePriceData = z.infer<typeof WholesalePriceDataSchema>;

// Wholesale price info from query
export const WholesalePrice = z.object({
  "Price hub": z.string(),
  "Trade date": z.number().transform((arg) => dayjs(arg)),
  "High price $/MWh": z.number(),
  "Low price $/MWh": z.number(),
  "Wtd avg price $/MWh": z.number(),
});

export type WholesalePrice = z.infer<typeof WholesalePrice>;
