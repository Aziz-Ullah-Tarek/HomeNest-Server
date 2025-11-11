const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection URI
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
    const reviewsCollection = database.collection("Reviews");

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

    // Get featured properties (6 most recent)
    app.get('/api/properties/featured', async (req, res) => {
      try {
        // Sort by createdAt descending (newest first) and limit to 6
        const properties = await propertiesCollection
          .find()
          .sort({ createdAt: -1 })
          .limit(6)
          .toArray();
        console.log("Fetched featured properties:", properties.length);
        res.json(properties);
      } catch (error) {
        console.error("Error fetching featured properties:", error);
        res.status(500).json({ message: "Error fetching featured properties", error: error.message });
      }
    });

    // all properties sorting
    app.get('/api/properties', async (req, res) => {
      try {
        const { sortBy, order } = req.query;
        
       
        let sortOptions = { createdAt: -1 }; 
        
        // Handle different sort options
        if (sortBy === 'price') {
          sortOptions = { price: order === 'asc' ? 1 : -1 };
        } else if (sortBy === 'date') {
          sortOptions = { createdAt: order === 'asc' ? 1 : -1 };
        } else if (sortBy === 'title') {
          sortOptions = { title: order === 'asc' ? 1 : -1 };
        }
        
        const properties = await propertiesCollection
          .find()
          .sort(sortOptions)
          .toArray();
        
        res.json(properties);
      } catch (error) {
        res.status(500).json({ message: "Error fetching properties", error: error.message });
      }
    });

    // Get single property by ID
    app.get('/api/properties/:id', async (req, res) => {
      try {
        const { ObjectId } = require('mongodb');
        const property = await propertiesCollection.findOne({ _id: new ObjectId(req.params.id) });
        if (!property) {
          return res.status(404).json({ message: "Property not found" });
        }
        console.log("Fetched property:", property.title);
        res.json(property);
      } catch (error) {
        console.error("Error fetching property:", error);
        res.status(500).json({ message: "Error fetching property", error: error.message });
      }
    });

    // Add new property (POST)
    app.post('/api/properties', async (req, res) => {
      try {
        const propertyData = req.body;
        
        // Validation
        if (!propertyData.title || !propertyData.description || !propertyData.category || !propertyData.price) {
          return res.status(400).json({ message: "Missing required fields" });
        }

        // Insert property
        const result = await propertiesCollection.insertOne(propertyData);
        console.log("Property added:", propertyData.title, "by", propertyData.userName);
        
        res.status(201).json({ 
          message: "Property added successfully", 
          insertedId: result.insertedId 
        });
      } catch (error) {
        console.error("Error adding property:", error);
        res.status(500).json({ message: "Error adding property", error: error.message });
      }
    });

    // Delete property by ID
    app.delete('/api/properties/:id', async (req, res) => {
      try {
        const { ObjectId } = require('mongodb');
        const result = await propertiesCollection.deleteOne({ _id: new ObjectId(req.params.id) });
        
        if (result.deletedCount === 0) {
          return res.status(404).json({ message: "Property not found" });
        }
        
        console.log("Property deleted:", req.params.id);
        res.json({ message: "Property deleted successfully" });
      } catch (error) {
        console.error("Error deleting property:", error);
        res.status(500).json({ message: "Error deleting property", error: error.message });
      }
    });

    // Update property by ID
    app.put('/api/properties/:id', async (req, res) => {
      try {
        const { ObjectId } = require('mongodb');
        const { _id, ...updateData } = req.body;
        
        const result = await propertiesCollection.updateOne(
          { _id: new ObjectId(req.params.id) },
          { $set: updateData }
        );
        
        if (result.matchedCount === 0) {
          return res.status(404).json({ message: "Property not found" });
        }
        
        console.log("Property updated:", req.params.id);
        res.json({ message: "Property updated successfully" });
      } catch (error) {
        console.error("Error updating property:", error);
        res.status(500).json({ message: "Error updating property", error: error.message });
      }
    });

    // ============= REVIEWS API Routes =============

    // Get all reviews
    app.get('/api/reviews', async (req, res) => {
      try {
        const reviews = await reviewsCollection
          .find({})
          .sort({ createdAt: -1 })
          .toArray();
        res.json(reviews);
      } catch (error) {
        console.error("Error fetching all reviews:", error);
        res.status(500).json({ message: "Error fetching reviews", error: error.message });
      }
    });

    // Get all reviews for a specific property
    app.get('/api/reviews/property/:propertyId', async (req, res) => {
      try {
        const reviews = await reviewsCollection
          .find({ propertyId: req.params.propertyId })
          .sort({ createdAt: -1 })
          .toArray();
        res.json(reviews);
      } catch (error) {
        console.error("Error fetching reviews:", error);
        res.status(500).json({ message: "Error fetching reviews", error: error.message });
      }
    });

    // Get all reviews by a specific user (for My Ratings page)
    app.get('/api/reviews/user/:userEmail', async (req, res) => {
      try {
        const reviews = await reviewsCollection
          .find({ userEmail: req.params.userEmail })
          .sort({ createdAt: -1 })
          .toArray();
        res.json(reviews);
      } catch (error) {
        console.error("Error fetching user reviews:", error);
        res.status(500).json({ message: "Error fetching user reviews", error: error.message });
      }
    });

    // Add new review
    app.post('/api/reviews', async (req, res) => {
      try {
        const reviewData = {
          ...req.body,
          createdAt: new Date().toISOString()
        };
        
        console.log("Received review data:", reviewData);
        
        // Validation - check 
        if (!reviewData.propertyId || reviewData.rating === undefined || reviewData.rating === null || !reviewData.review) {
          console.log("Validation failed:", {
            hasPropertyId: !!reviewData.propertyId,
            rating: reviewData.rating,
            hasReview: !!reviewData.review
          });
          return res.status(400).json({ message: "Missing required fields: propertyId, rating, and review are required" });
        }

        const result = await reviewsCollection.insertOne(reviewData);
        console.log("Review added for property:", reviewData.propertyId, "by", reviewData.userName);
        
        res.status(201).json({ 
          message: "Review added successfully", 
          insertedId: result.insertedId 
        });
      } catch (error) {
        console.error("Error adding review:", error);
        res.status(500).json({ message: "Error adding review", error: error.message });
      }
    });

    // Delete review by ID
    app.delete('/api/reviews/:id', async (req, res) => {
      try {
        const { ObjectId } = require('mongodb');
        const result = await reviewsCollection.deleteOne({ _id: new ObjectId(req.params.id) });
        
        if (result.deletedCount === 0) {
          return res.status(404).json({ message: "Review not found" });
        }
        
        console.log("Review deleted:", req.params.id);
        res.json({ message: "Review deleted successfully" });
      } catch (error) {
        console.error("Error deleting review:", error);
        res.status(500).json({ message: "Error deleting review", error: error.message });
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
      <li><a href="/api/sliders">GET /api/sliders</a> - Get all sliders</li>
      <li><a href="/api/properties/featured">GET /api/properties/featured</a> - Get featured properties (6 most recent)</li>
      <li><a href="/api/properties">GET /api/properties</a> - Get all properties</li>
      <li>GET /api/properties/:id - Get single property by ID</li>
      <li>POST /api/properties - Add new property</li>
    </ul>
    <p><strong>Note:</strong> URLs are case-sensitive! Use lowercase routes.</p>
  `);
});

// Start server
app.listen(port, () => {
  console.log(` HomeNest Server is running on port ${port}`);
});