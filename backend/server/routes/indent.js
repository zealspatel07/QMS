//backend/server/routes/indent.js

const express = require('express');
const router = express.Router();
const db = require('../db');

const authMiddleware = require('../middleware/auth');
const upload = require("../middleware/uploadIndentDocument");
const {
    requireIndentAccess,
    requireIndentCreation,
} = require('../middleware/authorization');

/*
-------------------------------------------------------
CREATE INDENT
-------------------------------------------------------
*/
router.post('/indents', authMiddleware, requireIndentCreation, upload.array("documents", 10), async (req, res) => {

    let conn;

    try {

        const {
            customer_id,
            customer_location_id,
            customer_contact_id,
            customer_name,
            preferred_vendor,
            indent_date,
            notes,
            status,
            items,
            created_by,
            created_by_name
        } = req.body;

        // support multiple uploaded documents (upload.array -> req.files)
        const documents = req.files || (req.file ? [req.file] : []);

        const year = new Date().getFullYear();

        conn = await db.getConnection();

        await conn.beginTransaction();

        // Generate indent number
        const [countRows] = await conn.query(
            "SELECT COUNT(*) as count FROM indents WHERE YEAR(created_at)=?",
            [year]
        );

        const nextNumber = countRows[0].count + 1;
        const indentNumber = `IND/${year}/${String(nextNumber).padStart(3, '0')}`;

        // Insert indent
        const [indentResult] = await conn.query(`
            INSERT INTO indents
            (
                indent_number,
                customer_id,
                customer_location_id,
                customer_contact_id,
                customer_name,
                preferred_vendor,
                indent_date,
                po_number,
                notes,
                status,
                created_by,
                created_by_name
            )
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
        `, [
            indentNumber,
            customer_id || null,
            customer_location_id || null,
            customer_contact_id || null,
            customer_name,
            preferred_vendor,
            indent_date,
            req.body.po_number || null,
            notes,
            status || "submitted",
            created_by,
            created_by_name
        ]);

        const indentId = indentResult.insertId;

        // Insert items
        const parsedItems = typeof items === 'string' ? JSON.parse(items) : items;

        if (parsedItems && parsedItems.length) {

            // ✅ Validate all items have required fields
            for (const item of parsedItems) {
                if (!item.product_name || !item.product_name.trim()) {
                    throw new Error(`Product name is required for all items. Item: ${JSON.stringify(item)}`);
                }
                if (!item.quantity || Number(item.quantity) <= 0) {
                    throw new Error(`Valid quantity required for product: ${item.product_name}`);
                }
            }

            const values = parsedItems.map(i => [
                indentId,
                i.product_id || null,
                i.product_name,
                i.product_description || null,
                Number(i.quantity || 0),
                i.uom || 'NOS'   // ✅ ADD THIS
            ]);
            await conn.query(`
        INSERT INTO indent_items
        (indent_id, product_id, product_name, product_description, quantity, uom)
        VALUES ?
    `, [values]);
        }

        // Save any uploaded documents
        if (documents && documents.length) {
            for (const doc of documents) {
                await conn.query(
                    `INSERT INTO indent_documents
                    (indent_id,file_name,file_path,uploaded_by)
                    VALUES (?,?,?,?)`,
                    [
                        indentId,
                        doc.originalname,
                        doc.filename,
                        created_by
                    ]
                );
            }
        }

        await conn.commit();

        res.json({
            success: true,
            indent_id: indentId,
            indent_number: indentNumber
        });

    } catch (err) {

        console.error(err);

        if (conn) await conn.rollback();

        res.status(500).json({ error: "Failed to create indent" });

    } finally {

        if (conn) conn.release();

    }

});

