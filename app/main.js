const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
// You can use print statements as follows for debugging, they'll be visible when running tests.
// console.log("Logs from your program will appear here!");
// Uncomment this block to pass the first stage
const hash = process.argv[4];
const writeCommand = process.argv[3];

const command = process.argv[2];
switch (command) {
    case "init":
        createGitDirectory();
        break;
    case 'cat-file':
        catFile(hash, writeCommand);
        break;
    case "hash-object":
        hashObject(hash, writeCommand);
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
async function catFile(hash, writeCommand) {
    const content = await fs.readFileSync(path.join(process.cwd(), ".git", "objects", hash.slice(0, 2), hash.slice(2)));
    const dataUnzipped = zlib.inflateSync(content);
    const res = dataUnzipped.toString().split('\0')[1];
    process.stdout.write(res);
}

async function hashObject(file, writeCommand) {
    // if command is not -w you return
    if (writeCommand !== "w") return;
    // get the file from the command
    const content = fs.readFileSync(file);
    // create the header
    const header = `blob ${content.length}\0`;
    // create the data
    const data = header + content;
    // hash it
    const hash = crypto.createHash('sha1').update(data).digest('hex');

    const objectsDirPath = path.join(process.cwd(), ".git", "objects");
    const hashDirPath = path.join(objectsDirPath, hash.slice(0, 2));
    const filePath = path.join(hashDirPath, hash.slice(2));
    fs.mkdirSync(hashDirPath, { recursive: true });
    fs.writeFileSync(filePath, zlib.deflateSync(data));
    process.stdout.write(hash);
}