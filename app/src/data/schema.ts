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
  supersedes: z.string().nullish(),
  flatdemandunit: z.string().nullish(),
  fixedchargefirstmeter: z.number().nullish(),
  fixedchargeunits: z.string().nullish(),
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
        ]),
        z.partialRecord(
          z.string(),
          z.partialRecord(
            z.string(),
            z.object({
              adj: z.optional(z.number()),
              rate: z.optional(z.number()),
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
    label: z.string(),
    name: z.string(),
    utility: z.string(),
  })
)

export type RatePlanSelect = z.infer<typeof RatePlanSelect>
export type RatePlan = z.infer<typeof RatePlan>

export const SynthData = z.array(
  z.object({
    hour: z.number(),
    usage_kw: z.number(),
    season: unionOfLiterals(['winter', 'summer']),
    region: unionOfLiterals(['New England', 'Texas', 'Southern California']),
  })
)

export type SynthData = z.infer<typeof SynthData>
