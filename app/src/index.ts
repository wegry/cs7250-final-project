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

class DetailView extends HTMLElement {
  constructor() {
    super()
    let template = document.getElementById('detail-view')
    if (!(template instanceof HTMLTemplateElement)) {
      throw new Error('Invalid template')
    }
    let templateContent = template.content

    const shadowRoot = this.attachShadow({ mode: 'open' })
    shadowRoot.appendChild(templateContent.cloneNode(true))
  }

  get adjustedIncluded() {
    return this.shadowRoot!.querySelector<HTMLInputElement>(
      '#include-adjusted-rate'
    )!
  }

  get ratePlanChooser() {
    return this.shadowRoot!.querySelector<HTMLSelectElement>(
      '#rate-plan-chooser'
    )!
  }

  get raw() {
    return this.shadowRoot!.querySelector('#raw-view')!
  }

  get chartEl() {
    return this.shadowRoot!.querySelector<HTMLElement>('#my-div')!
  }

  async replaceSlot(label?: string | null) {
    let old = this.shadowRoot!.querySelector<HTMLAnchorElement>(
      'slot[name="supersedes"]'
    )

    if (!old) {
      old = document.createElement('a')
      old.slot = 'supersedes'
      this.appendChild(old)
    }

    if (label) {
      const ratePlanInData = await get_query(queries.ratePlanInData(label))
      if (ratePlanInData.toArray()[0]) {
        old.innerHTML = `Supersedes <a href="?rate-plan=${label}">${label}</a>`
      } else {
        old.innerHTML = `Supersedes rate plan not in data set (${label})`
      }
    } else {
      old.innerHTML = 'Latest plan'
    }
  }
}

customElements.define('detail-view', DetailView)

const detailView = document.createElement('detail-view') as DetailView
document.body.appendChild(detailView)

{
  const select = detailView.ratePlanChooser
  for (const row of rows) {
    select!.add(
      new Option([row.utility, row.name, row.label].join('/'), row.label)
    )
  }
}

class UiState {
  selected?: RatePlan
  adjustedIncluded = true

  async setSelected(value: string) {
    let raw = null
    try {
      raw = (await get_query(queries.ratePlanDetail(value))).toArray()
      state.selected = RatePlan.parse(raw[0])
      detailView.replaceSlot(state.selected.supersedes)
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
    detailView.ratePlanChooser.value = maybeId
    rateQueryId = maybeId
  } else {
    rateQueryId = rows[0].label
  }
}

console.log(rateQueryId)

const state = new UiState()
await state.setSelected(rateQueryId)
function render() {
  if (!state.selected) {
    return
  }

  chart(state.selected, detailView.chartEl, {
    includeAdjusted: state.adjustedIncluded,
  })
  detailView.raw.innerHTML = JSON.stringify(
    state.selected,
    (key, value) => {
      if (typeof value === 'bigint') {
        return value.toString() // Convert BigInt to string
      }
      return value // Return other values unchanged
    },
    2
  ).replaceAll(/\[\s+([^\[\]{}]+?)\s+\]/g, (match, content) => {
    // Clean up the content and put on one line
    const cleaned = content.replace(/\s+/g, ' ').trim()
    return `[${cleaned}]`
  })
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

detailView.adjustedIncluded.addEventListener('change', ({ target }) => {
  if (target instanceof HTMLInputElement) {
    state.adjustedIncluded = target.checked
  }

  render()
})

detailView.ratePlanChooser.addEventListener('change', selectEvent)

render()
