import { getBooks } from "./sync.js";

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});

export async function onRequestGet({ env }) {
  try {
    const books = await getBooks(env);
    return json({ lastSynced: new Date().toISOString(), books });
  } catch (err) {
    return json({ message: err?.message || "Could not load textbooks." }, 502);
  }
}
