const app = require('./app');
const db = require('./config/db');

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Test Database connection
    console.log('Testing connection to PostgreSQL database...');
    await db.$connect();
    console.log('Successfully connected to PostgreSQL database!');

    // Start listening
    app.listen(PORT, () => {
      console.log(`===============================================`);
      console.log(` AI-Powered Code Review Bot Server Started`);
      console.log(` Port: ${PORT}`);
      console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(` Webhook URL path: /api/github/webhooks`);
      console.log(`===============================================`);
    });
  } catch (error) {
    console.error('Fatal: Failed to connect to database on startup. Exiting...', error);
    process.exit(1);
  }
}

// Clean up db connection on shutdown
process.on('SIGINT', async () => {
  await db.$disconnect();
  console.log('Prisma disconnected. App shutdown complete.');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await db.$disconnect();
  console.log('Prisma disconnected. App shutdown complete.');
  process.exit(0);
});

startServer();
