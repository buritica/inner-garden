import { bindings, defineConfig } from "cf/config";
import * as entrypoint from "./src/index.ts" with { type: "cf-worker" };

export default defineConfig({
	worker: {
		name: "inner-garden-votes",
		compatibilityDate: "2026-09-30",
		entrypoint,
		env: {
			DB: bindings.d1({ id: "2b61b7ef-9538-4b74-99e7-ff2eeab42a58" }),
		},
	},
});
