import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            // Match CRA's baseUrl: "src" in tsconfig.json
            // so bare imports like 'components/foo' resolve to 'src/components/foo'
            src: fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
    server: {
        port: 3000, // Keep same dev port as CRA
        host: true,
        open: true,
    },
    build: {
        outDir: 'build', // Keep same output dir for CDK deployment
        sourcemap: true,
    },
});