/*
-------------------------------------------------------
UPDATE INDENT
PUT /api/indents/:id
-------------------------------------------------------
*/
router.put('/indents/:id', authMiddleware, requireIndentCreation, upload.array("documents", 10), async (req, res) => {

    let conn;

    try {

        const indentId = req.params.id;
        const {
            customer_id,
            customer_location_id,
            customer_contact_id,
            customer_name,
            preferred_vendor,
            indent_date,
            notes,
            status,
            items
        } = req.body;

        // support multiple uploaded documents
        const documents = req.files || (req.file ? [req.file] : []);

        conn = await db.getConnection();

        await conn.beginTransaction();

        // Update indent header
        await conn.query(`
            UPDATE indents
            SET
                customer_id = ?,
                customer_location_id = ?,
                customer_contact_id = ?,
                customer_name = ?,
                preferred_vendor = ?,
                indent_date = ?,
                po_number = ?,
                notes = ?,
                status = ?
            WHERE id = ?
        `, [
            customer_id || null,
            customer_location_id || null,
            customer_contact_id || null,
            customer_name,
            preferred_vendor,
            indent_date,
            req.body.po_number || null,
            notes,
            status || "submitted",
            indentId
        ]);

        // Delete existing items for this indent
        await conn.query('DELETE FROM indent_items WHERE indent_id = ?', [indentId]);

        // Insert new items
        const parsedItems = typeof items === 'string' ? JSON.parse(items) : items;

        if (parsedItems && parsedItems.length) {

            // Validate all items have required fields
            for (const item of parsedItems) {
                if (!item.product_name || !item.product_name.trim()) {
                    throw new Error(`Product name is required for all items. Item: ${JSON.stringify(item)}`);
                }
                if (!item.quantity || Number(item.quantity) <= 0) {
                    throw new Error(`Valid quantity required for product: ${item.product_name}`);
                }
            }

            const values = parsedItems.map(i => [
                indentId,
                i.product_id || null,
                i.product_name,
                i.product_description || null,
                Number(i.quantity || 0),
                i.uom || 'NOS'   // ✅ ADD
            ]);

            await conn.query(`
        INSERT INTO indent_items
        (indent_id, product_id, product_name, product_description, quantity, uom)
        VALUES ?
    `, [values]);
        }

        // Save any uploaded documents
        if (documents && documents.length) {
            for (const doc of documents) {
                await conn.query(
                    `INSERT INTO indent_documents
                    (indent_id,file_name,file_path,uploaded_by)
                    VALUES (?,?,?,?)`,
                    [
                        indentId,
                        doc.originalname,
                        doc.filename,
                        req.user?.id || null
                    ]
                );
            }
        }

        await conn.commit();

        res.json({
            success: true,
            indent_id: indentId,
            message: "Indent updated successfully"
        });

    } catch (err) {

        console.error(err);

        if (conn) await conn.rollback();

        res.status(500).json({ error: "Failed to update indent" });

    } finally {

        if (conn) conn.release();

    }

});

/*
-------------------------------------------------------
DOWNLOAD INDENT DOCUMENT
GET /api/indents/document/download/:documentId
-------------------------------------------------------
*/
router.get('/indents/document/download/:documentId', authMiddleware, async (req, res) => {
    const { documentId } = req.params;
    let conn;

    try {
        conn = await db.getConnection();

        // Get document info
        const [docs] = await conn.query(
            `SELECT * FROM indent_documents WHERE id = ?`,
            [documentId]
        );

        if (!docs.length) {
            return res.status(404).json({ error: "Document not found" });
        }

        const doc = docs[0];
        const path = require('path');
        const fs = require('fs');

        // Debug: log download attempts
        try { console.log('Download API HIT documentId=', documentId, 'requestedBy=', req.ip || req.headers['x-forwarded-for'] || 'unknown'); } catch (e) { }

        const filePath = path.join(__dirname, '../../uploads/indent-documents', doc.file_path);

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: "File not found on server" });
        }

        // Detect MIME type from file extension
        const ext = String(path.extname(doc.file_name || '')).toLowerCase();
        let contentType = 'application/octet-stream';
        if (ext === '.pdf') contentType = 'application/pdf';
        else if (ext === '.png') contentType = 'image/png';
        else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${doc.file_name}"`);

        // Stream the file to avoid encoding issues
        const stream = fs.createReadStream(filePath);
        stream.on('error', (err) => {
            console.error('File stream error:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to read file' });
            } else {
                res.destroy();
            }
        });

        stream.pipe(res);

    } catch (err) {
        console.error('Download error:', err);
        res.status(500).json({ error: "Failed to download document", details: err.message });
    } finally {
        if (conn) conn.release();
    }
});


