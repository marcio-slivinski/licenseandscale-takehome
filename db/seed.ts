/**
 * Seed script — populates Supabase with 15 pricing items + 2 demo leads.
 *
 * Run: npm run db:seed
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY env var (service role, NOT anon — seed bypasses RLS).
 *
 * Pricing data: realistic Phoenix AZ premium hardscape/landscape contractor rates.
 * Leads: realistic Scottsdale / Paradise Valley clientele names + addresses.
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const PRICING_ITEMS = [
  // Hardscape
  { category: "hardscape", item_name: "Travertine Paver Patio (24x24)", description: "Premium travertine pavers, sand-set on compacted base.", unit: "sqft", unit_price: 28.0, tags: ["patio", "travertine", "premium"] },
  { category: "hardscape", item_name: "Flagstone Patio", description: "Natural Arizona flagstone, mortared joints.", unit: "sqft", unit_price: 32.0, tags: ["patio", "flagstone", "natural"] },
  { category: "hardscape", item_name: "Cantera Stone Pavers", description: "Mexican cantera stone pavers, sealed.", unit: "sqft", unit_price: 22.0, tags: ["patio", "walkway", "cantera"] },
  { category: "hardscape", item_name: "Stamped Concrete Patio", description: "Decorative stamped + colored concrete, sealed.", unit: "sqft", unit_price: 16.0, tags: ["patio", "concrete", "budget"] },
  { category: "hardscape", item_name: "Block Retaining Wall", description: "Architectural block retaining wall, includes drainage.", unit: "linear_ft", unit_price: 145.0, tags: ["wall", "retaining", "structural"] },

  // Structures
  { category: "structure", item_name: "Cedar Pergola 12x12", description: "Stained western red cedar pergola, custom-built on site.", unit: "each", unit_price: 8500.0, tags: ["pergola", "shade", "cedar", "premium"] },
  { category: "structure", item_name: "Aluminum Pergola 14x16", description: "Powder-coated aluminum pergola with louvered roof.", unit: "each", unit_price: 12000.0, tags: ["pergola", "shade", "aluminum", "louvered"] },
  { category: "structure", item_name: "Outdoor Kitchen, Basic 10ft", description: "10ft L-shape: stainless grill, side burner, sink, granite counter.", unit: "each", unit_price: 18500.0, tags: ["kitchen", "outdoor_living", "stainless"] },

  // Fire & water
  { category: "hardscape", item_name: "Gas Fire Pit", description: "Cast-stone fire pit, natural gas line included.", unit: "each", unit_price: 4200.0, tags: ["fire_pit", "gas", "entertainment"] },
  { category: "hardscape", item_name: "Wood-Burning Stone Fire Pit", description: "Stacked-stone wood-burning fire pit, drainage included.", unit: "each", unit_price: 3200.0, tags: ["fire_pit", "wood", "rustic"] },
  { category: "water_feature", item_name: "Basin Fountain", description: "Recirculating basin fountain with custom stone basin.", unit: "each", unit_price: 5800.0, tags: ["water_feature", "fountain", "premium"] },

  // Landscape
  { category: "landscape", item_name: "Premium Artificial Turf (80oz)", description: "80oz pile turf, drainage base, full install.", unit: "sqft", unit_price: 14.0, tags: ["turf", "synthetic", "low_maintenance"] },
  { category: "landscape", item_name: "Native Plant Install (per plant)", description: "Arizona-native plants installed with amended soil.", unit: "each", unit_price: 85.0, tags: ["planting", "native", "low_water"] },

  // Irrigation
  { category: "irrigation", item_name: "Drip Irrigation System", description: "Full property drip system with controller, valves, lines.", unit: "each", unit_price: 2400.0, tags: ["irrigation", "drip", "controller"] },

  // Lighting
  { category: "lighting", item_name: "LED Path Light", description: "12V LED path light, brass fixture, transformer-fed.", unit: "each", unit_price: 185.0, tags: ["lighting", "path", "led"] },
];

const DEMO_LEADS = [
  {
    name: "Sarah Chen",
    email: "sarah.chen@example.com",
    phone: "+1-602-555-0142",
    source: "meta_ads",
    project_address: "8420 E Camelback Rd, Scottsdale, AZ 85251",
    notes: "Interested in full backyard renovation. Two kids, want low-maintenance turf area, fire pit, some shade. Budget mentioned: 'around 40-50K'. HOA: Camelback Country Club. Timeline: would like done by end of summer.",
  },
  {
    name: "David Martinez",
    email: "david.m@example.com",
    phone: "+1-480-555-0198",
    source: "google_lsa",
    project_address: "4612 N Hummingbird Ln, Paradise Valley, AZ 85253",
    notes: "Full outdoor living build. Travertine patio (~600sqft), pergola with louvered roof, outdoor kitchen, water feature, landscape lighting. Premium finishes throughout. Mentioned cantera stone preference. Architect on file. No HOA. Timeline flexible but wants to break ground in 6 weeks.",
  },
];

async function seed() {
  console.log("Seeding pricing_items...");
  const { error: pricingError } = await supabase.from("pricing_items").insert(PRICING_ITEMS);
  if (pricingError) {
    console.error("pricing_items error:", pricingError);
    process.exit(1);
  }
  console.log(`  → inserted ${PRICING_ITEMS.length} items`);

  console.log("Seeding leads...");
  const { error: leadsError } = await supabase.from("leads").insert(DEMO_LEADS);
  if (leadsError) {
    console.error("leads error:", leadsError);
    process.exit(1);
  }
  console.log(`  → inserted ${DEMO_LEADS.length} leads`);

  console.log("Done.");
}

seed();
