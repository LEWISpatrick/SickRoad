const express = require('express');
const path = require('path');
const authenticateToken = require('./middleware');
const Decimal = require('decimal.js')

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const router = express.Router();
const { sendBTCFromEscrow } = require('./escrow');  // Adjust the path accordingly

const CryptoConvert = require('crypto-convert')


const crypto = require('crypto');


// Convert BTC to satoshis
function btcToSatoshis(btcAmount) {
    return Math.round(btcAmount * 100000000);
}

// Convert satoshis to BTC
function satoshisToBtc(satoshisAmount) {
    return satoshisAmount / 100000000;
}
const convert = new CryptoConvert()

async function cryptoConvert(BitcoinAmount) {
    await convert.ready()

    const btc = convert.BTC.USD(BitcoinAmount); 

    return btc
}
function decryptPrivateKey(encryptedData, password, salt, iv, authTag) {
    console.log("Decrypting with:", { encryptedData, password, salt, iv, authTag });

    const key = crypto.pbkdf2Sync(password, Buffer.from(salt, 'hex'), 100000, 32, 'sha256');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let decrypted = decipher.update(Buffer.from(encryptedData, 'hex'));
    decrypted += decipher.final();

    console.log("Decrypted Key:", decrypted);
    return decrypted;
}




// Serve main road page
router.get('/road', authenticateToken, (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'road.html'));
});


router.get('/road/featured', async (req, res) => {
    try {
        const featuredProducts = await prisma.product.findMany({
            take: 3,
            orderBy: { createdAt: 'desc' },
        });

        // Render only featured products as HTML
        const html = featuredProducts.map(product => {
            const priceInSatoshis = btcToSatoshis(product.price);
            const priceInBTC = satoshisToBtc(priceInSatoshis);
            return `
            <div class="flex flex-col md:flex-row border border-gray-300 rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 ease-in-out p-8 gap-8 w-full pb-20">
                <a href="/road/${product.sellerId}/${product.id}" class="flex flex-col justify-between space-y-8">
                    <h3 class="text-3xl font-bold text-gray-900">${product.name}</h3>
                    <p class="text-gray-700 text-lg leading-relaxed">${product.description}</p>
                    <p class="text-orange-500 font-extrabold text-4xl">${priceInBTC} BTC</p>
                </a>
            </div>
            `;
        }).join('');

        res.send(html);
    } catch (error) {
        console.error('Error fetching featured listings:', error);
        res.status(500).send('Error loading featured listings');
    }
});




router.get('/road/:username/:itemId', authenticateToken, async (req, res) => {
    const { username, itemId } = req.params;

    console.log("Raw itemId:", itemId);

    if (!itemId || isNaN(parseInt(itemId))) {
        console.error("itemId is missing or invalid");
        return res.status(400).send("Invalid product ID");
    }

    const productIds = parseInt(itemId);
    console.log("Parsed productId:", productIds);

    try {
        const product = await prisma.product.findUnique({
            where: { id: productIds }, // parseInt makes string into Int
            include: {
                seller: { // Include seller information for product
                    select: {
                        username: true,
                        publicKey: true,
                    },
                },
            },
        });

        if (!product) {
            return res.status(404).send('Item not found');
        }

        const statoshiPrice = btcToSatoshis(product.price)

       let FiatPrice = await cryptoConvert(product.price)

       FiatPrice = Math.round(FiatPrice)


        // Render the product details partial HTML with dynamic content
        const html = `

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SickRoad - Account</title>
    <!-- HTMX for dynamic content loading -->
    <script src="https://unpkg.com/htmx.org@1.9.6"></script>
    <!-- Tailwind CSS for styling -->
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100 text-gray-800">
    <!-- Header -->
    <header class="bg-gray-800 text-white p-4">
        <div class="container mx-auto flex justify-between items-center">
            <h1 class="text-2xl font-bold">SickRoad</h1>
            <nav>
                <ul class="flex space-x-4">
                    <li><a href="/road" class="hover:text-gray-300">Home</a></li>
                    <li><a href="/sell" class="hover:text-gray-300">Sell</a></li>
                    <li><a href="/account" class="hover:text-gray-300">Account</a></li>
                </ul>
            </nav>
        </div>
    </header>

    <!-- Product Details -->
<div id="product-details" class="bg-white p-6 rounded-lg shadow-md flex items-start gap-56">
    <!-- Product Image on the Left -->
    <img src="${product.imageUrl}" alt="${product.name}" class="w-48 h-48 object-cover rounded-lg">

    <!-- Product Info on the Right -->
    <div class="flex flex-col">
        <h2 class="text-3xl font-bold mb-4">${product.name}</h2>
        <p class="text-gray-700 mb-4">${product.description}</p>
        <p class="text-orange-500 font-bold text-2xl mb-4">$${product.price} &#x20bf; or ${statoshiPrice} SAT</p>
        <p class="text-green-600 mb-4">Fiat price $${FiatPrice} USD</p>

        <p class="text-gray-700 mb-2">
            <strong>Seller:</strong> ${product.seller.username}
        </p>
        
        <p class="text-gray-700 mb-6">
            <strong>Public Key:</strong> 
            <a href="https://www.blockchain.com/btc/address/${product.seller.publicKey}" 
               target="_blank">${product.seller.publicKey}</a>
        </p>

       <div class="flex items-center space-x-2">
            <input 
                type="password" 
                name="password"
                id="password-input"
                placeholder="Enter Password"
                class="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
            
                <button 
            hx-post="/road/buy/${product.id}"
            hx-target="#product-details"
            hx-include="#password-input"
            hx-swap="outerHTML"
            class="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600">
            Buy
        </button>
        </div>
    </div>
</div>

</body>
</html>



        `;

        res.send(html);
    } catch (error) {
        console.error('Error fetching product details:', error);
        res.status(500).send('Error loading item details');
    }
});