/*
-------------------------------------------------------
GET INDENT LIST
-------------------------------------------------------
*/
router.get('/indents', authMiddleware, requireIndentAccess, async (req, res) => {

    let conn;

    try {

        conn = await db.getConnection();

        const [rows] = await conn.query(`

        SELECT
        i.id,
        i.indent_number,
        i.indent_date,
        i.customer_name as customer,
        i.preferred_vendor,
        i.status,

        (SELECT product_name
        FROM indent_items
        WHERE indent_id=i.id
        LIMIT 1) as product_name,


        (SELECT product_description
        FROM indent_items
        WHERE indent_id=i.id
        LIMIT 1) as product_description,

        (SELECT COUNT(*)
        FROM indent_items
        WHERE indent_id=i.id) as product_count,

        (SELECT COALESCE(SUM(quantity),0)
        FROM indent_items
        WHERE indent_id=i.id) as total_quantity

        FROM indents i
        ORDER BY i.created_at DESC
        `);

        res.json(rows);

    } catch (err) {

        console.error(err);
        res.status(500).json({ error: "Failed to fetch indents" });

    } finally {

        if (conn) conn.release();

    }

});



/*
-------------------------------------------------------
GET SINGLE INDENT (MAIN PAGE DATA)
-------------------------------------------------------
*/
router.get('/indents/:id', authMiddleware, requireIndentAccess, async (req, res) => {

    let conn;

    try {

        const indentId = req.params.id;

        conn = await db.getConnection();

        // Fetch indent
        const [indentRows] = await conn.query(
            `SELECT * FROM indents WHERE id=?`,
            [indentId]
        );

        if (!indentRows.length) {
            return res.status(404).json({ error: "Indent not found" });
        }

        const indent = indentRows[0];

        // Fetch items with PO tracking - JOIN with products to get latest details
        const [items] = await conn.query(`

      SELECT
ii.id,
ii.product_id,
-- ✅ Use product name from products table if available, fallback to stored value
COALESCE(p.name, ii.product_name) AS product_name,
-- ✅ Use description from products table if available, fallback to stored value
COALESCE(p.description, ii.product_description) AS product_description,
ii.quantity AS required_qty,
COALESCE(p.uom, ii.uom) AS uom,

COALESCE(SUM(pi.ordered_qty),0) AS ordered_qty,
COALESCE(SUM(pi.received_qty),0) AS received_qty,

(ii.quantity - COALESCE(SUM(pi.ordered_qty),0)) AS pending_qty,

CASE
   -- ✅ 1. CLOSED (Check if PO is closed - show first)

    WHEN SUM(CASE WHEN po.status = 'closed' THEN 1 ELSE 0 END) > 0
      THEN 'Closed'
  
       -- ✅ 2. NO PO

  WHEN COALESCE(SUM(pi.ordered_qty),0) = 0 
    THEN 'Pending PO'

    -- ✅ 3. PO CREATED (no receipt yet)

  WHEN COALESCE(SUM(pi.ordered_qty),0) > 0 
       AND COALESCE(SUM(pi.received_qty),0) = 0 
    THEN 'PO Created'

     -- ✅ 4. PARTIAL DELIVERY

  WHEN COALESCE(SUM(pi.received_qty),0) > 0 
       AND COALESCE(SUM(pi.received_qty),0) < COALESCE(SUM(pi.ordered_qty),0) 
    THEN 'Partially Received'

 -- ✅ 5. FULL DELIVERY

  WHEN COALESCE(SUM(pi.received_qty),0) >= COALESCE(SUM(pi.ordered_qty),0) 
    THEN 'Completed'

END AS status

FROM indent_items ii
LEFT JOIN products p ON p.id = ii.product_id
LEFT JOIN po_items pi ON pi.indent_item_id = ii.id
LEFT JOIN purchase_orders po ON po.id = pi.po_id
WHERE ii.indent_id = ?
GROUP BY 
  ii.id,
  ii.product_id,
  COALESCE(p.name, ii.product_name),
  COALESCE(p.description, ii.product_description),
  ii.quantity,
  COALESCE(p.uom, ii.uom)
ORDER BY ii.id
        `, [indentId]);


        // Fetch PO history
        const [activities] = await conn.query(`
            SELECT
            po.id,
            po.po_number,
            po.vendor_name,
            po.created_at,
            'PO Created' as activity_type
            FROM purchase_orders po
            WHERE po.indent_id=?
            ORDER BY po.created_at ASC
        `, [indentId]);

        const timeline = [
            {
                activity_type: "Indent Created",
                created_at: indent.created_at
            },
            ...activities
        ];

        res.json({
            ...indent,
            items,
            activities: timeline
        });

    } catch (err) {

        console.error(err);
        res.status(500).json({ error: "Failed to fetch indent" });

    } finally {

        if (conn) conn.release();

    }

});



