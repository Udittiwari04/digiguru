

const express = require('express');
const puppeteer = require('puppeteer');

const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Serve the HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Screenshot endpoint
app.post('/api/screenshot', async (req, res) => {
    let browser;
    
    try {
        const { url, filename } = req.body;
        
        // Validate inputs
        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        console.log(`Taking screenshot of: ${url}`);

        // Launch Puppeteer with more robust settings
        browser = await puppeteer.launch({
            headless: 'new',
            
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ],
            executablePath: '/usr/bin/chromium-browser',
            // Add these options for better resource management
            ignoreHTTPSErrors: true,
            defaultViewport: null,
            timeout: 30000
        });

        const page = await browser.newPage();
        
        // Set viewport for consistent screenshots
        await page.setViewport({
            width: 1200,
            height: 800,
            deviceScaleFactor: 1
        });


        
        // Configure page behavior
        await page.setDefaultNavigationTimeout(10000); // Reduced from 30000 to 10000 ms
        await page.setDefaultTimeout(7000); // Reduced from 15000 to 7000 ms

        // Navigate to the URL with better error handling
        try {
            await page.goto(url, {
                waitUntil: ['load', 'domcontentloaded', 'networkidle0'],
                timeout: 10000 // Reduced from 30000 to 10000 ms
            });
        } catch (navigationError) {
            console.warn('Navigation warning:', navigationError.message);
            
        }

        // Wait for page to stabilize (optional: you can reduce/remove this for speed)
        await page.waitForFunction(() => {
            return document.readyState === 'complete';
        }, { timeout: 5000 }); 


        const screenshot = await page.screenshot({
            type: 'png',
            fullPage: true,
            encoding: 'binary'
        });

        // Set response headers for download
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Disposition', `attachment; filename="${filename || 'screenshot.png'}"`);
        
        // Send the screenshot
        res.send(screenshot);

        console.log('Screenshot taken successfully');

    } catch (error) {
        console.error('Screenshot error:', error);
        res.status(500).json({ 
            error: 'Failed to capture screenshot',
            message: error.message 
        });
    } finally {
        // Close the browser properly with error handling
        if (browser) {
            try {
                await browser.close();
                console.log('Browser instance closed successfully');
            } catch (closeError) {
                console.error('Error closing browser:', closeError);
                // Force kill the process if browser can't be closed
                if (browser.process() != null) {
                    browser.process().kill('SIGKILL');
                }
            }
        }
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT} to view the infographic website`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    process.exit(0);
});