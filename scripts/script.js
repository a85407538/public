const chatBox = document.getElementById('chat-box');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const clearChatBtn = document.getElementById('clear-chat');
const themeToggleBtn = document.getElementById('theme-toggle');
const loadingOverlay = document.getElementById('loading-overlay');


// Configuration API (from config.js)
const apiKey = CONFIG.apiKey;
const apiUrl = CONFIG.apiUrl + '?key=' + apiKey;

let conversationHistory = [];
let isTyping = false;

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    initializeTheme();
    initializeChat();
    setupEventListeners();
    createParticles();
});

function initializeChat() {
    // Masquer le message de bienvenue après la première interaction
    const welcomeMessage = document.querySelector('.welcome-message');
    if (welcomeMessage && conversationHistory.length > 0) {
        welcomeMessage.style.display = 'none';
    }
}

function setupEventListeners() {
    // Envoi de message
    sendBtn.addEventListener('click', handleSendMessage);
    userInput.addEventListener('keydown', handleKeyPress);

    // Actions rapides
    document.querySelectorAll('.quick-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const message = e.currentTarget.dataset.message;
            userInput.value = message;
            handleSendMessage();
        });
    });

    // Boutons d'action
    if (clearChatBtn) {
        clearChatBtn.addEventListener('click', clearChat);
    }
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', toggleTheme);
    }

    // Auto-resize textarea
    userInput.addEventListener('input', autoResizeTextarea);

    // Gestion du focus
    userInput.addEventListener('focus', () => {
        document.querySelector('.input-wrapper').classList.add('focused');
    });

    userInput.addEventListener('blur', () => {
        document.querySelector('.input-wrapper').classList.remove('focused');
    });
}

function handleKeyPress(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
    }
}

function autoResizeTextarea() {
    userInput.style.height = 'auto';
    userInput.style.height = Math.min(userInput.scrollHeight, 120) + 'px';
    
    // Activer/désactiver le bouton d'envoi
    sendBtn.disabled = !userInput.value.trim() || isTyping;
}

async function handleSendMessage() {
    const message = userInput.value.trim();
    if (!message || isTyping) return;
    
    // Masquer le message de bienvenue
    const welcomeMessage = document.querySelector('.welcome-message');
    if (welcomeMessage) {
        welcomeMessage.style.display = 'none';
    }
    
    // Ajouter le message utilisateur
    addMessage('user', message);
    
    // Réinitialiser l'input
    userInput.value = '';
    autoResizeTextarea();
    
    // Afficher l'indicateur de frappe
    const typingIndicator = addTypingIndicator();
    
    try {
        // Obtenir la réponse de l'IA
        const aiResponse = await getAIResponse(message);
        
        // Supprimer l'indicateur de frappe
        removeTypingIndicator(typingIndicator);
        
        // Ajouter la réponse de l'IA
        addMessage('ai', aiResponse);
        
        // Mettre à jour l'historique
        conversationHistory.push(
            { role: 'user', content: message },
            { role: 'ai', content: aiResponse }
        );
        
    } catch (error) {
        removeTypingIndicator(typingIndicator);
        addMessage('ai', "Désolé, une erreur s'est produite. Veuillez réessayer.");
        console.error('Erreur API:', error);
    }
}

