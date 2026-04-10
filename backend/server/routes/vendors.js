const express = require("express");
const router = express.Router();
const db = require("../db");
const authMiddleware = require("../middleware/auth");
const {
    requireVendorAccess,
    requireAdminOrPurchase,
    requireAdminOrSalesOrPurchase,
} = require("../middleware/authorization");


/*
---------------------------------------
GET ALL VENDORS
GET /api/vendors
---------------------------------------
*/

router.get("/vendors", authMiddleware, requireVendorAccess, async (req, res) => {

    let conn;

    try {

        conn = await db.getConnection();

        const [rows] = await conn.query(`
            SELECT
    v.id,
    v.vendor_code,
    v.name,
    v.gst_number,
    v.gst_number AS gst,
    v.contact_person,
    v.phone,
    v.email,
    v.city,
    v.address,
    v.state,
    v.country,
    v.rating,
    v.is_active,

    COUNT(DISTINCT po.id) AS total_pos,

    COALESCE(SUM(pi.line_total),0) AS total_value,

    MAX(po.order_date) AS last_order_date

FROM vendors v

LEFT JOIN po_items pi
ON pi.vendor_id = v.id

LEFT JOIN purchase_orders po
ON po.id = pi.po_id

GROUP BY v.id

ORDER BY v.name ASC
        `);

        console.log("📋 VENDORS LIST RETURNED:", rows);

        res.json(rows);

    } catch (err) {

        console.error(err);
        res.status(500).json({ error: "Failed to fetch vendors" });

    } finally {

        if (conn) conn.release();

    }

});


/*
---------------------------------------
GET SINGLE VENDOR
GET /api/vendors/:id
---------------------------------------
*/

router.get("/vendors/:id", authMiddleware, requireVendorAccess, async (req, res) => {

    let conn;

    try {

        const { id } = req.params;

        conn = await db.getConnection();

        const [[vendor]] = await conn.query(`
            SELECT 
                id,
                vendor_code,
                name,
                gst_number,
                gst_number AS gst,
                contact_person,
                phone,
                email,
                address,
                city,
                state,
                country,
                rating,
                is_active
            FROM vendors
            WHERE id = ?
        `, [id]);

        console.log("🔍 SINGLE VENDOR FETCHED (ID=${id}):", vendor);

        if (!vendor) {
            return res.status(404).json({ error: "Vendor not found" });
        }

        res.json(vendor);

    } catch (err) {

        console.error(err);
        res.status(500).json({ error: "Failed to fetch vendor" });

    } finally {

        if (conn) conn.release();

    }

});


/*
---------------------------------------
CREATE VENDOR
POST /api/vendors
---------------------------------------
*/

