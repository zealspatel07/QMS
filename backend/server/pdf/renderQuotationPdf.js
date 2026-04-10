const PDFDocument = require('pdfkit');

module.exports = async function renderQuotationPdf(html) {
  return new Promise((resolve, reject) => {
    try {
      // Create a new PDF document
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        bufferPages: true
      });

      const chunks = [];
      
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Parse HTML and extract text content (simplified)
      // This removes HTML tags and extracts content
      const cleanHtml = html
        .replace(/<style>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim();

      // Add content to PDF
      doc.fontSize(12).text(cleanHtml, {
        align: 'left',
        lineGap: 5,
        wordSpacing: 1
      });

      // Finalize the PDF
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};