async function getAIResponse(userMessage) {
    const requestBody = {
        contents: [
            ...conversationHistory.map(msg => ({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }]
            })),
            {
                role: 'user',
                parts: [{ text: userMessage }]
            }
        ],
        generationConfig: {
            temperature: 0.9,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
        },
        safetySettings: [
            {
                category: "HARM_CATEGORY_HARASSMENT",
                threshold: "BLOCK_ONLY_HIGH"
            },
            {
                category: "HARM_CATEGORY_HATE_SPEECH",
                threshold: "BLOCK_ONLY_HIGH"
            },
            {
                category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                threshold: "BLOCK_ONLY_HIGH"
            },
            {
                category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                threshold: "BLOCK_ONLY_HIGH"
            }
        ]
    };

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        if (response.status === 404) {
            throw new Error('Modèle non trouvé. Vérifiez la configuration de l\'API.');
        }
        throw new Error(`Erreur API: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        throw new Error('Réponse invalide de l\'API');
    }

    return data.candidates[0].content.parts[0].text;
}

function addMessage(sender, message) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', sender);
    
    // Avatar
    const avatar = document.createElement('div');
    avatar.classList.add('message-avatar');
    avatar.innerHTML = sender === 'user' ? 
        '<i class="fas fa-user"></i>' : 
        '<i class="fas fa-robot"></i>';
    
    // Contenu du message
    const messageContent = document.createElement('div');
    messageContent.classList.add('message-content');
    
    // Traitement du message pour les références et sources
    const processedMessage = processReferencesAndSources(message);
    messageContent.innerHTML = formatMarkdown(processedMessage.content);
    
    // Ajouter les références si elles existent
    if (processedMessage.references.length > 0) {
        const referencesSection = createReferencesSection(processedMessage.references);
        messageContent.appendChild(referencesSection);
    }
    
    // Assemblage du message
    messageElement.appendChild(avatar);
    messageElement.appendChild(messageContent);
    
    // Ajout au chat
    chatBox.appendChild(messageElement);
    scrollToBottom();
    
    // Post-traitement
    setTimeout(() => {
        enhanceCodeBlocks();
        highlightSyntax();
        processLinks();
    }, 100);
}

function addTypingIndicator() {
    isTyping = true;
    sendBtn.disabled = true;
    
    const typingElement = document.createElement('div');
    typingElement.classList.add('message', 'ai', 'typing-message');
    typingElement.innerHTML = `
        <div class="message-avatar">
            <i class="fas fa-robot"></i>
        </div>
        <div class="message-content">
            <div class="typing-indicator">
                <span>L'IA réfléchit</span>
                <div class="typing-dots">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>
        </div>
    `;
    
    chatBox.appendChild(typingElement);
    scrollToBottom();
    
    return typingElement;
}

function removeTypingIndicator(typingElement) {
    isTyping = false;
    sendBtn.disabled = !userInput.value.trim();
    
    if (typingElement && typingElement.parentNode) {
        typingElement.remove();
    }
}

function processReferencesAndSources(message) {
    const references = [];
    let content = message;
    
    // Extraire les références [1], [2], etc.
    const referenceRegex = /\[(\d+)\]\s*([^\n\r]*(?:https?:\/\/[^\s\)]+)?[^\n\r]*)/g;
    let match;
    
    while ((match = referenceRegex.exec(message)) !== null) {
        const refNum = match[1];
        const refText = match[2].trim();
        
        if (refText) {
            references.push({
                number: refNum,
                text: refText
            });
        }
    }
    
    // Remplacer les références par des liens cliquables
    content = content.replace(/\[(\d+)\](?!\s*[^\n\r]*(?:https?:\/\/|[a-zA-Z]))/g, 
        '<a href="#ref$1" class="reference" title="Voir la référence $1">$1</a>');
    
    return { content, references };
}

function createReferencesSection(references) {
    const section = document.createElement('div');
    section.classList.add('references-section');
    
    const title = document.createElement('h4');
    title.textContent = 'Sources et références :';
    section.appendChild(title);
    
    const list = document.createElement('ul');
    list.classList.add('references-list');
    
    references.forEach(ref => {
        const listItem = document.createElement('li');
        listItem.setAttribute('data-ref', ref.number);
        listItem.id = `ref${ref.number}`;
        
        // Détecter et formater les URLs
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        let refText = ref.text.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
        
        listItem.innerHTML = refText;
        list.appendChild(listItem);
    });
    
    section.appendChild(list);
    return section;
}

function enhanceCodeBlocks() {
    document.querySelectorAll('pre').forEach(pre => {
        if (!pre.querySelector('.copy-btn')) {
            const container = document.createElement('div');
            container.classList.add('code-block-container');
            
            const copyBtn = document.createElement('button');
            copyBtn.classList.add('copy-btn');
            copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copier';
            copyBtn.onclick = () => copyToClipboard(pre.textContent, copyBtn);
            
            pre.parentNode.insertBefore(container, pre);
            container.appendChild(pre);
            container.appendChild(copyBtn);
        }
    });
}

function copyToClipboard(text, button) {
    navigator.clipboard.writeText(text).then(() => {
        const originalHTML = button.innerHTML;
        button.innerHTML = '<i class="fas fa-check"></i> Copié !';
        button.style.background = 'rgba(76, 175, 80, 0.2)';
        
        setTimeout(() => {
            button.innerHTML = originalHTML;
            button.style.background = '';
        }, 2000);
    }).catch(err => {
        console.error('Erreur lors de la copie:', err);
    });
}

function highlightSyntax() {
    document.querySelectorAll('pre code').forEach((block) => {
        if (!block.classList.contains('hljs')) {
            hljs.highlightElement(block);
        }
    });
}

function processLinks() {
    document.querySelectorAll('a[href^="http"]').forEach(link => {
        if (!link.classList.contains('reference')) {
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            
            // Ajouter une icône pour les liens externes
            if (!link.querySelector('.external-icon')) {
                const icon = document.createElement('i');
                icon.classList.add('fas', 'fa-external-link-alt', 'external-icon');
                icon.style.marginLeft = '0.25rem';
                icon.style.fontSize = '0.8em';
                link.appendChild(icon);
            }
        }
    });
}

function formatMarkdown(message) {
    // Configuration de marked.js
    marked.setOptions({
        highlight: function(code, lang) {
            if (lang && hljs.getLanguage(lang)) {
                try {
                    return hljs.highlight(code, { language: lang }).value;
                } catch (err) {}
            }
            return hljs.highlightAuto(code).value;
        },
        breaks: true,
        gfm: true,
        tables: true,
        sanitize: false
    });
    
    let processedMessage = message;
    
    // Traitement des éléments spéciaux
    processedMessage = processedMessage.replace(/==(.*?)==/g, '<mark>$1</mark>');
    processedMessage = processedMessage.replace(/\$\$(.*?)\$\$/g, '<code class="math">$1</code>');
    processedMessage = processedMessage.replace(/\$(.*?)\$/g, '<code class="math-inline">$1</code>');
    
    return marked.parse(processedMessage);
}

function clearChat() {
    // Animation de disparition
    const messages = chatBox.querySelectorAll('.message');
    messages.forEach((message, index) => {
        setTimeout(() => {
            message.style.animation = 'fadeOut 0.3s ease-out forwards';
            setTimeout(() => message.remove(), 300);
        }, index * 50);
    });
    
    // Réinitialiser l'historique
    setTimeout(() => {
        conversationHistory = [];
        
        // Réafficher le message de bienvenue
        const welcomeMessage = document.querySelector('.welcome-message');
        if (welcomeMessage) {
            welcomeMessage.style.display = 'block';
            welcomeMessage.style.animation = 'fadeInUp 0.8s ease-out';
        }
    }, messages.length * 50 + 300);
}

function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);

    // Update icon
    const icon = themeToggleBtn.querySelector('i');
    if (newTheme === 'dark') {
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
    } else {
        icon.classList.remove('fa-sun');
        icon.classList.add('fa-moon');
    }
}

// Initialize theme on load
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);

    if (themeToggleBtn) {
        const icon = themeToggleBtn.querySelector('i');
        if (savedTheme === 'dark') {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        }
    }
}

function scrollToBottom() {
    chatBox.scrollTo({
        top: chatBox.scrollHeight,
        behavior: 'smooth'
    });
}

function createParticles() {
    const particlesContainer = document.getElementById('particles-background');
    const particleCount = 50;
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.style.position = 'absolute';
        particle.style.width = Math.random() * 4 + 1 + 'px';
        particle.style.height = particle.style.width;
        particle.style.background = 'rgba(102, 126, 234, 0.1)';
        particle.style.borderRadius = '50%';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';
        particle.style.animation = `float ${Math.random() * 10 + 10}s ease-in-out infinite`;
        particle.style.animationDelay = Math.random() * 10 + 's';
        
        particlesContainer.appendChild(particle);
    }
}

// Animation CSS pour fadeOut
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeOut {
        from { opacity: 1; transform: translateY(0); }
        to { opacity: 0; transform: translateY(-20px); }
    }
`;
document.head.appendChild(style);

// Focus automatique sur l'input au chargement
window.addEventListener('load', () => {
    userInput.focus();
});
