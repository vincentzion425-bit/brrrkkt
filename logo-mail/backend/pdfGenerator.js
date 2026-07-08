/**
 * Mweb Account Verification PDF Generator
 * Generates professional verification PDFs in memory using PDFKit
 * No files are saved to disk - everything is streamed directly
 * 
 * PDFKit v0.19+ includes built-in roundedRect() method
 * Link annotations use doc.link() for clickable areas
 */

const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

/**
 * Color palette matching Mweb brand exactly
 */
const COLORS = {
  primary: '#0066CC',       // Mweb blue button
  primaryDark: '#004499',   // Hover state
  textDark: '#1A1A1A',     // Headings
  textMedium: '#444444',    // Subheadings
  textLight: '#666666',     // Body text
  textMuted: '#888888',     // Hints, footer
  border: '#E8E8E8',      // Card border, dividers
  bgLight: '#F8F9FA',       // Notice box background
  bgCard: '#FAFAFA',        // QR section background
  white: '#FFFFFF',
  red: '#C53030',           // Warning text
};

/**
 * Convert hex color to PDFKit-compatible array [r, g, b]
 * PDFKit expects values between 0 and 1
 * @param {string} hex - Hex color string (e.g., '#0066CC')
 * @returns {number[]} - [r, g, b] array with values 0-1
 */
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16) / 255,
    parseInt(result[2], 16) / 255,
    parseInt(result[3], 16) / 255,
  ] : [0, 0, 0];
}

/**
 * Generate QR code as a PNG buffer
 * @param {string} url - The URL to encode in the QR code
 * @returns {Promise<Buffer>} - PNG buffer
 */
async function generateQRCode(url) {
  try {
    return await QRCode.toBuffer(url, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      type: 'png',
    });
  } catch (error) {
    console.error('[QR] Generation failed:', error);
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Draw a rounded rectangle using PDFKit's built-in roundedRect (v0.19+)
 * Falls back to manual path drawing for older versions
 * @param {PDFDocument} doc - PDFKit document
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} width - Width
 * @param {number} height - Height
 * @param {number} radius - Corner radius
 * @param {string} fillColor - Fill hex color (optional)
 * @param {string} strokeColor - Stroke hex color (optional)
 */
function drawRoundedRect(doc, x, y, width, height, radius, fillColor = null, strokeColor = null) {
  // PDFKit v0.19+ has built-in roundedRect
  if (doc.roundedRect) {
    doc.save();
    if (fillColor) {
      doc.fillColor(fillColor);
    }
    if (strokeColor) {
      doc.strokeColor(strokeColor).lineWidth(1);
    }

    doc.roundedRect(x, y, width, height, radius);

    if (fillColor && strokeColor) {
      doc.fillAndStroke();
    } else if (fillColor) {
      doc.fill();
    } else if (strokeColor) {
      doc.stroke();
    }
    doc.restore();
  } else {
    // Fallback for older PDFKit versions - manual path drawing
    doc.save();

    doc.moveTo(x + radius, y);
    doc.lineTo(x + width - radius, y);
    doc.quadraticCurveTo(x + width, y, x + width, y + radius);
    doc.lineTo(x + width, y + height - radius);
    doc.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    doc.lineTo(x + radius, y + height);
    doc.quadraticCurveTo(x, y + height, x, y + height - radius);
    doc.lineTo(x, y + radius);
    doc.quadraticCurveTo(x, y, x + radius, y);
    doc.closePath();

    if (fillColor) {
      doc.fill(fillColor);
    }
    if (strokeColor) {
      doc.stroke(strokeColor);
    }

    doc.restore();
  }
}

/**
 * Draw a horizontal line
 * @param {PDFDocument} doc - PDFKit document
 * @param {number} x1 - Start X
 * @param {number} y - Y position
 * @param {number} x2 - End X
 * @param {string} color - Hex color
 */
function drawLine(doc, x1, y, x2, color) {
  doc.save();
  doc.moveTo(x1, y)
     .lineTo(x2, y)
     .strokeColor(color)
     .lineWidth(1)
     .stroke();
  doc.restore();
}

/**
 * Generate the Mweb Account Verification PDF
 * Replicates the uploaded PDF design exactly
 * 
 * @param {string} email - User's email address
 * @param {string} verifyUrl - The verification URL for button and QR
 * @returns {Promise<Buffer>} - PDF as buffer
 */
