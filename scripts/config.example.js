// Configuration template
// Copy this file to config.js and add your API key
// Or use environment variables during build/deployment

const CONFIG = {
    apiKey: 'YOUR_API_KEY_HERE', // Replace with your actual API key
    apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'
};

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
