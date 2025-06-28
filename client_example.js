// 1. Load .env into process.env
import process from "node:process";
import dotenv from 'dotenv';
dotenv.config();

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function addCompany(name, website) {
  const { data, error } = await supabase.functions.invoke("add_company", {
    body: { name, website },
  });
  if (error) console.error("Error:", error);
  else console.log("Company ID:", data.company_id);
}

// Example
addCompany("Acme Corp", "https://acme.com");

