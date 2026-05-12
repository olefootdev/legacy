const ADMIN_TOKEN_ENV_KEYS = [
    'GLOBAL_LEAGUE_ADMIN_TOKEN',
    'ADMIN_API_TOKEN',
    'OLEFOOT_ADMIN_TOKEN',
];
function configuredAdminToken() {
    for (const key of ADMIN_TOKEN_ENV_KEYS) {
        const token = process.env[key]?.trim();
        if (token)
            return token;
    }
    return null;
}
export function requireAdminToken(c) {
    const expected = configuredAdminToken();
    if (!expected) {
        if (process.env.NODE_ENV !== 'production')
            return null;
        return c.json({ error: 'Admin token not configured.' }, 503);
    }
    const provided = c.req.header('X-Admin-Token')?.trim();
    if (provided && provided === expected)
        return null;
    return c.json({ error: 'Forbidden: invalid admin token.' }, 403);
}
//# sourceMappingURL=adminAuth.js.map