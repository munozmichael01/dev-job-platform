const express = require('express');
const cors = require('cors');

console.log('🔄 Starting test server...');

const app = express();

app.use(cors({
  origin: ['http://localhost:3001', 'http://localhost:3000'],
  credentials: true
}));

app.use(express.json());

// Test basic endpoint
app.get('/', (req, res) => {
  console.log('📥 Request received at /');
  res.json({ message: 'API test server running', timestamp: new Date().toISOString() });
});

// Test API endpoint
app.get('/api/test', (req, res) => {
  console.log('📥 Request received at /api/test');
  res.json({ success: true, message: 'API endpoint working' });
});

const PORT = 3003;
app.listen(PORT, () => {
  console.log(`✅ Test server running on http://localhost:${PORT}`);
  console.log('📊 Available endpoints:');
  console.log('  - GET /');
  console.log('  - GET /api/test');
});