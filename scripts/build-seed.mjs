// Turns data/institutions-seed.csv into the app's bundled directory
// (src/data/institutions.json) and a Supabase seed file (supabase/seed.sql).
import { readFileSync, writeFileSync } from "node:fs";

const TYPES = {
  University: "university",
  "Polytechnic / monotechnic": "polytechnic",
  "College of education": "college_of_education",
};

function parseCsv(text) {
  const rows = [];
  for (const line of text.trim().split("\n")) {
    const cells = [];
    let cur = "";
    let quoted = false;
    for (const ch of line.replace(/\r$/, "")) {
      if (ch === '"') quoted = !quoted;
      else if (ch === "," && !quoted) {
        cells.push(cur);
        cur = "";
      } else cur += ch;
    }
    cells.push(cur);
    rows.push(cells);
  }
  return rows;
}

const slugify = (s) =>
  s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const [header, ...rows] = parseCsv(readFileSync("data/institutions-seed.csv", "utf8"));
if (header.join(",") !== "name,type,ownership,state,source") throw new Error("unexpected CSV header");

const seen = new Set();
const institutions = rows.map(([name, type, ownership, state, source]) => {
  let slug = slugify(name);
  while (seen.has(slug)) slug += "-2";
  seen.add(slug);
  if (!TYPES[type]) throw new Error(`unknown type: ${type}`);
  return { slug, name, type: TYPES[type], ownership, state, source };
});

writeFileSync("src/data/institutions.json", JSON.stringify(institutions, null, 1) + "\n");

const q = (s) => `'${s.replace(/'/g, "''")}'`;
const values = institutions
  .map((i) => `(${q(i.slug)}, ${q(i.name)}, ${q(i.type)}, ${q(i.ownership)}, ${q(i.state)}, ${q(i.source)})`)
  .join(",\n");
writeFileSync(
  "supabase/seed.sql",
  `insert into institutions (slug, name, type, ownership, state, source_url) values\n${values}\non conflict (slug) do nothing;\n`,
);

console.log(`${institutions.length} institutions written`);
