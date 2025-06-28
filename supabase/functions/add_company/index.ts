/// <reference lib="dom" />

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import OpenAI from "https://esm.sh/openai";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);
const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY")! });

serve(async (req) => {
  try {
    const { name, website } = await req.json();
    console.log("➡️  Request:", { name, website });

    // 1. Insert company
    const { data: comp, error: insErr } = await supabase
      .from("companies")
      .insert({ name, website })
      .select("id")
      .single();
    if (insErr) throw insErr;
    const companyId = comp.id;

    // 2. Ask GPT‑4o for summary + products
    const prompt =
      `Summarize in ≤ 80 words what "${name}" does and list up to 5 ` +
      `distinct product names (comma‑separated).`;
    const res = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
    });
    const content = res.choices[0].message.content as string;
    console.log("🧠 GPT raw:", content);

    // 3. Parse summary & products
    let summary = "";
    let products: string[] = [];

    // Pattern A: "... product names include X, Y, Z"
    const includeMatch = content.match(
      /product names? (?:include|are)\s*([^.\n]+)/i
    );
    if (includeMatch) {
      const namesText = includeMatch[1];
      products = namesText
        .split(/,\s*/)
        .map((p) => p.replace(/\s*and\s*/i, "").trim())
        .filter(Boolean);
      summary = content.slice(0, includeMatch.index).trim().replace(/\.$/, "");
    } else {
      // Pattern B: "Products: X, Y, Z"
      const prodLabel = content.match(/Products?:\s*([^.\n]+)/i);
      if (prodLabel) {
        products = prodLabel[1]
          .split(/,\s*/)
          .map((p) => p.trim())
          .filter(Boolean);
        summary = content.slice(0, prodLabel.index).trim().replace(/\.$/, "");
      } else {
        // Fallback: first line = summary, second line = products
        const lines = content
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);
        summary = lines[0] || content.trim();
        if (lines[1]) {
          products = lines[1]
            .replace(/^Products?:\s*/i, "")
            .split(/,\s*/)
            .map((p) => p.trim())
            .filter(Boolean);
        }
      }
    }

    console.log("📝 Parsed summary:", summary);
    console.log("📦 Parsed products:", products);

    // 4. Update description
    await supabase.from("companies").update({ description: summary }).eq("id", companyId);

    // 5. Insert products
    if (products.length) {
      await supabase
        .from("products")
        .insert(products.map((n) => ({ company_id: companyId, name: n })));
    } else {
      console.log("⚠️  No products returned by GPT");
    }

    return new Response(JSON.stringify({ company_id: companyId }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("❌ Function error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  
  