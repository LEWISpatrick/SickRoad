const bitcoin = require('bitcoinjs-lib');
const crypto = require('crypto');
const { ECPairFactory } = require('ecpair');
const tinysecp = require('tiny-secp256k1');
const prisma = require('@prisma/client');
const ECPair = ECPairFactory(tinysecp);
const axios = require('axios');

// Convert BTC to satoshis
function btcToSatoshis(btcAmount) {
    return Math.round(btcAmount * 100000000);
}

// Convert satoshis to BTC
function satoshisToBtc(satoshisAmount) {
    return satoshisAmount / 100000000;
}

// Function to generate an escrow BTC address
function generateEscrowAddress() {
    const keypair = ECPair.makeRandom();
    const { address } = bitcoin.payments.p2pkh({ pubkey: keypair.publicKey });
    const privateKey = keypair.toWIF();


    return { address, privateKey };
}




function decryptPrivateKey(encryptedData, password, salt, iv, authTag) {
    console.log("Decrypting with:", { encryptedData, password, salt, iv, authTag });

    const key = crypto.pbkdf2Sync(password, Buffer.from(salt, 'hex'), 100000, 32, 'sha256');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

async function sendBTCFromEscrow(user, escrow, platformPublicKey, privateKeyWIF) {
    try {
        console.log("Starting BTC transfer from escrow");

        console.log("Private Key WIF:", privateKeyWIF); 

        const keyPair = ECPair.fromWIF(privateKeyWIF);

        const { publicKey } = keyPair;

        console.log("Derived Public Key:", publicKey.toString('hex'));
    
        const { address: escrowAddress } = bitcoin.payments.p2pkh({ pubkey: Buffer.from(publicKey) });
    
    

        console.log(`Escrow Address: ${escrowAddress}`);

        const utxos = await axios.get(`https://blockstream.info/api/address/${escrowAddress}/utxo`);
        if (!utxos.data.length) throw new Error("No UTXOs available");

        console.log(`Found ${utxos.data.length} UTXOs`);

        const psbt = new bitcoin.Psbt();
        let inputAmount = 0;

        utxos.data.forEach((utxo) => {
            psbt.addInput({
                hash: utxo.txid,
                index: utxo.vout,
            });
            inputAmount += utxo.value;
        });

        console.log(`Total input amount (in satoshis): ${inputAmount}`);

        const commission = Math.round(inputAmount * 0.02);
        const sellerAmount = inputAmount - commission;

        if (sellerAmount <= 0) throw new Error("Insufficient balance after fees");

        console.log(`Commission (in satoshis): ${commission}, Seller Amount (in satoshis): ${sellerAmount}`);

        psbt.addOutput({ address: escrow.sellerAddress, value: sellerAmount });
        psbt.addOutput({ address: platformPublicKey, value: commission });

        console.log("Signing transaction...");

        psbt.signAllInputs(keyPair);
        psbt.finalizeAllInputs();

        const txHex = psbt.extractTransaction().toHex();
        const response = await axios.post('https://blockstream.info/api/tx', txHex);

        console.log("Transaction broadcasted successfully:", response.data);

        return { success: true, txId: response.data };
    } catch (error) {
        console.error("Error in BTC transaction:", error);
        return { success: false, error: error.message };
    }
}

module.exports = { generateEscrowAddress, sendBTCFromEscrow };
