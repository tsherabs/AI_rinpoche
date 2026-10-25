import { pipeline } from "@huggingface/transformers";
import { ChromaClient } from "chromadb";


const client = new ChromaClient({
    host: "localhost", 
    port: 8000, 
    ssl: false
})

const queryPrefix = "Represent this sentence for searching relevant passages: "; 

const userQuery = queryPrefix +  "how does rinpochoe explain the practice of recognizing the nature ofmind and how can this practice help us handle negative emotions and challenegs ineveryday life?";  

const embedder = await pipeline(
    'feature-extraction', 
    'Xenova/bge-small-en-v1.5' 
);

const queryEmbedding = await embedder(userQuery, {
    pooling: "cls", 
    normalize: true 
}); 

const embeddedQuery = Array.from(queryEmbedding.data); 
console.log(embeddedQuery.length)


const collection = await client.getCollection({
    name: "srr_bge_small_cls_v2", 
    embeddingFunction: null, 
}); 

const results = await collection.query({
    queryEmbeddings: [embeddedQuery], 
    nResults: 5, 
    where: {
        attribution: "rinpoche_own"
    }
}); 

console.log(results.metadatas)