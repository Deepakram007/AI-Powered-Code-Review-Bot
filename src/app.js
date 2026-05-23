require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { webhookMiddleware } = require('./webhooks/github');
const rulesRouter = require('./routes/rules');
const feedbackRouter = require('./routes/feedback');

const app = express();

// Request logging (skip for webhooks to avoid cluttered logging, or log normally)
app.use(morgan('dev'));

// Enable CORS
app.use(cors());

// REGISTER GITHUB WEBHOOK FIRST.
// It requires the raw, unparsed request stream to verify the webhook signature.
app.use(webhookMiddleware);

// Now we parse JSON/urlencoded request bodies for other REST API routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check API
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// REST routes
app.use('/api/rules', rulesRouter);
app.use('/api/feedback', feedbackRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

module.exports = app;
