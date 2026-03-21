import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

// Rewrite sub-app deep links to their index.html so React Router handles routing.
// e.g. /leaderboard/some-uuid → /leaderboard/index.html (client-side router takes over)
function subAppFallback(): Plugin {
    return {
        name: 'sub-app-fallback',
        configureServer(server) {
            server.middlewares.use((req, _res, next) => {
                const url = req.url ?? '';
                if (url.startsWith('/leaderboard/') && !url.includes('.')) {
                    req.url = '/leaderboard/index.html';
                } else if (url.startsWith('/overlays/') && !url.includes('.')) {
                    req.url = '/overlays/index.html';
                }
                next();
            });
        },
    };
}

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react(), subAppFallback()],
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
