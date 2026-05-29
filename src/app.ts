import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { buildWebhookMiddleware } from './webhooks/github';
import rulesRouter from './routes/rules';
import feedbackRouter from './routes/feedback';
import billingRouter from './routes/billing';
import auditRouter from './routes/audit';
import healthRouter from './routes/health';
import { errorHandler } from './middlewares/errorHandler';

const app = express();

// Request logging
app.use(morgan('dev'));

// CORS enablement
app.use(cors());

// REGISTER GITHUB WEBHOOK FIRST (before body parsers).
// It requires raw, unparsed request streams to properly verify webhook signatures.
// Returns null when GitHub credentials are not configured (local dev without keys).
const webhookMiddleware = buildWebhookMiddleware();
if (webhookMiddleware) {
  app.use(webhookMiddleware);
}

// Body parsing configurations for REST routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check Routing
app.use('/health', healthRouter);

// API Routing Layer
app.use('/api/rules', rulesRouter);
app.use('/api/feedback', feedbackRouter);
app.use('/api/billing', billingRouter);
app.use('/api/audit', auditRouter);

// Centralized error interception middleware
app.use(errorHandler);

export default app;
export { app };
