const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
const admin = require('firebase-admin');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Initialize Firebase Admin SDK
const serviceAccount = require('./homenest-firebase-admin-sdk.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Middleware - Configure CORS to allow Netlify frontend
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://homenest-30d35.firebaseapp.com',
  process.env.FRONTEND_URL // Add your Netlify URL here
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || origin.includes('netlify.app')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

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

// Database and Collections (will be initialized after connection)
let database, slidersCollection, propertiesCollection, reviewsCollection, usersCollection;
let isConnected = false;

// Admin credentials from environment variables
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@12345';

// Connect to MongoDB
async function connectDB() {
  if (isConnected) return;
  
  try {
    await client.connect();
    console.log("Successfully connected to MongoDB!");
    
    database = client.db("HomeNestDB");
    slidersCollection = database.collection("Sliders");
    propertiesCollection = database.collection("Properties");
    reviewsCollection = database.collection("Reviews");
    usersCollection = database.collection("Users");
    isConnected = true;
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    throw error;
  }
}

// Initialize DB connection
connectDB();

// ============= API Routes =============

// Home route
app.get('/', (req, res) => {
  res.send(`
    <div style="max-width: 800px; margin: 50px auto; padding: 20px;">
  <h1 style="color: #9333ea;">🏠 HomeNest Server is Running!</h1>
  <p style="color: #666; font-size: 18px;">Server is running successfully on port ${port}</p>
    </div>
  `);
});

// Middleware to verify Firebase token
const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error("Token verification error:", error);
    res.status(401).json({ message: "Invalid token" });
  }
};

// Check if user is admin
app.post('/verify-admin', verifyToken, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const isAdmin = userEmail === ADMIN_EMAIL;
    
    res.json({ 
      isAdmin,
      email: userEmail
    });
  } catch (error) {
    console.error("Error verifying admin:", error);
    res.status(500).json({ message: "Error verifying admin status", error: error.message });
  }
});

// Get or create user profile
app.post('/users/profile', verifyToken, async (req, res) => {
  try {
    await connectDB();
    const { email, displayName, photoURL } = req.body;
    
    // Check if user exists
    let user = await usersCollection.findOne({ email });
    
    if (!user) {
      // Create new user
      const newUser = {
        email,
        displayName,
        photoURL,
        role: email === ADMIN_EMAIL ? 'admin' : 'user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await usersCollection.insertOne(newUser);
      user = newUser;
    }
    
    res.json(user);
  } catch (error) {
    console.error("Error managing user profile:", error);
    res.status(500).json({ message: "Error managing user profile", error: error.message });
  }
});

// Update user profile
app.put('/users/profile', verifyToken, async (req, res) => {
  try {
    await connectDB();
    const { email, displayName, photoURL, phone, address } = req.body;
    
    const result = await usersCollection.updateOne(
      { email },
      { 
        $set: { 
          displayName, 
          photoURL,
          phone,
          address,
          updatedAt: new Date().toISOString()
        }
      },
      { upsert: true }
    );
    
    res.json({ message: "Profile updated successfully" });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ message: "Error updating profile", error: error.message });
  }
});

// Get dashboard stats
app.get('/dashboard/stats', verifyToken, async (req, res) => {
  try {
    await connectDB();
    const userEmail = req.user.email;
    const isAdmin = userEmail === ADMIN_EMAIL;
    
    if (isAdmin) {
      // Admin stats
      const totalProperties = await propertiesCollection.countDocuments();
      const totalUsers = await usersCollection.countDocuments();
      const totalReviews = await reviewsCollection.countDocuments();
      
      // Get properties by category
      const propertiesByCategory = await propertiesCollection.aggregate([
        { $group: { _id: "$category", count: { $sum: 1 } } }
      ]).toArray();
      
      // Recent properties
      const recentProperties = await propertiesCollection
        .find()
        .sort({ createdAt: -1 })
        .limit(5)
        .toArray();
      
      res.json({
        totalProperties,
        totalUsers,
        totalReviews,
        propertiesByCategory,
        recentProperties
      });
    } else {
      // User stats
      const userProperties = await propertiesCollection.countDocuments({ userEmail });
      const userReviews = await reviewsCollection.countDocuments({ userEmail });
      
      const userPropertiesList = await propertiesCollection
        .find({ userEmail })
        .sort({ createdAt: -1 })
        .limit(5)
        .toArray();
      
      res.json({
        userProperties,
        userReviews,
        userPropertiesList
      });
    }
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({ message: "Error fetching dashboard stats", error: error.message });
  }
});

// Get all users (admin only)
app.get('/admin/users', verifyToken, async (req, res) => {
  try {
    await connectDB();
    const userEmail = req.user.email;
    
    if (userEmail !== ADMIN_EMAIL) {
      return res.status(403).json({ message: "Access denied. Admin only." });
    }
    
    const users = await usersCollection.find().sort({ createdAt: -1 }).toArray();
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Error fetching users", error: error.message });
  }
});

// Get all sliders
app.get('/sliders', async (req, res) => {
  try {
    await connectDB();
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
app.get('/test', async (req, res) => {
  try {
    await connectDB();
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
app.get('/properties/featured', async (req, res) => {
  try {
    await connectDB();
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

// Get all properties with sorting
app.get('/properties', async (req, res) => {
  try {
    await connectDB();
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
app.get('/properties/:id', async (req, res) => {
  try {
    await connectDB();
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
app.post('/properties', async (req, res) => {
  try {
    await connectDB();
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
app.delete('/properties/:id', async (req, res) => {
  try {
    await connectDB();
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
app.put('/properties/:id', async (req, res) => {
  try {
    await connectDB();
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
app.get('/reviews', async (req, res) => {
  try {
    await connectDB();
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
app.get('/reviews/property/:propertyId', async (req, res) => {
  try {
    await connectDB();
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
app.get('/reviews/user/:userEmail', async (req, res) => {
  try {
    await connectDB();
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
app.post('/reviews', async (req, res) => {
  try {
    await connectDB();
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
app.delete('/reviews/:id', async (req, res) => {
  try {
    await connectDB();
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

// Start server
app.listen(port, () => {
  console.log(`\nHomeNest Server is Running!`);
  console.log(` Server URL: http://localhost:${port}`);
  console.log(` Connected to MongoDB\n`);
});






// Export the Express app for Vercel
module.exports = app;
