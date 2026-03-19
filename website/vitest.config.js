"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("vitest/config");
exports.default = (0, config_1.defineConfig)({
    test: {
        include: ['src/**/*.test.ts'],
        exclude: [
            // Pre-existing test files that need Jest→Vitest migration:
            // - raceTableConfig.test.ts uses jest.fn() (needs vi.fn())
            // - deviceTableConfig.test.ts needs jsdom environment + Amplify config
            'src/admin/race-admin/support-functions/raceTableConfig.test.ts',
            'src/components/devices-table/deviceTableConfig.test.ts',
        ],
        globals: true,
        environment: 'node',
    },
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidml0ZXN0LmNvbmZpZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInZpdGVzdC5jb25maWcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSwwQ0FBNkM7QUFFN0Msa0JBQWUsSUFBQSxxQkFBWSxFQUFDO0lBQ3hCLElBQUksRUFBRTtRQUNGLE9BQU8sRUFBRSxDQUFDLGtCQUFrQixDQUFDO1FBQzdCLE9BQU8sRUFBRTtZQUNMLDJEQUEyRDtZQUMzRCwyREFBMkQ7WUFDM0QsdUVBQXVFO1lBQ3ZFLGdFQUFnRTtZQUNoRSx3REFBd0Q7U0FDM0Q7UUFDRCxPQUFPLEVBQUUsSUFBSTtRQUNiLFdBQVcsRUFBRSxNQUFNO0tBQ3RCO0NBQ0osQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZXN0L2NvbmZpZyc7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gICAgdGVzdDoge1xuICAgICAgICBpbmNsdWRlOiBbJ3NyYy8qKi8qLnRlc3QudHMnXSxcbiAgICAgICAgZXhjbHVkZTogW1xuICAgICAgICAgICAgLy8gUHJlLWV4aXN0aW5nIHRlc3QgZmlsZXMgdGhhdCBuZWVkIEplc3TihpJWaXRlc3QgbWlncmF0aW9uOlxuICAgICAgICAgICAgLy8gLSByYWNlVGFibGVDb25maWcudGVzdC50cyB1c2VzIGplc3QuZm4oKSAobmVlZHMgdmkuZm4oKSlcbiAgICAgICAgICAgIC8vIC0gZGV2aWNlVGFibGVDb25maWcudGVzdC50cyBuZWVkcyBqc2RvbSBlbnZpcm9ubWVudCArIEFtcGxpZnkgY29uZmlnXG4gICAgICAgICAgICAnc3JjL2FkbWluL3JhY2UtYWRtaW4vc3VwcG9ydC1mdW5jdGlvbnMvcmFjZVRhYmxlQ29uZmlnLnRlc3QudHMnLFxuICAgICAgICAgICAgJ3NyYy9jb21wb25lbnRzL2RldmljZXMtdGFibGUvZGV2aWNlVGFibGVDb25maWcudGVzdC50cycsXG4gICAgICAgIF0sXG4gICAgICAgIGdsb2JhbHM6IHRydWUsXG4gICAgICAgIGVudmlyb25tZW50OiAnbm9kZScsXG4gICAgfSxcbn0pO1xuIl19