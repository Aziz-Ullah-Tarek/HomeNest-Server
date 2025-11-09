const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection URI - URL encode password to handle special characters
const encodedPassword = encodeURIComponent(process.env.DB_PASS);
const uri = `mongodb+srv://${process.env.DB_USER}:${encodedPassword}@cluster0.bcz1ya4.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect to MongoDB
    await client.connect();
    console.log("Successfully connected to MongoDB!");

    // Database and Collections
    const database = client.db("HomeNestDB");
    const slidersCollection = database.collection("Sliders");
    const propertiesCollection = database.collection("Properties");

    // ============= API Routes =============

    // Get all sliders
    app.get('/api/sliders', async (req, res) => {
      try {
        const sliders = await slidersCollection.find().toArray();
        console.log("Fetched sliders:", sliders.length);
        console.log("Slider data:", JSON.stringify(sliders, null, 2));
        res.json(sliders);
      } catch (error) {
        console.error("Error fetching sliders:", error);
        res.status(500).json({ message: "Error fetching sliders", error: error.message });
      }
    });

    // Test endpoint to check database connection
    app.get('/api/test', async (req, res) => {
      try {
        const count = await slidersCollection.countDocuments();
        res.json({ 
          status: 'Connected to MongoDB', 
          database: 'HomeNestDB',
          collection: 'Sliders',
          documentCount: count 
        });
      } catch (error) {
        res.status(500).json({ message: "Database error", error: error.message });
      }
    });

    // Get featured properties
    app.get('/api/properties/featured', async (req, res) => {
      try {
        const properties = await propertiesCollection.find({ featured: true }).limit(6).toArray();
        res.json(properties);
      } catch (error) {
        res.status(500).json({ message: "Error fetching featured properties", error: error.message });
      }
    });

    // Get all properties
    app.get('/api/properties', async (req, res) => {
      try {
        const properties = await propertiesCollection.find().toArray();
        res.json(properties);
      } catch (error) {
        res.status(500).json({ message: "Error fetching properties", error: error.message });
      }
    });

  } catch (error) {
    console.error(" Error connecting to MongoDB:", error);
  }
}

run().catch(console.dir);

// Simple test route
app.get('/', (req, res) => {
  res.send(`
    <h1>HomeNest Server is Running!</h1>
    <h2>Available API Endpoints:</h2>
    <ul>
      <li><a href="/api/test">GET /api/test</a> - Test MongoDB connection</li>
      <li><a href="/api/sliders">GET /api/sliders</a> - Get all sliders (lowercase 's'!)</li>
      <li><a href="/api/properties/featured">GET /api/properties/featured</a> - Get featured properties</li>
      <li><a href="/api/properties">GET /api/properties</a> - Get all properties</li>
    </ul>
    <p><strong>Note:</strong> URLs are case-sensitive! Use lowercase routes.</p>
  `);
});

// Start server
app.listen(port, () => {
  console.log(` HomeNest Server is running on port ${port}`);
});