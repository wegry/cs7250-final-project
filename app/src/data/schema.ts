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
const optionalSchedule = z
  .unknown()
  .nullish()
  .transform((arg) => {
    if (arg == null) {
      return null
    }
    return Array.from(arg as unknown as number[][]).map((x) => Array.from(x))
  })
const dates = z
  .union([z.date(), z.number()])
  .nullish()
  .transform((arg) => {
    if (arg instanceof Date) {
      return arg
    } else if (typeof arg === 'number') {
      return new Date(arg)
    }
  })

export const RatePlan = z.object({
  label: z.string(),
  eiaid: z.optional(z.bigint()),
  name: z.string(),
  utility: z.string(),
  startdate: dates,
  enddate: dates,
  latest_update: dates,
  supersedes: z.string().nullish(),
  flatdemandunit: z.string().nullish(),
  fixedchargefirstmeter: z.number().nullish(),
  fixedchargeunits: fixedChargeUnits,
  mincharge: z.number().nullable(),
  minchargeunits: fixedChargeUnits,
  demandweekendschedule: optionalSchedule,
  demandweekdayschedule: optionalSchedule,
  demandcomments: z.string().nullish(),
  energycomments: z.string().nullish(),
  /** Hours of the day by months  */
  energyweekdayschedule: optionalSchedule,
  /** Hours of the day by months  */
  energyweekendschedule: optionalSchedule,
  ratestructure: z.optional(z.string()).transform((arg) => {
    if (arg == null) {
      return arg
    }
    return z
      .partialRecord(
        unionOfLiterals([
          'energyrate',
          'demandrate',
          'flaterate',
          'flatdemand',
        ] as const),
        z.record(
          z.templateLiteral(['period', z.number()]),
          z.record(
            z.templateLiteral(['tier', z.number()]),
            z.object({
              adj: z.optional(z.number()),
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
      )
      .parse(JSON.parse(arg))
  }),
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
