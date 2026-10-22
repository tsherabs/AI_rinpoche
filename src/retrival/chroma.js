import { ChromaClient } from "chromadb";

const client = new ChromaClient({
    host: "localhost", 
    port: 8000,
    ssl: false
}); 

const serverRespond = await client.heartbeat(); 

console.log(serverRespond); 

const collection = await client.getOrCreateCollection({
    name: "srr_bge_small_cls_v2",
    embeddingFunction: null,
    configuration: {
        hnsw: {
            space: 'cosine'
        }
    }
}); 


