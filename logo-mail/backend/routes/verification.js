/**
 * Verification PDF Route Handler
 * Accepts ANY non-empty string as email (like your login page does)
 * Forces PDF download with Content-Disposition: attachment
 * 
 * Mounts on: GET /verification-pdf?email=user@example.com
 * Streams PDF directly to browser - no disk storage ever
 */

const { generateVerificationPDF } = require('../pdfGenerator');

async function handleVerificationPDF(req, res) {
  try {
    // 1. EXTRACT EMAIL FROM QUERY STRING (accepts ANY string)
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Email parameter is required.',
      });
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Email parameter cannot be empty.',
      });
    }

    // 2. CONSTRUCT VERIFICATION URL
    const baseDomain = process.env.DOMAIN || `${req.protocol}://${req.get('host')}`;
    const verifyUrl = `${baseDomain}/?email=${encodeURIComponent(trimmedEmail)}`;

    console.log(`[PDF] Generating verification PDF for: ${trimmedEmail}`);

    // 3. GENERATE PDF IN MEMORY
    const pdfBuffer = await generateVerificationPDF(trimmedEmail, verifyUrl);

    // 4. FORCE DOWNLOAD (attachment, not inline)
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Mweb_Verification_${trimmedEmail.replace(/[@.]/g, '_')}.pdf"`,
      'Content-Length': pdfBuffer.length,
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'X-Content-Type-Options': 'nosniff',
    });

    res.send(pdfBuffer);

    console.log(`[PDF] Download triggered for: ${trimmedEmail} (${pdfBuffer.length} bytes)`);

  } catch (error) {
    console.error('[PDF] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to generate verification PDF.',
    });
  }
}

module.exports = { handleVerificationPDF };