async function generateVerificationPDF(email, verifyUrl) {
  return new Promise(async (resolve, reject) => {
    try {
      // ============================================================
      // 1. CREATE PDF DOCUMENT (A4 size, no margins)
      // ============================================================
      const doc = new PDFDocument({
        size: 'A4',
        margin: 0,
        bufferPages: true,
      });

      const chunks = [];

      // Collect PDF data chunks into buffer (no disk writes)
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        resolve(pdfBuffer);
      });
      doc.on('error', (err) => reject(err));

      // ============================================================
      // 2. PAGE SETUP & DIMENSIONS
      // ============================================================
      const pageWidth = doc.page.width;   // 595.28 points (A4)
      const pageHeight = doc.page.height;   // 841.89 points (A4)

      // Card dimensions: centered, max width ~520px (185mm converted to points)
      // 1mm = 2.83465 points
      const cardWidth = 185 * 2.83465;      // ~524 points
      const cardHeight = pageHeight - 160;  // Leave margins top/bottom
      const cardX = (pageWidth - cardWidth) / 2;
      let currentY = 80;                     // Top margin

      // ============================================================
      // 3. CARD BACKGROUND (White with light border)
      // ============================================================
      drawRoundedRect(
        doc,
        cardX,
        currentY,
        cardWidth,
        cardHeight,
        12,                    // Corner radius
        COLORS.white,          // Fill
        COLORS.border            // Stroke
      );

      // ============================================================
      // 4. HEADER SECTION
      // ============================================================
      const headerY = currentY + 24;
      const headerX = cardX + 28;

      // "Mweb" - bold, dark
      doc.font('Helvetica-Bold')
         .fontSize(20)
         .fillColor(COLORS.textDark)
         .text('Mweb', headerX, headerY);

      const mwebWidth = doc.widthOfString('Mweb');

      // "·" - separator, gray
      doc.font('Helvetica')
         .fontSize(20)
         .fillColor('#888888')
         .text('·', headerX + mwebWidth + 4, headerY);

      const dotWidth = doc.widthOfString('·');

      // "Account Verification" - regular weight, medium gray
      doc.font('Helvetica')
         .fontSize(20)
         .fillColor(COLORS.textMedium)
         .text('Account Verification', headerX + mwebWidth + dotWidth + 8, headerY);

      // Header bottom divider line
      drawLine(doc, cardX + 28, headerY + 32, cardX + cardWidth - 28, COLORS.border);

      // ============================================================
      // 5. CONTENT AREA
      // ============================================================
      let contentY = headerY + 56;
      const contentX = cardX + 28;
      const contentWidth = cardWidth - 56;  // 28px padding each side

      // --- Heading: "Verify your account" ---
      doc.font('Helvetica-Bold')
         .fontSize(26)
         .fillColor(COLORS.textDark)
         .text('Verify your account', contentX, contentY);

      contentY += 36;

      // --- Subtitle ---
      doc.font('Helvetica')
         .fontSize(13)
         .fillColor(COLORS.textLight)
         .text('Complete your email verification to access your account', contentX, contentY);

      contentY += 32;

      // ============================================================
      // 6. NOTICE BOX (Light gray with blue left accent)
      // ============================================================
      const noticeHeight = 50;

      // Background
      drawRoundedRect(
        doc,
        contentX,
        contentY,
        contentWidth,
        noticeHeight,
        8,
        COLORS.bgLight,
        null
      );

      // Blue left accent bar (3px wide)
      doc.save();
      doc.moveTo(contentX, contentY + 4)
         .lineTo(contentX, contentY + noticeHeight - 4)
         .strokeColor(COLORS.primary)
         .lineWidth(3)
         .stroke();
      doc.restore();

      // Notice text
      doc.font('Helvetica')
         .fontSize(12)
         .fillColor(COLORS.textMedium)
         .text(
           'Please complete the verification to continue using your account',
           contentX + 16,
           contentY + 16,
           { width: contentWidth - 32 }
         );

      contentY += noticeHeight + 24;

      // ============================================================
      // 7. EMAIL ADDRESS DISPLAY
      // ============================================================
      doc.font('Helvetica')
         .fontSize(12)
         .fillColor(COLORS.textLight)
         .text('Email Address:', contentX, contentY);

      contentY += 22;

      // Actual email value - bold, dark
      doc.font('Helvetica-Bold')
         .fontSize(14)
         .fillColor(COLORS.textDark)
         .text(email, contentX, contentY);

      // Underline beneath email
      const emailWidth = doc.widthOfString(email);
      drawLine(doc, contentX, contentY + 20, contentX + Math.max(emailWidth, 200), COLORS.border);

      contentY += 36;

      // ============================================================
      // 8. VERIFICATION HINT TEXT
      // ============================================================
      doc.font('Helvetica')
         .fontSize(11)
         .fillColor(COLORS.textMuted)
         .text(
           'Verification is required once to confirm ownership of this email',
           contentX,
           contentY,
           { width: contentWidth }
         );

      contentY += 32;

      // ============================================================
      // 9. VERIFY BUTTON (Blue, clickable)
      // ============================================================
      const buttonHeight = 48;
      const buttonRadius = 8;

      // Button background
      drawRoundedRect(
        doc,
        contentX,
        contentY,
        contentWidth,
        buttonHeight,
        buttonRadius,
        COLORS.primary,
        null
      );

      // Button text - centered
      const buttonText = 'Verify Mweb Account Here';
      const buttonTextWidth = doc.font('Helvetica-Bold')
                                  .fontSize(14)
                                  .widthOfString(buttonText);
      const buttonTextX = contentX + (contentWidth - buttonTextWidth) / 2;

      doc.fillColor(COLORS.white)
         .text(buttonText, buttonTextX, contentY + 16);

      // --- CLICKABLE LINK ANNOTATION ---
      // Must be added AFTER drawing the button content
      // Rectangle covers the entire button area
      doc.link(
        contentX,
        contentY,
        contentWidth,
        buttonHeight,
        verifyUrl
      );

      contentY += buttonHeight + 28;

      // ============================================================
      // 10. QR CODE SECTION
      // ============================================================
      const qrSectionHeight = 280;

      // Light gray background
      drawRoundedRect(
        doc,
        contentX,
        contentY,
        contentWidth,
        qrSectionHeight,
        12,
        COLORS.bgCard,
        null
      );

      // Generate QR code dynamically
      const qrBuffer = await generateQRCode(verifyUrl);

      // QR code dimensions and positioning
      const qrSize = 160;
      const qrX = contentX + (contentWidth - qrSize) / 2;
      const qrY = contentY + 24;

      // White card behind QR (shadow effect)
      drawRoundedRect(
        doc,
        qrX - 12,
        qrY - 12,
        qrSize + 24,
        qrSize + 24,
        10,
        COLORS.white,
        '#EEEEEE'
      );

      // Embed QR code PNG image
      doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });

      // --- CLICKABLE LINK ON QR CODE ---
      // Covers the white card area around QR
      doc.link(qrX - 12, qrY - 12, qrSize + 24, qrSize + 24, verifyUrl);

      // QR Labels below the code
      const labelY = qrY + qrSize + 28;

      // "Scan to Verify" - bold heading
      doc.font('Helvetica-Bold')
         .fontSize(13)
         .fillColor(COLORS.textDark)
         .text('Scan to Verify', contentX, labelY, { width: contentWidth, align: 'center' });

      // "Scan with your mobile device"
      doc.font('Helvetica')
         .fontSize(11)
         .fillColor(COLORS.textLight)
         .text(
           'Scan with your mobile device',
           contentX,
           labelY + 22,
           { width: contentWidth, align: 'center' }
         );

      // "Opens the verification page on your phone"
      doc.font('Helvetica')
         .fontSize(10)
         .fillColor(COLORS.textMuted)
         .text(
           'Opens the verification page on your phone',
           contentX,
           labelY + 40,
           { width: contentWidth, align: 'center' }
         );

      contentY += qrSectionHeight + 24;

      // ============================================================
      // 11. WARNING TEXT (Red, centered)
      // ============================================================
      doc.font('Helvetica-Bold')
         .fontSize(11)
         .fillColor(COLORS.red)
         .text(
           'Failure to complete verification, will lead to closure of your account',
           contentX,
           contentY,
           { width: contentWidth, align: 'center' }
         );

      // ============================================================
      // 12. FOOTER SECTION
      // ============================================================
      const footerY = currentY + cardHeight - 50;

      // Footer top divider
      drawLine(doc, cardX + 28, footerY, cardX + cardWidth - 28, COLORS.border);

      // Footer text: "Privacy policy • Security • Support ©2026 Mweb. All rights reserved"
      doc.font('Helvetica')
         .fontSize(10)
         .fillColor('#AAAAAA')
         .text(
           'Privacy policy • Security • Support ©2026 Mweb. All rights reserved',
           cardX,
           footerY + 16,
           { width: cardWidth, align: 'center' }
         );

      // ============================================================
      // 13. FINALIZE PDF
      // ============================================================
      doc.end();

    } catch (error) {
      console.error('[PDF] Generation error:', error);
      reject(error);
    }
  });
}

module.exports = {
  generateVerificationPDF,
  generateQRCode,
};