/**
 * mwebAccount Verification PDF Generator
 * Generates professional verification PDFs in memory using PDFKit
 * No files are saved to disk - everything is streamed directly
 *
 * Card height is computed from actual content instead of a fixed
 * page-height guess — this is what guarantees the document always
 * renders on a single A4 page regardless of email length, etc.
 */

const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

/**
 * Color palette matching mwebbrand exactly (unchanged)
 */
const COLORS = {
  primary: '#0066CC',
  primaryDark: '#004499',
  textDark: '#1A1A1A',
  textMedium: '#444444',
  textLight: '#666666',
  textMuted: '#888888',
  border: '#E8E8E8',
  bgLight: '#F8F9FA',
  bgCard: '#FAFAFA',
  white: '#FFFFFF',
  red: '#C53030',
};

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16) / 255,
    parseInt(result[2], 16) / 255,
    parseInt(result[3], 16) / 255,
  ] : [0, 0, 0];
}

async function generateQRCode(url) {
  try {
    return await QRCode.toBuffer(url, {
      width: 300,
      margin: 2,
      color: { dark: '#000000', light: '#FFFFFF' },
      type: 'png',
    });
  } catch (error) {
    console.error('[QR] Generation failed:', error);
    throw new Error('Failed to generate QR code');
  }
}

/** Fully rounded rectangle (all four corners) */
function drawRoundedRect(doc, x, y, width, height, radius, fillColor = null, strokeColor = null, lineWidth = 1) {
  doc.save();
  if (fillColor) doc.fillColor(fillColor);
  if (strokeColor) doc.strokeColor(strokeColor).lineWidth(lineWidth);
  doc.roundedRect(x, y, width, height, radius);
  if (fillColor && strokeColor) doc.fillAndStroke();
  else if (fillColor) doc.fill();
  else if (strokeColor) doc.stroke();
  doc.restore();
}

/** Rectangle rounded on the TOP two corners only, square bottom —
 *  used for the header bar sitting flush against the card body below it. */
function drawTopRoundedRect(doc, x, y, width, height, radius, fillColor) {
  doc.save();
  doc.moveTo(x, y + height);
  doc.lineTo(x, y + radius);
  doc.quadraticCurveTo(x, y, x + radius, y);
  doc.lineTo(x + width - radius, y);
  doc.quadraticCurveTo(x + width, y, x + width, y + radius);
  doc.lineTo(x + width, y + height);
  doc.closePath();
  doc.fillColor(fillColor).fill();
  doc.restore();
}       

function drawLine(doc, x1, y, x2, color, lineWidth = 1) {
  doc.save();
  doc.moveTo(x1, y).lineTo(x2, y).strokeColor(color).lineWidth(lineWidth).stroke();
  doc.restore();
}

function drawDashedLine(doc, x1, y, x2, color) {
  doc.save();
  doc.dash(2, { space: 2 });
  doc.moveTo(x1, y).lineTo(x2, y).strokeColor(color).lineWidth(1).stroke();
  doc.undash();
  doc.restore();
}

/** Small rounded "pill" badge, sized to fit its text */
function drawPill(doc, x, y, text, fontSize, textColor, bgColor) {
  doc.font('Helvetica-Bold').fontSize(fontSize);
  const textWidth = doc.widthOfString(text);
  const padX = 10;
  const height = fontSize + 10;
  const width = textWidth + padX * 2;
  drawRoundedRect(doc, x, y, width, height, height / 2, bgColor, null);
  doc.fillColor(textColor).text(text, x + padX, y + (height - fontSize) / 2 - 1);
  return { width, height };
}

