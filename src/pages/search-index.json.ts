// /search-index.json: every lesson's searchable text, both languages. Fetched lazily by the collection page.
import type { APIRoute } from "astro";
import { searchIndex } from "../lib/search-index";

export const GET: APIRoute = async () => new Response(JSON.stringify(await searchIndex()), { headers: { "Content-Type": "application/json" } });
