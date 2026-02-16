// ── CareBell user pictogram/allergen migration ──
// Run in mongosh on the app database

// helper: merge arrays uniquely
function uniq(arr) {
  return Array.from(new Set((arr || []).filter(Boolean)));
}

// helper: derive pictograms from allergens (inline minimal version)
// matches your shared logic essentials
function derivePictosFromAllergens(codes=[]) {
  const all = new Set();
  // expand A-parent to A1..A7 if present (minimal expansion for safety)
  if (codes.includes("A")) ["A1","A2","A3","A4","A5","A6","A7"].forEach(c => all.add(c));
  if (codes.includes("H")) ["H1","H2","H3","H4","H5","H6","H7","H8"].forEach(c => all.add(c));
  codes.forEach(c => all.add(c));

  const p = new Set();
  for (const c of all) {
    if (c.startsWith("A")) p.add("A");        // gluten
    if (c === "D")       p.add("F");          // fish
    if (c === "G")       p.add("L");          // milk
    if (c === "B" || c === "N") p.add("B");   // shellfish/molluscs
    if (c === "E" || c.startsWith("H")) p.add("H"); // peanuts/nuts
  }
  return Array.from(p);
}

// map legacy booleans → new pictogram keys
const legacyMap = {
  R: "R",
  S: "S",
  G: "G",
  M: "L", // lactose -> milk
  W: "A", // gluten
  K: "K",
  Y: "Y",
  // A (alcohol) ignored (not in new schema)
};

db.users.find().forEach(u => {
  // 1) merge duplicate Allergens -> allergens (lowercase)
  const allergensLower = uniq([...(u.allergens || []), ...((u.Allergens || []))]);

  // 2) derive pictograms from allergens
  const pictosFromAllergens = derivePictosFromAllergens(allergensLower);

  // 3) add any legacy boolean pictos
  const legacyPictos = [];
  for (const k in legacyMap) {
    if (u[k] === true) legacyPictos.push(legacyMap[k]);
  }

  const newPictos = uniq([...(u.pictograms || []), ...pictosFromAllergens, ...legacyPictos]);

  // 4) update doc
  db.users.updateOne(
    { _id: u._id },
    {
      $set: {
        allergens: allergensLower,
        pictograms: newPictos
      },
      $unset: {
        Allergens: "", // remove duplicate field
        R: "", S: "", G: "", M: "", A: "", W: "", K: "", Y: "" // remove legacy booleans
      }
    }
  );
});

print("✅ Users migrated: allergens merged; pictograms derived; legacy fields removed.");
