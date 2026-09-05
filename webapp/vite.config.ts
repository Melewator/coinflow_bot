import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    server: {
        host: '0.0.0.0', // или true (слушаем все интерфейсы)
        port: 5173,
        strictPort: true,
        cors: true,
        // В зависимости от версии Vite может потребоваться либо cors, либо allowedHosts
        allowedHosts: true
    }
})
