import dayjs from 'dayjs'
import * as z from 'zod'

/**
 * https://github.com/colinhacks/zod/discussions/2790#discussioncomment-7096060
 */
function unionOfLiterals<T extends string | number>(constants: readonly T[]) {
  const literals = constants.map((x) => z.literal(x)) as unknown as readonly [
    z.ZodLiteral<T>,
    z.ZodLiteral<T>,
    ...z.ZodLiteral<T>[],
  ]
  return z.union(literals)
}

const fixedChargeUnits = unionOfLiterals([
  '$/month',
  '$/day',
] as const).nullish()
const optionalSchedule = z.preprocess(
  (arg) => {
    if (arg == null) {
      return null
    }
    return Array.from(arg as unknown as unknown[][]).map((x) => Array.from(x))
  },
  z.array(z.array(z.number())).nullable()
)
const dates = z
  .union([z.date(), z.number(), z.string()])
  .nullish()
  .transform((arg) => {
    if (arg instanceof Date) {
      return dayjs(arg)
    } else if (typeof arg === 'number' || typeof arg === 'string') {
      return dayjs(arg)
    }
  })

export const RatePlan = z.object({
  _id: z.string(),
  eiaid: z.optional(z.bigint()),
  rateName: z.string(),
  utilityName: z.string(),
  effectiveDate: dates,
  endDate: dates,
  latest_update: dates,
  supercedes: z.string().nullish(),
  flatdemandunit: z.string().nullish(),
  fixedchargefirstmeter: z.number().nullish(),
  fixedchargeunits: fixedChargeUnits,
  minCharge: z.number().nullable(),
  minChargeUnits: fixedChargeUnits,
  demandweekendschedule: optionalSchedule,
  demandweekdayschedule: optionalSchedule,
  demandcomments: z.string().nullish(),
  energycomments: z.string().nullish(),
  /** Hours of the day by months  */
  energyWeekdaySched: optionalSchedule,
  /** Hours of the day by months  */
  energyWeekendSched: optionalSchedule,
  energyRate_tiers: z.preprocess(
    (arg) =>
      arg == null
        ? arg
        : Array.from(arg as unknown[]).map((x) => Array.from(x as unknown[])),
    z
      .array(
        z.array(
          z.object({
            adj: z.number().nullish(),
            rate: z.optional(z.number()),
            max: z.number().nullish(),
            unit: unionOfLiterals([
              'kWh',
              'kWh daily',
              'kWh/kW',
            ] as const).nullish(),
          })
        )
      )
      .optional()
  ),
  revisions: z.preprocess(
    (arg) => (arg == null ? arg : Array.from(arg as unknown[])),
    z.array(
      z.object({
        date: z.string().transform((arg) => dayjs(arg)),
        userid: z.string().optional(),
      })
    )
  ),
})

export const RatePlanArray = z.array(RatePlan)

export const RatePlanSelect = z.array(
  z.object({
    value: z.string(),
    label: z.string(),
  })
)

export type RatePlanSelect = z.infer<typeof RatePlanSelect>
export type RatePlan = z.infer<typeof RatePlan>

export const SynthData = z.object({
  hour: z.number(),
  usage_kw: z.number(),
  season: unionOfLiterals(['winter', 'summer']),
  region: unionOfLiterals(['New England', 'Texas', 'Southern California']),
})

export type SynthData = z.infer<typeof SynthData>
export const SynthDataArray = z.array(SynthData)

// Zod schemas for data structures
export const RetailPriceDataSchema = z.object({
  hour: z.number(),
  value: z.number(),
  series: z.string(),
})

export const WholesalePriceDataSchema = z.object({
  hour: z.number(),
  value: z.number(),
  line: z.string(),
})

export type RetailPriceData = z.infer<typeof RetailPriceDataSchema>
export type WholesalePriceData = z.infer<typeof WholesalePriceDataSchema>

// Wholesale price info from query
export const WholesalePrice = z.object({
  'Price hub': z.string(),
  'Trade date': z.number().transform((arg) => dayjs(arg)),
  'High price $/MWh': z.number(),
  'Low price $/MWh': z.number(),
  'Wtd avg price $/MWh': z.number(),
})

export type WholesalePrice = z.infer<typeof WholesalePrice>
