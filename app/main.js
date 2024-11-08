const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const crypto = require('crypto')
// You can use print statements as follows for debugging, they'll be visible when running tests.
// console.log("Logs from your program will appear here!");
// Uncomment this block to pass the first stage
const userInput = process.argv[4];
const writeCommand = process.argv[3];

const command = process.argv[2];
switch (command) {
    case "init":
        createGitDirectory();
        break;
    case 'cat-file':
        catFile(userInput, writeCommand);
        break;
    case "hash-object":
        hashObject(userInput, writeCommand);
        break;
    case "ls-tree":
        checkTree(userInput, writeCommand);
        break;
    case "write-tree":
        writeTree(userInput, writeCommand, './');
        break;

    default:
        throw new Error(`Unknown command ${command}`);
}
function createGitDirectory() {
    fs.mkdirSync(path.join(process.cwd(), ".git"), { recursive: true });
    fs.mkdirSync(path.join(process.cwd(), ".git", "objects"), { recursive: true });
    fs.mkdirSync(path.join(process.cwd(), ".git", "refs"), { recursive: true });
    fs.writeFileSync(path.join(process.cwd(), ".git", "HEAD"), "ref: refs/heads/main\n");
    console.log("Initialized git directory");
}


function readPath(hash) {
    const objectsDirectoryPath = path.join(process.cwd(), ".git", "objects");
    const hashDirectoryPath = path.join(objectsDirectoryPath, hash.slice(0, 2));
    const filePath = path.join(hashDirectoryPath, hash.slice(2));

    return { objectsDirectoryPath, hashDirectoryPath, filePath }
}

async function catFile(userInput, writeCommand) {
    if (writeCommand !== "-p") return 'use -p to make this work';
    const { objectsDirectoryPath, hashDirectoryPath, filePath } = readPath(userInput)

    const dataUnzipped = zlib.inflateSync(filePath);
    const res = dataUnzipped.toString().split('\0')[1];

    process.stdout.write(res);
}

function createShaHash(data) {
    return crypto.createHash('sha1').update(data).digest('hex');
}

function sliceHash(Hash) {
    return Hash.slice(0, 2) + '/' . Hash.slice(2);
}

function hashObject(userInput, writeCommand) {
    if (writeCommand !== "-w") return;

    const content = fs.readFileSync(userInput);
    const header = Buffer.from(`blob ${content.length}\0`);
    const data = Buffer.concat([header, content]);
    const hash = createShaHash(data);

    const { objectsDirectoryPath, hashDirectoryPath, filePath } = readPath(hash)

    fs.mkdirSync(hashDirectoryPath, { recursive: true });
    fs.writeFileSync(filePath, zlib.deflateSync(data));
    process.stdout.write(hash);
}

async function checkTree(userInput, writeCommand) {

    if (writeCommand !== "--name-only") return;
    const { objectsDirectoryPath, hashDirectoryPath, filePath } = readPath(userInput)

    const inflatedContent = zlib.inflateSync(fs.readFileSync(filePath));
    const content = inflatedContent.toString('utf-8');
    const parts = content.split('\0');
    const fileEntries = parts.slice(1);
    const names = fileEntries
        .filter(entry => entry.includes(" "))
        .map(entry => entry.split(" ")[1]);

    names.forEach(name => process.stdout.write(`${name}\n`));
}

function writeTree(userInput, writeCommand, dirPath ) {
    dirPath = './'
    // Get the list of files and directories (excluding .git and the current file)
    const filesAndDirs = fs.readdirSync(dirPath).filter(file => file !== ".git" && file !== "main.js");

    const entries = [];

    // Process each file or directory
    for (const file of filesAndDirs) {
        const fullPath = path.join(dirPath, file);
        let mode;
        let hash;

        if (fs.lstatSync(fullPath).isDirectory()) {
            // If it's a directory, recursively call writeTree to create a tree object
            mode = 40000;  // Mode for directories
            hash = writeTree(userInput, writeCommand, fullPath);  // Recursively create a tree hash for the directory
        } else {
            // If it's a file, create an object for the file
            mode = 100644;  // Mode for files
            const content = fs.readFileSync(fullPath);
            const header = Buffer.from(`blob ${content.length}\0`);
            const data = Buffer.concat([header, content]);
            hash = createShaHash(data);
            const { objectsDirectoryPath, hashDirectoryPath, filePath } = readPath(hash);

            // Create the object if it doesn't already exist
            if (!fs.existsSync(filePath)) {
                fs.mkdirSync(hashDirectoryPath, { recursive: true });
                fs.writeFileSync(filePath, zlib.deflateSync(data));
            }
        }

        // Add the entry for the file/directory in the tree
        entries.push({
            mode,
            name: file,
            hash
        });
    }

    // Create the tree object (concatenate entries)
    const treeData = entries.reduce((acc, { mode, name, hash }) => {
        return Buffer.concat([
            acc,
            Buffer.from(`${mode} ${name}\0`),
            Buffer.from(hash, 'hex')
        ]);
    }, Buffer.alloc(0));

    // Create the tree header and data
    const tree = Buffer.concat([
        Buffer.from(`tree ${treeData.length}\x00`),
        treeData,
    ]);

    // Compress the tree object
    const compressedData = zlib.deflateSync(tree);

    // Create the tree hash
    const treeHash = createShaHash(tree);

    // Save the tree object to the Git object store
    const { objectsDirectoryPath, hashDirectoryPath, filePath } = readPath(treeHash);
    fs.mkdirSync(hashDirectoryPath, { recursive: true });
    fs.writeFileSync(filePath, compressedData);

    return treeHash;
}