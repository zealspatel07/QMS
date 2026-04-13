// backend/server/routes/purchaseOrders.js

const express = require("express");
const router = express.Router();
const db = require("../db");
const authMiddleware = require("../middleware/auth");
const {
  requirePOAccess,
  requirePOCreation,
} = require("../middleware/authorization");

/*
-------------------------------------------------------
CREATE PURCHASE ORDER
POST /api/purchase-orders
-------------------------------------------------------
*/

router.post(
  "/purchase-orders",
  authMiddleware,
  requirePOCreation,
  async (req, res) => {
    let conn;

    try {
      const {
        indent_id,
        items,
        created_by,
        created_by_name,
        vendor_details,

        // 🔥 NEW FIELDS
        vendor_quote_no,
        vendor_quote_date,
        payment_terms,
        delivery_date,
        remarks,
        discount_percentage = 0,
        gst_rate = 18,
        po_date,
        terms,
      } = req.body;

      // 🔍 Log received quotation details - DETAILED
      console.log("═════════════════════════════════════");
      console.log("📋 PO CREATION - FULL REQUEST BODY:");
      console.log(JSON.stringify(req.body, null, 2));
      console.log("═════════════════════════════════════");
      console.log("📋 EXTRACTED QUOTATION DETAILS:");
      console.log({
        vendor_quote_no: `"${vendor_quote_no}"`,
        vendor_quote_date: `"${vendor_quote_date}"`,
        payment_terms: `"${payment_terms}"`,
        delivery_date: `"${delivery_date}"`,
        remarks: `"${remarks}"`,
      });
      console.log("═════════════════════════════════════");

      // ✅ Basic Validation
      if (!Array.isArray(items) || items.length === 0) {
        return res
          .status(400)
          .json({ error: "Invalid purchase order data - items required" });
      }

      conn = await db.getConnection();

      // ✅ CHECK INDENT STATUS ONLY IF INDENT_ID PROVIDED
      if (indent_id) {
        const [indentRows] = await conn.query(
          "SELECT status FROM indents WHERE id = ?",
          [indent_id],
        );

        if (!indentRows.length) {
          conn.release();
          return res.status(404).json({ error: "Indent not found" });
        }

        if (indentRows[0].status === "draft") {
          conn.release();
          return res.status(400).json({
            error:
              "Cannot create PO for Draft Indent. Please submit the indent first.",
          });
        }
      }

      await conn.beginTransaction();

      // --------------------------------------------------
      // ✅ FETCH DEFAULT PO TERMS
      // --------------------------------------------------
      const [[settingsRow]] = await conn.query(`
    SELECT po_terms_conditions 
    FROM app_settings 
    WHERE id = 1
`);

      const defaultTerms = settingsRow?.po_terms_conditions || "";

      // ✅ FINAL TERMS (USER EDIT OR DEFAULT)
      const finalTerms = terms && terms.trim() !== "" ? terms : defaultTerms;

      console.log("📜 PO TERMS SOURCE:", {
        used: finalTerms,
        source: terms && terms.trim() !== "" ? "USER_EDITED" : "DEFAULT",
      });

      // --------------------------------------------------
      // ✅ Financial Year Generator
      // --------------------------------------------------
      function getFinancialYear(date = new Date()) {
        const year = date.getFullYear();
        const month = date.getMonth() + 1;

        if (month >= 4) {
          return `${year.toString().slice(-2)}${(year + 1).toString().slice(-2)}`;
        } else {
          return `${(year - 1).toString().slice(-2)}${year.toString().slice(-2)}`;
        }
      }

      const fy = getFinancialYear();

      // --------------------------------------------------
      // ✅ Generate PO Number (FY Based, with 3-digit sequence)
      // ✅ FIXED: Get MAX sequence instead of COUNT to avoid duplicates
      // --------------------------------------------------
      const [maxRows] = await conn.query(
        `
            SELECT MAX(CAST(SUBSTRING(po_number, 8) AS UNSIGNED)) as max_seq
            FROM purchase_orders
            WHERE po_number LIKE ?
            `,
        [`POS${fy}%`],
      );

      const maxSequence = maxRows[0]?.max_seq || 0;
      const sequence = String(maxSequence + 1).padStart(3, "0");
      const poNumber = `POS${fy}${sequence}`;

      console.log(
        `📍 PO Number Generation: FY=${fy}, MaxSeq=${maxSequence}, NewSeq=${sequence}, FinalPO=${poNumber}`,
      );

      // --------------------------------------------------
      // ✅ Vendor Fetch (for backup/fallback)
      // --------------------------------------------------
      const vendorId = items[0]?.vendor_id;
      let vendor = null;

      if (vendorId) {
        const [[vendorRow]] = await conn.query(
          `SELECT 
             name,
             gst_number,
             state AS state_code,
             address,
             city,
             state,
             country,
            
             contact_person,
             email,
             phone
             FROM vendors
             WHERE id = ?`,
          [vendorId],
        );
        vendor = vendorRow;
      }

      // 🔥 USE EDITED VENDOR DETAILS IF PROVIDED, OTHERWISE USE DATABASE VALUES
      const gst = vendor_details?.gst || vendor?.gst_number || "";
      const extractedStateCode = gst ? gst.substring(0, 2) : "";

      const finalVendorDetails = {
        name: vendor_details?.name || vendor?.name || "",
        gst: gst,
        state_code: extractedStateCode,

        contact_person:
          vendor_details?.contact_person || vendor?.contact_person || "",
        email: vendor_details?.email || vendor?.email || "",
        phone: vendor_details?.phone || vendor?.phone || "",

        // 🔥 NEW
        address: vendor_details?.address || vendor?.address || "",
        city: vendor_details?.city || vendor?.city || "",
        state: vendor_details?.state || vendor?.state || "",
        country: vendor_details?.country || vendor?.country || "",
        pincode: vendor_details?.pincode || vendor?.pincode || "",
      };

      if (!finalVendorDetails.name) {
        throw new Error("Vendor name is required");
      }

      console.log("📋 FINAL VENDOR DETAILS FOR PO:", finalVendorDetails);

      const orderDate = po_date
        ? po_date // ✅ BEST: store as string (NO timezone issue)
        : new Date().toISOString().split("T")[0]; // fallback

      // --------------------------------------------------
      // ✅ Insert Purchase Order (SNAPSHOT with edited details)
      // --------------------------------------------------
      console.log("🔥 VALUES ABOUT TO INSERT INTO purchase_orders:");
      console.log([
        poNumber,
        indent_id,
        orderDate, // ✅ FIXED
        "created",
        created_by,
        created_by_name,
        finalVendorDetails.name,
        finalVendorDetails.gst,
        finalVendorDetails.state_code,
        finalVendorDetails.contact_person,
        finalVendorDetails.email,
        finalVendorDetails.phone,
        vendor_quote_no || null,
        vendor_quote_date || null,
        payment_terms || null,
        delivery_date || null,
        remarks || null,
      ]);
      const [poResult] = await conn.query(
        `INSERT INTO purchase_orders
    (
        po_number,
        indent_id,
        order_date,
        status,
        terms_snapshot,
        created_by,
        created_by_name,
        vendor_name,
        vendor_gst,
        vendor_state_code,
        vendor_address,
        vendor_city,
        vendor_state,
        vendor_country,
        contact_person,
        contact_email,
        contact_phone,
        vendor_quote_no,
        vendor_quote_date,
        payment_terms,
        delivery_date,
        remarks,
        discount_percentage,
        gst_rate,
        total_amount
    )
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
       [
    poNumber,
    indent_id,
    orderDate,
    "created",
    finalTerms,
    created_by,
    created_by_name,

    finalVendorDetails.name || null,
    finalVendorDetails.gst || null,
    finalVendorDetails.state_code || null,

    finalVendorDetails.address || null,
    finalVendorDetails.city || null,
    finalVendorDetails.state || null,
    finalVendorDetails.country || null,

    finalVendorDetails.contact_person || null,
    finalVendorDetails.email || null,
    finalVendorDetails.phone || null,

    vendor_quote_no || null,
    vendor_quote_date || null,
    payment_terms || null,
    delivery_date || null,
    remarks || null,

    discount_percentage || 0,
    gst_rate || 18,
    0
]
      );
      console.log("✅ PO INSERTED with ID:", poResult.insertId);

      const poId = poResult.insertId;

      // --------------------------------------------------
      // ✅ Insert PO Items (WITH PRODUCT VALIDATION & AUTO-CREATION)
      // --------------------------------------------------
      const itemValues = [];

      console.log(
        "🔍 ITEMS RECEIVED IN PO CREATE:",
        JSON.stringify(items, null, 2),
      );

      // ✅ VALIDATE & AUTO-CREATE: Check/create products for all items
      const validProductIds = new Map(); // Maps incoming product_id to actual database product_id

      // Collect all product references from items
      const productsToProcess = items.map((item) => ({
        incoming_product_id: item.product_id || null,
        product_name: item.product_name,
        product_description: item.product_description || null,
        uom: item.uom || "NOS",
        unit_price: Number(item.unit_price) || 0,
        hsn_code: item.hsn_code || null,
      }));

      // Validate frontend product_ids first
      const frontendProductIds = productsToProcess
        .filter((p) => p.incoming_product_id && p.incoming_product_id > 0)
        .map((p) => p.incoming_product_id);

      if (frontendProductIds.length > 0) {
        const placeholders = frontendProductIds.map(() => "?").join(",");
        const [existingProducts] = await conn.query(
          `SELECT id, name FROM products WHERE id IN (${placeholders})`,
          frontendProductIds,
        );
        existingProducts.forEach((p) => {
          validProductIds.set(p.id, p.id); // Maps incoming_id -> database_id
        });
        console.log(
          "✅ VALIDATED PRODUCT IDS:",
          Array.from(validProductIds.keys()),
        );
      }

      // Auto-create products that don't exist in the database
      for (const product of productsToProcess) {
        if (!product.incoming_product_id) {
          // Check if product exists by name
          const [[existingByName]] = await conn.query(
            `SELECT id FROM products WHERE name = ? LIMIT 1`,
            [product.product_name],
          );

          if (existingByName) {
            validProductIds.set(product.product_name, existingByName.id);
            console.log(
              `✅ Found product by name: "${product.product_name}" → ID: ${existingByName.id}`,
            );
          } else {
            // Create the product
            const [createResult] = await conn.query(
              `INSERT INTO products (name, description, uom, unit_price, hsn_code, status) 
                         VALUES (?, ?, ?, ?, ?, 'active')`,
              [
                product.product_name,
                product.product_description,
                product.uom,
                product.unit_price,
                product.hsn_code,
              ],
            );
            validProductIds.set(product.product_name, createResult.insertId);
            console.log(
              `🆕 AUTO-CREATED product: "${product.product_name}" → ID: ${createResult.insertId}`,
            );
          }
        } else if (!validProductIds.has(product.incoming_product_id)) {
          console.warn(
            `⚠️ Product ID ${product.incoming_product_id} not found, but will continue`,
          );
        }
      }

      for (const item of items) {
        if (!item.product_name) {
          console.error(
            "❌ ITEM MISSING PRODUCT NAME:",
            JSON.stringify(item, null, 2),
          );
          throw new Error(
            `Product name missing in item. Item data: ${JSON.stringify(item)}`,
          );
        }

        const qty = Number(item.quantity || 0);

        // 🔥 USE FRONTEND PRICE (NOT PRODUCT TABLE)
        const price = Number(item.unit_price || 0);

        if (isNaN(price) || price <= 0) {
          throw new Error(`Invalid price for product: ${item.product_name}`);
        }

        const lineTotal = qty * price;

        // ✅ Get product_id from validation map
        let productId = null;

        if (
          item.product_id &&
          item.product_id > 0 &&
          validProductIds.has(item.product_id)
        ) {
          productId = validProductIds.get(item.product_id);
          console.log(`✅ Using product_id: ${item.product_id} (validated)`);
        } else if (validProductIds.has(item.product_name)) {
          productId = validProductIds.get(item.product_name);
          console.log(
            `✅ Product resolved (by name): "${item.product_name}" → ID: ${productId}`,
          );
        } else {
          console.warn(
            `⚠️ No product found: "${item.product_name}" - will insert with NULL product_id`,
          );
          productId = null;
        }

        // 🔥 ENSURE VENDOR EXISTS (CRITICAL FOR PRODUCTION)
        const resolvedVendorId = item.vendor_id || vendorId;

        if (!resolvedVendorId) {
          console.error("❌ Vendor missing for item:", item);
          throw new Error(
            `Vendor ID missing for product: ${item.product_name}`,
          );
        }

        itemValues.push([
          poId,
          item.indent_item_id || null,
          productId,
          item.product_name,
          item.product_description || null,
          qty,
          item.uom || "NOS",
          resolvedVendorId, // ✅ SAFE
          price,
          lineTotal,
        ]);
      }

      if (itemValues.length === 0) {
        throw new Error("No valid items to insert");
      }

      await conn.query(
        `INSERT INTO po_items
            (
               po_id,
 indent_item_id,
 product_id,                 -- ✅ ADD
 product_name,
 product_description,
 ordered_qty,
 uom,              -- ✅ ADD
 vendor_id,
 unit_price,
 line_total
            )
            VALUES ?`,
        [itemValues],
      );

      // ✅ Calculate and update total amount
      const [[totalsRow]] = await conn.query(
        `SELECT COALESCE(SUM(line_total), 0) as subtotal FROM po_items WHERE po_id = ?`,
        [poId],
      );

      const subtotal = Number(totalsRow.subtotal || 0);
      const discountAmount = subtotal * (discount_percentage / 100);
      const subtotalAfterDiscount = subtotal - discountAmount;
      const gstAmount = subtotalAfterDiscount * (gst_rate / 100);
      const totalAmount = subtotalAfterDiscount + gstAmount;

      await conn.query(
        `UPDATE purchase_orders SET total_amount = ? WHERE id = ?`,
        [totalAmount, poId],
      );

      // --------------------------------------------------
      // ✅ Commit
      // --------------------------------------------------
      await conn.commit();

      res.json({
        success: true,
        po_id: poId,
        po_number: poNumber,
      });
    } catch (err) {
      console.error("PO CREATE ERROR:", err);

      if (conn) await conn.rollback();

      res.status(500).json({
        error: "PO creation failed",
        details: err.message, // 🔥 shows exact issue in frontend
      });
    } finally {
      if (conn) conn.release();
    }
  },
);

/*
-------------------------------------------------------
FETCH PURCHASE ORDER LIST
GET /api/purchase-orders
-------------------------------------------------------
*/

router.get(
  "/purchase-orders",
  authMiddleware,
  requirePOAccess,
  async (req, res) => {
    let conn;

    try {
      const indentId = req.query.indent; // ← read filter

      conn = await db.getConnection();

      let query = `
SELECT
    po.id,
    po.po_number,
    po.vendor_name,
    po.terms_snapshot,
    po.order_date,
    po.status,
    po.indent_id,

    -- 🔥 Vendor quotation fields
    po.vendor_quote_no,
    po.vendor_quote_date,
    po.payment_terms,
    po.delivery_date,
    po.remarks,
    po.discount_percentage,
    po.gst_rate,
    po.total_amount,

    i.indent_number,

    -- 🔥 SNAPSHOT VENDOR (PRIMARY)
    po.vendor_gst,
    po.vendor_state_code,
    po.contact_person,
    po.contact_email,
    po.contact_phone,

    COUNT(pi.id) AS total_items,
    SUM(pi.ordered_qty) AS total_qty

FROM purchase_orders po

LEFT JOIN indents i
    ON i.id = po.indent_id

LEFT JOIN po_items pi
    ON pi.po_id = po.id
`;

      const params = [];

      // 🔴 FILTER BY INDENT IF PROVIDED
      if (indentId) {
        query += ` WHERE po.indent_id = ? `;
        params.push(indentId);
      }

      query += `
        GROUP BY po.id
        ORDER BY po.created_at DESC
        `;

      const [rows] = await conn.query(query, params);

      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch purchase orders" });
    } finally {
      if (conn) conn.release();
    }
  },
);

/* ========================================
   GET /api/purchase-orders/export
   Export all POs with items as CSV
======================================== */
router.get("/purchase-orders/export", authMiddleware, async (req, res) => {
  let conn;

  try {
    conn = await db.getConnection();

    // ===============================
    // 🔍 EXTRACT QUERY PARAMS
    // ===============================
    const { from, to, status = "all", type = "detailed" } = req.query;

    // ===============================
    // 🧠 BUILD DYNAMIC QUERY
    // ===============================
    let query = `
            SELECT
                po.id,
                po.po_number,
                po.created_at,
                po.order_date,
                po.delivery_date,
                po.status,
                po.vendor_name,
                po.gst_rate,
                po.discount_percentage,
                po.total_amount
            FROM purchase_orders po
        `;

    const conditions = [];
    const params = [];

    // ✅ DATE FILTER
    if (from && to) {
      conditions.push(`DATE(po.created_at) BETWEEN ? AND ?`);
      params.push(from, to);
    }

    // ✅ STATUS FILTER
    if (status && status !== "all") {
      conditions.push(`po.status = ?`);
      params.push(status);
    }

    // APPLY CONDITIONS
    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += ` ORDER BY po.created_at DESC, po.po_number DESC`;

    console.log("📋 EXPORT QUERY:", query);
    const [poHeaders] = await conn.query(query, params);
    console.log(
      "📊 RAW QUERY RESULT (first PO):",
      poHeaders.length > 0 ? JSON.stringify(poHeaders[0], null, 2) : "NO DATA",
    );

    // ===============================
    // ❌ NO DATA CASE
    // ===============================
    if (!poHeaders.length) {
      const csv = buildPOCsv([]);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=po_export_empty.csv",
      );
      return res.send(csv);
    }

    // ===============================
    // 📦 FETCH ITEMS (ONLY IF DETAILED)
    // ===============================
    let poData = [];

    if (type === "detailed") {
      const [allItems] = await conn.query(
        `
                SELECT
                    pi.po_id,
                    pi.product_name,
                    pi.ordered_qty,
                    pi.unit_price,
                    pi.line_total,
                    pi.received_qty
                FROM po_items pi
                WHERE pi.po_id IN (${poHeaders.map(() => "?").join(",")})
                ORDER BY pi.po_id, pi.id
            `,
        poHeaders.map((p) => p.id),
      );

      // 🔥 OPTIMIZED MAP
      const itemsMap = {};
      allItems.forEach((item) => {
        if (!itemsMap[item.po_id]) {
          itemsMap[item.po_id] = [];
        }
        itemsMap[item.po_id].push(item);
      });

      poData = poHeaders.map((po) => ({
        ...po,
        po_date: po.created_at, // ✅ USE created_at as the display date
        items: itemsMap[po.id] || [],
      }));
    } else {
      // SUMMARY MODE
      poData = poHeaders.map((po) => ({
        ...po,
        po_date: po.created_at, // ✅ USE created_at as the display date
        items: [],
      }));
    }

    console.log("📄 GENERATE CSV");
    console.log(
      "🔍 DEBUG - Sample PO Data (first PO):",
      JSON.stringify(poData[0], null, 2),
    );
    const csv = buildPOCsv(poData, type);

    // ===============================
    // 📁 DYNAMIC FILE NAME
    // ===============================
    const fileName = `PO_${from || "all"}_to_${to || "all"}_${status}.csv`;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);

    res.send(csv);
  } catch (err) {
    console.error("PO export error:", err);
    res.status(500).json({
      error: "export_failed",
      details: err.message,
    });
  } finally {
    if (conn) conn.release();
  }
});
/*
-------------------------------------------------------
FETCH SINGLE PURCHASE ORDER
GET /api/purchase-orders/:id
-------------------------------------------------------
*/

router.get(
  "/purchase-orders/:id",
  authMiddleware,
  requirePOAccess,
  async (req, res) => {
    let conn;

    try {
      const id = req.params.id;

      conn = await db.getConnection();

      // --------------------------------------------------
      // 🔹 FETCH PO HEADER
      // --------------------------------------------------
      const [poRows] = await conn.query(
        `
            SELECT
                po.id,
                po.po_number,
                 po.terms_snapshot,
                DATE_FORMAT(po.order_date, '%Y-%m-%d') AS order_date,
                po.status,
                po.indent_id,

                i.indent_number,

                -- Vendor snapshot (fallback)
                po.vendor_name,
                po.vendor_gst,
                po.vendor_state_code,
                po.contact_person,
                po.contact_email,
                po.contact_phone,

                -- Use current vendor address from vendors table if available, else use snapshot
                COALESCE(v.address, po.vendor_address) AS vendor_address,
                COALESCE(v.city, po.vendor_city) AS vendor_city,
                COALESCE(v.state, po.vendor_state) AS vendor_state,
                COALESCE(v.country, po.vendor_country) AS vendor_country,

                -- Quotation / Financial fields
                po.vendor_quote_no,
                DATE_FORMAT(po.vendor_quote_date, '%Y-%m-%d') AS vendor_quote_date,
                po.payment_terms,
                DATE_FORMAT(po.delivery_date, '%Y-%m-%d') AS delivery_date,
                po.remarks,
                po.discount_percentage,
                po.gst_rate,
                po.total_amount

            FROM purchase_orders po

            LEFT JOIN indents i
                ON i.id = po.indent_id

            LEFT JOIN vendors v
                ON v.id = (
                    SELECT vendor_id FROM po_items 
                    WHERE po_id = po.id 
                    LIMIT 1
                )

            WHERE po.id = ?
            `,
        [id],
      );

      if (!poRows.length) {
        return res.status(404).json({ error: "Purchase order not found" });
      }

      // --------------------------------------------------
      // 🔹 FETCH PO ITEMS (WITH UOM & LATEST PRODUCT DETAILS)
      // --------------------------------------------------
      const [items] = await conn.query(
        `
            SELECT
                pi.id,
                pi.product_id,
                pi.indent_item_id,
                -- ✅ Use PO-specific description first (what was quoted), fallback to product master
                COALESCE(pi.product_name, p.name) AS product_name,
                COALESCE(pi.product_description, p.description) AS product_description,

                pi.ordered_qty,
                COALESCE(p.uom, pi.uom) AS uom,                -- ✅ IMPORTANT - Use latest from products if available

                pi.received_qty,
                pi.unit_price,
                pi.line_total,
                pi.vendor_id,

                v.name AS vendor_name,

                (pi.ordered_qty - pi.received_qty) AS pending_qty,

                CASE
                    WHEN pi.received_qty = 0 THEN 'pending'
                    WHEN pi.received_qty < pi.ordered_qty THEN 'partial'
                    ELSE 'completed'
                END AS delivery_status

            FROM po_items pi

            LEFT JOIN products p                    -- ✅ JOIN with products for latest details
                ON p.id = pi.product_id

            LEFT JOIN vendors v
                ON v.id = pi.vendor_id

            WHERE pi.po_id = ?
            `,
        [id],
      );

      // --------------------------------------------------
      // 🔹 RESPONSE
      // --------------------------------------------------
      res.json({
        ...poRows[0],
        items,
      });
    } catch (err) {
      console.error("FETCH PO ERROR:", err);

      res.status(500).json({
        error: "Failed to fetch purchase order",
        details: err.message,
      });
    } finally {
      if (conn) conn.release();
    }
  },
);
/*
-------------------------------------------------------
FETCH AVAILABLE INDENT ITEMS FOR PO
(Exclude already used items)
GET /api/indents/:id/available-items
-------------------------------------------------------
*/

router.get("/indents/:id/available-items", authMiddleware, async (req, res) => {
  let conn;

  try {
    const indentId = req.params.id;

    conn = await db.getConnection();

    const [rows] = await conn.query(
      `
        SELECT 
            ii.id,
            ii.indent_id,
            ii.product_id,
            ii.product_name,
            ii.product_description,
            ii.quantity,
            ii.uom,
            COALESCE(SUM(pi.ordered_qty), 0) AS already_ordered,
            (ii.quantity - COALESCE(SUM(pi.ordered_qty), 0)) AS remaining_qty
        FROM indent_items ii

        LEFT JOIN po_items pi
        ON pi.indent_item_id = ii.id

        WHERE ii.indent_id = ?
        GROUP BY ii.id
        HAVING remaining_qty > 0
        `,
      [indentId],
    );

    console.log("📋 AVAILABLE ITEMS FOR PO:", rows);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch indent items" });
  } finally {
    if (conn) conn.release();
  }
});

/*
-------------------------------------------------------
UPDATE RECEIVED QUANTITY
PUT /api/po-items/:id/receive
-------------------------------------------------------
*/

router.put(
  "/po-items/:id/receive",
  authMiddleware,
  requirePOCreation,
  async (req, res) => {
    let conn;

    try {
      const itemId = req.params.id;
      const { received_qty } = req.body;

      conn = await db.getConnection();

      // --------------------------------------------------
      // 🔹 FETCH ITEM
      // --------------------------------------------------
      const [[item]] = await conn.query(
        `SELECT po_id, ordered_qty FROM po_items WHERE id=?`,
        [itemId],
      );

      if (!item) {
        return res.status(404).json({ error: "PO item not found" });
      }

      const poId = item.po_id;
      const ordered = Number(item.ordered_qty);

      // --------------------------------------------------
      // 🔹 NORMALIZE RECEIVED QTY
      // --------------------------------------------------
      let received = parseFloat(received_qty);
      received = Math.round(received * 100) / 100;

      if (!Number.isFinite(received) || received < 0) {
        return res.status(400).json({ error: "Invalid received_qty" });
      }

      if (received > ordered) {
        received = ordered;
      }

      // --------------------------------------------------
      // 🔹 UPDATE ITEM
      // --------------------------------------------------
      await conn.query(
        `UPDATE po_items
             SET received_qty=?
             WHERE id=?`,
        [received, itemId],
      );

      // --------------------------------------------------
      // 🔥 CRITICAL FIX: CHECK IF PO IS CLOSED
      // --------------------------------------------------
      const [[po]] = await conn.query(
        `SELECT status FROM purchase_orders WHERE id=?`,
        [poId],
      );

      if (!po) {
        throw new Error("PO not found");
      }

      // 🚫 DO NOT UPDATE IF CLOSED
      if (po.status === "closed") {
        return res.json({
          success: true,
          received_qty: received,
          message: "PO is closed. Status not modified.",
        });
      }

      // --------------------------------------------------
      // 🔹 UPDATE PO STATUS (ONLY IF NOT CLOSED)
      // --------------------------------------------------
      await conn.query(
        `UPDATE purchase_orders
             SET status =
             CASE
              WHEN NOT EXISTS (
                  SELECT 1 FROM po_items
                  WHERE po_id=? AND received_qty < ordered_qty
              ) THEN 'completed'
              WHEN EXISTS (
                  SELECT 1 FROM po_items
                  WHERE po_id=? AND received_qty > 0
              ) THEN 'partial'
              ELSE 'pending'
             END
             WHERE id=?`,

        [poId, poId, poId],
      );

      res.json({
        success: true,
        received_qty: received,
        status:
          received === 0 ? "pending" : received < ordered ? "partial" : "completed",
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to update quantity" });
    } finally {
      if (conn) conn.release();
    }
  },
);

//-------------------------------------------------------
// MARK ITEM AS ORDERED (LOCKS ITEM TO PREVENT PO EDITS)
// PUT /api/po-items/:id/order
//-------------------------------------------------------

router.put(
  "/po-items/:id/order",
  authMiddleware,
  requirePOCreation,
  async (req, res) => {
    let conn;

    try {
      const itemId = req.params.id;

      conn = await db.getConnection();

      // po_items table doesn't have a status column in this project schema.
      // "Ordered" is represented at PO level and via quantities, so no-op here.

      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to mark as ordered" });
    } finally {
      if (conn) conn.release();
    }
  },
);

//-------------------------------------------------------
// MARK ITEM AS COMPLETED (RECEIVED FULLY)
// POST /api/po-items/:id/complete
//-------------------------------------------------------

router.post(
  "/po-items/:id/complete",
  authMiddleware,
  requirePOCreation,
  async (req, res) => {
    let conn;

    try {
      const itemId = req.params.id;

      conn = await db.getConnection();

      // --------------------------------------------------
      // 🔹 FETCH ITEM
      // --------------------------------------------------
      const [[item]] = await conn.query(
        `SELECT po_id, ordered_qty FROM po_items WHERE id=?`,
        [itemId],
      );

      if (!item) {
        return res.status(404).json({ error: "PO item not found" });
      }

      const poId = item.po_id;

      // --------------------------------------------------
      // 🔹 MARK ITEM COMPLETED (FULLY RECEIVED)
      // --------------------------------------------------
      await conn.query(
        `UPDATE po_items
             SET received_qty = ordered_qty
             WHERE id=?`,
        [itemId],
      );

      // --------------------------------------------------
      // 🔥 CRITICAL FIX: CHECK IF PO IS CLOSED
      // --------------------------------------------------
      const [[po]] = await conn.query(
        `SELECT status FROM purchase_orders WHERE id=?`,
        [poId],
      );

      if (!po) {
        throw new Error("PO not found");
      }

      // 🚫 DO NOT UPDATE STATUS IF CLOSED
      if (po.status === "closed") {
        return res.json({
          success: true,
          message: "PO is closed. Status not modified.",
        });
      }

      // --------------------------------------------------
      // 🔹 RECALCULATE PO STATUS (ONLY IF NOT CLOSED)
      // --------------------------------------------------
      await conn.query(
        `UPDATE purchase_orders
             SET status =
             CASE
              WHEN NOT EXISTS (
                  SELECT 1 FROM po_items
                  WHERE po_id=? AND received_qty < ordered_qty
              ) THEN 'completed'
              WHEN EXISTS (
                  SELECT 1 FROM po_items
                  WHERE po_id=? AND received_qty > 0
              ) THEN 'partial'
              ELSE 'pending'
             END
             WHERE id=?`,

        [poId, poId, poId],
      );

      // --------------------------------------------------
      // 🔹 RESPONSE
      // --------------------------------------------------
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Complete failed" });
    } finally {
      if (conn) conn.release();
    }
  },
);

// PUT /api/purchase-orders/:id

router.put(
  "/purchase-orders/:id",
  authMiddleware,
  requirePOCreation,
  async (req, res) => {
    let conn;

    try {
      const poId = req.params.id;
      const {
        items,
        // Header fields (only editable ones - poNumber and orderedDate are fixed)
        vendorQuoteNo,
        vendorQuoteDate,
        deliveryDate,
        paymentTerms,
        remarks,
        gstRate,
      } = req.body;

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Items required" });
      }

      conn = await db.getConnection();
      await conn.beginTransaction();

      // --------------------------------------------------
      // ✅ CHECK STATUS (LOCK AFTER PROCESS STARTS)
      // --------------------------------------------------
      const [[po]] = await conn.query(
        `SELECT status FROM purchase_orders WHERE id = ?`,
        [poId],
      );

      if (!po) {
        throw new Error("PO not found");
      }

      if (po.status !== "created" && po.status !== "pending") {
        return res.status(400).json({
          error: "PO_LOCKED",
          message: "PO cannot be edited after delivery has started",
        });
      }

      // --------------------------------------------------
      // 🚫 LOCK IF MATERIAL RECEIVED
      // --------------------------------------------------
      const [[hasReceived]] = await conn.query(
        `
    SELECT COUNT(*) as count
    FROM po_items
    WHERE po_id = ? AND received_qty > 0
`,
        [poId],
      );

      if (hasReceived.count > 0) {
        throw new Error("Cannot edit PO after material received");
      }

      // --------------------------------------------------
      // 🔵 GET EXISTING ITEM IDs BEFORE PROCESSING
      // --------------------------------------------------
      const [[existingItemsData]] = await conn.query(
        `
            SELECT GROUP_CONCAT(id) as ids
            FROM po_items
            WHERE po_id = ?
        `,
        [poId],
      );

      const existingIds = existingItemsData?.ids
        ? existingItemsData.ids.split(",").map((id) => parseInt(id, 10))
        : [];

      // --------------------------------------------------
      // ✅ PROCESS ITEMS (UPDATE / INSERT)
      // --------------------------------------------------

      for (const item of items) {
        const qty = Number(item.quantity || 0);
        const price = Number(item.unit_price || 0);
        const lineTotal = qty * price;

        // 🔵 EXISTING ITEM → UPDATE
        if (item.id) {
          // Try to get product_id from item, or look it up from product name
          let productId = item.product_id || null;

          if (!productId && item.product_name) {
            try {
              const [[productRow]] = await conn.query(
                `SELECT id FROM products WHERE name = ? LIMIT 1`,
                [item.product_name],
              );
              if (productRow) {
                productId = productRow.id;
              }
            } catch (e) {
              console.warn(
                `Could not find product_id for: ${item.product_name}`,
              );
            }
          }

          await conn.query(
            `
                    UPDATE po_items
                    SET 
                        product_id = ?,
                        product_name = ?,
                        product_description = ?,
                        ordered_qty = ?,
                        uom = ?,
                        vendor_id = ?,
                        unit_price = ?,
                        line_total = ?
                    WHERE id = ? AND po_id = ?
                `,
            [
              productId,
              item.product_name,
              item.product_description || null,
              qty,
              item.uom || "NOS",
              item.vendor_id,
              price,
              lineTotal,
              item.id,
              poId,
            ],
          );
        }
        // 🟢 NEW ITEM → INSERT
        else {
          // Try to get product_id from item, or look it up from product name
          let productId = item.product_id || null;

          if (!productId && item.product_name) {
            try {
              const [[productRow]] = await conn.query(
                `SELECT id FROM products WHERE name = ? LIMIT 1`,
                [item.product_name],
              );
              if (productRow) {
                productId = productRow.id;
              }
            } catch (e) {
              console.warn(
                `Could not find product_id for: ${item.product_name}`,
              );
            }
          }

          await conn.query(
            `
                    INSERT INTO po_items
                    (
                        po_id,
                        indent_item_id,
                        product_id,
                        product_name,
                        product_description,
                        ordered_qty,
                        uom,
                        vendor_id,
                        unit_price,
                        line_total
                    )
                    VALUES (?,?,?,?,?,?,?,?,?,?)
                `,
            [
              poId,
              item.indent_item_id || null,
              productId,
              item.product_name,
              item.product_description || null,
              qty,
              item.uom || "NOS",
              item.vendor_id,
              price,
              lineTotal,
            ],
          );
        }
      }

      // --------------------------------------------------
      // 🔵 DELETE REMOVED ITEMS
      // --------------------------------------------------
      // Get all INCOMING item IDs (only items with actual DB IDs, not new items)
      const incomingItemIds = items
        .filter((item) => item.id) // Only existing items with IDs
        .map((item) => item.id);

      // Delete items that EXISTED before but are NOT in the new request
      const itemsToDelete = existingIds.filter(
        (id) => !incomingItemIds.includes(id),
      );

      if (itemsToDelete.length > 0) {
        await conn.query(
          `
                DELETE FROM po_items
                WHERE po_id = ? AND id IN (?)
            `,
          [poId, itemsToDelete],
        );
        console.log(
          `[PO Update] Deleted ${itemsToDelete.length} items:`,
          itemsToDelete,
        );
      }

      // --------------------------------------------------
      // ✅ UPDATE PO HEADER WITH PRIMARY VENDOR INFO & USER FIELDS
      // --------------------------------------------------
      // Get the primary vendor (first item's vendor)
      const [[primaryItem]] = await conn.query(
        `
            SELECT pi.vendor_id 
            FROM po_items pi
            WHERE pi.po_id = ? AND pi.vendor_id IS NOT NULL
            LIMIT 1
        `,
        [poId],
      );

      if (primaryItem && primaryItem.vendor_id) {
        const [[vendorData]] = await conn.query(
          `
                SELECT 
                    name,
                    gst_number,
                    state,
                    address,
                    city
                FROM vendors
                WHERE id = ?
            `,
          [primaryItem.vendor_id],
        );

        if (vendorData) {
          // Update purchase_orders with header fields
          await conn.query(
            `
                    UPDATE purchase_orders
                    SET 
                        vendor_name = ?,
                        vendor_gst = ?,
                        vendor_state_code = ?,
                        vendor_address = ?,
                        vendor_city = ?,
                        vendor_quote_no = COALESCE(?, vendor_quote_no),
                        vendor_quote_date = COALESCE(?, vendor_quote_date),
                        delivery_date = COALESCE(?, delivery_date),
                        payment_terms = COALESCE(?, payment_terms),
                        remarks = COALESCE(?, remarks),
                        gst_rate = COALESCE(?, gst_rate)
                    WHERE id = ?
                `,
            [
              vendorData.name,
              vendorData.gst_number || "",
              vendorData.state || "",
              vendorData.address || "",
              vendorData.city || "",
              vendorQuoteNo || null,
              vendorQuoteDate || null,
              deliveryDate || null,
              paymentTerms || null,
              remarks || null,
              gstRate || null,
              poId,
            ],
          );
        }
      }

      await conn.commit();

      res.json({ success: true });
    } catch (err) {
      console.error("PO UPDATE ERROR:", err);

      if (conn) await conn.rollback();

      res.status(500).json({
        error: "PO update failed",
        details: err.message,
      });
    } finally {
      if (conn) conn.release();
    }
  },
);

/* ========================================
   POST /api/purchase-orders/:id/close
   Close a PO with reason comment
======================================== */
router.post("/purchase-orders/:id/close", authMiddleware, async (req, res) => {
  let conn;
  try {
    const poId = req.params.id;
    const { reason } = req.body;

    if (!reason || reason.trim() === "") {
      return res.status(400).json({ error: "Reason for closing is required" });
    }

    conn = await db.getConnection();

    // Check if PO exists and get current status
    const [[po]] = await conn.query(
      `SELECT id, status FROM purchase_orders WHERE id = ?`,
      [poId],
    );

    if (!po) {
      return res.status(404).json({ error: "Purchase order not found" });
    }

    // Don't allow closing if already closed/cancelled
    if (po.status === "closed" || po.status === "cancelled") {
      return res.status(400).json({ error: `PO is already ${po.status}` });
    }

    // Close the PO
    await conn.query(
      `UPDATE purchase_orders 
             SET status = 'closed', 
                 closed_reason = ?,
                 closed_at = NOW(),
                 closed_by = ?
             WHERE id = ?`,
      [reason, req.user.id, poId],
    );

    res.json({ success: true, message: "Purchase Order closed successfully" });
  } catch (err) {
    console.error("Close PO error:", err);
    res.status(500).json({ error: err.message || "Failed to close PO" });
  } finally {
    if (conn) conn.release();
  }
});

function buildPOCsv(poData, type = "detailed") {
  console.log("🔍 buildPOCsv DEBUG:");
  console.log("  - Total POs:", poData.length);
  if (poData.length > 0) {
    console.log("  - First PO keys:", Object.keys(poData[0]));
    console.log("  - First PO po_date (created_at):", poData[0].po_date);
    console.log("  - First PO order_date:", poData[0].order_date);
    console.log("  - First PO delivery_date:", poData[0].delivery_date);
  }

  // ===============================
  // 📄 HEADER BASED ON TYPE
  // ===============================
  const header =
    type === "summary"
      ? ["PO No.", "PO Date", "Vendor", "Total Amount", "Status"].join(",")
      : [
          "PO No.",
          "PO Date",
          "Delivery Date",
          "Vendor",
          "Product",
          "Taxable Value",
          "Tax",
          "Grand Total",
          "PO Qty",
          "Received Qty",
          "Pending Qty",
          "Status",
        ].join(",");

  const lines = [];

  // ===============================
  // 🔁 LOOP
  // ===============================
  poData.forEach((po, idx) => {
    // ✅ SAFE DATE FORMAT (FULL DATETIME)
    const formatDate = (d) => {
      if (!d) {
        console.log(`  ⚠️ Empty date for PO ${po.po_number}:`, d);
        return "";
      }
      try {
        let date;

        if (d instanceof Date) {
          date = d;
        } else {
          const dateStr = String(d).trim();
          date = new Date(dateStr);
        }

        if (isNaN(date.getTime())) {
          console.log(`  ❌ Invalid date for PO ${po.po_number}:`, d);
          return "";
        }

        // Format as "Wed Apr 08 2026 10:23:40"
        const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const months = [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ];

        const dayName = days[date.getDay()];
        const monthName = months[date.getMonth()];
        const dayNum = String(date.getDate()).padStart(2, "0");
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");
        const seconds = String(date.getSeconds()).padStart(2, "0");

        const formatted = `${dayName} ${monthName} ${dayNum} ${year} ${hours}:${minutes}:${seconds}`;

        console.log(
          `  ✅ Formatted date for PO ${po.po_number}: ${String(d)} -> ${formatted}`,
        );
        return formatted;
      } catch (e) {
        console.log(
          `  ❌ Error formatting date for PO ${po.po_number}:`,
          e.message,
        );
        return "";
      }
    };

    // ===============================
    // 📊 SUMMARY MODE
    // ===============================
    if (type === "summary") {
      lines.push(
        [
          escapeCsvField(po.po_number),
          formatDate(po.po_date),
          escapeCsvField(po.vendor_name),
          Number(po.total_amount || 0).toFixed(2),
          escapeCsvField(po.status),
        ].join(","),
      );
      return;
    }

    // ===============================
    // 📦 DETAILED MODE
    // ===============================
    if (po.items && po.items.length > 0) {
      let poTotal = 0;

      po.items.forEach((item) => {
        const unitPrice = Number(item.unit_price) || 0;
        const quantity = Number(item.ordered_qty) || 0;
        const gstRate = Number(po.gst_rate) || 0;
        const receivedQty = Number(item.received_qty) || 0;

        const taxableValue = unitPrice * quantity;
        const taxAmount = (taxableValue * gstRate) / 100;
        const grandTotal = taxableValue + taxAmount;
        const pendingQty = quantity - receivedQty;

        poTotal += grandTotal;

        lines.push(
          [
            escapeCsvField(po.po_number),
            formatDate(po.po_date),
            formatDate(po.delivery_date),
            escapeCsvField(po.vendor_name),
            escapeCsvField(item.product_name),
            taxableValue.toFixed(2),
            taxAmount.toFixed(2),
            grandTotal.toFixed(2),
            quantity,
            receivedQty,
            pendingQty,
            escapeCsvField(po.status),
          ].join(","),
        );
      });

      // ===============================
      // 🔥 PO TOTAL ROW (ERP FEATURE)
      // ===============================
      lines.push(
        [
          "",
          "",
          "",
          "",
          "TOTAL",
          "",
          "",
          poTotal.toFixed(2),
          "",
          "",
          "",
          "",
        ].join(","),
      );
    } else {
      // NO ITEMS
      lines.push(
        [
          escapeCsvField(po.po_number),
          formatDate(po.po_date),
          formatDate(po.delivery_date),
          escapeCsvField(po.vendor_name),
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          escapeCsvField(po.status),
        ].join(","),
      );
    }
  });

  return [header, ...lines].join("\n");
}

function escapeCsvField(field) {
  if (field === null || field === undefined) {
    return "";
  }
  const str = String(field);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/* ========================================
   DELETE /api/purchase-orders/:id
   Delete a purchase order
======================================== */
router.delete(
  "/purchase-orders/:id",
  authMiddleware,
  requirePOAccess,
  async (req, res) => {
    let conn;
    try {
      const poId = req.params.id;

      if (!poId) {
        return res.status(400).json({ error: "PO ID is required" });
      }

      conn = await db.getConnection();

      // Check if PO exists
      const [[po]] = await conn.query(
        "SELECT id, status FROM purchase_orders WHERE id = ?",
        [poId],
      );

      if (!po) {
        return res.status(404).json({ error: "Purchase order not found" });
      }

      // Begin transaction
      await conn.beginTransaction();

      try {
        // Delete PO items first (foreign key constraint)
        await conn.query("DELETE FROM po_items WHERE po_id = ?", [poId]);

        // Delete the PO
        await conn.query("DELETE FROM purchase_orders WHERE id = ?", [poId]);

        // Commit transaction
        await conn.commit();

        res.json({
          success: true,
          message: "Purchase order deleted successfully",
        });
      } catch (err) {
        await conn.rollback();
        throw err;
      }
    } catch (err) {
      console.error("Delete PO error:", err);
      res.status(500).json({
        error: "Failed to delete purchase order",
        details: err.message,
      });
    } finally {
      if (conn) conn.release();
    }
  },
);

module.exports = router;
