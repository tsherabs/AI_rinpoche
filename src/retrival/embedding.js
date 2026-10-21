import { pipeline } from "@huggingface/transformers";
import fs from "fs";
import path from "node:path"
import { ChromaClient } from "chromadb";

const dirPath = "./src/chunking/processed"; 
const dirJSONL = fs.readdirSync(dirPath);
const filterJSONL = dirJSONL.filter(jsonl => jsonl.endsWith(".jsonl"));

const fullPath = path.join(dirPath, filterJSONL[1]); 

console.log(fullPath)


const fromJSONL = fs.readFileSync(fullPath, "utf-8"); 

const lines = fromJSONL.split("\n")
const nonEmptyLines = lines.filter(lines => lines.trim() !== "")
const parsedLines = nonEmptyLines.map(lines => JSON.parse(lines)); 
console.log(parsedLines[0])
const passageIds = parsedLines.map(Ids => Ids.passage_id); 
console.log(passageIds[0]); 
const passageTexts = parsedLines.map(text => text.text); 
console.log(passageTexts[0]);

const passageMetadata = parsedLines.map(lines => ({
    source_id: lines.source_id, 
    title: lines.title, 
    speaker: lines.speaker, 
    attribution: lines.attribution, 
    start: lines.start, 
    end: lines.end, 
    url: lines.url, 
    reviewed_status: lines.review_status
})); 


console.log(passageMetadata[0])

// Length of those lines 
console.log(parsedLines.length); 
console.log(passageIds.length); 
console.log(passageTexts.length); 
console.log(passageMetadata.length); 

const embedder = await pipeline(
    'feature-extraction', 
    'Xenova/bge-small-en-v1.5'
); 

const embeddedPassages = []; 


for(let i = 0; i < parsedLines.length; i++){
    const embedding = await embedder(parsedLines[i].text, {
    pooling: "cls", 
    normalize: true
}); 
const convertArray = Array.from(embedding.data); 
embeddedPassages.push(convertArray); 
}
 
console.log("Total passages:", parsedLines.length);
console.log("Total embeddings:", embeddedPassages.length);
console.log("First embedding dimensions:", embeddedPassages[0].length);
console.log("First five values:", embeddedPassages[0].slice(0, 5));

const client = new ChromaClient({
    host: "localhost", 
    port: 8000, 
    ssl: false
}); 


const collection = await client.getCollection({ 
    name: "srr_bge_small_cls_v1", 
    embeddingFunction: null 
    }); 

for(let i = 1; i < parsedLines.length; i++){
    
await collection.add({ 
    ids: [passageIds[i]], 
    documents: [passageTexts[i]], 
    embeddings: [embeddedPassages[i]], 
    metadatas: [passageMetadata[i]] 
}); 
}
const viewTest = await collection.get({
    include: ["documents", "metadatas", "embeddings"]
}); 
console.log(viewTest.ids.length)
console.log(viewTest.metadatas.length)
console.log(viewTest.embeddings.length)
console.log(viewTest.documents.length)






 

