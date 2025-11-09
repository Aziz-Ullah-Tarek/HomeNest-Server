# How to Get Your MongoDB Connection String

## Steps:

1. Go to https://cloud.mongodb.com/
2. Click on **"Database"** in the left sidebar
3. Click **"Connect"** button on your Cluster0
4. Select **"Drivers"** (or "Connect your application")
5. Copy the connection string - it should look like:
   ```
   mongodb+srv://HomeNestDB:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
   ```

6. Replace `<password>` with: `lX3qL3af7WG4JCth`

## Your Connection String Should Be:

```
mongodb+srv://HomeNestDB:lX3qL3af7WG4JCth@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
```

**Note:** Replace `cluster0.xxxxx.mongodb.net` with your actual cluster hostname from Atlas.

## Common Hostnames Format:
- `cluster0.xxxxx.mongodb.net` (where xxxxx is a random 5-character string)
- Example: `cluster0.abc12.mongodb.net`

## The issue is:
The hostname `cluster0.fqctz.mongodb.net` might be incorrect. Please verify from your MongoDB Atlas dashboard.
