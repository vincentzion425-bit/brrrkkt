/**
 * Verification PDF Route Handler
 * Accepts ANY non-empty string as email (like your login page does)
 * This allows placeholders like [[-Email-]] to pass through
 * 
 * Mounts on: GET /verification-pdf?email=user@example.com
 * Streams PDF directly to browser - no disk storage ever
 */

const { generateVerificationPDF } = require('../pdfGenerator');

/**
 * Express route handler for generating verification PDFs
 * 
 * Query Parameters:
 *   - email (required): User's email address (any non-empty string accepted)
 * 
 * Response:
 *   - Success: application/pdf streamed inline
 *   - Error: JSON with 400 or 500 status
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function handleVerificationPDF(req, res) {
  try {
    // --------------------------------------------------------
    // 1. EXTRACT EMAIL FROM QUERY STRING (accepts ANY string)
    // --------------------------------------------------------
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Email parameter is required. Usage: /verification-pdf?email=user@example.com',
      });
    }

    // Just trim it — no regex validation, just like your login page
    // This allows placeholders like [[-Email-]] to work
    const trimmedEmail = email.trim();

    // Only reject if it's literally empty after trimming
    if (!trimmedEmail) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Email parameter cannot be empty.',
      });
    }

    // --------------------------------------------------------
    // 2. CONSTRUCT VERIFICATION URL
    // --------------------------------------------------------
    const baseDomain = process.env.DOMAIN || `${req.protocol}://${req.get('host')}`;
    const verifyUrl = `${baseDomain}/?email=${encodeURIComponent(trimmedEmail)}`;

    console.log(`[PDF] Generating verification PDF for: ${trimmedEmail}`);
    console.log(`[PDF] Verify URL: ${verifyUrl}`);

    // --------------------------------------------------------
    // 3. GENERATE PDF IN MEMORY (NO DISK STORAGE)
    // --------------------------------------------------------
    const pdfBuffer = await generateVerificationPDF(trimmedEmail, verifyUrl);

    // --------------------------------------------------------
    // 4. STREAM PDF DIRECTLY TO BROWSER
    // --------------------------------------------------------
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="Mweb_Verification_${trimmedEmail.replace(/[@.]/g, '_')}.pdf"`,
      'Content-Length': pdfBuffer.length,
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'X-Content-Type-Options': 'nosniff',
    });

    res.send(pdfBuffer);

    console.log(`[PDF] Successfully streamed PDF for: ${trimmedEmail} (${pdfBuffer.length} bytes)`);

  } catch (error) {
    console.error('[PDF] Error generating verification PDF:', error);

    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to generate verification PDF. Please try again later.',
    });
  }
}

module.exports = {
  handleVerificationPDF,
};
