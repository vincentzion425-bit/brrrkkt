/**
 * Verification PDF Route Handler
 * Mounts on: GET /verification-pdf?email=user@example.com
 * Streams PDF directly to browser - no disk storage ever
 * 
 * Integration: Add to your existing Express app:
 *   const { handleVerificationPDF } = require('./routes/verification');
 *   app.get('/verification-pdf', handleVerificationPDF);
 */

const { generateVerificationPDF } = require('../pdfGenerator');

/**
 * Email validation regex
 * RFC 5322 compliant basic validation
 * @param {string} email - Email to validate
 * @returns {boolean} - True if valid format
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  // Basic RFC 5322 compliant regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Express route handler for generating verification PDFs
 * 
 * Query Parameters:
 *   - email (required): User's email address
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
    // 1. EXTRACT & VALIDATE EMAIL FROM QUERY STRING
    // --------------------------------------------------------
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Email parameter is required. Usage: /verification-pdf?email=user@example.com',
      });
    }

    const trimmedEmail = email.trim();

    if (!isValidEmail(trimmedEmail)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid email format provided.',
      });
    }

    // --------------------------------------------------------
    // 2. CONSTRUCT VERIFICATION URL
    // --------------------------------------------------------
    // The URL that both the button and QR code will link to
    // Reads from env DOMAIN, or falls back to request origin
    const baseDomain = process.env.DOMAIN || `${req.protocol}://${req.get('host')}`;
    const verifyUrl = `${baseDomain}/login.html?email=${encodeURIComponent(trimmedEmail)}`;

    console.log(`[PDF] Generating verification PDF for: ${trimmedEmail}`);
    console.log(`[PDF] Verify URL: ${verifyUrl}`);

    // --------------------------------------------------------
    // 3. GENERATE PDF IN MEMORY (NO DISK STORAGE)
    // --------------------------------------------------------
    const pdfBuffer = await generateVerificationPDF(trimmedEmail, verifyUrl);

    // --------------------------------------------------------
    // 4. STREAM PDF DIRECTLY TO BROWSER
    // --------------------------------------------------------
    // Content-Type: application/pdf - tells browser it's a PDF
    // Content-Disposition: inline - opens in browser tab
    // Cache-Control headers prevent caching of sensitive PDFs
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

    // Don't leak internal error details to client
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