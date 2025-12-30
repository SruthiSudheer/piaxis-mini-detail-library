import express, { json } from 'express';
import { Pool } from 'pg';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(json());

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'Piaxis_local',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'sruthi',
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('Error connecting to the database:', err.stack);
  } else {
    console.log('Connected to PostgreSQL database');
    release();
  }
});

// API 1: List Details
// GET /details - Returns basic information of all details
app.get('/details', async (req, res) => {
  try {
    const query = `
      SELECT id, title, category, tags, description 
      FROM details 
      ORDER BY id
    `;
    const result = await pool.query(query);
    console.log(`Fetched ${result.rows.length} details.`);
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching details:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

// API 2: Search Details
// GET /details/search?q=searchTerm
// Searches in title, tags, and description
app.get('/details/search', async (req, res) => {
  try {
    const searchTerm = req.query.q;
    
    if (!searchTerm) {
      return res.status(400).json({
        success: false,
        error: 'Search query parameter "q" is required'
      });
    }

    const query = `
      SELECT id, title, category, tags, description 
      FROM details 
      WHERE 
        title ILIKE $1 OR 
        tags ILIKE $1 OR 
        description ILIKE $1
      ORDER BY 
        CASE 
          WHEN title ILIKE $1 THEN 1
          WHEN tags ILIKE $1 THEN 2
          ELSE 3
        END,
        id
    `;
    
    const searchPattern = `%${searchTerm}%`;
    const result = await pool.query(query, [searchPattern]);
    
    res.json({
      success: true,
      query: searchTerm,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Error searching details:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

// API 3: Suggest Detail
// POST /suggest-detail
// Request body: { host_element, adjacent_element, exposure }
app.post('/suggest-detail', async (req, res) => {
  try {
    const { host_element, adjacent_element, exposure } = req.body;
    
    if (!host_element || !adjacent_element || !exposure) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        required: ['host_element', 'adjacent_element', 'exposure']
      });
    }

    const query = `
      SELECT 
        d.id,
        d.title,
        d.category,
        d.tags,
        d.description,
        dur.host_element,
        dur.adjacent_element,
        dur.exposure,
        CASE 
          WHEN dur.host_element ILIKE $1 THEN 3 ELSE 0 
        END +
        CASE 
          WHEN dur.adjacent_element ILIKE $2 THEN 3 ELSE 0 
        END +
        CASE 
          WHEN dur.exposure ILIKE $3 THEN 2 ELSE 0 
        END as match_score
      FROM details d
      INNER JOIN detail_usage_rules dur ON d.id = dur.detail_id
      WHERE 
        dur.host_element ILIKE $1 OR
        dur.adjacent_element ILIKE $2 OR
        dur.exposure ILIKE $3
      ORDER BY match_score DESC, d.id
      LIMIT 1
    `;
    
    const result = await pool.query(query, [
      `%${host_element}%`,
      `%${adjacent_element}%`,
      `%${exposure}%`
    ]);

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        suggested_detail: null,
        explanation: 'No matching detail found for the given context.'
      });
    }

    const suggestedDetail = result.rows[0];
    
    let explanationParts = [];
    if (suggestedDetail.host_element.toLowerCase().includes(host_element.toLowerCase())) {
      explanationParts.push(`compatible with ${host_element} as host element`);
    }
    if (suggestedDetail.adjacent_element.toLowerCase().includes(adjacent_element.toLowerCase())) {
      explanationParts.push(`works with ${adjacent_element} as adjacent element`);
    }
    if (suggestedDetail.exposure.toLowerCase().includes(exposure.toLowerCase())) {
      explanationParts.push(`suitable for ${exposure} exposure`);
    }

    const explanation = `This detail (${suggestedDetail.title}) is recommended because it is ${explanationParts.join(' and ')}.`;

    res.json({
      success: true,
      suggested_detail: {
        id: suggestedDetail.id,
        title: suggestedDetail.title,
        category: suggestedDetail.category,
        tags: suggestedDetail.tags,
        description: suggestedDetail.description,
        usage_context: {
          host_element: suggestedDetail.host_element,
          adjacent_element: suggestedDetail.adjacent_element,
          exposure: suggestedDetail.exposure
        }
      },
      explanation: explanation
    });
  } catch (error) {
    console.error('Error suggesting detail:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Detail Library API is running',
    timestamp: new Date().toISOString()
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API endpoints available at http://localhost:${PORT}`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  pool.end(() => {
    console.log('Database pool closed');
  });
});