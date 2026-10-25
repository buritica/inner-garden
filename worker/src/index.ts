import { env } from "cloudflare:workers";

const GARDENS = new Set(["oudolf-2","oudolf-matrix-h","oudolf-red-stones","matrix-boulders-1","nakane-melastome-3","nakane-melastome-tree-4","nakane-inset-2","log-black-1","plate-oudolf-1","columns-oudolf-1","tree-oudolf-2"]);
const ORIGINS = new Set(["https://pages.buriti.ca","https://ca-bu.riti.ca"]);
const cors = (req: Request) => {
	const o = req.headers.get("origin") ?? "";
	return { "access-control-allow-origin": ORIGINS.has(o) ? o : "https://pages.buriti.ca", "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "content-type", vary: "origin" };
};
const json = (req: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors(req), "content-type": "application/json", "cache-control": "no-store" } });

async function results(exp: string) {
	const rows = await env.DB.prepare("SELECT kind, garden, COUNT(*) n FROM votes WHERE exp=? GROUP BY kind, garden").bind(exp).all<{ kind: string; garden: string; n: number }>();
	const v = await env.DB.prepare("SELECT COUNT(DISTINCT voter) n FROM votes WHERE exp=?").bind(exp).first<{ n: number }>();
	const out: { love: Record<string, number>; pick: Record<string, number>; voters: number } = { love: {}, pick: {}, voters: v?.n ?? 0 };
	for (const r of rows.results) (r.kind === "pick" ? out.pick : out.love)[r.garden] = r.n;
	return out;
}

export default {
	async fetch(req: Request) {
		const url = new URL(req.url);
		if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
		if (url.pathname === "/results" && req.method === "GET") {
			const exp = url.searchParams.get("exp") ?? "";
			if (!/^[\w-]{1,40}$/.test(exp)) return json(req, { error: "bad exp" }, 400);
			return json(req, await results(exp));
		}
		if (url.pathname === "/vote" && req.method === "POST") {
			const ip = req.headers.get("cf-connecting-ip") ?? "x";
			const m = Math.floor(Date.now() / 60000);
			const t = await env.DB.prepare("INSERT INTO throttle(ip,m,n) VALUES(?,?,1) ON CONFLICT(ip,m) DO UPDATE SET n=n+1 RETURNING n").bind(ip, m).first<{ n: number }>();
			if ((t?.n ?? 0) > 40) return json(req, { error: "slow down" }, 429);
			if (Math.random() < 0.02) await env.DB.prepare("DELETE FROM throttle WHERE m<?").bind(m - 5).run();
			let b: any;
			try { b = await req.json(); } catch { return json(req, { error: "bad json" }, 400); }
			const { exp, voter, kind, garden, on } = b ?? {};
			if (!/^[\w-]{1,40}$/.test(exp ?? "") || !/^[\w-]{8,64}$/.test(voter ?? "") || !GARDENS.has(garden) || (kind !== "love" && kind !== "pick") || typeof on !== "boolean") return json(req, { error: "bad vote" }, 400);
			if (!on) await env.DB.prepare("DELETE FROM votes WHERE exp=? AND voter=? AND kind=? AND garden=?").bind(exp, voter, kind, garden).run();
			else if (kind === "pick") await env.DB.batch([
				env.DB.prepare("DELETE FROM votes WHERE exp=? AND voter=? AND kind='pick'").bind(exp, voter),
				env.DB.prepare("INSERT INTO votes(exp,voter,kind,garden,at) VALUES(?,?,'pick',?,unixepoch())").bind(exp, voter, garden),
			]);
			else await env.DB.prepare("INSERT OR IGNORE INTO votes(exp,voter,kind,garden,at) VALUES(?,?,?,?,unixepoch())").bind(exp, voter, kind, garden).run();
			return json(req, await results(exp));
		}
		return json(req, { ok: true, service: "inner-garden-votes" });
	},
} satisfies ExportedHandler<{ DB: D1Database }>;
