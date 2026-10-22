import { pipeline } from "@huggingface/transformers";
import fs from "fs";
import path from "node:path"
import { ChromaClient } from "chromadb";

const dirPath = "./src/chunking/processed"; 
const dirJSONL = fs.readdirSync(dirPath);
const filterJSONL = dirJSONL.filter(jsonl => jsonl.endsWith(".jsonl"));

const embedder = await pipeline(
    'feature-extraction', 
    'Xenova/bge-small-en-v1.5'
); 

const client = new ChromaClient({
    host: "localhost", 
    port: 8000, 
    ssl: false
}); 

const collection = await client.getCollection({ 
    name: "srr_bge_small_cls_v2", 
    embeddingFunction: null 
}); 

for(let i = 0; i < filterJSONL.length; i++){
    const fullPath = path.join(dirPath, filterJSONL[i]);
    const fromJSONL = fs.readFileSync(fullPath, "utf-8");

    console.log("Processing file: ", fullPath); 

    const lines = fromJSONL.split("\n")
    const nonEmptyLines = lines.filter(lines => lines.trim() !== "") 
    const parsedLines = nonEmptyLines.map(lines => JSON.parse(lines)); 
    const filterRinpoche = parsedLines.filter(passage => passage.attribution === 'rinpoche_own');
    if (filterRinpoche.length === 0) {
    console.log(`Skipping ${filterJSONL[i]}: No Rinpoche passages.`);
    continue;
    }
    console.log("Rinpoche Passage Length")
    console.log(filterRinpoche.length)

    const textsToEmbed = filterRinpoche.map(passage => {
    const question = (passage.context_question ?? "").trim();

    if(question === ""){ 
        return `Answer: ${passage.text}`; 
    }else{
        return `Question: ${question} \n Answer: ${passage.text}`; 
    }
    });
    console.log("Rinpoche Passage Filtered")
    console.log(textsToEmbed[0])

    const passageMetadata = filterRinpoche.map(lines => ({
    source_id: lines.source_id, 
    title: lines.title,
    speaker: lines.speaker, 
    attribution: lines.attribution, 
    start: lines.start, 
    end: lines.end, 
    url: lines.url, 
    review_status: lines.review_status
    })); 
    const passageIds = filterRinpoche.map(Ids => Ids.passage_id); 
    console.log(passageIds[0]); 
    const passageTexts = filterRinpoche.map(text => text.text); 
    console.log(passageTexts[0]);

    // Length of those lines 
    console.log(parsedLines.length); 
    console.log(passageIds.length); 
    console.log(passageTexts.length); 
    console.log(passageMetadata.length); 

    const embeddedPassages = []; 


    for(let i = 0; i < textsToEmbed.length; i++){
        const embedding = await embedder(textsToEmbed[i], {
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

   
    
    console.log(`Adding ${filterJSONL[i]} to Chroma DB: ` )
    for(let i = 0; i < filterRinpoche.length; i++){
        await collection.upsert({ 
        ids: [passageIds[i]], 
        documents: [passageTexts[i]], 
        embeddings: [embeddedPassages[i]], 
        metadatas: [passageMetadata[i]] 
    }); 
    }

    const viewCount = await collection.count(); 
    console.log(`Total passages in the vector DB: ${viewCount}`)
}

async function viewCollectionDetails(){
    const viewTest = await collection.get({
        include: ["documents", "metadatas"]
    }); 


    const viewCount = await collection.count(); 
    const listCollection = await client.listCollections(); 

    console.log(listCollection)
    console.log(viewTest.documents[0])
    console.log(viewTest.metadatas[0])
    console.log(viewTest.ids[0])
    console.log(viewCount)
}  














 














 

