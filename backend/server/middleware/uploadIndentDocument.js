// middleware/uploadIndentDocument.js

const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadDir = "uploads/indent-documents/";

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({

    destination: function (req, file, cb) {
        // Ensure directory exists before saving
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },

    filename: function (req, file, cb) {

        const uniqueName =
            Date.now() + "-" + Math.round(Math.random() * 1E9);

        cb(null, uniqueName + path.extname(file.originalname));
    }

});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, //5MB
});

module.exports = upload;