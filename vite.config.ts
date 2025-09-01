
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": new URL("./client/src", import.meta.url).pathname,
      "@shared": new URL("./shared", import.meta.url).pathname
    }
  },
  root: "client",
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
})