router.post("/vendors", authMiddleware, requireAdminOrSalesOrPurchase, async (req, res) => {

    let conn;

    try {

        const {
            vendor_code,
            name,
            contact_person,
            phone,
            email,
            address,
            city,
            state,
            country,
            gst_number
        } = req.body;

        // ✅ GST mandatory validation
        if (!gst_number || !gst_number.trim()) {
            return res.status(400).json({
                error: "GST number is required"
            });
        }

        // ✅ Normalize GST once (single source of truth)
        const gst = gst_number.trim().toUpperCase();

        // ✅ Format validation (India GST)
        const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

        if (!gstRegex.test(gst)) {
            return res.status(400).json({
                error: "Invalid GST format"
            });
        }

        // ✅ Vendor name validation
        if (!name || !name.trim()) {
            return res.status(400).json({
                error: "Vendor name is required"
            });
        }

        conn = await db.getConnection();

        // ✅ Step 1: Check for duplicate GST
        const [existingVendor] = await conn.query(
            `SELECT id, name FROM vendors WHERE gst_number = ? LIMIT 1`,
            [gst]
        );

        if (existingVendor.length > 0) {
            return res.status(409).json({
                error: "Vendor already exists with this GST",
                existing_vendor: existingVendor[0]
            });
        }

        console.log(`📝 Creating vendor with GST: ${gst}`);

        // ✅ Step 2: Insert vendor
        const [result] = await conn.query(
            `
            INSERT INTO vendors
            (
                vendor_code,
                name,
                contact_person,
                phone,
                email,
                address,
                city,
                state,
                country,
                gst_number,
                gst_verified
            )
            VALUES (?,?,?,?,?,?,?,?,?,?,?)
            `,
            [
                vendor_code || null,
                name.trim(),
                contact_person || null,
                phone || null,
                email || null,
                address || null,
                city || null,
                state || null,
                country || "India",
                gst, // ✅ ALWAYS use normalized value
                0
            ]
        );

        console.log(`✅ Vendor created: ID ${result.insertId}`);

        res.json({
            vendor_id: result.insertId,
            id: result.insertId,
            name: name.trim(),
            gst_number: gst, // ✅ consistent response
            phone: phone || null,
            email: email || null,
            address: address || null,
            city: city || null,
            state: state || null,
            country: country || "India",
            message: "Vendor created successfully"
        });

    } catch (err) {

        console.error("❌ Vendor creation error:", err);

        res.status(500).json({
            error: "Failed to create vendor",
            details: err.message
        });

    } finally {

        if (conn) conn.release();

    }

});


/*
---------------------------------------
VENDOR CONTACTS
GET /api/vendors/:id/contacts
---------------------------------------
*/

router.get("/vendors/:id/contacts", authMiddleware, requireVendorAccess, async (req, res) => {

    let conn;

    try {

        const { id } = req.params;

        conn = await db.getConnection();

        const [rows] = await conn.query(`
            SELECT *
            FROM vendor_contacts
            WHERE vendor_id = ?
            ORDER BY is_primary DESC
        `, [id]);

        res.json(rows);

    } catch (err) {

        console.error(err);
        res.status(500).json({ error: "Failed to fetch contacts" });

    } finally {

        if (conn) conn.release();

    }

});


/*
---------------------------------------
ADD VENDOR CONTACT
POST /api/vendors/:id/contacts
---------------------------------------
*/

router.post("/vendors/:id/contacts", authMiddleware, requireAdminOrPurchase, async (req, res) => {

    let conn;

    try {

        const { id } = req.params;

        const {
            name,
            designation,
            phone,
            email,
            is_primary
        } = req.body;

        conn = await db.getConnection();

        const [result] = await conn.query(`
            INSERT INTO vendor_contacts
            (
                vendor_id,
                name,
                designation,
                phone,
                email,
                is_primary
            )
            VALUES (?,?,?,?,?,?)
        `,
            [
                id,
                name,
                designation || null,
                phone || null,
                email || null,
                is_primary || 0
            ]);

        res.json({ id: result.insertId });

    } catch (err) {

        console.error(err);
        res.status(500).json({ error: "Failed to add contact" });

    } finally {

        if (conn) conn.release();

    }

});


/*
---------------------------------------
VENDOR PURCHASE HISTORY
GET /api/vendors/:id/purchase-history
---------------------------------------
*/

router.get("/vendors/:id/purchase-history", authMiddleware, requireVendorAccess, async (req, res) => {

    let conn;

    try {

        const { id } = req.params;

        conn = await db.getConnection();

        const [rows] = await conn.query(`
SELECT
    po.id,
    po.po_number,
    po.order_date,

    SUM(pi.ordered_qty) AS total_qty,
    SUM(pi.line_total) AS total_value,

    CASE
        WHEN SUM(pi.received_qty) = SUM(pi.ordered_qty) THEN 'completed'
        WHEN SUM(pi.received_qty) > 0 THEN 'partial'
        ELSE 'pending'
    END AS delivery_status

FROM po_items pi
JOIN purchase_orders po ON po.id = pi.po_id

WHERE pi.vendor_id = ?

GROUP BY po.id, po.po_number, po.order_date
ORDER BY po.order_date DESC
`, [id]);

        res.json(rows);

    } catch (err) {

        console.error(err);
        res.status(500).json({ error: "Failed to fetch purchase history" });

    } finally {

        if (conn) conn.release();

    }

});


