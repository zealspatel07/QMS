// server/services/gstService.js

const axios = require("axios");

/**
 * Normalize GSTIN (uppercase + trim)
 */
function normalizeGSTIN(gstin) {
  return (gstin || "").toUpperCase().trim();
}

/**
 * Validate GST format (India)
 * Format: 15 chars → 2 state + 10 PAN + 1 entity + 1 Z + 1 checksum
 */
function validateGSTFormat(gstin) {
  const gst = normalizeGSTIN(gstin);

  if (!gst) return false;

  const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

  return gstRegex.test(gst);
}

/**
 * Fetch GST details from GSTINCheck API
 * @param {string} gstin
 * @returns {Promise<Object|null>}
 */
async function fetchGSTDetails(gstin) {
  const normalizedGST = normalizeGSTIN(gstin);

  try {
    // 🔒 Step 1: Validate GSTIN
    if (!validateGSTFormat(normalizedGST)) {
      throw new Error("Invalid GSTIN format");
    }

    console.log(`🔍 GST FETCH START → ${normalizedGST}`);

    // 🌐 Step 2: API Call
    const url = `https://sheet.gstincheck.co.in/check/${process.env.GST_API_KEY}/${normalizedGST}`;

    const response = await axios.get(url, {
      timeout: 10000,
    });

    const raw = response.data;

    console.log("📦 GST RAW RESPONSE:", JSON.stringify(raw, null, 2));

    // ❌ Step 3: Validate API response
    if (!raw || raw.flag !== true || !raw.data) {
      throw new Error(raw?.message || "Invalid GST API response");
    }

    const d = raw.data;

    // 🧠 Step 4: Build FULL ADDRESS from all components
    const addr = d.pradr?.addr || {};
    
    // Construct complete address by combining all fields
    const addressParts = [
      addr.flno,    // Floor number
      addr.bno,     // Building number
      addr.bnm,     // Building name
      addr.st,      // Street
      addr.loc,     // Locality
      addr.dst,     // District/City
    ].filter(Boolean); // Remove undefined/null/empty values
    
    const fullAddress = addressParts.join(", ");

    // 🧠 Step 5: Map response → clean object
    const gstData = {
      gst_number: normalizedGST,
      name: d.tradeNam || d.lgnm || "Unknown",

      address: fullAddress || "",

      city: addr.dst || "",
      state: addr.stcd || "",
      pincode: addr.pncd || "",

      status: d.sts || "Inactive",

      // Optional metadata (future use)
      legal_name: d.lgnm || "",
      trade_name: d.tradeNam || "",
      raw: d, // keep full response for debugging/intelligence
    };

    console.log("✅ GST FETCH SUCCESS:", gstData);

    return gstData;

  } catch (err) {
    // 🛑 Error Handling (normalized)
    const errorPayload = err.response?.data || err.message;

    console.error("❌ GST FETCH FAILED:", {
      gstin: normalizedGST,
      error: errorPayload,
    });

    return null;
  }
}

/**
 * Export service
 */
module.exports = {
  fetchGSTDetails,
  validateGSTFormat,
};