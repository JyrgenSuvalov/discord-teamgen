import {
	defineWorkersConfig,
	readD1Migrations,
} from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig(async () => {
	const migrations = await readD1Migrations("./migrations");

	return {
		test: {
			poolOptions: {
				workers: {
					wrangler: { configPath: "./wrangler.jsonc" },
					miniflare: {
						bindings: {
							ENVIRONMENT: "development",
							TEST_MIGRATIONS: migrations,
						},
					},
				},
			},
		},
	};
});
