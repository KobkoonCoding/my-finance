import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,        // bind ทุก interface → ใช้ได้ทั้ง localhost และ 127.0.0.1
    port: 5173,
    strictPort: true,  // ล็อกพอร์ต ไม่แอบย้ายไป 5174 ตอนพอร์ตชน
  },
})