/*
---------------------------------------
VENDOR PERFORMANCE
GET /api/vendors/:id/performance
---------------------------------------
*/

router.get("/vendors/:id/performance", authMiddleware, requireVendorAccess, async (req, res) => {

    let conn;

    try {

        const { id } = req.params;

        conn = await db.getConnection();

        const [[perf]] = await conn.query(`
            SELECT *
            FROM vendor_performance
            WHERE vendor_id = ?
        `, [id]);

        res.json(perf || {});

    } catch (err) {

        console.error(err);
        res.status(500).json({ error: "Failed to fetch vendor performance" });

    } finally {

        if (conn) conn.release();

    }

});


/*
---------------------------------------
VENDOR PROCUREMENT STATS
GET /api/vendors/:id/procurement
---------------------------------------
*/

router.get("/vendors/:id/procurement", authMiddleware, requireVendorAccess, async (req, res) => {

    let conn;

    try {

        const { id } = req.params;

        conn = await db.getConnection();

        const [[stats]] = await conn.query(

            `
        SELECT
            COUNT(DISTINCT po.id) AS total_pos,

            COALESCE(SUM(pi.line_total),0) AS total_value,

            MAX(po.order_date) AS last_order_date

        FROM po_items pi

        JOIN purchase_orders po
        ON po.id = pi.po_id

        WHERE pi.vendor_id = ?
        `,
            [id]
        );

        res.json(stats || {
            total_pos: 0,
            total_value: 0,
            last_order_date: null
        });

    }
    catch (err) {

        console.error(err);
        res.status(500).json({ error: "Failed to fetch procurement stats" });

    }
    finally {

        if (conn) conn.release();

    }

});


/*
---------------------------------------
UPDATE VENDOR DETAILS (FULL)
PUT /api/vendors/:id
---------------------------------------
*/

router.put("/vendors/:id", authMiddleware, requireAdminOrPurchase, async (req, res) => {

    let conn;

    try {

        const { id } = req.params;
        const data = req.body;

        conn = await db.getConnection();

        // ✅ ONLY ALLOW REAL DB COLUMNS
        const allowedFields = [
            "vendor_code",
            "name",
            "contact_person",
            "phone",
            "email",
            "address",
            "city",
            "state",
            "country",
            "gst_number",
            "is_active"
        ];

        const updates = [];
        const values = [];

        for (const key of allowedFields) {
            if (data[key] !== undefined) {
                updates.push(`${key} = ?`);
                values.push(data[key]);
            }
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: "No valid fields to update" });
        }

        values.push(id);

        const query = `UPDATE vendors SET ${updates.join(", ")} WHERE id = ?`;

        console.log("✅ SAFE UPDATE:", { id, updates });

        await conn.query(query, values);

        res.json({
            success: true,
            message: "Vendor updated successfully",
            vendor_id: id
        });

    } catch (err) {

        console.error("Update vendor error:", err);
        res.status(500).json({ error: "Failed to update vendor" });

    } finally {

        if (conn) conn.release();

    }

});

/*
---------------------------------------
BULK SAVE CONTACTS
POST /api/vendors/:id/contacts/bulk
---------------------------------------
*/

