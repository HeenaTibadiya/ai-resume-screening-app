const express = require('express');
const cors = require('cors');
require('dotenv').config();

const analyzeRoute = require('./routes/analyze');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/analyze', analyzeRoute);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(5000, () => console.log('Server running on port 5000'));