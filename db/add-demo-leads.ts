/**
 * Add 4 more demo leads to give evaluators a richer pending pool.
 *
 * Run: npx tsx db/add-demo-leads.ts
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const LEADS = [
  {
    name: "Tanya Williams",
    email: "tanya.w@example.com",
    phone: "+1-602-555-0334",
    source: "referral",
    project_address: "3845 E Cheryl Dr, Phoenix, AZ 85028",
    notes: "Referred by the Marshalls (we did their patio last year). Smaller scope this round — flagstone walkway from driveway to side gate, replace dead bushes with native plants, fix the broken drip line. Budget mentioned: 'under 10K if possible'. No HOA. Wants to start as soon as possible — Easter party in 3 weeks.",
  },
  {
    name: "Carlos Mendez",
    email: "carlos.m@example.com",
    phone: "+1-480-555-0421",
    source: "manual",
    project_address: "7218 W Joshua Ln, Glendale, AZ 85308",
    notes: "Walk-in at the showroom Saturday. Wants a stamped concrete patio (~400 sqft) and a basic wood-burning fire pit. Mentioned he's also getting quotes from two other contractors. Budget mentioned: 'around 12K'. No HOA. Timeline open but says he'll decide within 2 weeks.",
  },
  {
    name: "Jennifer Kim",
    email: "j.kim@example.com",
    phone: "+1-602-555-0512",
    source: "meta_ads",
    project_address: "12428 N 80th St, Scottsdale, AZ 85260",
    notes: "Premium new-construction backyard. Architect-designed plan attached (will share via email). Travertine patio (~700 sqft), aluminum louvered pergola, outdoor kitchen with pizza oven, basin fountain, full LED path lighting throughout. HOA: Pinnacle Peak Estates — submission package required. Budget mentioned: '70-90K'. Wants ground-break in 8 weeks.",
  },
  {
    name: "Robert O'Brien",
    email: "rob.obrien@example.com",
    phone: "+1-480-555-0688",
    source: "google_lsa",
    project_address: "5512 E Indian School Rd, Phoenix, AZ 85018",
    notes: "Simple ask — replace the cracked concrete pad with travertine pavers (about 300 sqft) and add a gas fire pit. That's it. Budget mentioned: 'whatever's reasonable for a patio + fire pit'. No HOA. Timeline flexible.",
  },
];

async function main() {
  console.log("Adding 4 demo leads...");
  const { error } = await supabase.from("leads").insert(LEADS);
  if (error) {
    console.error(error);
    process.exit(1);
  }
  console.log(`✅ inserted ${LEADS.length} leads`);
}

main();
