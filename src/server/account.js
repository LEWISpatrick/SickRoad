const express = require('express');
const path = require('path');
const authenticateToken = require('./middleware');
const router = express.Router();

const axios = require('axios'); 
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

router.get('/account', authenticateToken, (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'account.html'));
});


const BLOCKCHAIN_API_URL = 'https://blockchain.info/rawaddr';  // Blockchain info API to get BTC balance
const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd'; // CoinGecko API for BTC to USD rate




// Fetch user's BTC balance and USD equivalent
router.get('/btc-user-info', authenticateToken, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.userId },
            select: { id: true, username: true, createdAt: true, publicKey: true },
        });

        if (!user) {
            return res.status(404).send('<p>User not found.</p>');
        }

        // Fetch Bitcoin balance for user's wallet address
        const btcBalanceResponse = await axios.get(`${BLOCKCHAIN_API_URL}/${user.publicKey}`);
        const btcBalance = btcBalanceResponse.data.final_balance 

        // Fetch BTC to USD conversion rate
        const btcToUsdcResponse = await axios.get(COINGECKO_API_URL);
        const btcToUsd = btcToUsdcResponse.data.bitcoin.usd;
        const usdcBalance = btcBalance * btcToUsd;

        res.json({
            loggedIn: true,
            btcBalance,
            usdBalance: usdcBalance
        });
    } catch (error) {
        console.error('Error fetching user info:', error);
        res.status(500).send('<p>Error loading user information.</p>');
    }
});





// Serve user information
router.get('/user-info', authenticateToken, async (req, res) => {


    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.userId },
            select: { id: true, username: true, createdAt: true, publicKey: true },
        });

        if (!user) {
            return res.status(404).send('<p>User not found.</p>');
        }


        // Fetch Bitcoin balance for user's wallet address
        const btcBalanceResponse = await axios.get(`${BLOCKCHAIN_API_URL}/${user.publicKey}`);
        const btcBalance = btcBalanceResponse.data.final_balance / 100000000; // Convert satoshis to BTC

        // Fetch BTC to USDC conversion rate
        const btcToUsdcResponse = await axios.get(COINGECKO_API_URL);
        const btcToUsd = btcToUsdcResponse.data.bitcoin.usd;
        const usdcBalance = btcBalance * btcToUsd;



        res.send(`
            <p><strong>Username:</strong> ${user.username}</p>
            <p><strong>Account Created:</strong> ${new Date(user.createdAt).toLocaleDateString()}</p>
            <p><strong>Bitcoin Address:</strong> <a href="https://www.blockchain.com/btc/address/${user.publicKey}" target="_blank">${user.publicKey}</a></p>
            <p><strong>BTC Balance:</strong> ${btcBalance} BTC</p>
            <p><strong>Balance in USDC:</strong> $${usdcBalance.toFixed(2)}</p>

        `);
    } catch (error) {
        console.error('Error fetching user info:', error);
        res.status(500).send('<p>Error loading user information.</p>');
    }
});

// Serve user products
router.get('/user-products', authenticateToken, async (req, res) => {
    try {
        const products = await prisma.product.findMany({
            where: { sellerId: req.user.userId },
            orderBy: { createdAt: 'desc' },
        });

        if (products.length === 0) {
            return res.send('<p>No products listed yet.</p>');
        }

        const html = products.map(product => `
               <div class="bg-gray-100 p-4 rounded shadow mb-4">
        <img src="/${product.imagePath}" alt="${product.name}" class="w-full h-48 object-cover rounded mb-4">
        <h3 class="font-bold">${product.name}</h3>
        <p>${product.description}</p>
        <p class="text-orange-400 font-semibold">$${product.price} &#x20bf;</p>
        <button 
            hx-delete="/product/${product.id}" 
            hx-target="#user-products" 
            hx-swap="outerHTML" 
            class="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 mt-4"
        >
            Delete Product
        </button>
    </div>
        `).join('');

        res.send(html);
    } catch (error) {
        console.error('Error fetching user products:', error);
        res.status(500).send('<p>Error loading your products.</p>');
    }
});
router.get('/user-transactions', authenticateToken, async (req, res) => {
    try {
        const transactions = await prisma.transaction.findMany({
            where: { buyerId: req.user.userId },
            select: {
                id: true,
                escrowAddress: true,
                releaseConfirmed: true,
                status: true,
                createdAt: true,
                product: {
                    select: {
                        name: true,
                        description: true,
                        price: true
                    }
                }
            }        });

        if (transactions.length === 0) {
            return res.send('<p>No transactions found.</p>');
        }

        const html = transactions.map(transaction => `
            <div class="bg-gray-100 p-4 rounded shadow mb-4">
                <h3 class="font-bold">${transaction.Product.name}</h3>
                <p>${transaction.Product.description}</p>
                <p class="text-blue-500 font-semibold">$${transaction.Product.price}</p>
                <p><strong>Status:</strong> ${transaction.status}</p>
                <p><strong>Date:</strong> ${new Date(transaction.createdAt).toLocaleDateString()}</p>
            </div>
        `).join('');

        res.send(html);
    } catch (error) {
        console.error('Error fetching user transactions:', error);
        res.status(500).send('<p>Error loading your transactions.</p>');
    }
});


// DELETE product route
router.delete('/product/:id', authenticateToken, async (req, res) => {
    const productId = parseInt(req.params.id);
    
    if (isNaN(productId)) {
        return res.status(400).send('Invalid product ID');
    }

    try {
        const product = await prisma.product.findUnique({
            where: { id: productId },
        });

        if (!product) {
            return res.status(404).send('Product not found');
        }

        // Ensure the user is the seller of the product
        if (product.sellerId !== req.user.userId) {
            return res.status(403).send('Unauthorized');
        }

        await prisma.product.delete({
            where: { id: productId },
        });

        res.status(200).send('Product deleted successfully');
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).send('Internal Server Error');
    }
});



router.get('/logout', (req, res) => {
    res.clearCookie('auth_token', { httpOnly: true, secure: true });
    res.redirect('/');  // Redirect to login page
});



module.exports = router;
