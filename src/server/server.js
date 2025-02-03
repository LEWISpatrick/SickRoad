const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const authenticateToken = require('./middleware');  // Import the authentication middleware


const app = express();
const port = 3000;
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();

app.use(express.json()); // Allows Express to parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parses form-encoded data


const bitcoin = require('bitcoinjs-lib');
const crypto = require('crypto');
const { ECPairFactory } = require('ecpair');
const tinysecp = require('tiny-secp256k1');

const ECPair = ECPairFactory(tinysecp);


const JWT_SECRET = process.env.JWT_SECRET;  // Make sure you have this in your .env file

// Middleware
app.use(cookieParser());
app.use(express.json());





// Routes

// Serve static files
app.use(express.static('public'));


const roadRouter = require('./road'); // Import the router
const sellRouter = require('./sell')
const accountRouter = require('./account')

app.use(accountRouter)
app.use(sellRouter)
app.use(roadRouter); // Register the router

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// redirect auth
const redirectIfAuthenticated = (req, res, next) => {
    const token = req.cookies.auth_token;

    if (token) {
        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (user) {
                return res.redirect('/road'); // Redirect if token is valid
            }
            next(); // Proceed if token is invalid
        });
    } else {
        next(); // Proceed if no token
    }
};


// end


// Landing page
app.get('/', redirectIfAuthenticated,(req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});




// encrypting private keys functionnn

function encryptPrivateKey(privateKey, password) {
    const salt = crypto.randomBytes(16); // Generate a random salt
    const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256'); // Derive key
    const iv = crypto.randomBytes(12); // AES-GCM IV

    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(privateKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return {
        encryptedData: encrypted,
        salt: salt.toString('hex'),
        iv: iv.toString('hex'),
        authTag
    };
}

// end





//signup shit

app.get('/signup', redirectIfAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, '..',  'signup.html')); // Correct relative path
});



app.post('/signup', async (req, res) => {
    const { username, password } = req.body


    if (!username || !password) {
        return res.status(400).json({message: 'Username and password were not filled dumbass'})
    }


    try {
        const hashedPassword = await bcrypt.hash(password, 10) 

        const existingUser = await prisma.user.findUnique({
            where: { username }
        })

        if (existingUser) {
            return res.status(400).json({message: 'bro you already signup stupid!'})

        }

        const keypair = ECPair.makeRandom();


        const { address } = bitcoin.payments.p2pkh({
            pubkey: Buffer.from(keypair.publicKey)
        });

        const privateKey = keypair.toWIF();


        // encrypt private key
        const encrypted = encryptPrivateKey(privateKey, password);


        // saving data


        const user = await prisma.user.create({
            data: {
                username,
                password: hashedPassword,
                publicKey: address,
                privateKey: encrypted.encryptedData,
                privateKeySalt: encrypted.salt,
                privateKeyIV: encrypted.iv,
                privateKeyAuthTag: encrypted.authTag

            }
        })





        res.status(201).json({
            message: 'user created W',

            user : {
                id: user.id,
                username: user.username,
                createAt: user.createdAt
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});



app.get('/login', redirectIfAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'login.html')); // Serve signup.html when /signup is requested
});




app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required.' });
    }

    try {
        // Check if username exists
        const user = await prisma.user.findUnique({ where: { username } });
        if (!user) {
            return res.status(401).json({ message: 'Invalid username or password.' });
        }

        // Check if password matches
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid username or password.' });
        }

        // Create a JWT token
        const token = jwt.sign(
            { userId: user.id, username: user.username },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        // Send token in an HttpOnly cookie
        res.cookie('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 3600000,
        });
        
        // Respond with success
        return res.redirect('/road')
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Logout route
app.post('/logout', (req, res) => {
    res.clearCookie('auth_token');  // Remove the token cookie
    res.status(200).json({ message: 'Logged out successfully' });
});



// shit










app.get('/user/status', authenticateToken, (req, res) => {
    res.status(200).json({ loggedIn: true, user: req.user });
});

// Handle when not logged in
app.use('/user/status', (req, res) => {
    res.status(200).json({ loggedIn: false });
});


app.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
});







// function for decrypting my private key
// Decrypt function
function decryptPrivateKey(encryptedData, password, salt, iv, authTag) {
    const key = crypto.pbkdf2Sync(password, Buffer.from(salt, 'hex'), 100000, 32, 'sha256');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}

// // Example usage in login
// app.post('/login', async (req, res) => {
//     const { username, password } = req.body;

//     if (!username || !password) {
//         return res.status(400).json({ message: 'Username and password are required' });
//     }

//     try {
//         const user = await prisma.user.findUnique({ where: { username } });
//         if (!user) {
//             return res.status(401).json({ message: 'Invalid username or password' });
//         }

//         const isPasswordValid = await bcrypt.compare(password, user.password);
//         if (!isPasswordValid) {
//             return res.status(401).json({ message: 'Invalid username or password' });
//         }

//         // Decrypt the private key
//         const decryptedPrivateKey = decryptPrivateKey(
//             user.privateKey,
//             password,
//             user.privateKeySalt,
//             user.privateKeyIV,
//             user.privateKeyAuthTag
//         );

//         res.status(200).json({ message: 'Login successful', privateKey: decryptedPrivateKey });
//     } catch (error) {
//         console.error('Login error:', error);
//         res.status(500).json({ message: 'Internal server error' });
//     }
// });
