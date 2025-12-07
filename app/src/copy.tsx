import type { RateAspect } from "./components/Schedule";

export const complexEnergyScheduleTooltip = (
  type: RateAspect<"flat demand">["type"],
) => (
  <>
    This rate plan's {type} rate varies based on month
    {["demand", "energy"].includes(type) && ` or weekday vs. weekend`}. Each
    period represents a different set of rates and/or tiers.
    <br />
    <br />
    Click on a colored region of the chart to change the date for the rest of
    the charts.
  </>
);

export const zipCodeSearchTooltip = `If you don't know your electricity provider, you can check which ones are present in your zip code here.`;