router.post('/road/buy/:productId', authenticateToken, async (req, res) => {


    

    const productId = parseInt(req.params.productId);
    const buyerId = req.user.userId;




    const password = req.body.password

    

    console.log(password)

    if (!password) {
        return res.status(400).send('Password is required to proceed with purchase');
    }


    try {
        console.log(`Starting purchase for productId: ${productId} by buyerId: ${buyerId}`);

        const product = await prisma.product.findUnique({
            where: { id: productId },
            include: { seller: true },
        });

        if (!product) {
            console.error('Product not found');
            return res.status(404).send('Product not found');
        }

        console.log(`Product found: ${product.name}, Price: $${product.price}`);


            
        const user = await prisma.user.findUnique({ where: { id: buyerId } });  // Fetch user details


        try {

            console.log(user)

            privateKeyWIF = decryptPrivateKey(
                user.privateKey,
                password,
                user.privateKeySalt,
                user.privateKeyIV,
                user.privateKeyAuthTag
            );
        console.log('Private key successfully decrypted. Proceeding with transaction.', privateKeyWIF);
    } catch (error) {
        console.error('Invalid password, decryption failed');
        return res.status(401).send('Invalid password. Cannot proceed with purchase.');
    }

        const priceInSatoshis = btcToSatoshis(product.price);
        const platformFeeInSatoshis = priceInSatoshis * 0.10; // Example 10% fee
        const sellerAmountInSatoshis = priceInSatoshis - platformFeeInSatoshis;

        console.log(`Platform Fee: ${platformFeeInSatoshis} satoshis, Seller Amount: ${sellerAmountInSatoshis} satoshis`);

        // Create an escrow transaction with satoshi values
        const escrow = await prisma.escrow.create({
            data: {
                buyerId,
                sellerId: product.sellerId,
                productId,
                amount: sellerAmountInSatoshis,
                status: "pending",
            }
        });

        console.log(`Escrow created for productId: ${productId}, escrowId: ${escrow.id}`);

        // Now trigger the Bitcoin transfer to the escrow account
        const platformPublicKey = "bc1q6vvslrtr2vjepeg552qvfep0ktall5tsdw3gh0";  // Replace with the actual platform public key
    
        // Pass the user object to the escrow function
        const transferResult = await sendBTCFromEscrow(user, escrow, platformPublicKey, privateKeyWIF);

        if (transferResult.success) {
            return res.send(`Funds held in escrow for ${product.name}. Awaiting seller confirmation.`);
        } else {
            return res.status(500).send(`Error sending BTC to escrow: ${transferResult.error}`);
        }
    } catch (error) {
        console.error('Error during purchase:', error);
        res.status(500).send('Error processing purchase');
    }
});



router.post('/escrow/ship/:escrowId', authenticateToken, async (req, res) => {
    const escrowId = parseInt(req.params.escrowId);
    const sellerId = req.user.userId;

    try {
        const escrow = await prisma.escrow.findUnique({
            where: { id: escrowId }
        });

        if (!escrow || escrow.sellerId !== sellerId) {
            return res.status(403).send('Unauthorized');
        }

        await prisma.escrow.update({
            where: { id: escrowId },
            data: { status: "shipped" }
        });

        res.send("Marked as shipped. Buyer will confirm receipt.");
    } catch (error) {
        console.error(error);
        res.status(500).send("Error updating shipment status");
    }
});



router.post('/escrow/release/:escrowId', authenticateToken, async (req, res) => {
    const escrowId = parseInt(req.params.escrowId);
    const buyerId = req.user.userId;

    try {
        const escrow = await prisma.escrow.findUnique({ where: { id: escrowId } });

        if (!escrow || escrow.buyerId !== buyerId || escrow.status !== "shipped") {
            return res.status(403).send('Unauthorized');
        }

        // Update status to released
        await prisma.escrow.update({
            where: { id: escrowId },
            data: { status: "released" }
        });

        res.send("Funds released to the seller.");
    } catch (error) {
        console.error(error);
        res.status(500).send("Error releasing funds.");
    }
});



router.post('/escrow/dispute/:escrowId', authenticateToken, async (req, res) => {
    const escrowId = parseInt(req.params.escrowId);
    const buyerId = req.user.userId;

    try {
        const escrow = await prisma.escrow.findUnique({ where: { id: escrowId } });

        if (!escrow || escrow.buyerId !== buyerId) {
            return res.status(403).send('Unauthorized');
        }

        await prisma.escrow.update({
            where: { id: escrowId },
            data: { status: "disputed" }
        });

        res.send("Escrow marked as disputed. Admin intervention required.");
    } catch (error) {
        console.error(error);
        res.status(500).send("Error raising dispute.");
    }
});





module.exports = router;
