// https://ant.design/docs/react/v5-for-19
import '@ant-design/v5-patch-for-react-19'
import { createRoot } from 'react-dom/client'
import { App } from './App'

const root = createRoot(document.getElementById('root')!)
root.render(<App />)
