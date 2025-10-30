// backend/tests/testFoodsAPI.js
import fetch from "node-fetch";

const API = "http://localhost:5174"; // ✅ no trailing slash
const ADMIN_CREDENTIALS = {
  emailOrUsername: "leo",
  password: "13131313",
};

let cookieJar = ""; // session cookie

// ───────────────────────────────────────────────
//  Helpers
// ───────────────────────────────────────────────
async function loginAsAdmin() {
  console.log("🔑 Logging in as admin...");
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ADMIN_CREDENTIALS),
  });

  if (!res.ok) {
    throw new Error(`Admin login failed: ${res.status} ${res.statusText}`);
  }

  cookieJar = res.headers.get("set-cookie");
  console.log("✅ Admin logged in. Session cookie stored.");
}

async function call(path, method = "GET", body = null, asAdmin = false) {
  const headers = { "Content-Type": "application/json" };
  if (asAdmin && cookieJar) headers["Cookie"] = cookieJar;

  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }

  if (!res.ok) {
    console.error(`❌ ${method} ${path} → ${res.status}`);
    console.error(json);
    throw new Error(`Request failed: ${res.status}`);
  }

  console.log(`✅ ${method} ${path} → ${res.status}`);
  return json;
}

// ───────────────────────────────────────────────
//  Test sequence
// ───────────────────────────────────────────────
(async () => {
  try {
    await loginAsAdmin();

    // 1️⃣ Create a new food
    const newFood = {
      barcode: "TESTBARCODE-001",
      date: "2025-10-30",
      category: "Dessert",
      dish: "Test Vanilla Pudding",
      description: "Auto-generated test entry",
      allergens: ["G"],
      additives: ["9", "16"],
      translations: {
        en: {
          dish: "Vanilla Pudding",
          description: "Sweet test pudding",
          category: "Dessert",
        },
      },
    };
    const created = await call("/admin/foods", "POST", newFood, true);
    console.log("📦 Created food:", created.dish, "→ id:", created.id);

    // 2️⃣ Verify saved fields
    const fetched = await call(`/foods/${created.barcode}`, "GET");
    console.log("🔍 Verifying saved fields...");
    console.log("   • Allergens:", fetched.allergens);
    console.log("   • Additives:", fetched.additives);
    console.log("   • Pictograms:", fetched.pictograms);
    console.log("   • Diabetic friendly:", fetched.diabeticFriendly);

    // Assert-like checks
    const missing = [];
    if (!Array.isArray(fetched.allergens) || fetched.allergens.length === 0)
      missing.push("allergens");
    if (!Array.isArray(fetched.additives) || fetched.additives.length === 0)
      missing.push("additives");
    if (!Array.isArray(fetched.pictograms))
      missing.push("pictograms");
    if (typeof fetched.diabeticFriendly !== "boolean")
      missing.push("diabeticFriendly");

    if (missing.length > 0) {
      throw new Error(`⚠️ Missing or invalid fields: ${missing.join(", ")}`);
    } else {
      console.log("✅ All expected fields are present and valid.");
    }

    // 3️⃣ List foods (admin)
    const list = await call("/admin/foods", "GET", null, true);
    console.log(`📜 Foods count: ${list.length}`);

    // 4️⃣ Fetch image (expected 404, none uploaded)
    const imgRes = await fetch(`${API}/admin/foods/${created.id}/image`, {
      headers: { Cookie: cookieJar },
    });
    console.log("🖼️ Image check:", imgRes.status === 404 ? "No image (expected)" : imgRes.status);

    // 5️⃣ Update (change additives)
    const updated = await call(
      `/admin/foods/${created.id}`,
      "PUT",
      { additives: ["1", "9"], allergens: ["A1"] },
      true
    );
    console.log("✏️ Updated diabeticFriendly:", updated.diabeticFriendly);
    console.log("✏️ Updated pictograms:", updated.pictograms);

    // 6️⃣ Get public version again
    const publicFood = await call(`/foods/${created.barcode}`, "GET");
    console.log("🌍 Public fetch OK:", publicFood.dish);

    // 7️⃣ Delete
    await call(`/admin/foods/${created.id}`, "DELETE", null, true);
    console.log("🗑️ Deleted test food.");

    console.log("\n✅ All tests passed successfully!");
  } catch (err) {
    console.error("🚨 Test sequence failed:", err);
    process.exit(1);
  }
})();
