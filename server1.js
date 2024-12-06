const express = require('express');
const fs = require('fs');
const path = require('path');
const MongoClient = require('mongodb').MongoClient; // Separate MongoClient import
const ObjectID = require('mongodb').ObjectID; // Separate ObjectID import
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

app.use('/static', express.static(path.join(__dirname, 'static')));

// Custom Logger
const logFilePath = path.join(__dirname, 'project.log');
function logActivity(message) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    fs.appendFile(logFilePath, logEntry, (err) => {
        if (err) console.error('Error writing to log file:', err);
    });
    console.log(logEntry.trim());
}

// Middleware to log all requests
app.use((req, res, next) => {
    logActivity(`Request: ${req.method} ${req.url}`);
    next();
});

// MongoDB connection
let db;
MongoClient.connect('mongodb+srv://danialasif592:50502597@cluster0.ilnlz.mongodb.net/', { useUnifiedTopology: true }, (err, client) => {
    if (err) {
        logActivity('Error connecting to MongoDB');
        throw err;
    }
    db = client.db('Webstore');
    logActivity('Connected to MongoDB');
});

// Routes
app.get('/', (req, res) => {
    logActivity('Homepage accessed');
    res.send('Select a collection, e.g., /collection/messages');
});

app.param('collectionName', (req, res, next, collectionName) => {
    req.collection = db.collection(collectionName);
    logActivity(`Accessing collection: ${collectionName}`);
    next();
});

// Fetch all documents from a collection
app.get('/collection/:collectionName', (req, res, next) => {
    req.collection.find({}).toArray((err, results) => {
        if (err) {
            logActivity(`Error fetching from collection: ${req.params.collectionName}`);
            return next(err);
        }
        logActivity(`Fetched from collection: ${req.params.collectionName}`);
        res.send(results);
    });
});

// Add a new document to a collection
app.post('/collection/:collectionName', (req, res, next) => {
    req.collection.insert(req.body, (err, results) => {
        if (err) {
            logActivity(`Error inserting into collection: ${req.params.collectionName}`);
            return next(err);
        }
        logActivity(`Inserted into collection: ${req.params.collectionName} - Data: ${JSON.stringify(req.body)}`);
        res.send(results.ops);
    });
});

// Update a document by ObjectId
app.put('/collection/:collectionName/:id', (req, res, next) => {
    const { id } = req.params;

    // Validate ObjectId format
    if (!ObjectID.isValid(id)) {
        logActivity(`Invalid ObjectId format: ${id}`);
        return res.status(400).send({ msg: 'Invalid ObjectId format' });
    }

    try {
        // Convert the id to ObjectId
        const objectId = new ObjectID(id);
        req.collection.updateOne({ _id: objectId }, { $set: req.body }, (err, result) => {
            if (err) {
                logActivity(`Error updating document in collection: ${req.params.collectionName}`);
                return next(err);
            }
            logActivity(`Updated document in collection: ${req.params.collectionName} - ID: ${id}`);
            res.send(result.matchedCount === 1 ? { msg: 'success' } : { msg: 'error' });
        });
    } catch (err) {
        logActivity(`Error converting ObjectId: ${id}`);
        return res.status(400).send({ msg: 'Invalid ObjectId format' });
    }
});

// Delete a document by ObjectId
app.delete('/collection/:collectionName/:id', (req, res, next) => {
    const { id } = req.params;

    // Validate ObjectId format
    if (!ObjectID.isValid(id)) {
        logActivity(`Invalid ObjectId format: ${id}`);
        return res.status(400).send({ msg: 'Invalid ObjectId format' });
    }

    try {
        // Convert the id to ObjectId
        const objectId = new ObjectID(id);
        req.collection.deleteOne({ _id: objectId }, (err, result) => {
            if (err) {
                logActivity(`Error deleting from collection: ${req.params.collectionName}`);
                return next(err);
            }
            logActivity(`Deleted from collection: ${req.params.collectionName} - ID: ${id}`);
            res.send(result.deletedCount === 1 ? { msg: 'success' } : { msg: 'error' });
        });
    } catch (err) {
        logActivity(`Error converting ObjectId: ${id}`);
        return res.status(400).send({ msg: 'Invalid ObjectId format' });
    }
});

// Get a specific document by ObjectId
app.get('/collection/:collectionName/:id', (req, res, next) => {
    const { collectionName, id } = req.params;

    // Validate ObjectId format
    if (!ObjectID.isValid(id)) {
        logActivity(`Invalid ObjectId format: ${id}`);
        return res.status(400).send({ msg: 'Invalid ObjectId format' });
    }

    try {
        // Convert the id to ObjectId
        const objectId = new ObjectID(id);

        // Fetch the document
        req.collection.findOne({ _id: objectId }, (err, result) => {
            if (err) {
                logActivity(`Error fetching document from collection: ${collectionName} - ID: ${id}`);
                return next(err);
            }
            if (!result) {
                logActivity(`Document not found in collection: ${collectionName} - ID: ${id}`);
                return res.status(404).send({ msg: 'Document not found' });
            }
            logActivity(`Fetched document from collection: ${collectionName} - ID: ${id}`);
            res.send(result);
        });
    } catch (err) {
        logActivity(`Error converting ObjectId: ${id}`);
        return res.status(400).send({ msg: 'Invalid ObjectId format' });
    }
});

// Place an order
app.post('/place-order', (req, res, next) => {
    const order = req.body;

    // Log the order data to check it
    console.log('Received Order:', order);

    // Validate order data
    if (!order.customerName || !order.cart || !Array.isArray(order.cart) || order.cart.length === 0) {
        logActivity('Invalid order data received');
        return res.status(400).send({ msg: 'Invalid order data' });
    }

    // Insert order into the 'orders' collection
    const ordersCollection = db.collection('orders');
    ordersCollection.insertOne(order, (err, result) => {
        if (err) {
            logActivity(`Error inserting order: ${err.message}`);
            return next(err); // Logs the specific error
        }
        logActivity(`Order placed successfully - Data: ${JSON.stringify(order)}`);
        res.send({ msg: 'Order placed successfully', orderId: result.insertedId });
    });
});

// Error handler
app.use((err, req, res, next) => {
    logActivity(`Error: ${err.message}`);
    res.status(500).send('Something went wrong!');
});


const port = process.env.PORT || 3000;
app.listen(port, () => {
    logActivity(`Server started on port ${port}`);
});
