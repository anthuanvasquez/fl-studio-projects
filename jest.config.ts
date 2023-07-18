import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
    transform: {
        '^.+\\.tsx?$': 'ts-jest',
    },
    testMatch: [
        "**/__tests__/**/*.test.ts"
    ]
};

export default config;
