# US Electricity Rate Explorer

An interactive web application for understanding and comparing electricity pricing mechanisms across US utilities.

## Overview

America's electricity grids face challenges from extreme weather, aging infrastructure, and growing demand. This tool helps users understand different pricing mechanisms by combining data from the [US Utility Rate Database](https://openei.org/wiki/Utility_Rate_Database) and the EIA-861.

## Features

- **Zip Search** — Look up utilities and rate plans by zip code
- **Detail View** — Search directly by utility and rate plan name
- **Compare** — Compare costs between two rate plans
- **Map View** — Browse utilities geographically
- **Plan Survey** — Learn about different rate structures (flat, tiered, TOU, demand, etc.)

## Getting Started

### Prerequisites

- Node.js (v24+)
- Python (>=3.13) for database update scripts

### Installation

To download data files after cloning and with git LFS installed:

```sh
git lfs pull
```

Then

```sh
cd app
npm install
npm run dev
```

## Tech Stack

- vega-lite
- React
- React Router
- Ant Design
- Day.js
- DuckDB-WASM

## Data Sources

- [OpenEI Utility Rate Database](https://openei.org/wiki/Utility_Rate_Database)
- EIA-861

> **Note:** Rates shown are residential and primarily generation charges; distribution charges are not included.

## License

MIT

## Acknowledgments

Created for CS7250 Data Visualization at Northeastern University.
