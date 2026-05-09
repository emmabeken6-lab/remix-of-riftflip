import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TOKEN_USD_PRICE = 0.06; // 1 token = $0.06

function sortedStringify(obj: unknown): string {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return "[" + obj.map(sortedStringify).join(",") + "]";
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + sortedStringify((obj as Record<string, unknown>)[k])).join(",") + "}";
}

export const Route = createFileRoute("/api/public/nowpayments-ipn")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.NOWPAYMENTS_IPN_SECRET;
        if (!secret) return new Response("not configured", { status: 500 });
        const sig = request.headers.get("x-nowpayments-sig");
        const raw = await request.text();
        let payload: Record<string, unknown>;
        try { payload = JSON.parse(raw); } catch { return new Response("bad json", { status: 400 }); }
        const expected = createHmac("sha512", secret).update(sortedStringify(payload)).digest("hex");
        if (!sig || sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
          return new Response("bad sig", { status: 401 });
        }
        const paymentId = String(payload.payment_id ?? payload.id ?? "");
        const status = String(payload.payment_status ?? "waiting");
        const payAmount = Number(payload.pay_amount ?? 0);
        const payCurrency = String(payload.pay_currency ?? "");
        const priceAmount = Number(payload.price_amount ?? 0);
        if (!paymentId) return new Response("missing id", { status: 400 });

        const { data: dep } = await supabaseAdmin
          .from("crypto_deposits").select("*").eq("payment_id", paymentId).maybeSingle();
        if (!dep) return new Response("unknown deposit", { status: 404 });

        await supabaseAdmin.from("crypto_deposits").update({
          status, pay_amount: payAmount, pay_currency: payCurrency, updated_at: new Date().toISOString(),
        }).eq("payment_id", paymentId);

        if ((status === "finished" || status === "confirmed") && Number(dep.tokens_credited) === 0) {
          const tokens = Math.floor(priceAmount / TOKEN_USD_PRICE);
          await supabaseAdmin.rpc("apply_transaction", {
            _user_id: dep.user_id, _delta: tokens, _reason: "deposit",
            _ref_id: dep.id, _meta: { payment_id: paymentId, pay_currency: payCurrency, usd: priceAmount },
          });
          await supabaseAdmin.from("crypto_deposits").update({ tokens_credited: tokens }).eq("payment_id", paymentId);
        }
        return new Response("ok");
      },
    },
  },
});
