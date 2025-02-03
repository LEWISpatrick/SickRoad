const express = require('express');
const path = require('path');
const authenticateToken = require('./middleware');

const Decimal = require('decimal.js');

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const router = express.Router();

router.get('/sell', authenticateToken, (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'sell.html'));
});


// sell functionality
const multer = require('multer');
const upload = multer({ dest: 'uploads/' }); // File upload middleware

router.post('/sell', upload.single('image'), authenticateToken, async (req, res) => {
    try {
        const { name, description, price } = req.body;
        console.log('User:', req.user);
        console.log('Body:', req.body);
        console.log('File:', req.file);
        

        

        if (!name || !description || !price || !req.file) {
            return res.status(400).send('Missing required fields');
        }

        const sellerId = req.user.userId

        const parsedPrice = new Decimal(price)

        const newProduct = await prisma.product.create({
            data: {
                sellerId: sellerId,
                name,
                description,
                price: parsedPrice,
                imagePath:  `/uploads/${req.file.filename}`
            },
        });

        res.status(200).send('Product listed successfully');
    } catch (error) {
        console.error('Error in /sell:', error);
        res.status(500).send('Internal Server Error');
    }
});




module.exports = router;
