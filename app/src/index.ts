import { chart } from './detail-view'
import { get_query } from './data/duckdb'
import { RatePlan, RatePlanSelect } from './data/schema'
import * as queries from './data/queries'

const result = await get_query(queries.selectList)
const table = result.toArray()

let rows: RatePlanSelect
try {
  rows = RatePlanSelect.parse(table, { reportInput: true })
} catch (e) {
  console.error(e)
  throw e
}

const select = document.createElement('select')
const adjustedIncludedCheckbox = document.createElement('input')
adjustedIncludedCheckbox.type = 'checkbox'

for (const row of rows) {
  select.add(
    new Option([row.utility, row.name, row.label].join('/'), row.label)
  )
}

const myDiv = document.createElement('div')
myDiv.id = 'myDiv'
const raw = document.createElement('pre')
document.body.appendChild(adjustedIncludedCheckbox)
document.body.appendChild(select)
document.body.appendChild(myDiv)
document.body.appendChild(raw)

class UiState {
  selected?: RatePlan
  adjustedIncluded = true

  async setSelected(value: string) {
    let raw = null
    try {
      raw = (await get_query(queries.ratePlanDetail(value))).toArray()
      state.selected = RatePlan.parse(raw[0])
    } catch (e) {
      console.debug('Failed to parse', raw)
      console.error(e)
    }
  }
}

const RATE_QUERY_PARAM = 'rate-plan'

let rateQueryId = null
{
  const maybeId = new URLSearchParams(window.location.search).get(
    RATE_QUERY_PARAM
  )
  if (maybeId) {
    select.value = maybeId
    rateQueryId = maybeId
  } else {
    rateQueryId = rows[0].label
  }
}

console.log(rateQueryId)

const state = new UiState()
await state.setSelected(rateQueryId)
function render() {
  console.log(state)
  if (!state.selected) {
    console.log(state)
    return
  }

  chart(state.selected, { includeAdjusted: state.adjustedIncluded })
  raw.innerHTML = JSON.stringify(
    state.selected,
    (key, value) => {
      if (typeof value === 'bigint') {
        return value.toString() // Convert BigInt to string
      }
      return value // Return other values unchanged
    },
    2
  )
}

function selectEvent({ target }: Event) {
  if (target instanceof HTMLSelectElement && target?.value) {
    const { value } = target
    state.setSelected(value).then(() => {
      const params = new URLSearchParams(window.location.search)
      params.set(RATE_QUERY_PARAM, value)
      const newUrl = window.location.pathname + '?' + params.toString()
      history.pushState(null, '', newUrl)
      render()
    })
  }
}

adjustedIncludedCheckbox.addEventListener('change', ({ target }) => {
  if (target instanceof HTMLInputElement) {
    state.adjustedIncluded = target.checked
  }

  render()
})

select.addEventListener('change', selectEvent)

render()
