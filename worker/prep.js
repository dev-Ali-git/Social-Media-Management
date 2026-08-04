const fs = require('fs');
const data = JSON.parse(fs.readFileSync('tiktok_cookies.json', 'utf8'));
const account = data[0];
const formattedCookies = account.session_cookies.map(cookie => {
    let sameSite = 'Lax';
    if (typeof cookie.sameSite === 'string') {
        const s = cookie.sameSite.toLowerCase();
        if (s === 'no_restriction' || s === 'none') sameSite = 'None';
        else if (s === 'lax') sameSite = 'Lax';
        else if (s === 'strict') sameSite = 'Strict';
    }
    return {
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path,
        expires: typeof cookie.expirationDate === 'number' ? cookie.expirationDate : (typeof cookie.expires === 'number' ? cookie.expires : -1),
        httpOnly: cookie.httpOnly || false,
        secure: cookie.secure || false,
        sameSite: sameSite
    };
});
const stateObj = { cookies: formattedCookies, origins: [] };
fs.writeFileSync('state_tiktok.json', JSON.stringify(stateObj, null, 2));
console.log('Saved state_tiktok.json');
