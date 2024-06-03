const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = "mongodb+srv://ildar251:JfEw7DmUTouhns16@cluster0.8o77zwl.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";


const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});


async function connectToDatabase() {
    try {
        await client.connect();
        console.log("Connected to MongoDB!");
        const db = client.db("narkologKrasnodar"); 
        return db;
    } catch (error) {
        console.error("Error connecting to MongoDB", error);
        throw error;
    }
}

module.exports = connectToDatabase;