router.post("/vendors/:id/contacts/bulk", authMiddleware, requireAdminOrPurchase, async (req, res) => {

    let conn;

    try {

        const { id } = req.params;
        const { contacts } = req.body;

        conn = await db.getConnection();
        await conn.beginTransaction();

        console.log("📦 BULK CONTACT SAVE:", contacts);

        // delete old
        await conn.query(
            "DELETE FROM vendor_contacts WHERE vendor_id = ?",
            [id]
        );

        // insert new
        for (const c of contacts) {

            if (!c.name) continue;

            await conn.query(
                `
                INSERT INTO vendor_contacts
                (vendor_id, name, designation, phone, email, is_primary)
                VALUES (?, ?, ?, ?, ?, ?)
                `,
                [
                    id,
                    c.name,
                    c.designation || null,
                    c.phone || null,
                    c.email || null,
                    c.is_primary || 0
                ]
            );
        }

        await conn.commit();

        res.json({ success: true });

    } catch (err) {

        if (conn) await conn.rollback();

        console.error("❌ BULK CONTACT ERROR:", err);
        res.status(500).json({ error: "Failed to save contacts" });

    } finally {

        if (conn) conn.release();

    }

});

/*
---------------------------------------
DELETE CONTACT
DELETE /api/vendors/:vendorId/contacts/:contactId
---------------------------------------
*/

router.delete("/vendors/:vendorId/contacts/:contactId", authMiddleware, requireAdminOrPurchase, async (req, res) => {
    let conn;
    try {
        const { contactId } = req.params;

        conn = await db.getConnection();
        await conn.query(
            "DELETE FROM vendor_contacts WHERE id = ?",
            [contactId]
        );

        res.json({ success: true });

    } catch (err) {
        console.error("Delete contact error:", err);
        res.status(500).json({ error: "Failed to delete contact" });
    } finally {
        if (conn) await conn.release();
    }
});

/*
---------------------------------------
SET PRIMARY CONTACT
PUT /api/vendors/:vendorId/contacts/:contactId/primary
---------------------------------------
*/

router.put("/vendors/:vendorId/contacts/:contactId/primary", authMiddleware, requireAdminOrPurchase, async (req, res) => {

    let conn;

    try {

        const { vendorId, contactId } = req.params;

        conn = await db.getConnection();
        await conn.beginTransaction();

        // reset all
        await conn.query(
            "UPDATE vendor_contacts SET is_primary = 0 WHERE vendor_id = ?",
            [vendorId]
        );

        // set selected
        await conn.query(
            "UPDATE vendor_contacts SET is_primary = 1 WHERE id = ?",
            [contactId]
        );

        await conn.commit();

        res.json({ success: true });

    } catch (err) {

        if (conn) await conn.rollback();

        console.error("Primary contact error:", err);
        res.status(500).json({ error: "Failed to set primary contact" });

    } finally {

        if (conn) conn.release();

    }

});

/*
-------------------------------------------------------
DELETE VENDOR
DELETE /api/vendors/:id
-------------------------------------------------------
*/
router.delete('/vendors/:id', require('../middleware/auth'), require('../middleware/authorization').requireAdminOrPurchase, async (req, res) => {
    let conn;
    try {
        const vendorId = req.params.id;

        if (!vendorId) {
            return res.status(400).json({ error: "Vendor ID is required" });
        }

        conn = await db.getConnection();

        // Check if vendor exists
        const [[vendor]] = await conn.query(
            'SELECT id FROM vendors WHERE id = ?',
            [vendorId]
        );

        if (!vendor) {
            return res.status(404).json({ error: "Vendor not found" });
        }

        // Begin transaction
        await conn.beginTransaction();

        try {
            // Delete vendor contacts first (foreign key constraint)
            await conn.query('DELETE FROM vendor_contacts WHERE vendor_id = ?', [vendorId]);

            // Delete the vendor
            await conn.query('DELETE FROM vendors WHERE id = ?', [vendorId]);

            // Commit transaction
            await conn.commit();

            res.json({ success: true, message: "Vendor deleted successfully" });
        } catch (err) {
            await conn.rollback();
            throw err;
        }
    } catch (err) {
        console.error("Delete vendor error:", err);
        res.status(500).json({ error: "Failed to delete vendor", details: err.message });
    } finally {
        if (conn) conn.release();
    }
});


module.exports = router;