/*
-------------------------------------------------------
GET INDENT SUMMARY
-------------------------------------------------------
*/
router.get('/indents/:id/summary', authMiddleware, requireIndentAccess, async (req, res) => {

    let conn;

    try {

        const indentId = req.params.id;

        conn = await db.getConnection();

        const [rows] = await conn.query(`

        SELECT
        COUNT(ii.id) as products,
        COALESCE(SUM(ii.quantity),0) as required_qty,
        COALESCE(SUM(pi.ordered_qty),0) as ordered_qty,
        COALESCE(SUM(ii.quantity),0) - COALESCE(SUM(pi.ordered_qty),0) as pending_qty

        FROM indent_items ii

        LEFT JOIN po_items pi
        ON pi.indent_item_id = ii.id

        WHERE ii.indent_id=?

        `, [indentId]);

        const data = rows[0];

        const required = Number(data.required_qty || 0);
        const ordered = Number(data.ordered_qty || 0);

        const coverage = required > 0
            ? Math.round((ordered / required) * 100)
            : 0;

        res.json({
            ...data,
            coverage
        });

    } catch (err) {

        console.error(err);
        res.status(500).json({ error: "Failed to fetch summary" });

    } finally {

        if (conn) conn.release();

    }

});



/*
-------------------------------------------------------
GET INDENT ITEMS
-------------------------------------------------------
*/
router.get('/indents/:id/items', authMiddleware, requireIndentAccess, async (req, res) => {

    let conn;

    try {

        const indentId = req.params.id;

        conn = await db.getConnection();

        // --------------------------------------------------
        // 🔹 GET INDENT ITEMS WITH CORRECT STATUS LOGIC
        // --------------------------------------------------
        const [items] = await conn.query(`
SELECT
  ii.id AS item_id,
  ii.product_id,
  ii.product_name,
  ii.product_description,
  ii.quantity AS required_qty,
  ii.uom,

  COALESCE(SUM(CASE WHEN po.status != 'closed' THEN pi.ordered_qty ELSE 0 END), 0) AS ordered_qty,
  COALESCE(SUM(pi.received_qty), 0) AS received_qty,

  (ii.quantity - COALESCE(SUM(CASE WHEN po.status != 'closed' THEN pi.ordered_qty ELSE 0 END), 0)) AS pending_qty,

  CASE

    -- 1. PO CREATED BUT NOT RECEIVED AND CLOSED - Check if it's closed FIRST
    WHEN COALESCE(SUM(pi.ordered_qty), 0) > 0 
         AND COALESCE(SUM(pi.received_qty), 0) = 0
         AND SUM(CASE WHEN po.status = 'closed' THEN 1 ELSE 0 END) > 0
      THEN 'Closed'

    -- 2. NO OPEN PO YET (no active orders and no closed orders either)
    WHEN COALESCE(SUM(CASE WHEN po.status != 'closed' THEN pi.ordered_qty ELSE 0 END), 0) = 0 
         AND COALESCE(SUM(pi.ordered_qty), 0) = 0
      THEN 'Pending PO'

    -- 3. FULLY RECEIVED (regardless if PO is closed or not)
    WHEN COALESCE(SUM(pi.received_qty), 0) >= COALESCE(SUM(CASE WHEN po.status != 'closed' THEN pi.ordered_qty ELSE 0 END), 0)
      THEN 'Completed'

    -- 4. PARTIALLY RECEIVED (regardless if PO is closed or not)
    WHEN COALESCE(SUM(pi.received_qty), 0) > 0 
         AND COALESCE(SUM(pi.received_qty), 0) < COALESCE(SUM(CASE WHEN po.status != 'closed' THEN pi.ordered_qty ELSE 0 END), 0)
      THEN 'Partially Received'

    -- 5. PO CREATED AND OPEN (not yet received)
    WHEN COALESCE(SUM(CASE WHEN po.status != 'closed' THEN pi.ordered_qty ELSE 0 END), 0) > 0 
         AND COALESCE(SUM(pi.received_qty), 0) = 0
      THEN 'PO Created'

  END AS status

FROM indent_items ii

LEFT JOIN po_items pi 
  ON pi.indent_item_id = ii.id

-- 🔥 CRITICAL JOIN
LEFT JOIN purchase_orders po 
  ON po.id = pi.po_id

WHERE ii.indent_id = ?

GROUP BY 
  ii.id,
  ii.product_id,
  ii.product_name,
  ii.product_description,
  ii.quantity,
  ii.uom

ORDER BY ii.id;
        `, [indentId]);

        // --------------------------------------------------
        // 🔹 ATTACH PO DETAILS PER ITEM
        // --------------------------------------------------
        for (const item of items) {

            const [poRows] = await conn.query(`

            SELECT
              po.id AS po_id,
              po.po_number,
              v.name AS vendor_name,
              pi.ordered_qty

            FROM po_items pi

            JOIN purchase_orders po
              ON po.id = pi.po_id

            LEFT JOIN vendors v
              ON v.id = pi.vendor_id

            WHERE pi.indent_item_id = ?

            `, [item.item_id]);

            item.po_details = poRows;
        }

        res.json(items);

    } catch (err) {

        console.error(err);
        res.status(500).json({ error: "Failed to fetch indent items" });

    } finally {

        if (conn) conn.release();

    }

});