async function generateVerificationPDF(email, verifyUrl) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true });
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      const pageWidth = doc.page.width;
      const cardWidth = 185 * 2.83465; // ~524pt, same as before
      const cardX = (pageWidth - cardWidth) / 2;
      const cardY = 36;
      const padX = 28;
      const contentX = cardX + padX;
      const contentWidth = cardWidth - padX * 2;

      // ============================================================
      // FIXED SECTION HEIGHTS — these constants are used BOTH to
      // compute the card's total height up front AND as the actual
      // drawing increments below, so the two can never drift apart.
      // ============================================================
      const HEADER_H = 50;
      const TOP_PAD = 26;
      const TITLE_H = 28;
      const GAP_1 = 10;
      const SUBTITLE_H = 16;
      const GAP_2 = 14;
      const PARA_H = 15;
      const GAP_3 = 18;
      const DETAILS_BOX_H = 128;
      const GAP_4 = 20;
      const BUTTON_H = 48;
      const GAP_5 = 18;
      const QR_TOP_PAD = 16;
      const QR_SIZE = 138;
      const QR_LABEL_GAP = 16;
      const QR_LABEL_BLOCK_H = 48; // heading + 2 supporting lines
      const QR_BOTTOM_PAD = 16;
      const QR_SECTION_H = QR_TOP_PAD + QR_SIZE + QR_LABEL_GAP + QR_LABEL_BLOCK_H + QR_BOTTOM_PAD;
      const GAP_6 = 18;
      const WARNING_H = 36;
      const GAP_7 = 20;
      const FOOTER_H = 48;
      const BOTTOM_PAD = 22;

      const cardHeight =
        HEADER_H + TOP_PAD +
        TITLE_H + GAP_1 +
        SUBTITLE_H + GAP_2 +
        PARA_H + GAP_3 +
        DETAILS_BOX_H + GAP_4 +
        BUTTON_H + GAP_5 +
        QR_SECTION_H + GAP_6 +
        WARNING_H + GAP_7 +
        FOOTER_H + BOTTOM_PAD;

      // ============================================================
      // CARD SHELL
      // ============================================================
      drawRoundedRect(doc, cardX, cardY, cardWidth, cardHeight, 14, COLORS.white, COLORS.border);
      drawTopRoundedRect(doc, cardX, cardY, cardWidth, HEADER_H, 14, COLORS.primary);

      // Header text — white, on the solid primary bar
      const headerTextY = cardY + (HEADER_H - 15) / 2 - 1;
      doc.font('Helvetica-Bold').fontSize(15).fillColor(COLORS.white).text('Mweb', contentX, headerTextY);
      const mwebWidth = doc.widthOfString('Mweb');
      doc.font('Helvetica-Bold').fontSize(15).text(' ·Account Verification', contentX + mwebWidth, headerTextY);

      let y = cardY + HEADER_H + TOP_PAD;

      // ============================================================
      // TITLE
      // ============================================================
      doc.font('Helvetica-Bold').fontSize(22).fillColor(COLORS.textDark).text('Verify your account', contentX, y);
      y += TITLE_H + GAP_1;

      // ============================================================
      // SUBTITLE — thin left accent bar + text, blockquote-style
      // ============================================================
      doc.save();
      doc.roundedRect(contentX, y + 1, 2.5, SUBTITLE_H - 2, 1.25).fillColor(COLORS.primary).fill();
      doc.restore();
      doc.font('Helvetica').fontSize(11).fillColor(COLORS.textMedium)
        .text('Complete your email verification to access your account', contentX + 12, y + 1);
      y += SUBTITLE_H + GAP_2;

      // ============================================================
      // PARAGRAPH
      // ============================================================
      doc.font('Helvetica').fontSize(11).fillColor(COLORS.textLight)
        .text('Please complete the verification to continue using your account.', contentX, y, {
          width: contentWidth,
        });
      y += PARA_H + GAP_3;

      // ============================================================
      // ACCOUNT DETAILS BOX
      // ============================================================
      const boxY = y;
      drawRoundedRect(doc, contentX, boxY, contentWidth, DETAILS_BOX_H, 10, COLORS.bgLight, null);

      const boxPad = 16;
      let by = boxY + 14;

      drawPill(doc, contentX + boxPad, by, 'ACCOUNT DETAILS', 8.5, COLORS.textMedium, '#EDEFF1');
      by += 28;

      // Inline "Email Address: value"
      doc.font('Helvetica').fontSize(10.5).fillColor(COLORS.textLight).text('Email Address: ', contentX + boxPad, by);
      const labelWidth = doc.widthOfString('Email Address: ');
      doc.font('Helvetica-Bold').fontSize(11.5).fillColor(COLORS.textDark)
        .text(email, contentX + boxPad + labelWidth, by - 1);
      by += 22;

      drawDashedLine(doc, contentX + boxPad, by, contentX + contentWidth - boxPad, COLORS.border);
      by += 12;

      // Nested verification-note strip
      const noteText = 'Verification is required once to confirm ownership of this email address.';
      const noteBoxH = 30;
      drawRoundedRect(doc, contentX + boxPad, by, contentWidth - boxPad * 2, noteBoxH, 6, COLORS.white, COLORS.border);
      doc.save();
      doc.roundedRect(contentX + boxPad, by + 5, 2.5, noteBoxH - 10, 1.25).fillColor(COLORS.textMuted).fill();
      doc.restore();
      doc.font('Helvetica').fontSize(9.5).fillColor(COLORS.textLight)
        .text(noteText, contentX + boxPad + 14, by + (noteBoxH - 12) / 2, {
          width: contentWidth - boxPad * 2 - 24,
        });

      y = boxY + DETAILS_BOX_H + GAP_4;

      // ============================================================
      // VERIFY BUTTON
      // ============================================================
      drawRoundedRect(doc, contentX, y, contentWidth, BUTTON_H, 8, COLORS.primary, null);
      const buttonText = 'Verify mweb Account Here';
      doc.font('Helvetica-Bold').fontSize(13);
      const buttonTextWidth = doc.widthOfString(buttonText);
      doc.fillColor(COLORS.white).text(
        buttonText,
        contentX + (contentWidth - buttonTextWidth) / 2,
        y + (BUTTON_H - 13) / 2 - 1
      );
      doc.link(contentX, y, contentWidth, BUTTON_H, verifyUrl);
      y += BUTTON_H + GAP_5;

      // ============================================================
      // QR SECTION
      // ============================================================
      const qrSectionY = y;
      drawRoundedRect(doc, contentX, qrSectionY, contentWidth, QR_SECTION_H, 10, COLORS.bgCard, null);

      doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.textDark)
        .text('Scan to Verify', contentX, qrSectionY + 14, { width: contentWidth, align: 'center' });

      const qrBuffer = await generateQRCode(verifyUrl);
      const qrX = contentX + (contentWidth - QR_SIZE) / 2;
      const qrY = qrSectionY + QR_TOP_PAD + 14;

      drawRoundedRect(doc, qrX - 10, qrY - 10, QR_SIZE + 20, QR_SIZE + 20, 8, COLORS.white, '#EEEEEE');
      doc.image(qrBuffer, qrX, qrY, { width: QR_SIZE, height: QR_SIZE });
      doc.link(qrX - 10, qrY - 10, QR_SIZE + 20, QR_SIZE + 20, verifyUrl);

      const labelY = qrY + QR_SIZE + QR_LABEL_GAP;
      doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.textDark)
        .text('Scan with your mobile device', contentX, labelY, { width: contentWidth, align: 'center' });
      doc.font('Helvetica').fontSize(9.5).fillColor(COLORS.textMuted)
        .text('Opens the verification page on your phone', contentX, labelY + 16, {
          width: contentWidth,
          align: 'center',
        });

      y = qrSectionY + QR_SECTION_H + GAP_6;

      // ============================================================
      // WARNING BOX
      // ============================================================
      drawRoundedRect(doc, contentX, y, contentWidth, WARNING_H, 8, COLORS.bgLight, null);
      doc.font('Helvetica-Bold').fontSize(10.5).fillColor(COLORS.red)
        .text('Failure to complete verification will lead to closure of your account.', contentX + 16, y + 12, {
          width: contentWidth - 32,
          align: 'center',
        });
      y += WARNING_H + GAP_7;

      // ============================================================
      // FOOTER
      // ============================================================
      drawLine(doc, contentX, y, contentX + contentWidth, COLORS.border);
      doc.font('Helvetica').fontSize(9.5).fillColor(COLORS.textMuted)
        .text('Privacy policy   •   Security   •   Support', contentX, y + 14, {
          width: contentWidth,
          align: 'center',
        });
      doc.font('Helvetica').fontSize(9).fillColor(COLORS.textMuted)
        .text('© 2026 mweb. All rights reserved.', contentX, y + 30, {
          width: contentWidth,
          align: 'center',
        });

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
