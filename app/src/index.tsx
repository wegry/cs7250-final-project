// https://ant.design/docs/react/v5-for-19
import "@ant-design/v5-patch-for-react-19";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import localizedFormat from "dayjs/plugin/localizedFormat"; // ES 2015
import dayjs from "dayjs";
import "./data/duckdb";

dayjs.extend(localizedFormat);

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