/*
-------------------------------------------------------
GET PO HISTORY (TIMELINE)
-------------------------------------------------------
*/
router.get('/indents/:id/po-history', authMiddleware, requireIndentAccess, async (req, res) => {

    let conn;

    try {

        const indentId = req.params.id;

        conn = await db.getConnection();

        const [indentRows] = await conn.query(
            `SELECT created_at FROM indents WHERE id=?`,
            [indentId]
        );

        const [activities] = await conn.query(`
            SELECT
            po.id,
            po.po_number,
            po.vendor_name,
            po.created_at,
            'PO Created' as activity_type
            FROM purchase_orders po
            WHERE po.indent_id=?
            ORDER BY po.created_at ASC
        `, [indentId]);

        const timeline = [
            {
                activity_type: "Indent Created",
                created_at: indentRows[0]?.created_at
            },
            ...activities
        ];

        res.json(timeline);

    } catch (err) {

        console.error(err);
        res.status(500).json({ error: "Failed to fetch PO history" });

    } finally {

        if (conn) conn.release();

    }

});

/*
-------------------------------------------------------
GET PO COUNT FOR INDENT
-------------------------------------------------------
*/
router.get('/indents/:id/po-count', authMiddleware, requireIndentAccess, async (req, res) => {

    let conn;

    try {

        const indentId = req.params.id;

        conn = await db.getConnection();

        // Get total number of product items in indent
        const [totalItemsResult] = await conn.query(
            `SELECT COUNT(DISTINCT id) as total_items FROM indent_items WHERE indent_id=?`,
            [indentId]
        );

        // Get number of product items that have at least one PO created for them
        const [createdItemsResult] = await conn.query(
            `SELECT COUNT(DISTINCT pi.indent_item_id) as created_items
             FROM po_items pi
             INNER JOIN purchase_orders po ON po.id = pi.po_id
             WHERE po.indent_id=?`,
            [indentId]
        );

        // Get distinct PO count
        const [poCount] = await conn.query(
            `SELECT COUNT(DISTINCT po.id) as created 
             FROM purchase_orders po
             WHERE po.indent_id=?`,
            [indentId]
        );

        const totalItems = totalItemsResult[0]?.total_items || 0;
        const createdItems = createdItemsResult[0]?.created_items || 0;
        const poCountValue = poCount[0]?.created || 0;

        res.json({
            total: totalItems,
            created: createdItems,
            po_count: poCountValue
        });

    } catch (err) {

        console.error("PO count error:", err);
        res.status(500).json({ error: "Failed to fetch PO count" });

    } finally {

        if (conn) conn.release();

    }

});




