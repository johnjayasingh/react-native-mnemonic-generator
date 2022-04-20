const unorm = require('unorm')
const createHash = require('create-hash')
const {randomBytes} = require('react-native-randombytes')
const CryptoJS = require('crypto-js')

const DEFAULT_WORDLIST = require('./wordlists/en.json')

function mnemonicToSeed(mnemonic, numIterations) {
    const salt = CryptoJS.lib.WordArray.random(128 / 8)
    const key256Bits = CryptoJS.PBKDF2(mnemonic, salt, {
        keySize: 256 / 32,
        iterations: numIterations
    })
    return key256Bits
}

function mnemonicToSeedHex(mnemonic, numIterations) {
    const seed = mnemonicToSeed(mnemonic, numIterations)
    return seed.toString()
}

function mnemonicToEntropy(mnemonic, wordlist) {
    wordlist = wordlist || DEFAULT_WORDLIST

    const words = mnemonic.split(' ')
    if(words.length % 3 !== 0){
        throw new Error('Invalid mnemonic')
    }
    

    const belongToList = words.every(function (word) {
        return wordlist.indexOf(word) > -1
    })

    if(!belongToList){
        throw new Error('Invalid mnemonic')
    }

    // convert word indices to 11 bit binary strings
    const bits = words
        .map(function (word) {
            const index = wordlist.indexOf(word)
            return lpad(index.toString(2), '0', 11)
        })
        .join('')

    // split the binary string into ENT/CS
    const dividerIndex = Math.floor(bits.length / 33) * 32
    const entropy = bits.slice(0, dividerIndex)
    const checksum = bits.slice(dividerIndex)

    // calculate the checksum and compare
    const entropyBytes = entropy.match(/(.{1,8})/g).map(function (bin) {
        return parseInt(bin, 2)
    })
    const entropyBuffer = Buffer.from(entropyBytes)
    const newChecksum = checksumBits(entropyBuffer)

    if(newChecksum !== checksum){
        throw new Error('Invalid mnemonic checksum')
    }

    return entropyBuffer.toString('hex')
}

function entropyToMnemonic(entropy, wordlist) {
    wordlist = wordlist || DEFAULT_WORDLIST

    const entropyBuffer = Buffer.from(entropy, 'hex')
    const entropyBits = bytesToBinary([].slice.call(entropyBuffer))
    const checksum = checksumBits(entropyBuffer)

    const bits = entropyBits + checksum
    const chunks = bits.match(/(.{1,11})/g)

    const words = chunks.map(function (binary) {
        const index = parseInt(binary, 2)

        return wordlist[index]
    })

    return words.join(' ')
}

function generateMnemonic(strength, rng, wordlist) {
    return new Promise((resolve, reject) => {
        strength = strength || 128
        rng = rng || randomBytes
        // rng = rng;

        rng(strength / 8, (error, randomBytesBuffer) => {
            if (error) {
                reject(error)
            } else {
                resolve(entropyToMnemonic(randomBytesBuffer.toString('hex'), wordlist))
            }
        })
    })
}

function validateMnemonic(mnemonic, wordlist) {
    try {
        mnemonicToEntropy(mnemonic, wordlist)
    } catch (e) {
        return false
    }

    return true
}

function checksumBits(entropyBuffer) {
    const hash = createHash('sha256')
        .update(entropyBuffer)
        .digest()

    // Calculated constants from BIP39
    const ENT = entropyBuffer.length * 8
    const CS = ENT / 32

    return bytesToBinary([].slice.call(hash)).slice(0, CS)
}

function salt(password) {
    return 'mnemonic' + (unorm.nfkd(password) || '') // Use unorm until String.prototype.normalize gets better browser support
}

//=========== helper methods from bitcoinjs-lib ========

function bytesToBinary(bytes) {
    return bytes
        .map(function (x) {
            return lpad(x.toString(2), '0', 8)
        })
        .join('')
}

function lpad(str, padString, length) {
    while (str.length < length) str = padString + str
    return str
}

module.exports = {
    mnemonicToSeed: mnemonicToSeed,
    mnemonicToSeedHex: mnemonicToSeedHex,
    mnemonicToEntropy: mnemonicToEntropy,
    entropyToMnemonic: entropyToMnemonic,
    generateMnemonic: generateMnemonic,
    validateMnemonic: validateMnemonic,
    wordlists: {
        EN: DEFAULT_WORDLIST
    }
}