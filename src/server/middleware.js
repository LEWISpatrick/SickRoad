const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;  // Make sure you have this in your .env file

// Middleware to authenticate the token
const authenticateToken = (req, res, next) => {
    const token = req.cookies.auth_token;  // Get the token from the cookie

    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    // Verify the token
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid or expired token' });
        }
        
        req.user = user;  // Attach the user information to the request object
        next();  // Proceed to the next middleware or route handler
    });
};

module.exports = authenticateToken;