/*
-------------------------------------------------------
GET INDENT DOCUMENTS
-------------------------------------------------------
*/
router.get('/indents/:id/documents', authMiddleware, requireIndentAccess, async (req, res) => {

    const { id } = req.params;

    let conn;

    try {

        conn = await db.getConnection();

        const [docs] = await conn.query(
            `SELECT * FROM indent_documents WHERE indent_id=?`,
            [id]
        );

        res.json(docs);

    } catch (err) {

        console.error(err);
        res.status(500).json({ error: "Failed to fetch documents" });

    } finally {

        if (conn) conn.release();

    }

});

/*
-------------------------------------------------------
DELETE INDENT
DELETE /api/indents/:id
-------------------------------------------------------
*/
router.delete('/indents/:id', authMiddleware, requireIndentCreation, async (req, res) => {
    let conn;
    try {
        const indentId = req.params.id;

        if (!indentId) {
            return res.status(400).json({ error: "Indent ID is required" });
        }

        conn = await db.getConnection();

        // Check if indent exists
        const [[indent]] = await conn.query(
            'SELECT id, status FROM indents WHERE id = ?',
            [indentId]
        );

        if (!indent) {
            return res.status(404).json({ error: "Indent not found" });
        }

        // Begin transaction
        await conn.beginTransaction();

        try {
            // Delete indent items first (foreign key constraint)
            await conn.query('DELETE FROM indent_items WHERE indent_id = ?', [indentId]);

            // Delete indent documents if any
            await conn.query('DELETE FROM indent_documents WHERE indent_id = ?', [indentId]);

            // Delete the indent
            await conn.query('DELETE FROM indents WHERE id = ?', [indentId]);

            // Commit transaction
            await conn.commit();

            res.json({ success: true, message: "Indent deleted successfully" });
        } catch (err) {
            await conn.rollback();
            throw err;
        }
    } catch (err) {
        console.error("Delete indent error:", err);
        res.status(500).json({ error: "Failed to delete indent", details: err.message });
    } finally {
        if (conn) conn.release();
    }
});



module.exports = router;