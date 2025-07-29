// Editor-specific JavaScript
let editor;
let isMobile = false;
let ogOverlayVisible = false;
let isDragging = false;
let dragOffset = { x: 0, y: 0 };
let validationEnabled = true;
let validationMarkers = [];
let isOverlayResizing = false;
let resizeHandle = null;
let overlaySize = { width: 1200, height: 630 };

// HTML Validation System
class HTMLValidator {
    constructor() {
        this.errorTypes = {
            UNCLOSED_TAG: 'unclosed-tag',
            INVALID_NESTING: 'invalid-nesting',
            MISSING_ATTRIBUTE: 'missing-attribute',
            INVALID_ATTRIBUTE: 'invalid-attribute',
            DUPLICATE_ATTRIBUTE: 'duplicate-attribute',
            SYNTAX_ERROR: 'syntax-error',
            ACCESSIBILITY: 'accessibility',
            SEO: 'seo'
        };
        
        this.voidElements = new Set([
            'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
            'link', 'meta', 'param', 'source', 'track', 'wbr'
        ]);
        
        this.blockElements = new Set([
            'div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'section',
            'article', 'header', 'footer', 'nav', 'main', 'aside', 'ul', 'ol', 'li'
        ]);
        
        this.inlineElements = new Set([
            'span', 'a', 'strong', 'em', 'b', 'i', 'code', 'small', 'mark'
        ]);
    }
    
    validate(htmlContent) {
        const errors = [];
        const lines = htmlContent.split('\n');
        
        // Parse HTML and validate
        try {
            errors.push(...this.validateSyntax(htmlContent, lines));
            errors.push(...this.validateStructure(htmlContent, lines));
            errors.push(...this.validateAccessibility(htmlContent, lines));
            errors.push(...this.validateSEO(htmlContent, lines));
        } catch (error) {
            console.error('Validation error:', error);
        }
        
        return errors;
    }
    
    validateSyntax(htmlContent, lines) {
        const errors = [];
        const tagStack = [];
        const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;
        
        let match;
        while ((match = tagRegex.exec(htmlContent)) !== null) {
            const fullMatch = match[0];
            const tagName = match[1].toLowerCase();
            const startPos = match.index;
            const position = this.getLineAndColumn(htmlContent, startPos);
            
            // Check for malformed tags
            if (!fullMatch.endsWith('>')) {
                errors.push({
                    type: this.errorTypes.SYNTAX_ERROR,
                    message: `Malformed tag: missing closing '>'`,
                    line: position.line,
                    column: position.column,
                    endLine: position.line,
                    endColumn: position.column + fullMatch.length,
                    severity: 'error'
                });
                continue;
            }
            
            const isClosingTag = fullMatch.startsWith('</');
            const isSelfClosing = fullMatch.endsWith('/>') || this.voidElements.has(tagName);
            
            if (isClosingTag) {
                // Check for matching opening tag
                const lastOpenTag = tagStack.pop();
                if (!lastOpenTag) {
                    errors.push({
                        type: this.errorTypes.SYNTAX_ERROR,
                        message: `Unexpected closing tag '</${tagName}>'`,
                        line: position.line,
                        column: position.column,
                        endLine: position.line,
                        endColumn: position.column + fullMatch.length,
                        severity: 'error'
                    });
                } else if (lastOpenTag.tagName !== tagName) {
                    errors.push({
                        type: this.errorTypes.UNCLOSED_TAG,
                        message: `Mismatched closing tag: expected '</${lastOpenTag.tagName}>' but found '</${tagName}>'`,
                        line: position.line,
                        column: position.column,
                        endLine: position.line,
                        endColumn: position.column + fullMatch.length,
                        severity: 'error'
                    });
                    // Put the tag back on stack since it wasn't properly closed
                    tagStack.push(lastOpenTag);
                }
            } else if (!isSelfClosing) {
                // Opening tag - add to stack
                tagStack.push({
                    tagName,
                    line: position.line,
                    column: position.column,
                    fullMatch
                });
            }
            
            // Validate attributes
            errors.push(...this.validateAttributes(fullMatch, tagName, position));
        }
        
        // Check for unclosed tags
        tagStack.forEach(tag => {
            errors.push({
                type: this.errorTypes.UNCLOSED_TAG,
                message: `Unclosed tag '<${tag.tagName}>'`,
                line: tag.line,
                column: tag.column,
                endLine: tag.line,
                endColumn: tag.column + tag.fullMatch.length,
                severity: 'error'
            });
        });
        
        return errors;
    }
    
    validateAttributes(tagHtml, tagName, position) {
        const errors = [];
        const attributeRegex = /\s+([a-zA-Z-]+)(?:=["']([^"']*)["']|=([^\s>]+)|(?=\s|>))/g;
        const attributes = new Set();
        
        let match;
        while ((match = attributeRegex.exec(tagHtml)) !== null) {
            const attrName = match[1].toLowerCase();
            const attrValue = match[2] || match[3] || '';
            const attrStart = position.column + match.index;
            
            // Check for duplicate attributes
            if (attributes.has(attrName)) {
                errors.push({
                    type: this.errorTypes.DUPLICATE_ATTRIBUTE,
                    message: `Duplicate attribute '${attrName}'`,
                    line: position.line,
                    column: attrStart,
                    endLine: position.line,
                    endColumn: attrStart + match[0].length,
                    severity: 'warning'
                });
            }
            attributes.add(attrName);
            
            // Validate specific attributes
            if (attrName === 'id' && !attrValue) {
                errors.push({
                    type: this.errorTypes.INVALID_ATTRIBUTE,
                    message: `Empty 'id' attribute`,
                    line: position.line,
                    column: attrStart,
                    endLine: position.line,
                    endColumn: attrStart + match[0].length,
                    severity: 'warning'
                });
            }
            
            if (attrName === 'href' && tagName === 'a' && !attrValue) {
                errors.push({
                    type: this.errorTypes.INVALID_ATTRIBUTE,
                    message: `Empty 'href' attribute in link`,
                    line: position.line,
                    column: attrStart,
                    endLine: position.line,
                    endColumn: attrStart + match[0].length,
                    severity: 'warning'
                });
            }
            
            if (attrName === 'src' && ['img', 'script', 'iframe'].includes(tagName) && !attrValue) {
                errors.push({
                    type: this.errorTypes.INVALID_ATTRIBUTE,
                    message: `Empty 'src' attribute in ${tagName}`,
                    line: position.line,
                    column: attrStart,
                    endLine: position.line,
                    endColumn: attrStart + match[0].length,
                    severity: 'error'
                });
            }
        }
        
        return errors;
    }
    
    validateStructure(htmlContent, lines) {
        const errors = [];
        
        // Check for proper document structure
        if (!htmlContent.includes('<!DOCTYPE')) {
            errors.push({
                type: this.errorTypes.MISSING_ATTRIBUTE,
                message: `Missing DOCTYPE declaration`,
                line: 1,
                column: 1,
                endLine: 1,
                endColumn: 1,
                severity: 'warning'
            });
        }
        
        if (!htmlContent.includes('<html')) {
            errors.push({
                type: this.errorTypes.MISSING_ATTRIBUTE,
                message: `Missing <html> element`,
                line: 1,
                column: 1,
                endLine: 1,
                endColumn: 1,
                severity: 'warning'
            });
        }
        
        if (!htmlContent.includes('<head>')) {
            errors.push({
                type: this.errorTypes.MISSING_ATTRIBUTE,
                message: `Missing <head> element`,
                line: 1,
                column: 1,
                endLine: 1,
                endColumn: 1,
                severity: 'warning'
            });
        }
        
        if (!htmlContent.includes('<body>')) {
            errors.push({
                type: this.errorTypes.MISSING_ATTRIBUTE,
                message: `Missing <body> element`,
                line: 1,
                column: 1,
                endLine: 1,
                endColumn: 1,
                severity: 'warning'
            });
        }
        
        return errors;
    }
    
    validateAccessibility(htmlContent, lines) {
        const errors = [];
        const imgRegex = /<img[^>]*>/g;
        
        let match;
        while ((match = imgRegex.exec(htmlContent)) !== null) {
            const imgTag = match[0];
            const position = this.getLineAndColumn(htmlContent, match.index);
            
            if (!imgTag.includes('alt=')) {
                errors.push({
                    type: this.errorTypes.ACCESSIBILITY,
                    message: `Image missing 'alt' attribute for accessibility`,
                    line: position.line,
                    column: position.column,
                    endLine: position.line,
                    endColumn: position.column + imgTag.length,
                    severity: 'warning'
                });
            }
        }
        
        // Check for form inputs without labels
        const inputRegex = /<input[^>]*>/g;
        while ((match = inputRegex.exec(htmlContent)) !== null) {
            const inputTag = match[0];
            const position = this.getLineAndColumn(htmlContent, match.index);
            
            if (!inputTag.includes('aria-label=') && !inputTag.includes('id=')) {
                errors.push({
                    type: this.errorTypes.ACCESSIBILITY,
                    message: `Input element should have 'aria-label' or be associated with a label`,
                    line: position.line,
                    column: position.column,
                    endLine: position.line,
                    endColumn: position.column + inputTag.length,
                    severity: 'info'
                });
            }
        }
        
        return errors;
    }
    
    validateSEO(htmlContent, lines) {
        const errors = [];
        
        if (!htmlContent.includes('<title>')) {
            errors.push({
                type: this.errorTypes.SEO,
                message: `Missing <title> element - important for SEO`,
                line: 1,
                column: 1,
                endLine: 1,
                endColumn: 1,
                severity: 'info'
            });
        }
        
        if (!htmlContent.includes('name="description"')) {
            errors.push({
                type: this.errorTypes.SEO,
                message: `Missing meta description - important for SEO`,
                line: 1,
                column: 1,
                endLine: 1,
                endColumn: 1,
                severity: 'info'
            });
        }
        
        // Check heading hierarchy
        const headingRegex = /<h([1-6])[^>]*>/g;
        const headings = [];
        
        let match;
        while ((match = headingRegex.exec(htmlContent)) !== null) {
            const level = parseInt(match[1]);
            const position = this.getLineAndColumn(htmlContent, match.index);
            headings.push({ level, position });
        }
        
        // Check for proper heading hierarchy
        for (let i = 1; i < headings.length; i++) {
            const prev = headings[i - 1];
            const curr = headings[i];
            
            if (curr.level > prev.level + 1) {
                errors.push({
                    type: this.errorTypes.SEO,
                    message: `Heading hierarchy skipped from h${prev.level} to h${curr.level}`,
                    line: curr.position.line,
                    column: curr.position.column,
                    endLine: curr.position.line,
                    endColumn: curr.position.column + 4,
                    severity: 'info'
                });
            }
        }
        
        return errors;
    }
    
    getLineAndColumn(content, index) {
        const lines = content.substring(0, index).split('\n');
        return {
            line: lines.length,
            column: lines[lines.length - 1].length + 1
        };
    }
}

// Initialize validation system
const htmlValidator = new HTMLValidator();

// Clear editor content - moved outside Monaco require block to be available immediately
function clearEditor() {
    console.log('clearEditor function called');
    console.log('editor variable:', editor);
    console.log('typeof editor:', typeof editor);
    
    // Check if editor is available and properly initialized
    if (!editor) {
        console.error('Editor not initialized!');
        alert('Editor not initialized yet. Please wait a moment and try again.');
        return;
    }
    
    // Additional check to ensure editor has the setValue method
    if (typeof editor.setValue !== 'function') {
        console.error('Editor setValue method not available!');
        alert('Editor not properly initialized. Please refresh the page and try again.');
        return;
    }
    
    // Clear immediately without confirmation
    try {
        console.log('Attempting to clear editor...');
        editor.setValue('');
        console.log('Editor cleared successfully');
        
        // Show success notification
        if (typeof showCopyNotification === 'function') {
            showCopyNotification('Editor cleared!', 'success');
        }
        
        // Update preview to reflect empty editor
        if (typeof updatePreview === 'function') {
            updatePreview();
        }
        
        // Reset current document reference
        if (window.documentStorage && window.documentStorage.currentDocument) {
            window.documentStorage.currentDocument = null;
            console.log('Current document reference cleared');
        }
    } catch (error) {
        console.error('Error clearing editor:', error);
        alert('Error clearing editor: ' + error.message);
    }
}

// Make clearEditor globally available
window.clearEditor = clearEditor;

// Set up the clear button event listener 
document.addEventListener('DOMContentLoaded', function() {
    const clearBtn = document.getElementById('clearBtn');
    if (clearBtn) {
        console.log('Setting up clear button event listener');
        clearBtn.addEventListener('click', clearEditor);
        console.log('Clear button event listener attached successfully');
    } else {
        console.warn('Clear button not found in DOM');
    }
});

// Initialize Monaco Editor
require.config({ paths: { vs: 'https://unpkg.com/monaco-editor@0.44.0/min/vs' } });
require(['vs/editor/editor.main'], function () {
    // Absolutely unhinged preview content collection
    const previewContent = [
        // Absolute Degeneracy Mode
        { title: "we live in a society", text: "where HTML previews go this hard for literally no reason. bottom text. your move, tailwind." },
        { title: "sir this is a wendy's", text: "and yet here you are, writing code at 3am. the preview respects the grind. goblin mode activated." },
        
        // Feral Coding Hours
        { title: "unalive me.js", text: "jk jk... unless your code doesn't match this preview's energy. then it's on sight. choose violence." },
        { title: "i'm baby", text: "but this glassmorphism? full grown. mature. aged like fine wine in a digital cellar. chef's kiss." },
        
        // Maximum Cope
        { title: "L + ratio + you fell off", text: "+ your HTML is mid + this preview clears + touch DOM + maidenless behavior + skill issue" },
        { title: "he's literally just sitting there", text: "menacingly. this preview has done nothing wrong ever in its life. we stan. no choice but to code." },
        
        // Delulu Developer Arc
        { title: "gaslight gatekeep girlcode", text: "this preview isn't real it can't hurt you. the preview: absolutely demolishing with dark mode excellence" },
        { title: "hear me out...", text: "what if we just... never wrote bad code again? this preview has inspired world peace. nobel prize when?" },
        
        // Chronically Online Syndrome
        { title: "bestie wake up", text: "new preview just dropped and it's giving main character energy. your divs could never relate." },
        { title: "caught in 4k", text: "writing vanilla CSS in 2025? couldn't be me. but this preview? cinematography. oscar worthy. IMAX quality." },
        
        // Unhinged Tech Bro Energy
        { title: "10x preview", text: "while you were partying, i studied the glassmorphism. this preview just disrupted the entire industry." },
        { title: "NPC behavior", text: "using default previews. this one hits different. built different. constructed alternatively if you will." },
        
        // Brain Smoothening Content
        { title: "babe it's 4pm", text: "time for your daily existential crisis about whether your code sparks joy. this preview does btw." },
        { title: "i ain't reading all that", text: "i'm happy for u tho. or sorry that happened. either way this preview absolutely devours." },
        
        // Peak Internet Poisoning
        { title: "weird flex but ok", text: "imagine not having a preview this clean. couldn't be you. unless... haha jk... unless? 😳" },
        { title: "call that HTML aura", text: "+1000 aura for using this preview. -10000 for inline styles. them's the rules i don't make them." }
    ];
    
    // Pick random content
    const randomContent = previewContent[Math.floor(Math.random() * previewContent.length)];
    
    const initialContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
            background: #0a0a0a;
            color: white;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            overflow: hidden;
            position: relative;
        }
        
        /* Animated gradient orbs for background */
        body::before,
        body::after {
            content: '';
            position: absolute;
            width: 400px;
            height: 400px;
            border-radius: 50%;
            filter: blur(80px);
            opacity: 0.4;
        }
        
        body::before {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            top: -200px;
            right: -100px;
            animation: float 20s ease-in-out infinite;
        }
        
        body::after {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            bottom: -200px;
            left: -100px;
            animation: float 20s ease-in-out infinite reverse;
        }
        
        /* Glass container */
        .container {
            text-align: center;
            max-width: 600px;
            background: rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border-radius: 24px;
            padding: 60px 40px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 
                0 8px 32px rgba(0, 0, 0, 0.3),
                inset 0 1px 0 rgba(255, 255, 255, 0.1);
            position: relative;
            z-index: 1;
            animation: slideIn 0.8s ease-out;
        }
        
        /* Additional glass layer for depth */
        .container::before {
            content: '';
            position: absolute;
            inset: -1px;
            background: linear-gradient(135deg, 
                rgba(255, 255, 255, 0.1) 0%, 
                rgba(255, 255, 255, 0.05) 50%,
                rgba(255, 255, 255, 0) 100%);
            border-radius: 24px;
            z-index: -1;
            opacity: 0.5;
        }
        
        h1 {
            font-size: 3.5rem;
            font-weight: 700;
            margin-bottom: 1.5rem;
            background: linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.7) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            letter-spacing: -0.02em;
            animation: fadeInUp 0.8s ease-out;
            text-shadow: 0 0 40px rgba(255, 255, 255, 0.1);
        }
        
        p {
            font-size: 1.2rem;
            opacity: 0.8;
            line-height: 1.8;
            animation: fadeInUp 0.8s ease-out 0.2s both;
            color: rgba(255, 255, 255, 0.9);
            font-weight: 300;
        }
        
        /* Subtle glow effect on hover */
        .container:hover {
            background: rgba(255, 255, 255, 0.08);
            border-color: rgba(255, 255, 255, 0.2);
            transform: translateY(-2px);
            transition: all 0.3s ease;
        }
        
        /* Floating animation for background orbs */
        @keyframes float {
            0%, 100% {
                transform: translate(0, 0) rotate(0deg);
            }
            33% {
                transform: translate(30px, -30px) rotate(120deg);
            }
            66% {
                transform: translate(-20px, 20px) rotate(240deg);
            }
        }
        
        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        @keyframes slideIn {
            from {
                opacity: 0;
                transform: scale(0.9) translateY(20px);
            }
            to {
                opacity: 1;
                transform: scale(1) translateY(0);
            }
        }
        
        /* Responsive adjustments */
        @media (max-width: 600px) {
            .container {
                padding: 40px 30px;
            }
            
            h1 {
                font-size: 2.5rem;
            }
            
            p {
                font-size: 1.1rem;
            }
            
            body::before,
            body::after {
                width: 300px;
                height: 300px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>${randomContent.title}</h1>
        <p>${randomContent.text}</p>
    </div>
</body>
</html>`;

    editor = monaco.editor.create(document.getElementById('editor-container'), {
        value: initialContent,
        language: 'html',
        theme: 'vs',
        automaticLayout: true,
        fontSize: 13,
        lineHeight: 1.6,
        fontFamily: "'SF Mono', 'Monaco', 'Cascadia Code', 'Roboto Mono', monospace",
        minimap: { enabled: true },
        wordWrap: 'on',
        formatOnPaste: true,
        formatOnType: true,
        autoIndent: 'full',
        folding: true,
        lineNumbers: 'on',
        renderWhitespace: 'selection',
        bracketPairColorization: { enabled: true },
        guides: {
            bracketPairs: true,
            indentation: true
        },
        suggest: {
            insertMode: 'replace'
        },
        quickSuggestions: {
            other: true,
            comments: true,
            strings: true
        },
        parameterHints: { enabled: true },
        hover: { enabled: true },
        contextmenu: true,
        mouseWheelZoom: true,
        smoothScrolling: true,
        cursorBlinking: 'smooth',
        cursorSmoothCaretAnimation: true,
        renderLineHighlight: 'gutter',
        selectOnLineNumbers: true,
        roundedSelection: false,
        scrollBeyondLastLine: false,
        readOnly: false,
        domReadOnly: false
    });

    // Set up HTML validation - delay to ensure DOM is ready
    setTimeout(() => {
        setupHTMLValidation();
    }, 100);

    // Update preview when content changes
    editor.onDidChangeModelContent(() => {
        updatePreview();
        if (validationEnabled) {
            validateHTML();
        }
    });
    
    // Initial preview and validation
    updatePreview();
    if (validationEnabled) {
        validateHTML();
    }
});

// HTML Validation Setup
function setupHTMLValidation() {
    // Add validation toggle to header controls
    const headerControls = document.querySelector('.editor-pane .header-controls');
    if (headerControls) {
        const validationToggle = document.createElement('button');
        validationToggle.className = 'action-btn secondary';
        validationToggle.id = 'validationToggle';
        validationToggle.title = 'Toggle HTML validation';
        validationToggle.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
            </svg>
        `;
        validationToggle.onclick = toggleValidation;
        
        // Insert before the clear button - with error handling
        const clearBtn = document.getElementById('clearBtn');
        if (clearBtn) {
            headerControls.insertBefore(validationToggle, clearBtn);
        } else {
            // Fallback: append to the end if clear button not found
            console.warn('Clear button not found, appending validation toggle to header controls');
            headerControls.appendChild(validationToggle);
        }
    }
}

function validateHTML() {
    if (!editor || !validationEnabled) return;
    
    const htmlContent = editor.getValue();
    const errors = htmlValidator.validate(htmlContent);
    
    // Clear previous markers
    if (validationMarkers.length > 0) {
        editor.deltaDecorations(validationMarkers, []);
        validationMarkers = [];
    }
    
    // Convert errors to Monaco markers
    const markers = errors.map(error => ({
        startLineNumber: error.line,
        startColumn: error.column,
        endLineNumber: error.endLine,
        endColumn: error.endColumn,
        message: error.message,
        severity: getMonacoSeverity(error.severity),
        source: 'html-validator'
    }));
    
    // Set markers in Monaco
    monaco.editor.setModelMarkers(editor.getModel(), 'html-validator', markers);
    
    // Add decorations for better visibility
    const decorations = errors.map(error => ({
        range: {
            startLineNumber: error.line,
            startColumn: error.column,
            endLineNumber: error.endLine,
            endColumn: error.endColumn
        },
        options: {
            className: `validation-${error.severity}`,
            stickiness: 1,
            hoverMessage: {
                value: `**${error.severity.toUpperCase()}**: ${error.message}`
            }
        }
    }));
    
    validationMarkers = editor.deltaDecorations([], decorations);
    
    // Update validation status in UI
    updateValidationStatus(errors);
}

function getMonacoSeverity(severity) {
    switch (severity) {
        case 'error': return monaco.MarkerSeverity.Error;
        case 'warning': return monaco.MarkerSeverity.Warning;
        case 'info': return monaco.MarkerSeverity.Info;
        default: return monaco.MarkerSeverity.Hint;
    }
}

function toggleValidation() {
    validationEnabled = !validationEnabled;
    const toggleBtn = document.getElementById('validationToggle');
    
    if (validationEnabled) {
        toggleBtn.classList.remove('secondary');
        toggleBtn.classList.add('save');
        toggleBtn.title = 'HTML validation enabled - Click to disable';
        validateHTML();
        showCopyNotification('HTML validation enabled', 'success');
    } else {
        toggleBtn.classList.remove('save');
        toggleBtn.classList.add('secondary');
        toggleBtn.title = 'HTML validation disabled - Click to enable';
        
        // Clear all markers and decorations
        monaco.editor.setModelMarkers(editor.getModel(), 'html-validator', []);
        if (validationMarkers.length > 0) {
            editor.deltaDecorations(validationMarkers, []);
            validationMarkers = [];
        }
        clearValidationStatus();
        showCopyNotification('HTML validation disabled', 'info');
    }
}

function updateValidationStatus(errors) {
    // Remove existing status
    const existingStatus = document.querySelector('.validation-status');
    if (existingStatus) {
        existingStatus.remove();
    }
    
    if (errors.length === 0) {
        // Show success indicator
        const statusEl = document.createElement('div');
        statusEl.className = 'validation-status validation-success';
        statusEl.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
            </svg>
            <span>No validation errors</span>
        `;
        
        document.body.appendChild(statusEl);
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            if (statusEl.parentNode) {
                statusEl.remove();
            }
        }, 3000);
    } else {
        // Show error count with click functionality
        const errorCount = errors.filter(e => e.severity === 'error').length;
        const warningCount = errors.filter(e => e.severity === 'warning').length;
        const infoCount = errors.filter(e => e.severity === 'info').length;
        
        if (errorCount > 0 || warningCount > 0 || infoCount > 0) {
            const statusEl = document.createElement('div');
            statusEl.className = `validation-status validation-${errorCount > 0 ? 'error' : (warningCount > 0 ? 'warning' : 'info')} clickable`;
            
            let message = '';
            if (errorCount > 0) message += `${errorCount} error${errorCount > 1 ? 's' : ''}`;
            if (warningCount > 0) {
                if (message) message += ', ';
                message += `${warningCount} warning${warningCount > 1 ? 's' : ''}`;
            }
            if (infoCount > 0) {
                if (message) message += ', ';
                message += `${infoCount} suggestion${infoCount > 1 ? 's' : ''}`;
            }
            
            statusEl.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                    <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" stroke-width="2"/>
                    <path d="M12 16h.01" stroke="currentColor" stroke-width="2"/>
                </svg>
                <span>${message}</span>
                <span class="click-hint">Click for details</span>
            `;
            
            statusEl.addEventListener('click', () => showValidationDetails(errors));
            statusEl.style.cursor = 'pointer';
            
            document.body.appendChild(statusEl);
        }
    }
}

function showValidationDetails(errors) {
    // Remove existing validation panel
    const existingPanel = document.querySelector('.validation-panel');
    if (existingPanel) {
        existingPanel.remove();
        return; // Toggle behavior
    }
    
    // Create validation details panel
    const panel = document.createElement('div');
    panel.className = 'validation-panel';
    
    const header = document.createElement('div');
    header.className = 'validation-panel-header';
    header.innerHTML = `
        <h3>Validation Issues</h3>
        <button class="validation-panel-close" onclick="this.parentElement.parentElement.remove()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2"/>
                <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2"/>
            </svg>
        </button>
    `;
    
    const content = document.createElement('div');
    content.className = 'validation-panel-content';
    
    // Group errors by severity
    const groupedErrors = {
        error: errors.filter(e => e.severity === 'error'),
        warning: errors.filter(e => e.severity === 'warning'),
        info: errors.filter(e => e.severity === 'info')
    };
    
    Object.entries(groupedErrors).forEach(([severity, severityErrors]) => {
        if (severityErrors.length === 0) return;
        
        const severitySection = document.createElement('div');
        severitySection.className = `validation-section validation-section-${severity}`;
        
        const severityHeader = document.createElement('div');
        severityHeader.className = 'validation-section-header';
        severityHeader.innerHTML = `
            <div class="severity-icon">
                ${getSeverityIcon(severity)}
            </div>
            <span>${severity.charAt(0).toUpperCase() + severity.slice(1)}s (${severityErrors.length})</span>
        `;
        
        const errorsList = document.createElement('div');
        errorsList.className = 'validation-errors-list';
        
        severityErrors.forEach((error, index) => {
            const errorItem = document.createElement('div');
            errorItem.className = 'validation-error-item';
            errorItem.innerHTML = `
                <div class="error-location">Line ${error.line}:${error.column}</div>
                <div class="error-message">${error.message}</div>
                <div class="error-type">${error.type.replace(/-/g, ' ')}</div>
            `;
            
            // Make error item clickable to jump to line
            errorItem.addEventListener('click', () => {
                jumpToError(error);
                // Highlight the clicked error
                errorItem.classList.add('highlighted');
                setTimeout(() => errorItem.classList.remove('highlighted'), 2000);
            });
            
            errorsList.appendChild(errorItem);
        });
        
        severitySection.appendChild(severityHeader);
        severitySection.appendChild(errorsList);
        content.appendChild(severitySection);
    });
    
    // Add quick actions
    const actions = document.createElement('div');
    actions.className = 'validation-panel-actions';
    actions.innerHTML = `
        <button class="validation-action-btn" onclick="jumpToNextError()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <polyline points="9,18 15,12 9,6" stroke="currentColor" stroke-width="2"/>
            </svg>
            Next Issue
        </button>
        <button class="validation-action-btn" onclick="focusEditor()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7V17C2 17.5304 2.21071 18.0391 2.58579 18.4142C2.96086 18.7893 3.46957 19 4 19H20C20.5304 19 21.0391 18.7893 21.4142 18.4142C21.7893 18.0391 22 17.5304 22 17V7L12 2Z" stroke="currentColor" stroke-width="2"/>
            </svg>
            Focus Editor
        </button>
        <button class="validation-action-btn" onclick="copyValidationReport()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="currentColor" stroke-width="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="2"/>
            </svg>
            Copy Report
        </button>
    `;
    
    panel.appendChild(header);
    panel.appendChild(content);
    panel.appendChild(actions);
    
    document.body.appendChild(panel);
    
    // Store current errors for navigation
    window.currentValidationErrors = errors.filter(e => e.severity === 'error' || e.severity === 'warning');
    window.currentErrorIndex = 0;
}

function getSeverityIcon(severity) {
    switch (severity) {
        case 'error':
            return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                <line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" stroke-width="2"/>
                <line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" stroke-width="2"/>
            </svg>`;
        case 'warning':
            return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="currentColor" stroke-width="2"/>
                <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" stroke-width="2"/>
                <path d="M12 17h.01" stroke="currentColor" stroke-width="2"/>
            </svg>`;
        case 'info':
            return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                <path d="M12 16v-4" stroke="currentColor" stroke-width="2"/>
                <path d="M12 8h.01" stroke="currentColor" stroke-width="2"/>
            </svg>`;
        default:
            return '';
    }
}

function jumpToError(error) {
    if (!editor) return;
    
    try {
        // Set cursor to the error location
        editor.setPosition({
            lineNumber: error.line,
            column: error.column
        });
        
        // Reveal the line in center
        editor.revealLineInCenter(error.line);
        
        // Focus the editor
        editor.focus();
        
        // Show a temporary highlight
        const decoration = editor.deltaDecorations([], [{
            range: {
                startLineNumber: error.line,
                startColumn: error.column,
                endLineNumber: error.endLine || error.line,
                endColumn: error.endColumn || error.column + 10
            },
            options: {
                className: 'validation-jump-highlight',
                stickiness: 1
            }
        }]);
        
        // Remove highlight after 2 seconds
        setTimeout(() => {
            editor.deltaDecorations(decoration, []);
        }, 2000);
        
        showCopyNotification(`Jumped to line ${error.line}`, 'success');
    } catch (err) {
        console.error('Failed to jump to error:', err);
        showCopyNotification('Failed to jump to error location', 'error');
    }
}

function jumpToNextError() {
    if (!window.currentValidationErrors || window.currentValidationErrors.length === 0) {
        showCopyNotification('No validation errors to navigate', 'info');
        return;
    }
    
    const error = window.currentValidationErrors[window.currentErrorIndex];
    jumpToError(error);
    
    // Move to next error (cycle through)
    window.currentErrorIndex = (window.currentErrorIndex + 1) % window.currentValidationErrors.length;
}

function focusEditor() {
    if (editor) {
        editor.focus();
        showCopyNotification('Editor focused', 'success');
    }
}

function copyValidationReport() {
    if (!window.currentValidationErrors) return;
    
    const errors = window.currentValidationErrors;
    let report = `HTML Validation Report\n`;
    report += `Generated: ${new Date().toLocaleString()}\n`;
    report += `Total Issues: ${errors.length}\n\n`;
    
    errors.forEach((error, index) => {
        report += `${index + 1}. ${error.severity.toUpperCase()}: ${error.message}\n`;
        report += `   Location: Line ${error.line}, Column ${error.column}\n`;
        report += `   Type: ${error.type}\n\n`;
    });
    
    navigator.clipboard.writeText(report).then(() => {
        showCopyNotification('Validation report copied to clipboard', 'success');
    }).catch(() => {
        showCopyNotification('Failed to copy validation report', 'error');
    });
}

function clearValidationStatus() {
    const existingStatus = document.querySelector('.validation-status');
    if (existingStatus) {
        existingStatus.remove();
    }
}

function updatePreview() {
    const preview = document.getElementById('preview');
    if (!editor || !preview) return;
    
    const html = editor.getValue();
    const previewDoc = preview.contentDocument || preview.contentWindow.document;
    previewDoc.open();
    previewDoc.write(html);
    previewDoc.close();
    
    // Add interactivity after content loads
    setTimeout(() => setupPreviewInteractivity(), 100);
}

// === CLICK-TO-HIGHLIGHT FUNCTIONALITY ===

// Global variable to store element-to-position mapping
let elementPositionMap = new WeakMap();
let sourceElementMap = [];

function setupPreviewInteractivity() {
    const preview = document.getElementById('preview');
    if (!preview) return;
    
    const previewDoc = preview.contentDocument || preview.contentWindow.document;
    if (!previewDoc || !previewDoc.body) return;
    
    try {
        // Parse the HTML and build position mapping
        buildElementPositionMap();
        
        // Add click listeners to all elements
        addClickListeners(previewDoc);
        
        // Add visual feedback styles
        addInteractivityStyles(previewDoc);
        
        console.log('✅ Preview interactivity enabled');
    } catch (error) {
        console.error('Failed to setup preview interactivity:', error);
    }
}

function buildElementPositionMap() {
    if (!editor) return;
    
    const htmlContent = editor.getValue();
    const lines = htmlContent.split('\n');
    
    // Clear previous mappings
    elementPositionMap = new WeakMap();
    sourceElementMap = [];
    
    // Parse HTML and create element mappings
    const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;
    let match;
    let elementStack = [];
    
    while ((match = tagRegex.exec(htmlContent)) !== null) {
        const fullMatch = match[0];
        const tagName = match[1].toLowerCase();
        const startPos = match.index;
        const endPos = match.index + fullMatch.length;
        
        // Calculate line and column numbers
        const beforeMatch = htmlContent.substring(0, startPos);
        const linesBefore = beforeMatch.split('\n');
        const lineNumber = linesBefore.length;
        const columnNumber = linesBefore[linesBefore.length - 1].length + 1;
        
        const isClosingTag = fullMatch.startsWith('</');
        const isSelfClosing = fullMatch.endsWith('/>') || ['img', 'br', 'hr', 'input', 'meta', 'link'].includes(tagName);
        
        if (isClosingTag) {
            // Find matching opening tag
            for (let i = elementStack.length - 1; i >= 0; i--) {
                if (elementStack[i].tagName === tagName) {
                    const openTag = elementStack.splice(i, 1)[0];
                    // Store complete element info
                    sourceElementMap.push({
                        tagName: tagName,
                        startLine: openTag.lineNumber,
                        startColumn: openTag.columnNumber,
                        endLine: lineNumber,
                        endColumn: columnNumber + fullMatch.length,
                        fullStartPos: openTag.startPos,
                        fullEndPos: endPos,
                        attributes: openTag.attributes
                    });
                    break;
                }
            }
        } else {
            // Extract attributes
            const attributeRegex = /\s+([a-zA-Z-]+)(?:=["']([^"']*)["'])?/g;
            const attributes = {};
            let attrMatch;
            while ((attrMatch = attributeRegex.exec(fullMatch)) !== null) {
                attributes[attrMatch[1]] = attrMatch[2] || '';
            }
            
            const elementInfo = {
                tagName: tagName,
                lineNumber: lineNumber,
                columnNumber: columnNumber,
                startPos: startPos,
                attributes: attributes
            };
            
            if (isSelfClosing) {
                // Self-closing tags are complete
                sourceElementMap.push({
                    tagName: tagName,
                    startLine: lineNumber,
                    startColumn: columnNumber,
                    endLine: lineNumber,
                    endColumn: columnNumber + fullMatch.length,
                    fullStartPos: startPos,
                    fullEndPos: endPos,
                    attributes: attributes
                });
            } else {
                // Add to stack for later matching
                elementStack.push(elementInfo);
            }
        }
    }
    
    console.log(`📍 Mapped ${sourceElementMap.length} elements`);
}

function addClickListeners(previewDoc) {
    // Remove existing listeners
    previewDoc.removeEventListener('click', handlePreviewClick);
    previewDoc.removeEventListener('mouseover', handlePreviewHover);
    previewDoc.removeEventListener('mouseout', handlePreviewHoverOut);
    
    // Add new listeners
    previewDoc.addEventListener('click', handlePreviewClick, true);
    previewDoc.addEventListener('mouseover', handlePreviewHover, true);
    previewDoc.addEventListener('mouseout', handlePreviewHoverOut, true);
}

function handlePreviewClick(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const element = event.target;
    const position = findElementPosition(element);
    
    if (position) {
        highlightInEditor(position);
        showElementInfo(element, position);
    }
}

function handlePreviewHover(event) {
    const element = event.target;
    if (element && element.tagName) {
        element.style.outline = '2px solid rgba(99, 102, 241, 0.5)';
        element.style.outlineOffset = '1px';
        element.style.cursor = 'pointer';
    }
}

function handlePreviewHoverOut(event) {
    const element = event.target;
    if (element && element.tagName) {
        element.style.outline = '';
        element.style.outlineOffset = '';
        element.style.cursor = '';
    }
}

function findElementPosition(clickedElement) {
    if (!clickedElement || !clickedElement.tagName) return null;
    
    const tagName = clickedElement.tagName.toLowerCase();
    const elementAttributes = {};
    
    // Get element attributes
    for (let attr of clickedElement.attributes || []) {
        elementAttributes[attr.name] = attr.value;
    }
    
    // Find matching element in source map
    // We'll use a scoring system to find the best match
    let bestMatch = null;
    let bestScore = 0;
    
    for (const sourceElement of sourceElementMap) {
        if (sourceElement.tagName !== tagName) continue;
        
        let score = 1; // Base score for tag name match
        
        // Score based on matching attributes
        const sourceAttrs = sourceElement.attributes || {};
        const sourceAttrCount = Object.keys(sourceAttrs).length;
        const elementAttrCount = Object.keys(elementAttributes).length;
        
        if (sourceAttrCount === 0 && elementAttrCount === 0) {
            score += 2; // Both have no attributes
        } else {
            let attrMatches = 0;
            for (const [key, value] of Object.entries(elementAttributes)) {
                if (sourceAttrs[key] === value) {
                    attrMatches++;
                    score += 3; // High score for exact attribute match
                }
            }
            
            // Prefer elements with similar attribute counts
            const attrCountDiff = Math.abs(sourceAttrCount - elementAttrCount);
            score += Math.max(0, 3 - attrCountDiff);
        }
        
        // Special scoring for unique identifiers
        if (elementAttributes.id && sourceAttrs.id === elementAttributes.id) {
            score += 10; // Very high score for ID match
        }
        
        if (elementAttributes.class && sourceAttrs.class === elementAttributes.class) {
            score += 5; // High score for class match
        }
        
        if (score > bestScore) {
            bestScore = score;
            bestMatch = sourceElement;
        }
    }
    
    return bestMatch;
}

function highlightInEditor(position) {
    if (!editor || !position) return;
    
    try {
        // Create selection range
        const selection = {
            startLineNumber: position.startLine,
            startColumn: position.startColumn,
            endLineNumber: position.endLine,
            endColumn: position.endColumn
        };
        
        // Set selection and reveal
        editor.setSelection(selection);
        editor.revealLineInCenter(position.startLine);
        
        // Add temporary highlight decoration
        const decorations = editor.deltaDecorations([], [{
            range: selection,
            options: {
                className: 'element-highlight',
                stickiness: 1
            }
        }]);
        
        // Remove highlight after 3 seconds
        setTimeout(() => {
            editor.deltaDecorations(decorations, []);
        }, 3000);
        
        console.log(`🎯 Highlighted ${position.tagName} at line ${position.startLine}`);
    } catch (error) {
        console.error('Failed to highlight in editor:', error);
    }
}

function showElementInfo(element, position) {
    // Create a temporary notification showing element info
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(99, 102, 241, 0.95);
        color: white;
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        z-index: 2001;
        animation: slideInDown 0.3s ease;
        box-shadow: 0 10px 25px rgba(0,0,0,0.1);
        backdrop-filter: blur(10px);
    `;
    
    const tagInfo = `<${position.tagName}>`;
    const lineInfo = `Line ${position.startLine}`;
    const attrInfo = Object.keys(position.attributes || {}).length > 0 
        ? ` • ${Object.keys(position.attributes).length} attributes`
        : '';
    
    notification.innerHTML = `${tagInfo} ${lineInfo}${attrInfo}`;
    
    document.body.appendChild(notification);
    
    // Remove after delay
    setTimeout(() => {
        notification.style.animation = 'slideOutUp 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 2000);
}

function addInteractivityStyles(previewDoc) {
    // Add CSS for hover effects and highlighting
    const styleElement = previewDoc.createElement('style');
    styleElement.textContent = `
        .preview-interactive-element {
            transition: outline 0.2s ease !important;
        }
        
        .preview-interactive-element:hover {
            outline: 2px solid rgba(99, 102, 241, 0.5) !important;
            outline-offset: 1px !important;
            cursor: pointer !important;
        }
        
        @keyframes slideInDown {
            from {
                transform: translateX(-50%) translateY(-20px);
                opacity: 0;
            }
            to {
                transform: translateX(-50%) translateY(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOutUp {
            from {
                transform: translateX(-50%) translateY(0);
                opacity: 1;
            }
            to {
                transform: translateX(-50%) translateY(-20px);
                opacity: 0;
            }
        }
    `;
    
    previewDoc.head.appendChild(styleElement);
}

function setupPreview(previewElement) {
    if (!editor) return;
    
    const html = editor.getValue();
    const previewDoc = previewElement.contentDocument || previewElement.contentWindow.document;
    previewDoc.open();
    previewDoc.write(html);
    previewDoc.close();
}

function formatHtmlCode() {
    if (!editor) return;
    editor.getAction('editor.action.formatDocument').run();
}

// Resizable panes functionality
const divider = document.querySelector('.divider');
const container = document.querySelector('.container');
let editorPane = document.querySelector('.editor-pane');
let previewPane = document.querySelector('.preview-pane');
let isResizing = false;
let lastUpdateTime = 0;

function updatePaneReferences() {
    editorPane = document.querySelector('.editor-pane');
    previewPane = document.querySelector('.preview-pane');
}

function startResize(e) {
    isResizing = true;
    divider.classList.add('dragging');
    container.classList.add('resizing');
    document.body.style.cursor = 'col-resize';
    e.preventDefault();
}

function stopResize() {
    if (!isResizing) return;
    isResizing = false;
    divider.classList.remove('dragging');
    container.classList.remove('resizing');
    document.body.style.cursor = '';
    
    // Force a reflow to ensure divider styling is properly applied
    divider.offsetHeight;
    
    // Ensure divider remains properly styled
    divider.style.width = '1px';
    divider.style.minWidth = '1px';
    divider.style.maxWidth = '1px';
    divider.style.flexShrink = '0';
    
    // Trigger Monaco layout update
    if (editor) {
        setTimeout(() => editor.layout(), 0);
    }
}

function handleResize(e) {
    if (!isResizing) return;
    
    // Throttle updates for better performance
    const now = Date.now();
    if (now - lastUpdateTime < 16) return; // ~60fps
    lastUpdateTime = now;
    
    const containerRect = container.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const percentage = Math.max(20, Math.min(80, 
        ((clientX - containerRect.left) / containerRect.width) * 100
    ));
    
    // Use flexBasis for more reliable resizing
    editorPane.style.flexBasis = `${percentage}%`;
    editorPane.style.flexGrow = '0';
    editorPane.style.flexShrink = '0';
    
    previewPane.style.flexBasis = `${100 - percentage}%`;
    previewPane.style.flexGrow = '0';
    previewPane.style.flexShrink = '0';
    
    // Ensure divider stays properly sized
    divider.style.width = '1px';
    divider.style.flexShrink = '0';
    
    // Trigger Monaco layout update
    if (editor) {
        editor.layout();
    }
    
    e.preventDefault();
}

// Mouse events
if (divider) {
    divider.addEventListener('mousedown', startResize);
    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', stopResize);
    
    // Touch events for mobile
    divider.addEventListener('touchstart', (e) => {
        startResize(e.touches[0]);
    });
    
    document.addEventListener('touchmove', (e) => {
        if (isResizing) {
            handleResize(e.touches[0]);
        }
    });
    
    document.addEventListener('touchend', stopResize);
    
    // Prevent context menu on divider
    divider.addEventListener('contextmenu', (e) => e.preventDefault());
    
    // Double-click to reset to 50/50 split
    divider.addEventListener('dblclick', () => {
        editorPane.style.flexBasis = '50%';
        editorPane.style.flexGrow = '0';
        editorPane.style.flexShrink = '0';
        
        previewPane.style.flexBasis = '50%';
        previewPane.style.flexGrow = '0';
        previewPane.style.flexShrink = '0';
        
        // Ensure divider returns to normal state
        divider.style.width = '1px';
        divider.style.minWidth = '1px';
        divider.style.maxWidth = '1px';
        
        // Trigger Monaco layout update
        if (editor) {
            setTimeout(() => editor.layout(), 0);
        }
    });
}

// Device toggle functionality
function toggleDevice() {
    isMobile = !isMobile;
    const button = document.getElementById('deviceToggle');
    const previewPane = document.querySelector('.preview-pane');
    
    // Store current flex properties before switching
    const currentEditorBasis = editorPane.style.flexBasis;
    const currentPreviewBasis = previewPane.style.flexBasis;
    const hadCustomSizing = currentEditorBasis && currentPreviewBasis;
    
    if (isMobile) {
        // Switch to mobile view
        button.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" stroke-width="2"/><path d="m8 21 8 0" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
        button.title = 'Switch to desktop view';
        
        previewPane.classList.add('mobile');
        previewPane.innerHTML = `
            <div class="pane-header" style="position: absolute; top: 0; left: 0; right: 0;">
                <span>Preview - iPhone 15 Pro</span>
                <div class="header-controls">
                    <button id="backgroundToggle" onclick="togglePreviewBackground()" title="Toggle background (light/dark)" style="
                        background: transparent;
                        border: none;
                        color: #64748b;
                        cursor: pointer;
                        font-size: 14px;
                        padding: 2px 4px;
                        border-radius: 3px;
                        transition: all 0.2s ease;
                        opacity: 0.7;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    " onmouseover="this.style.opacity='1'; this.style.background='rgba(0,0,0,0.05)'" onmouseout="this.style.opacity='0.7'; this.style.background='transparent'">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="2"/>
                            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" stroke-width="2"/>
                        </svg>
                    </button>
                    <button id="exportBtn" onclick="exportOpenGraphImage()" title="Show OpenGraph screenshot overlay" style="
                        background: rgba(34, 197, 94, 0.1);
                        border: 1px solid rgba(34, 197, 94, 0.2);
                        border-radius: 6px;
                        padding: 4px 8px;
                        cursor: pointer;
                        font-size: 12px;
                        color: #22c55e;
                        transition: all 0.2s ease;
                        margin-right: 8px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    " onmouseover="this.style.background='rgba(34, 197, 94, 0.2)'; this.style.transform='scale(1.05)'" onmouseout="this.style.background='rgba(34, 197, 94, 0.1)'; this.style.transform='scale(1)'">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M23 19C23 19.5304 22.7893 20.0391 22.4142 20.4142C22.0391 20.7893 21.5304 21 21 21H3C2.46957 21 1.96086 20.7893 1.58579 20.4142C1.21071 20.0391 1 19.5304 1 19V8C1 7.46957 1.21071 6.96086 1.58579 6.58579C1.96086 6.21071 2.46957 6 3 6H7L9 4H15L17 6H21C21.5304 6 22.0391 6.21071 22.4142 6.58579C22.7893 6.96086 23 7.46957 23 8V19Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            <circle cx="12" cy="13" r="4" stroke="currentColor" stroke-width="2"/>
                        </svg>
                    </button>
                    <button id="deviceToggle" onclick="toggleDevice()" style="
                        background: transparent;
                        border: none;
                        color: #64748b;
                        cursor: pointer;
                        font-size: 14px;
                        padding: 2px 4px;
                        border-radius: 3px;
                        transition: all 0.2s ease;
                        opacity: 0.7;
                    " onmouseover="this.style.opacity='1'; this.style.background='rgba(0,0,0,0.05)'" onmouseout="this.style.opacity='0.7'; this.style.background='transparent'" title="Switch to desktop view" style="display: flex; align-items: center; justify-content: center;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" stroke-width="2"/>
                            <path d="m8 21 8 0" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="phone-frame">
                <div class="phone-screen">
                    <iframe id="preview"></iframe>
                </div>
            </div>
        `;
        
        // Re-establish preview and update
        const newPreview = document.getElementById('preview');
        setupPreview(newPreview);
        // Re-enable interactivity after content loads
        setTimeout(() => setupPreviewInteractivity(), 100);
        
    } else {
        // Switch back to desktop view
        button.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="2" width="14" height="20" rx="2" ry="2" stroke="currentColor" stroke-width="2"/><line x1="12" y1="18" x2="12.01" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
        button.title = 'Switch to mobile view';
        
        previewPane.classList.remove('mobile');
        previewPane.innerHTML = `
            <div class="pane-header">
                <span>Preview</span>
                <div class="header-controls">
                    <button id="backgroundToggle" onclick="togglePreviewBackground()" title="Toggle background (light/dark)" style="
                        background: transparent;
                        border: none;
                        color: #64748b;
                        cursor: pointer;
                        font-size: 14px;
                        padding: 2px 4px;
                        border-radius: 3px;
                        transition: all 0.2s ease;
                        opacity: 0.7;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    " onmouseover="this.style.opacity='1'; this.style.background='rgba(0,0,0,0.05)'" onmouseout="this.style.opacity='0.7'; this.style.background='transparent'">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="2"/>
                            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" stroke-width="2"/>
                        </svg>
                    </button>
                    <button id="exportBtn" onclick="exportOpenGraphImage()" title="Show OpenGraph screenshot overlay" style="
                        background: rgba(34, 197, 94, 0.1);
                        border: 1px solid rgba(34, 197, 94, 0.2);
                        border-radius: 6px;
                        padding: 4px 8px;
                        cursor: pointer;
                        font-size: 12px;
                        color: #22c55e;
                        transition: all 0.2s ease;
                        margin-right: 8px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    " onmouseover="this.style.background='rgba(34, 197, 94, 0.2)'; this.style.transform='scale(1.05)'" onmouseout="this.style.background='rgba(34, 197, 94, 0.1)'; this.style.transform='scale(1)'">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M23 19C23 19.5304 22.7893 20.0391 22.4142 20.4142C22.0391 20.7893 21.5304 21 21 21H3C2.46957 21 1.96086 20.7893 1.58579 20.4142C1.21071 20.0391 1 19.5304 1 19V8C1 7.46957 1.21071 6.96086 1.58579 6.58579C1.96086 6.21071 2.46957 6 3 6H7L9 4H15L17 6H21C21.5304 6 22.0391 6.21071 22.4142 6.58579C22.7893 6.96086 23 7.46957 23 8V19Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            <circle cx="12" cy="13" r="4" stroke="currentColor" stroke-width="2"/>
                        </svg>
                    </button>
                    <button id="deviceToggle" onclick="toggleDevice()" style="
                        background: transparent;
                        border: none;
                        color: #64748b;
                        cursor: pointer;
                        font-size: 14px;
                        padding: 2px 4px;
                        border-radius: 3px;
                        transition: all 0.2s ease;
                        opacity: 0.7;
                    " onmouseover="this.style.opacity='1'; this.style.background='rgba(0,0,0,0.05)'" onmouseout="this.style.opacity='0.7'; this.style.background='transparent'" title="Switch to mobile view" style="display: flex; align-items: center; justify-content: center;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect x="5" y="2" width="14" height="20" rx="2" ry="2" stroke="currentColor" stroke-width="2"/>
                            <line x1="12" y1="18" x2="12.01" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                    </button>
                </div>
            </div>
            <iframe id="preview"></iframe>
        `;
        
        // Re-establish preview and update
        const newPreview = document.getElementById('preview');
        setupPreview(newPreview);
        // Re-enable interactivity after content loads
        setTimeout(() => setupPreviewInteractivity(), 100);
    }
    
    // Update pane references after DOM changes
    updatePaneReferences();
    
    // Restore flex properties if they were customized
    if (hadCustomSizing) {
        editorPane.style.flexBasis = currentEditorBasis;
        editorPane.style.flexGrow = '0';
        editorPane.style.flexShrink = '0';
        
        previewPane.style.flexBasis = currentPreviewBasis;
        previewPane.style.flexGrow = '0';
        previewPane.style.flexShrink = '0';
    }
}

// Resize functionality for screenshot overlay
function resizeOverlay(newWidth) {
    // Maintain aspect ratio (1200:630 = 1.904:1)
    const aspectRatio = 1200 / 630;
    overlaySize.width = Math.max(300, Math.min(2400, newWidth));
    overlaySize.height = overlaySize.width / aspectRatio;
    
    updateOverlaySize();
    updateSizeDisplay();
}

function resetOverlaySize() {
    overlaySize.width = 1200;
    overlaySize.height = 630;
    updateOverlaySize();
    updateSizeDisplay();
}

function updateOverlaySize() {
    const overlay = document.getElementById('og-overlay');
    if (overlay) {
        overlay.style.width = overlaySize.width + 'px';
        overlay.style.height = overlaySize.height + 'px';
        
        // Ensure overlay stays within bounds after resizing
        constrainOverlayPosition(overlay);
    }
}

function constrainOverlayPosition(overlay) {
    const previewRect = overlay.parentElement.getBoundingClientRect();
    const overlayRect = overlay.getBoundingClientRect();
    
    // Get current position relative to parent
    const currentLeft = parseInt(overlay.style.left) || 0;
    const currentTop = parseInt(overlay.style.top) || 0;
    
    // Calculate constrained position
    const maxLeft = previewRect.width - overlaySize.width;
    const maxTop = previewRect.height - overlaySize.height;
    
    const newLeft = Math.max(0, Math.min(currentLeft, maxLeft));
    const newTop = Math.max(0, Math.min(currentTop, maxTop));
    
    // Only update if position changed
    if (newLeft !== currentLeft || newTop !== currentTop) {
        overlay.style.left = newLeft + 'px';
        overlay.style.top = newTop + 'px';
        overlay.style.transform = 'none';
    }
}

function updateSizeDisplay() {
    const sizeDisplay = document.getElementById('size-display');
    if (sizeDisplay) {
        sizeDisplay.textContent = `${overlaySize.width}×${overlaySize.height}px`;
    }
}

// OpenGraph overlay functionality
function exportOpenGraphImage() {
    const exportBtn = document.getElementById('exportBtn');
    const previewPane = document.querySelector('.preview-pane');
    
    if (!previewPane) {
        alert('Preview pane not found');
        return;
    }
    
    ogOverlayVisible = !ogOverlayVisible;
    
    if (ogOverlayVisible) {
        // Create overlay
        const overlay = document.createElement('div');
        overlay.id = 'og-overlay';
        overlay.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            width: 1200px;
            height: 630px;
            transform: translate(-50%, -50%);
            border: 3px solid #22c55e;
            border-radius: 8px;
            cursor: move;
            z-index: 1000;
            box-shadow: 
                0 0 0 2px rgba(34, 197, 94, 0.3),
                0 0 20px rgba(34, 197, 94, 0.2);
        `;
        
        // Add label with resize controls
        const labelContainer = document.createElement('div');
        labelContainer.style.cssText = `
            position: absolute;
            top: -60px;
            left: 0;
            display: flex;
            gap: 8px;
            align-items: center;
        `;
        
        const label = document.createElement('div');
        label.style.cssText = `
            background: #22c55e;
            color: white;
            padding: 4px 12px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
            white-space: nowrap;
            cursor: move;
        `;
        label.textContent = 'Drag to position • Drag corner to resize';
        
        // Size controls
        const sizeControls = document.createElement('div');
        sizeControls.style.cssText = `
            display: flex;
            gap: 4px;
            align-items: center;
            background: rgba(0, 0, 0, 0.8);
            border-radius: 6px;
            padding: 4px;
        `;
        
        // Smaller button
        const smallerBtn = document.createElement('button');
        smallerBtn.style.cssText = `
            background: rgba(255, 255, 255, 0.1);
            border: none;
            color: white;
            width: 24px;
            height: 24px;
            border-radius: 4px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            transition: all 0.2s ease;
        `;
        smallerBtn.innerHTML = '−';
        smallerBtn.title = 'Make smaller';
        smallerBtn.onclick = (e) => { e.stopPropagation(); resizeOverlay(overlaySize.width * 0.8); };
        smallerBtn.onmouseover = () => smallerBtn.style.background = 'rgba(255, 255, 255, 0.2)';
        smallerBtn.onmouseout = () => smallerBtn.style.background = 'rgba(255, 255, 255, 0.1)';
        
        // Size display
        const sizeDisplay = document.createElement('div');
        sizeDisplay.id = 'size-display';
        sizeDisplay.style.cssText = `
            color: white;
            font-size: 11px;
            min-width: 80px;
            text-align: center;
            font-weight: 600;
        `;
        sizeDisplay.textContent = `${overlaySize.width}×${overlaySize.height}px`;
        
        // Larger button
        const largerBtn = document.createElement('button');
        largerBtn.style.cssText = `
            background: rgba(255, 255, 255, 0.1);
            border: none;
            color: white;
            width: 24px;
            height: 24px;
            border-radius: 4px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            transition: all 0.2s ease;
        `;
        largerBtn.innerHTML = '+';
        largerBtn.title = 'Make larger';
        largerBtn.onclick = (e) => { e.stopPropagation(); resizeOverlay(overlaySize.width * 1.25); };
        largerBtn.onmouseover = () => largerBtn.style.background = 'rgba(255, 255, 255, 0.2)';
        largerBtn.onmouseout = () => largerBtn.style.background = 'rgba(255, 255, 255, 0.1)';
        
        // Reset size button
        const resetBtn = document.createElement('button');
        resetBtn.style.cssText = `
            background: rgba(255, 255, 255, 0.1);
            border: none;
            color: white;
            width: 24px;
            height: 24px;
            border-radius: 4px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            transition: all 0.2s ease;
        `;
        resetBtn.innerHTML = '⌂';
        resetBtn.title = 'Reset to 1200×630px';
        resetBtn.onclick = (e) => { e.stopPropagation(); resetOverlaySize(); };
        resetBtn.onmouseover = () => resetBtn.style.background = 'rgba(255, 255, 255, 0.2)';
        resetBtn.onmouseout = () => resetBtn.style.background = 'rgba(255, 255, 255, 0.1)';
        
        sizeControls.appendChild(smallerBtn);
        sizeControls.appendChild(sizeDisplay);
        sizeControls.appendChild(largerBtn);
        sizeControls.appendChild(resetBtn);
        
        labelContainer.appendChild(label);
        labelContainer.appendChild(sizeControls);
        overlay.appendChild(labelContainer);
        
        // Add resize handle
        const resizeHandle = document.createElement('div');
        resizeHandle.style.cssText = `
            position: absolute;
            bottom: -8px;
            right: -8px;
            width: 16px;
            height: 16px;
            background: #22c55e;
            border-radius: 50%;
            cursor: nw-resize;
            border: 2px solid white;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            transition: all 0.2s ease;
        `;
        resizeHandle.title = 'Drag to resize (maintains aspect ratio)';
        overlay.appendChild(resizeHandle);
        
        // Setup resize functionality
        setupOverlayResize(overlay, resizeHandle);
        
        // Make overlay draggable
        setupDragging(overlay);
        
        // Make preview pane relative for positioning
        previewPane.style.position = 'relative';
        previewPane.appendChild(overlay);
        
        // Update button
        exportBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2"/><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2"/></svg>';
        exportBtn.title = 'Hide OpenGraph overlay';
        
    } else {
        // Remove overlay and reset size
        const overlay = document.getElementById('og-overlay');
        if (overlay) {
            overlay.remove();
        }
        
        // Reset overlay size when closing
        resetOverlaySize();
        
        // Update button
        exportBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M23 19C23 19.5304 22.7893 20.0391 22.4142 20.4142C22.0391 20.7893 21.5304 21 21 21H3C2.46957 21 1.96086 20.7893 1.58579 20.4142C1.21071 20.0391 1 19.5304 1 19V8C1 7.46957 1.21071 6.96086 1.58579 6.58579C1.96086 6.21071 2.46957 6 3 6H7L9 4H15L17 6H21C21.5304 6 22.0391 6.21071 22.4142 6.58579C22.7893 6.96086 23 7.46957 23 8V19Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="13" r="4" stroke="currentColor" stroke-width="2"/></svg>';
        exportBtn.title = 'Show OpenGraph screenshot overlay';
    }
}

function setupDragging(overlay) {
    overlay.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', stopDrag);
    
    function startDrag(e) {
        isDragging = true;
        overlay.style.cursor = 'grabbing';
        
        const rect = overlay.getBoundingClientRect();
        const previewRect = overlay.parentElement.getBoundingClientRect();
        
        dragOffset.x = e.clientX - rect.left;
        dragOffset.y = e.clientY - rect.top;
        
        e.preventDefault();
    }
    
    function drag(e) {
        if (!isDragging) return;
        
        const previewRect = overlay.parentElement.getBoundingClientRect();
        
        let newX = e.clientX - previewRect.left - dragOffset.x;
        let newY = e.clientY - previewRect.top - dragOffset.y;
        
        // Keep within bounds using current overlay size
        const currentWidth = overlaySize.width;
        const currentHeight = overlaySize.height;
        newX = Math.max(0, Math.min(newX, previewRect.width - currentWidth));
        newY = Math.max(0, Math.min(newY, previewRect.height - currentHeight));
        
        overlay.style.left = newX + 'px';
        overlay.style.top = newY + 'px';
        overlay.style.transform = 'none';
    }
    
    function stopDrag() {
        if (isDragging) {
            isDragging = false;
            overlay.style.cursor = 'move';
        }
    }
}

// Setup resize functionality for overlay
function setupOverlayResize(overlay, handle) {
    handle.addEventListener('mousedown', startResize);
    
    function startResize(e) {
        isOverlayResizing = true;
        resizeHandle = handle;
        
        const rect = overlay.getBoundingClientRect();
        const startX = e.clientX;
        const startY = e.clientY;
        const startWidth = overlaySize.width;
        const startHeight = overlaySize.height;
        
        function resize(e) {
            if (!isOverlayResizing) return;
            
            // Calculate new width based on mouse movement
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            // Use the larger delta to determine new size
            const delta = Math.max(deltaX, deltaY);
            const newWidth = startWidth + delta;
            
            resizeOverlay(newWidth);
        }
        
        function stopResize() {
            if (isOverlayResizing) {
                isOverlayResizing = false;
                resizeHandle = null;
                document.removeEventListener('mousemove', resize);
                document.removeEventListener('mouseup', stopResize);
            }
        }
        
        document.addEventListener('mousemove', resize);
        document.addEventListener('mouseup', stopResize);
        
        e.preventDefault();
        e.stopPropagation();
    }
}

// Download HTML function
function downloadHtml() {
    if (!editor) return;
    
    const htmlContent = editor.getValue();
    
    // Create a blob with the HTML content
    const blob = new Blob([htmlContent], { type: 'text/html' });
    
    // Create a temporary download link
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    
    // Generate filename with timestamp
    const now = new Date();
    const timestamp = now.toISOString().slice(0, 19).replace(/[:]/g, '-');
    link.download = `html-editor-${timestamp}.html`;
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}

// Toggle preview background between light and dark
function togglePreviewBackground() {
    const preview = document.getElementById('preview');
    const button = document.getElementById('backgroundToggle');
    
    if (!preview) return;
    
    // Toggle dark background class
    preview.classList.toggle('dark-background');
    
    const isDark = preview.classList.contains('dark-background');
    
    // Update button icon and tooltip
    if (isDark) {
        button.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" stroke-width="2"/>
            </svg>
        `;
        button.title = 'Switch to light background';
        showCopyNotification('Dark background enabled', 'success');
    } else {
        button.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="2"/>
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" stroke-width="2"/>
            </svg>
        `;
        button.title = 'Switch to dark background';
        showCopyNotification('Light background enabled', 'success');
    }
}

// Copy HTML code to clipboard
function copyCode() {
    if (!editor) return;
    
    const htmlContent = editor.getValue();
    
    // Use the modern clipboard API if available
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(htmlContent).then(() => {
            showCopyNotification('Code copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy code:', err);
            fallbackCopyToClipboard(htmlContent);
        });
    } else {
        // Fallback for older browsers or non-secure contexts
        fallbackCopyToClipboard(htmlContent);
    }
}

// Fallback copy method for older browsers
function fallbackCopyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        document.execCommand('copy');
        showCopyNotification('Code copied to clipboard!');
    } catch (err) {
        console.error('Fallback copy failed:', err);
        showCopyNotification('Failed to copy code', 'error');
    }
    
    document.body.removeChild(textArea);
}

// Show copy notification
function showCopyNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#10b981' : '#ef4444'};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        z-index: 2001;
        animation: slideInRight 0.3s ease;
        box-shadow: 0 10px 25px rgba(0,0,0,0.1);
        display: flex;
        align-items: center;
        gap: 8px;
    `;
    
    const icon = type === 'success' 
        ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><polyline points="20,6 9,17 4,12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" stroke-width="2"/><line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" stroke-width="2"/></svg>';
    
    notification.innerHTML = `${icon}${message}`;
    document.body.appendChild(notification);
    
    // Remove after delay
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 2000);
}

// Toggle save dropdown
function toggleSaveDropdown() {
    const dropdown = document.getElementById('saveDropdown');
    const isVisible = dropdown.classList.contains('show');
    
    if (isVisible) {
        dropdown.classList.remove('show');
        document.removeEventListener('click', closeSaveDropdownOnClickOutside);
    } else {
        dropdown.classList.add('show');
        setTimeout(() => {
            document.addEventListener('click', closeSaveDropdownOnClickOutside);
        }, 0);
    }
}

// Close dropdown when clicking outside
function closeSaveDropdownOnClickOutside(event) {
    const dropdown = document.getElementById('saveDropdown');
    const saveButton = document.getElementById('saveDropdownBtn');
    
    if (!dropdown.contains(event.target) && !saveButton.contains(event.target)) {
        dropdown.classList.remove('show');
        document.removeEventListener('click', closeSaveDropdownOnClickOutside);
    }
}

// Handle save dropdown menu clicks
function handleSaveDropdownAction(action) {
    const dropdown = document.getElementById('saveDropdown');
    dropdown.classList.remove('show');
    document.removeEventListener('click', closeSaveDropdownOnClickOutside);
    
    if (action === 'save') {
        // Use existing save logic
        const saveEvent = new Event('click');
        if (window.documentStorage) {
            window.documentStorage.showSaveModal();
        } else if (window.supabaseStorage) {
            window.supabaseStorage.showSaveModal();
        } else {
            alert('Save functionality not initialized');
        }
    } else if (action === 'download') {
        downloadHtml();
    }
}

// Handle window resize for Monaco layout
window.addEventListener('resize', () => {
    if (editor) {
        setTimeout(() => editor.layout(), 0);
    }
});

// Modal Helper Functions
function closeSaveModal() {
    const modal = document.getElementById('saveModal');
    modal.classList.remove('show');
    
    // Reset the new category input if it's visible
    cancelInlineNewCategory();
}

function closeCategoryModal() {
    const modal = document.getElementById('categoryModal');
    modal.classList.remove('show');
}

function closeAuthModal() {
    const modal = document.getElementById('authModal');
    modal.classList.remove('show');
}

function saveDocument() {
    const nameInput = document.getElementById('documentName');
    const categorySelect = document.getElementById('documentCategory');
    const name = nameInput.value.trim();
    const category = categorySelect.value;
    
    if (!name) {
        nameInput.focus();
        return;
    }
    
    if (!editor) return;
    
    const content = editor.getValue();
    const storage = window.documentStorage;
    
    if (storage) {
        storage.saveDocument(name, category, content);
        closeSaveModal();
    }
}

function addCategory() {
    const nameInput = document.getElementById('categoryName');
    const name = nameInput.value.trim();
    
    if (!name) {
        nameInput.focus();
        return;
    }
    
    const storage = window.documentStorage;
    if (storage) {
        storage.addCategory(name);
        closeCategoryModal();
    }
}

function showProfileModal() {
    const modal = document.getElementById('profileModal');
    const nameInput = document.getElementById('profileName');
    const storage = window.documentStorage;
    
    // Close user menu first
    const userMenu = document.getElementById('userMenu');
    if (userMenu) {
        userMenu.classList.remove('show');
    }
    
    // Pre-fill the current name if available
    if (storage && storage.currentUser && storage.currentUser.user_metadata?.full_name) {
        nameInput.value = storage.currentUser.user_metadata.full_name;
    }
    
    modal.style.display = 'flex';
    nameInput.focus();
}

function closeProfileModal() {
    const modal = document.getElementById('profileModal');
    const nameInput = document.getElementById('profileName');
    
    modal.style.display = 'none';
    nameInput.value = '';
}

function updateProfile() {
    const nameInput = document.getElementById('profileName');
    const name = nameInput.value.trim();
    
    if (!name) {
        nameInput.focus();
        return;
    }
    
    const storage = window.documentStorage;
    if (storage && storage.updateUserProfile) {
        storage.updateUserProfile(name);
        closeProfileModal();
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById('documentsSidebar');
    const button = document.getElementById('sidebarToggle');
    
    sidebar.classList.toggle('collapsed');
    
    // Update button icon based on state
    const isCollapsed = sidebar.classList.contains('collapsed');
    button.innerHTML = isCollapsed 
        ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 4H21V6H3V4ZM3 11H21V13H3V11ZM3 18H21V20H3V18Z" fill="currentColor"/></svg>'
        : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2"/></svg>';
    
    button.title = isCollapsed ? 'Show Saved Documents' : 'Hide Saved Documents';
}

function toggleUserMenu() {
    const menu = document.getElementById('userMenu');
    const isVisible = menu.classList.contains('show');
    
    if (isVisible) {
        menu.classList.remove('show');
        document.removeEventListener('click', closeUserMenuOnClickOutside);
    } else {
        menu.classList.add('show');
        setTimeout(() => {
            document.addEventListener('click', closeUserMenuOnClickOutside);
        }, 0);
    }
}

function closeUserMenuOnClickOutside(event) {
    const menu = document.getElementById('userMenu');
    const profileContainer = document.getElementById('userProfile');
    
    if (!menu.contains(event.target) && !profileContainer.contains(event.target)) {
        menu.classList.remove('show');
        document.removeEventListener('click', closeUserMenuOnClickOutside);
    }
}

function toggleAuth() {
    const storage = window.documentStorage;
    if (storage && storage.currentUser) {
        // Sign out
        storage.signOut();
    } else {
        // Show auth modal
        if (storage && storage.showAuthModal) {
            storage.showAuthModal();
        }
    }
}

function switchAuthTab(tab) {
    const signInTab = document.querySelector('.auth-tab:first-child');
    const signUpTab = document.querySelector('.auth-tab:last-child');
    const nameGroup = document.getElementById('nameGroup');
    const submitBtn = document.getElementById('authSubmitBtn');
    const resendSection = document.getElementById('resendConfirmationSection');
    
    if (tab === 'signin') {
        signInTab.classList.add('active');
        signUpTab.classList.remove('active');
        nameGroup.style.display = 'none';
        submitBtn.textContent = 'Sign In';
        
        // Show resend section if there's a pending email
        const pendingEmail = localStorage.getItem('pendingSignupEmail');
        if (pendingEmail) {
            resendSection.style.display = 'block';
        } else {
            resendSection.style.display = 'none';
        }
    } else {
        signInTab.classList.remove('active');
        signUpTab.classList.add('active');
        nameGroup.style.display = 'block';
        submitBtn.textContent = 'Sign Up';
        resendSection.style.display = 'none';
    }
}

function resendConfirmationEmail() {
    const storage = window.documentStorage;
    const email = document.getElementById('authEmail').value || localStorage.getItem('pendingSignupEmail');
    
    if (!email) {
        alert('Please enter your email address first.');
        return;
    }
    
    if (storage && storage.resendConfirmation) {
        storage.resendConfirmation(email);
    }
}

async function handleAuth(event) {
    event.preventDefault();
    
    const storage = window.documentStorage;
    if (!storage) return;
    
    const isSignUp = document.querySelector('.auth-tab.active').textContent === 'Sign Up';
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;
    const name = document.getElementById('authName').value;
    
    try {
        let result;
        if (isSignUp) {
            result = await storage.signUp(email, password, name);
        } else {
            result = await storage.signIn(email, password);
        }
        
        if (result && !result.error) {
            closeAuthModal();
        } else if (result && result.error) {
            alert(`Error: ${result.error.message}`);
        }
    } catch (error) {
        console.error('Auth error:', error);
        alert('Authentication failed. Please try again.');
    }
}

function useDemoMode() {
    const storage = window.documentStorage;
    if (storage && storage.useDemoMode) {
        storage.useDemoMode(true);
        closeAuthModal();
    }
}

// Initialize storage systems when page loads
window.addEventListener('DOMContentLoaded', () => {
    // Try to initialize Supabase storage first, falls back to local storage
    try {
        window.documentStorage = new SupabaseDocumentStorage();
    } catch (error) {
        console.warn('Failed to initialize Supabase storage, using local storage:', error);
        window.documentStorage = new DocumentStorage();
    }
    
    // Set up sidebar toggle
    const sidebarToggle = document.getElementById('sidebarToggle');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', toggleSidebar);
    }
}); 

// Document Storage System with Spaces Support
class DocumentStorage {
    constructor() {
        this.storageKey = 'html-editor-documents';
        this.categoriesKey = 'html-editor-categories';
        this.spacesKey = 'html-editor-spaces';
        this.currentSpaceKey = 'html-editor-current-space';
        this.currentDocument = null;
        this.currentSpace = null;
        this.init();
    }

    init() {
        // Initialize default space if none exist
        if (!this.getSpaces().length) {
            this.addSpace('Personal Workspace', 'Your main workspace for personal projects', true);
        }
        
        // Set current space
        this.currentSpace = this.getCurrentSpace() || this.getSpaces()[0];
        
        // Migrate existing documents without space IDs
        this.migrateExistingDocuments();
        
        // Migrate existing categories without space IDs
        this.migrateExistingCategories();
        
        // Initialize default categories for current space if none exist
        if (!this.getCategories().length) {
            this.addCategory('Personal');
            this.addCategory('Work');
            this.addCategory('Learning');
        }
        this.renderSidebar();
        this.setupEventListeners();
    }
    
    migrateExistingDocuments() {
        const allDocuments = JSON.parse(localStorage.getItem(this.storageKey) || '[]');
        let updated = false;
        
        allDocuments.forEach(doc => {
            if (!doc.spaceId && this.currentSpace) {
                doc.spaceId = this.currentSpace.id;
                updated = true;
            }
        });
        
        if (updated) {
            localStorage.setItem(this.storageKey, JSON.stringify(allDocuments));
            console.log('✅ Migrated existing documents to spaces');
        }
    }
    
    migrateExistingCategories() {
        const stored = localStorage.getItem(this.categoriesKey);
        if (!stored) return;
        
        let categories;
        try {
            categories = JSON.parse(stored);
        } catch (e) {
            return;
        }
        
        // Check if categories are already in new format (objects with spaceId)
        if (categories.length > 0 && typeof categories[0] === 'object' && categories[0].spaceId) {
            return; // Already migrated
        }
        
        // Migrate old format (array of strings) to new format (array of objects)
        const migratedCategories = categories.map(categoryName => ({
            name: categoryName,
            spaceId: this.currentSpace?.id,
            createdAt: new Date().toISOString()
        }));
        
        localStorage.setItem(this.categoriesKey, JSON.stringify(migratedCategories));
        console.log('✅ Migrated existing categories to spaces');
    }

    // === SPACES MANAGEMENT ===
    
    getSpaces() {
        const stored = localStorage.getItem(this.spacesKey);
        return stored ? JSON.parse(stored) : [];
    }
    
    getCurrentSpace() {
        const currentSpaceId = localStorage.getItem(this.currentSpaceKey);
        if (currentSpaceId) {
            return this.getSpaces().find(space => space.id === currentSpaceId) || null;
        }
        return null;
    }
    
    setCurrentSpace(spaceId) {
        const space = this.getSpaces().find(s => s.id === spaceId);
        if (space) {
            this.currentSpace = space;
            localStorage.setItem(this.currentSpaceKey, spaceId);
            this.renderSidebar();
            this.showNotification(`Switched to "${space.name}"`, 'success');
        }
    }
    
    addSpace(name, description = '', setAsCurrent = false) {
        const spaces = this.getSpaces();
        const newSpace = {
            id: Date.now().toString(),
            name: name,
            description: description,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        spaces.push(newSpace);
        localStorage.setItem(this.spacesKey, JSON.stringify(spaces));
        
        if (setAsCurrent || !this.currentSpace) {
            this.setCurrentSpace(newSpace.id);
        }
        
        return newSpace;
    }
    
    updateSpace(spaceId, updates) {
        const spaces = this.getSpaces();
        const spaceIndex = spaces.findIndex(s => s.id === spaceId);
        
        if (spaceIndex >= 0) {
            spaces[spaceIndex] = {
                ...spaces[spaceIndex],
                ...updates,
                updatedAt: new Date().toISOString()
            };
            localStorage.setItem(this.spacesKey, JSON.stringify(spaces));
            
            // Update current space if it's the one being edited
            if (this.currentSpace && this.currentSpace.id === spaceId) {
                this.currentSpace = spaces[spaceIndex];
            }
            
            this.renderSidebar();
        }
    }
    
    deleteSpace(spaceId) {
        const spaces = this.getSpaces();
        const spaceToDelete = spaces.find(s => s.id === spaceId);
        
        if (!spaceToDelete) return;
        
        // Don't allow deleting the last space
        if (spaces.length <= 1) {
            this.showNotification('Cannot delete the last space', 'error');
            return;
        }
        
        // Move documents to default space (first space that's not being deleted)
        const defaultSpace = spaces.find(s => s.id !== spaceId);
        const documents = this.getDocuments();
        documents.forEach(doc => {
            if (doc.spaceId === spaceId) {
                doc.spaceId = defaultSpace.id;
            }
        });
        localStorage.setItem(this.storageKey, JSON.stringify(documents));
        
        // Remove categories specific to this space
        const categories = this.getCategories();
        const updatedCategories = categories.filter(cat => cat.spaceId !== spaceId);
        localStorage.setItem(this.categoriesKey, JSON.stringify(updatedCategories));
        
        // Remove the space
        const filteredSpaces = spaces.filter(s => s.id !== spaceId);
        localStorage.setItem(this.spacesKey, JSON.stringify(filteredSpaces));
        
        // Switch to default space if current space was deleted
        if (this.currentSpace && this.currentSpace.id === spaceId) {
            this.setCurrentSpace(defaultSpace.id);
        }
        
        this.showNotification(`Space "${spaceToDelete.name}" deleted`, 'success');
    }

    setupEventListeners() {
        // The save functionality is now handled through the dropdown menu
        // via handleSaveDropdownAction() function
        
        // New category button
        document.getElementById('newCategoryBtn').addEventListener('click', this.showCategoryModal.bind(this));
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                this.showSaveModal();
            }
        });
    }

    getDocuments() {
        const stored = localStorage.getItem(this.storageKey);
        const allDocuments = stored ? JSON.parse(stored) : [];
        
        // Filter by current space
        if (this.currentSpace) {
            return allDocuments.filter(doc => doc.spaceId === this.currentSpace.id);
        }
        
        return allDocuments;
    }

    getCategories() {
        const stored = localStorage.getItem(this.categoriesKey);
        const allCategories = stored ? JSON.parse(stored) : [];
        
        // Filter by current space
        if (this.currentSpace) {
            return allCategories.filter(cat => cat.spaceId === this.currentSpace.id).map(cat => cat.name);
        }
        
        return allCategories.map(cat => cat.name);
    }

    saveDocument(name, category, content, spaceId = null) {
        const targetSpaceId = spaceId || this.currentSpace?.id;
        if (!targetSpaceId) {
            this.showNotification('No space selected', 'error');
            return;
        }
        
        const documents = JSON.parse(localStorage.getItem(this.storageKey) || '[]');
        const now = new Date().toISOString();
        
        const document = {
            id: Date.now().toString(),
            name: name,
            category: category || 'Uncategorized',
            content: content,
            spaceId: targetSpaceId,
            createdAt: now,
            updatedAt: now
        };

        // Check if document with same name exists in category within target space
        const existingIndex = documents.findIndex(doc => 
            doc.name === name && 
            doc.category === category && 
            doc.spaceId === targetSpaceId
        );

        if (existingIndex >= 0) {
            // Update existing document
            documents[existingIndex] = { ...documents[existingIndex], ...document, id: documents[existingIndex].id };
        } else {
            // Add new document
            documents.push(document);
        }

        localStorage.setItem(this.storageKey, JSON.stringify(documents));
        this.renderSidebar();
        this.currentDocument = document;
        
        // Show success feedback
        this.showNotification('Document saved successfully!', 'success');
    }

    loadDocument(id) {
        const allDocuments = JSON.parse(localStorage.getItem(this.storageKey) || '[]');
        const document = allDocuments.find(doc => doc.id === id);
        
        if (document && editor) {
            editor.setValue(document.content);
            this.currentDocument = document;
            this.showNotification(`Loaded "${document.name}"`, 'success');
        }
    }

    deleteDocument(id) {
        const documents = JSON.parse(localStorage.getItem(this.storageKey) || '[]');
        const filtered = documents.filter(doc => doc.id !== id);
        localStorage.setItem(this.storageKey, JSON.stringify(filtered));
        this.renderSidebar();
        this.showNotification('Document deleted', 'success');
    }

    duplicateDocument(id) {
        const documents = JSON.parse(localStorage.getItem(this.storageKey) || '[]');
        const original = documents.find(doc => doc.id === id);
        
        if (original) {
            const copy = {
                ...original,
                id: Date.now().toString(),
                name: `${original.name} (Copy)`,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            documents.push(copy);
            localStorage.setItem(this.storageKey, JSON.stringify(documents));
            this.renderSidebar();
            this.showNotification('Document duplicated', 'success');
        }
    }

    addCategory(name) {
        if (!this.currentSpace) return;
        
        const allCategories = JSON.parse(localStorage.getItem(this.categoriesKey) || '[]');
        const categoryExists = allCategories.some(cat => 
            cat.name === name && cat.spaceId === this.currentSpace.id
        );
        
        if (!categoryExists) {
            allCategories.push({
                name: name,
                spaceId: this.currentSpace.id,
                createdAt: new Date().toISOString()
            });
            localStorage.setItem(this.categoriesKey, JSON.stringify(allCategories));
            this.renderSidebar();
            this.populateCategorySelect();
        }
    }

    deleteCategory(name) {
        if (!this.currentSpace) return;
        
        const allCategories = JSON.parse(localStorage.getItem(this.categoriesKey) || '[]');
        const filteredCategories = allCategories.filter(cat => 
            !(cat.name === name && cat.spaceId === this.currentSpace.id)
        );
        localStorage.setItem(this.categoriesKey, JSON.stringify(filteredCategories));
        
        // Move documents from deleted category to 'Uncategorized' within current space
        const documents = JSON.parse(localStorage.getItem(this.storageKey) || '[]');
        documents.forEach(doc => {
            if (doc.category === name && doc.spaceId === this.currentSpace.id) {
                doc.category = 'Uncategorized';
            }
        });
        localStorage.setItem(this.storageKey, JSON.stringify(documents));
        
        this.renderSidebar();
        this.populateCategorySelect();
    }

    showSaveModal() {
        const modal = document.getElementById('saveModal');
        const nameInput = document.getElementById('documentName');
        const categorySelect = document.getElementById('documentCategory');
        const spaceSelect = document.getElementById('documentSpace');
        
        // Populate spaces and categories
        this.populateSpaceSelect();
        this.populateCategorySelect();
        
        // Pre-fill if editing current document
        if (this.currentDocument) {
            nameInput.value = this.currentDocument.name;
            categorySelect.value = this.currentDocument.category;
            if (spaceSelect) {
                spaceSelect.value = this.currentDocument.spaceId || this.currentSpace?.id;
            }
        } else {
            nameInput.value = '';
            categorySelect.value = '';
            if (spaceSelect) {
                spaceSelect.value = this.currentSpace?.id || '';
            }
        }
        
        modal.classList.add('show');
        nameInput.focus();
    }

    populateSpaceSelect() {
        const select = document.getElementById('documentSpace');
        if (!select) return;
        
        const spaces = this.getSpaces();
        
        select.innerHTML = '';
        spaces.forEach(space => {
            const option = document.createElement('option');
            option.value = space.id;
            option.textContent = space.name;
            select.appendChild(option);
        });
    }

    showCategoryModal() {
        const modal = document.getElementById('categoryModal');
        const nameInput = document.getElementById('categoryName');
        
        nameInput.value = '';
        modal.classList.add('show');
        nameInput.focus();
    }

    showSpaceModal() {
        const modal = document.getElementById('spaceModal');
        const nameInput = document.getElementById('spaceName');
        const descriptionInput = document.getElementById('spaceDescription');
        
        nameInput.value = '';
        descriptionInput.value = '';
        modal.classList.add('show');
        nameInput.focus();
    }

    showEditSpaceModal(spaceId) {
        const space = this.getSpaces().find(s => s.id === spaceId);
        if (!space) return;
        
        const modal = document.getElementById('editSpaceModal');
        const nameInput = document.getElementById('editSpaceName');
        const descriptionInput = document.getElementById('editSpaceDescription');
        
        nameInput.value = space.name;
        descriptionInput.value = space.description || '';
        
        // Store space ID for updating
        modal.setAttribute('data-space-id', spaceId);
        
        modal.classList.add('show');
        nameInput.focus();
    }

    showAuthModal() {
        // For basic localStorage mode, show a simple modal explaining the limitations
        const modal = document.getElementById('authModal');
        modal.classList.add('show');
        document.getElementById('authEmail').focus();
        
        // Update modal title to indicate this is demo mode
        const modalTitle = document.getElementById('authModalTitle');
        if (modalTitle) {
            modalTitle.textContent = 'Demo Mode - Local Storage Only';
        }
    }

    updateAuthUI() {
        const authBtn = document.getElementById('authBtn');
        const userProfile = document.getElementById('userProfile');
        const userEmail = document.getElementById('userEmail');
        const userMenuName = document.getElementById('userMenuName');
        const userMenuEmail = document.getElementById('userMenuEmail');
        
        if (this.currentUser) {
            // Demo mode - signed in
            authBtn.style.display = 'none';
            userProfile.style.display = 'flex';
            
            // Use the full name if available, otherwise extract username from email
            const displayName = this.currentUser.user_metadata?.full_name || this.currentUser.email.split('@')[0];
            userEmail.textContent = displayName;
            if (userMenuName) userMenuName.textContent = displayName;
            if (userMenuEmail) userMenuEmail.textContent = this.currentUser.email;
        } else {
            // Demo mode - not signed in
            authBtn.style.display = 'block';
            userProfile.style.display = 'none';
            authBtn.textContent = 'Demo Mode';
            authBtn.className = 'auth-btn demo';
            authBtn.onclick = () => this.showAuthModal();
        }
    }

    // Auth methods for localStorage mode (demo/fallback)
    async signUp(email, password, name) {
        // For demo mode, just simulate successful signup
        alert('Demo Mode: Account created successfully! In demo mode, your data is stored locally only.');
        return { data: { user: { email, user_metadata: { full_name: name } } }, error: null };
    }

    async signIn(email, password) {
        // For demo mode, just simulate successful signin
        alert('Demo Mode: Signed in successfully! In demo mode, your data is stored locally only.');
        this.currentUser = { email, user_metadata: { full_name: 'Demo User' } };
        this.updateAuthUI();
        return { data: { user: { email, user_metadata: { full_name: 'Demo User' } } }, error: null };
    }

    async signOut() {
        // For demo mode, just simulate signout
        this.currentUser = null;
        this.updateAuthUI();
        alert('Demo Mode: Signed out successfully!');
        return { error: null };
    }

    populateCategorySelect() {
        const select = document.getElementById('documentCategory');
        const categories = this.getCategories();
        
        select.innerHTML = '<option value="">Select category...</option>';
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            select.appendChild(option);
        });
        
        // Add "Create new category..." option
        const createOption = document.createElement('option');
        createOption.value = '__CREATE_NEW__';
        createOption.textContent = '+ Create new category...';
        createOption.style.fontStyle = 'italic';
        createOption.style.color = '#a855f7';
        select.appendChild(createOption);
    }

    renderSidebar() {
        // Update space selector in sidebar header
        this.updateSpaceSelector();
        
        const container = document.getElementById('categoriesList');
        const documents = this.getDocuments();
        const categories = this.getCategories();
        
        // Group documents by category
        const groupedDocs = {};
        categories.forEach(cat => groupedDocs[cat] = []);
        
        documents.forEach(doc => {
            const category = doc.category || 'Uncategorized';
            if (!groupedDocs[category]) {
                groupedDocs[category] = [];
            }
            groupedDocs[category].push(doc);
        });

        container.innerHTML = '';

        Object.entries(groupedDocs).forEach(([category, docs]) => {
            if (docs.length === 0) return;

            const categoryGroup = document.createElement('div');
            categoryGroup.className = 'category-group';

            const categoryHeader = document.createElement('div');
            categoryHeader.className = 'category-header';
            categoryHeader.setAttribute('data-category', category);
            categoryHeader.innerHTML = `
                <div class="category-title">
                    <span>${category}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="category-count">${docs.length}</span>
                    ${category !== 'Uncategorized' ? `
                        <button class="document-action" onclick="documentStorage.deleteCategory('${category}')" title="Delete category" style="opacity: 0.6; transition: opacity 0.2s;">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" stroke="currentColor" stroke-width="2"/>
                            </svg>
                        </button>
                    ` : ''}
                    <svg class="category-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <polyline points="6,9 12,15 18,9" stroke="currentColor" stroke-width="2"/>
                    </svg>
                </div>
            `;
            
            // Add drop zone functionality
            this.addDropZoneListeners(categoryHeader, category);

            const categoryDocuments = document.createElement('div');
            categoryDocuments.className = 'category-documents';

            docs.forEach(doc => {
                const docItem = document.createElement('div');
                docItem.className = 'document-item';
                docItem.draggable = true;
                docItem.setAttribute('data-doc-id', doc.id);
                docItem.setAttribute('data-doc-category', doc.category);
                docItem.innerHTML = `
                    <span class="document-name" onclick="documentStorage.loadDocument('${doc.id}')" title="Click to open document">${doc.name}</span>
                    <div class="document-actions">
                        <button class="document-action" onclick="documentStorage.duplicateDocument('${doc.id}')" title="Duplicate">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="currentColor" stroke-width="2"/>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="2"/>
                            </svg>
                        </button>
                        <button class="document-action" onclick="documentStorage.deleteDocument('${doc.id}')" title="Delete">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" stroke="currentColor" stroke-width="2"/>
                            </svg>
                        </button>
                    </div>
                `;
                
                // Add drag event listeners
                this.addDragEventListeners(docItem, doc);
                
                categoryDocuments.appendChild(docItem);
            });

            // Toggle category collapse
            categoryHeader.addEventListener('click', () => {
                categoryHeader.classList.toggle('collapsed');
                categoryDocuments.classList.toggle('collapsed');
            });

            categoryGroup.appendChild(categoryHeader);
            categoryGroup.appendChild(categoryDocuments);
            container.appendChild(categoryGroup);
        });
    }

    updateSpaceSelector() {
        const spaceSelector = document.getElementById('currentSpaceSelector');
        if (!spaceSelector) return;
        
        const spaces = this.getSpaces();
        const currentSpace = this.currentSpace;
        
        if (currentSpace) {
            spaceSelector.textContent = currentSpace.name;
            spaceSelector.title = currentSpace.description || currentSpace.name;
        }
    }

    // === DRAG AND DROP METHODS ===
    
    addDragEventListeners(docItem, doc) {
        docItem.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', JSON.stringify({
                docId: doc.id,
                fromCategory: doc.category
            }));
            docItem.classList.add('dragging');
            
            // Show all category headers as potential drop zones
            document.querySelectorAll('.category-header').forEach(header => {
                header.classList.add('drop-zone-visible');
            });
        });
        
        docItem.addEventListener('dragend', (e) => {
            docItem.classList.remove('dragging');
            
            // Hide drop zone indicators
            document.querySelectorAll('.category-header').forEach(header => {
                header.classList.remove('drop-zone-visible', 'drop-zone-active');
            });
        });
    }
    
    addDropZoneListeners(categoryHeader, category) {
        categoryHeader.addEventListener('dragover', (e) => {
            e.preventDefault();
            categoryHeader.classList.add('drop-zone-active');
        });
        
        categoryHeader.addEventListener('dragleave', (e) => {
            // Only remove if leaving the header itself, not just its children
            if (!categoryHeader.contains(e.relatedTarget)) {
                categoryHeader.classList.remove('drop-zone-active');
            }
        });
        
        categoryHeader.addEventListener('drop', (e) => {
            e.preventDefault();
            categoryHeader.classList.remove('drop-zone-active');
            
            try {
                const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                const { docId, fromCategory } = data;
                
                if (fromCategory !== category) {
                    this.moveDocumentToCategory(docId, category);
                }
            } catch (error) {
                console.error('Error processing drop:', error);
            }
        });
    }
    
    moveDocumentToCategory(docId, newCategory) {
        const documents = JSON.parse(localStorage.getItem(this.storageKey) || '[]');
        const docIndex = documents.findIndex(doc => doc.id === docId);
        
        if (docIndex >= 0) {
            const oldCategory = documents[docIndex].category;
            documents[docIndex].category = newCategory;
            documents[docIndex].updatedAt = new Date().toISOString();
            
            localStorage.setItem(this.storageKey, JSON.stringify(documents));
            this.renderSidebar();
            
            this.showNotification(`Moved document to "${newCategory}"`, 'success');
        }
    }

    showNotification(message, type = 'info', duration = 3000) {
        // Create notification element
        const notification = document.createElement('div');
        
        // Define colors based on type
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#6366f1'
        };
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${colors[type] || colors.info};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            z-index: 2000;
            animation: slideInRight 0.3s ease;
            box-shadow: 0 10px 25px rgba(0,0,0,0.1);
            max-width: 350px;
            word-wrap: break-word;
        `;
        notification.textContent = message;

        document.body.appendChild(notification);

        // Remove after delay
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, duration);
    }
}

// Global functions for inline category creation
function handleCategoryChange() {
    const select = document.getElementById('documentCategory');
    const newCategoryInput = document.getElementById('newCategoryInput');
    
    if (select.value === '__CREATE_NEW__') {
        showInlineNewCategory();
        // Reset the select to empty so user can see the new category input
        select.value = '';
    } else {
        // Hide the new category input if it's visible
        if (newCategoryInput.style.display !== 'none') {
            cancelInlineNewCategory();
        }
    }
}

function showInlineNewCategory() {
    const newCategoryInput = document.getElementById('newCategoryInput');
    const newCategoryName = document.getElementById('newCategoryName');
    const newCategoryBtn = document.getElementById('newCategoryInlineBtn');
    
    newCategoryInput.style.display = 'block';
    newCategoryBtn.style.display = 'none';
    newCategoryName.value = '';
    newCategoryName.focus();
    
    // Handle Enter key
    newCategoryName.onkeypress = function(e) {
        if (e.key === 'Enter') {
            createInlineCategory();
        } else if (e.key === 'Escape') {
            cancelInlineNewCategory();
        }
    };
}

function cancelInlineNewCategory() {
    const newCategoryInput = document.getElementById('newCategoryInput');
    const newCategoryBtn = document.getElementById('newCategoryInlineBtn');
    const select = document.getElementById('documentCategory');
    
    newCategoryInput.style.display = 'none';
    newCategoryBtn.style.display = 'flex';
    
    // Reset select if it was on the create option
    if (select.value === '__CREATE_NEW__') {
        select.value = '';
    }
}

function createInlineCategory() {
    const newCategoryName = document.getElementById('newCategoryName');
    const categoryName = newCategoryName.value.trim();
    
    if (!categoryName) {
        newCategoryName.focus();
        return;
    }
    
    // Use the appropriate storage system
    const storage = window.documentStorage;
    if (storage) {
        // Add the category
        storage.addCategory(categoryName);
        
        // Refresh the dropdown
        storage.populateCategorySelect();
        
        // Select the new category
        const select = document.getElementById('documentCategory');
        select.value = categoryName;
        
        // Hide the input and show the button again
        cancelInlineNewCategory();
        
        // Show success message
        storage.showNotification(`Category "${categoryName}" created!`, 'success');
    }
}

// === SPACE MANAGEMENT FUNCTIONS ===

function toggleSpaceDropdown() {
    const dropdown = document.getElementById('spaceDropdown');
    const isVisible = dropdown.classList.contains('show');
    
    if (isVisible) {
        dropdown.classList.remove('show');
        document.removeEventListener('click', closeSpaceDropdownOnClickOutside);
    } else {
        populateSpaceDropdown();
        dropdown.classList.add('show');
        setTimeout(() => {
            document.addEventListener('click', closeSpaceDropdownOnClickOutside);
        }, 0);
    }
}

function closeSpaceDropdownOnClickOutside(event) {
    const dropdown = document.getElementById('spaceDropdown');
    const spaceSelector = document.getElementById('currentSpaceSelector');
    
    if (!dropdown.contains(event.target) && !spaceSelector.contains(event.target)) {
        dropdown.classList.remove('show');
        document.removeEventListener('click', closeSpaceDropdownOnClickOutside);
    }
}

function populateSpaceDropdown() {
    const container = document.getElementById('spacesList');
    const storage = window.documentStorage;
    
    if (!storage) return;
    
    const spaces = storage.getSpaces();
    const currentSpace = storage.currentSpace;
    
    container.innerHTML = '';
    
    spaces.forEach(space => {
        const spaceItem = document.createElement('div');
        spaceItem.className = `space-item ${space.id === currentSpace?.id ? 'active' : ''}`;
        spaceItem.innerHTML = `
            <div class="space-info" onclick="switchToSpace('${space.id}')">
                <div class="space-name">${space.name}</div>
                ${space.description ? `<div class="space-description">${space.description}</div>` : ''}
            </div>
            <div class="space-actions">
                <button class="space-action-btn" onclick="editSpace('${space.id}')" title="Edit Space">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2"/>
                        <path d="m18.5 2.5 a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2"/>
                    </svg>
                </button>
                ${spaces.length > 1 ? `
                    <button class="space-action-btn delete" onclick="deleteSpace('${space.id}')" title="Delete Space">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" stroke="currentColor" stroke-width="2"/>
                        </svg>
                    </button>
                ` : ''}
            </div>
        `;
        container.appendChild(spaceItem);
    });
}

function switchToSpace(spaceId) {
    const storage = window.documentStorage;
    if (storage) {
        storage.setCurrentSpace(spaceId);
        toggleSpaceDropdown(); // Close the dropdown
    }
}

function showSpaceModal() {
    const storage = window.documentStorage;
    if (storage) {
        storage.showSpaceModal();
        toggleSpaceDropdown(); // Close the dropdown
    }
}

function editSpace(spaceId) {
    const storage = window.documentStorage;
    if (storage) {
        storage.showEditSpaceModal(spaceId);
        toggleSpaceDropdown(); // Close the dropdown
    }
}

function deleteSpace(spaceId) {
    const storage = window.documentStorage;
    if (storage) {
        const space = storage.getSpaces().find(s => s.id === spaceId);
        if (space && confirm(`Are you sure you want to delete the space "${space.name}"? All documents and categories will be moved to another space.`)) {
            storage.deleteSpace(spaceId);
            toggleSpaceDropdown(); // Close the dropdown
        }
    }
}

function closeSpaceModal() {
    const modal = document.getElementById('spaceModal');
    modal.classList.remove('show');
}

function closeEditSpaceModal() {
    const modal = document.getElementById('editSpaceModal');
    modal.classList.remove('show');
}

function createSpace() {
    const nameInput = document.getElementById('spaceName');
    const descriptionInput = document.getElementById('spaceDescription');
    const name = nameInput.value.trim();
    const description = descriptionInput.value.trim();
    
    if (!name) {
        nameInput.focus();
        return;
    }
    
    const storage = window.documentStorage;
    if (storage) {
        storage.addSpace(name, description, true);
        closeSpaceModal();
    }
}

function updateSpace() {
    const modal = document.getElementById('editSpaceModal');
    const spaceId = modal.getAttribute('data-space-id');
    const nameInput = document.getElementById('editSpaceName');
    const descriptionInput = document.getElementById('editSpaceDescription');
    const name = nameInput.value.trim();
    const description = descriptionInput.value.trim();
    
    if (!name) {
        nameInput.focus();
        return;
    }
    
    const storage = window.documentStorage;
    if (storage) {
        storage.updateSpace(spaceId, { name, description });
        closeEditSpaceModal();
    }
}

function saveDocument() {
    const nameInput = document.getElementById('documentName');
    const categorySelect = document.getElementById('documentCategory');
    const spaceSelect = document.getElementById('documentSpace');
    
    const name = nameInput.value.trim();
    const category = categorySelect.value;
    const spaceId = spaceSelect ? spaceSelect.value : null;
    
    if (!name) {
        nameInput.focus();
        return;
    }
    
    if (!editor) return;
    
    const content = editor.getValue();
    const storage = window.documentStorage;
    
    if (storage) {
        storage.saveDocument(name, category, content, spaceId);
        closeSaveModal();
    }
}

// Supabase Configuration and Storage System
class SupabaseDocumentStorage {
    constructor() {
        // ⚠️ IMPORTANT: Replace these with your actual Supabase credentials
        this.supabaseUrl = 'https://tpeotxhvlhijpboqtxzr.supabase.co'; // e.g., 'https://abcdefghijklmnop.supabase.co'
        this.supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwZW90eGh2bGhpanBib3F0eHpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwMDg4OTYsImV4cCI6MjA2ODU4NDg5Nn0.yOWHk5mlwJSBJ2_BxBCwErZuyS5zmO0StyRyJvbfJGY'; // Your anon/public key
        
        this.supabase = null;
        this.currentUser = null;
        this.currentDocument = null;
        this.currentSpace = null;
        this.isOnline = navigator.onLine;
        this.demoMode = false;
        this.localBackup = new DocumentStorage(); // Fallback to localStorage
        
        this.init();
    }

    async init() {
        // Check if Supabase credentials are configured
        if (this.supabaseUrl === 'YOUR_SUPABASE_URL' || this.supabaseKey === 'YOUR_SUPABASE_ANON_KEY') {
            console.warn('Supabase not configured, falling back to demo mode');
            this.useDemoMode();
            return;
        }

        // Wait for Supabase to be available - retry for up to 10 seconds
        let supabaseLib = null;
        let attempts = 0;
        const maxAttempts = 20; // 10 seconds with 500ms intervals
        
        while (!supabaseLib && attempts < maxAttempts) {
            attempts++;
            
            if (window.supabaseLoaded && window.supabase && typeof window.supabase.createClient === 'function') {
                supabaseLib = window.supabase;
                console.log('✅ Found Supabase at window.supabase');
                break;
            } else if (typeof window.createClient === 'function') {
                supabaseLib = { createClient: window.createClient };
                console.log('✅ Found Supabase createClient at window.createClient');
                break;
            }
            
            if (attempts < maxAttempts) {
                console.log(`⏳ Waiting for Supabase to load... attempt ${attempts}/${maxAttempts}`);
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        if (!supabaseLib) {
            console.warn('⚠️ Supabase library failed to load after waiting, falling back to demo mode');
            this.useDemoMode();
            this.setupEventListeners();
            return;
        }

        try {
            // Initialize Supabase client
            console.log('🚀 Creating Supabase client...');
            this.supabase = supabaseLib.createClient(this.supabaseUrl, this.supabaseKey);
            console.log('✅ Supabase client created successfully');
            
            // Test the connection with a simple call
            const { data, error } = await this.supabase.auth.getSession();
            if (error) {
                throw error;
            }
            
            // If we have a session, set up the user
            if (data.session) {
                this.currentUser = data.session.user;
                console.log('✅ Found existing session for:', this.currentUser.email);
                this.updateAuthUI();
                await this.loadUserData();
            } else {
                console.log('ℹ️ No existing session found');
                this.updateAuthUI();
            }

            // Listen to auth changes
            this.supabase.auth.onAuthStateChange((event, session) => {
                console.log('🔑 Auth state changed:', event, session?.user?.email);
                this.currentUser = session?.user || null;
                
                // IMPORTANT: Clear demo mode when user successfully signs in
                if (event === 'SIGNED_IN' && this.currentUser) {
                    this.demoMode = false;
                    console.log('✅ User signed in, disabled demo mode');
                    
                    // Clear any pending signup info since user is now confirmed and signed in
                    localStorage.removeItem('pendingSignupEmail');
                    
                    // Check if this was from email confirmation
                    const isFromEmailConfirmation = window.location.hash.includes('access_token') || window.location.hash.includes('type=signup');
                    if (isFromEmailConfirmation) {
                        this.showNotification('Email confirmed successfully! Welcome to your account.', 'success');
                        // Clean up URL if needed
                        if (window.location.hash) {
                            window.history.replaceState(null, null, window.location.pathname);
                        }
                    }
                }
                
                this.updateAuthUI();
                
                if (event === 'SIGNED_IN') {
                    this.loadUserData();
                } else if (event === 'SIGNED_OUT') {
                    this.renderSidebar();
                }
            });

            // Setup real-time subscriptions
            this.setupRealtimeSync();
            
            console.log('🎉 Supabase initialized successfully!');
            
        } catch (error) {
            console.error('❌ Failed to initialize Supabase:', error);
            this.useDemoMode();
        }

        this.setupEventListeners();
        this.setupConnectionMonitoring();
        this.showConnectionStatus();
    }

    useDemoMode(showNotification = false) {
        console.log('⚠️ Switching to demo mode, showNotification:', showNotification);
        this.demoMode = true;
        this.localBackup.init();
        this.updateAuthUI();
        if (showNotification) {
            this.showNotification('Running in demo mode - using local storage', 'info');
        }
    }

    disableDemoMode() {
        console.log('✅ Disabling demo mode - Supabase is available');
        this.demoMode = false;
        this.updateAuthUI();
    }

    setupEventListeners() {
        // Handle email confirmation links
        this.handleEmailConfirmation();
        
        // The save functionality is now handled through the dropdown menu
        // via handleSaveDropdownAction() function
        
        // New category button
        document.getElementById('newCategoryBtn').addEventListener('click', () => {
            if (this.demoMode) {
                this.localBackup.showCategoryModal();
            } else if (this.currentUser) {
                this.showCategoryModal();
            } else {
                this.showAuthModal();
            }
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (this.demoMode || this.currentUser) {
                    this.showSaveModal();
                } else {
                    this.showAuthModal();
                }
            }
        });
    }

    setupConnectionMonitoring() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.showConnectionStatus();
            if (!this.demoMode && this.currentUser) {
                this.syncOfflineChanges();
            }
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.showConnectionStatus();
        });
    }

    setupRealtimeSync() {
        if (this.demoMode || !this.supabase || !this.currentUser) return;

        // Subscribe to document changes
        this.supabase
            .channel('documents')
            .on('postgres_changes', 
                { event: '*', schema: 'public', table: 'documents', filter: `user_id=eq.${this.currentUser.id}` },
                (payload) => {
                    console.log('Document change received:', payload);
                    this.handleRealtimeUpdate(payload);
                }
            )
            .subscribe();
    }

    handleRealtimeUpdate(payload) {
        const { eventType, new: newRecord, old: oldRecord } = payload;
        
        switch (eventType) {
            case 'INSERT':
            case 'UPDATE':
                this.showNotification(`Document "${newRecord.name}" updated`, 'info');
                break;
            case 'DELETE':
                this.showNotification(`Document deleted`, 'info');
                break;
        }
        
        // Refresh sidebar
        this.loadUserData();
    }

    async signUp(email, password, name) {
        if (this.demoMode) return;
        
        try {
            const { data, error } = await this.supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: name
                    }
                }
            });
            
            if (error) throw error;
            
            // Check if email confirmation is required
            if (data.user && !data.session) {
                // Email confirmation required
                this.showNotification('Please check your email and click the confirmation link to complete your account setup!', 'success', 8000);
                
                // Store pending user info for better UX
                localStorage.setItem('pendingSignupEmail', email);
                
                // Show additional guidance
                setTimeout(() => {
                    this.showNotification('Once you confirm your email, you can sign in normally. Confirmation emails may take a few minutes to arrive.', 'info', 6000);
                }, 2000);
                
            } else if (data.session) {
                // User was signed in immediately (email confirmation disabled)
                this.currentUser = data.user;
                this.demoMode = false;
                this.updateAuthUI();
                this.showNotification('Account created and signed in successfully!', 'success');
                this.loadUserData();
            }
            
            return { data, error: null };
        } catch (error) {
            console.error('Sign up error:', error);
            
            // Provide more helpful error messages
            let errorMessage = 'Sign up failed. Please try again.';
            if (error.message.includes('already registered')) {
                errorMessage = 'This email is already registered. Try signing in instead.';
            } else if (error.message.includes('Invalid email')) {
                errorMessage = 'Please enter a valid email address.';
            } else if (error.message.includes('Password')) {
                errorMessage = 'Password must be at least 6 characters long.';
            }
            
            this.showNotification(errorMessage, 'error');
            return { data: null, error };
        }
    }

    async signIn(email, password) {
        if (this.demoMode) {
            console.log('⚠️ Currently in demo mode, cannot sign in with Supabase');
            return;
        }
        
        try {
            console.log('🔑 Attempting to sign in with Supabase...');
            const { data, error } = await this.supabase.auth.signInWithPassword({
                email,
                password
            });
            
            if (error) throw error;
            
            // Update current user immediately and disable demo mode
            this.currentUser = data.user;
            this.demoMode = false;
            console.log('✅ Sign in successful, disabled demo mode for user:', data.user.email);
            
            // Clear any pending signup info
            localStorage.removeItem('pendingSignupEmail');
            
            this.updateAuthUI();
            this.showNotification('Successfully signed in!', 'success');
            await this.loadUserData();
            
            return { data, error: null };
        } catch (error) {
            console.error('❌ Sign in error:', error);
            
            // Provide helpful error messages based on the error type
            let errorMessage = 'Sign in failed. Please check your credentials.';
            
            if (error.message.includes('Email not confirmed')) {
                errorMessage = 'Please check your email and click the confirmation link before signing in.';
                // Show resend option
                setTimeout(() => {
                    this.showNotification('Need a new confirmation email? Try signing up again with the same email.', 'info', 5000);
                }, 2000);
            } else if (error.message.includes('Invalid login credentials')) {
                const pendingEmail = localStorage.getItem('pendingSignupEmail');
                if (pendingEmail === email) {
                    errorMessage = 'Please confirm your email first by clicking the link we sent you, then try signing in again.';
                } else {
                    errorMessage = 'Invalid email or password. Please check your credentials.';
                }
            } else if (error.message.includes('Too many requests')) {
                errorMessage = 'Too many sign in attempts. Please wait a moment and try again.';
            }
            
            this.showNotification(errorMessage, 'error', 6000);
            return { data: null, error };
        }
    }

    async signOut() {
        if (this.demoMode) return;
        
        try {
            const { error } = await this.supabase.auth.signOut();
            if (error) throw error;
            
            this.showNotification('Signed out successfully', 'success');
        } catch (error) {
            console.error('Sign out error:', error);
        }
    }

    async updateUserProfile(name) {
        if (this.demoMode || !this.currentUser) return;
        
        try {
            const { data, error } = await this.supabase.auth.updateUser({
                data: {
                    full_name: name
                }
            });
            
            if (error) throw error;
            
            // Update the current user object
            this.currentUser = data.user;
            this.updateAuthUI();
            this.showNotification('Profile updated successfully!', 'success');
            
            return { data, error: null };
        } catch (error) {
            console.error('Profile update error:', error);
            this.showNotification('Failed to update profile', 'error');
            return { data: null, error };
        }
    }

    async loadUserData() {
        if (this.demoMode || !this.currentUser) return;
        
        try {
            // Load documents and categories
            await Promise.all([
                this.loadDocuments(),
                this.loadCategories()
            ]);
            
            this.renderSidebar();
        } catch (error) {
            console.error('Failed to load user data:', error);
            this.showNotification('Failed to load documents', 'error');
        }
    }

    async loadDocuments() {
        if (this.demoMode) return this.localBackup.getDocuments();
        if (!this.currentUser) return [];
        
        try {
            const { data, error } = await this.supabase
                .from('documents')
                .select('*')
                .eq('user_id', this.currentUser.id)
                .order('updated_at', { ascending: false });
            
            if (error) throw error;
            
            this.documents = data || [];
            return this.documents;
        } catch (error) {
            console.error('Failed to load documents:', error);
            return [];
        }
    }

    async loadCategories() {
        if (this.demoMode) return this.localBackup.getCategories();
        if (!this.currentUser) return [];
        
        try {
            const { data, error } = await this.supabase
                .from('categories')
                .select('*')
                .eq('user_id', this.currentUser.id)
                .order('name');
            
            if (error) throw error;
            
            this.categories = data?.map(cat => cat.name) || [];
            
            // Ensure default categories exist (only on first load)
            if (this.categories.length === 0) {
                const defaults = ['Personal', 'Work', 'Learning'];
                for (const defaultCat of defaults) {
                    await this.addCategory(defaultCat);
                }
                // Reload categories after adding defaults
                const { data: updatedData } = await this.supabase
                    .from('categories')
                    .select('*')
                    .eq('user_id', this.currentUser.id)
                    .order('name');
                this.categories = updatedData?.map(cat => cat.name) || [];
            }
            
            return this.categories;
        } catch (error) {
            console.error('Failed to load categories:', error);
            return [];
        }
    }

    async saveDocument(name, category, content) {
        if (this.demoMode) {
            return this.localBackup.saveDocument(name, category, content);
        }
        
        if (!this.currentUser) {
            this.showAuthModal();
            return;
        }

        try {
            this.showConnectionStatus('syncing');
            
            const documentData = {
                name,
                category: category || 'Uncategorized',
                content,
                user_id: this.currentUser.id,
                updated_at: new Date().toISOString()
            };

            // Check if document exists
            const { data: existing } = await this.supabase
                .from('documents')
                .select('id')
                .eq('user_id', this.currentUser.id)
                .eq('name', name)
                .eq('category', category || 'Uncategorized')
                .single();

            let result;
            if (existing) {
                // Update existing document
                result = await this.supabase
                    .from('documents')
                    .update(documentData)
                    .eq('id', existing.id)
                    .select()
                    .single();
            } else {
                // Create new document
                documentData.created_at = new Date().toISOString();
                result = await this.supabase
                    .from('documents')
                    .insert(documentData)
                    .select()
                    .single();
            }

            if (result.error) throw result.error;

            this.currentDocument = result.data;
            this.showNotification('Document saved to cloud!', 'success');
            this.showConnectionStatus('online');
            
            // Refresh documents list
            await this.loadDocuments();
            this.renderSidebar();
            
        } catch (error) {
            console.error('Failed to save document:', error);
            this.showNotification('Failed to save document', 'error');
            this.showConnectionStatus('offline');
            
            // TODO: Store for offline sync
        }
    }

    async loadDocument(id) {
        if (this.demoMode) {
            return this.localBackup.loadDocument(id);
        }
        
        try {
            const { data, error } = await this.supabase
                .from('documents')
                .select('*')
                .eq('id', id)
                .single();
            
            if (error) throw error;
            
            if (data && editor) {
                editor.setValue(data.content);
                this.currentDocument = data;
                this.showNotification(`Loaded "${data.name}"`, 'success');
            }
        } catch (error) {
            console.error('Failed to load document:', error);
            this.showNotification('Failed to load document', 'error');
        }
    }

    async deleteDocument(id) {
        if (this.demoMode) {
            return this.localBackup.deleteDocument(id);
        }
        
        try {
            const { error } = await this.supabase
                .from('documents')
                .delete()
                .eq('id', id);
            
            if (error) throw error;
            
            this.showNotification('Document deleted', 'success');
            await this.loadDocuments();
            this.renderSidebar();
            
        } catch (error) {
            console.error('Failed to delete document:', error);
            this.showNotification('Failed to delete document', 'error');
        }
    }

    async duplicateDocument(id) {
        if (this.demoMode) {
            return this.localBackup.duplicateDocument(id);
        }
        
        try {
            const { data: original, error } = await this.supabase
                .from('documents')
                .select('*')
                .eq('id', id)
                .single();
            
            if (error) throw error;
            
            const copy = {
                name: `${original.name} (Copy)`,
                category: original.category,
                content: original.content,
                user_id: this.currentUser.id,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            
            const { error: insertError } = await this.supabase
                .from('documents')
                .insert(copy);
            
            if (insertError) throw insertError;
            
            this.showNotification('Document duplicated', 'success');
            await this.loadDocuments();
            this.renderSidebar();
            
        } catch (error) {
            console.error('Failed to duplicate document:', error);
            this.showNotification('Failed to duplicate document', 'error');
        }
    }

    async addCategory(name) {
        if (this.demoMode) {
            return this.localBackup.addCategory(name);
        }
        
        if (!this.currentUser) return;
        
        try {
            const { error } = await this.supabase
                .from('categories')
                .insert({
                    name,
                    user_id: this.currentUser.id,
                    created_at: new Date().toISOString()
                });
            
            // Ignore duplicate key errors (PostgreSQL code 23505 or Supabase conflict)
            if (error && error.code !== '23505' && !error.message?.includes('duplicate') && !error.message?.includes('already exists')) {
                throw error;
            }
            
            await this.loadCategories();
            this.renderSidebar();
            this.populateCategorySelect();
            
        } catch (error) {
            // Handle HTTP 409 conflicts and other duplicate-related errors silently
            if (error.status === 409 || error.code === 409 || error.message?.includes('duplicate') || error.message?.includes('already exists')) {
                console.log(`Category "${name}" already exists, skipping...`);
                return;
            }
            console.error('Failed to add category:', error);
        }
    }

    async deleteCategory(name) {
        if (this.demoMode) {
            return this.localBackup.deleteCategory(name);
        }
        
        try {
            // Delete category
            await this.supabase
                .from('categories')
                .delete()
                .eq('user_id', this.currentUser.id)
                .eq('name', name);
            
            // Move documents to 'Uncategorized'
            await this.supabase
                .from('documents')
                .update({ category: 'Uncategorized' })
                .eq('user_id', this.currentUser.id)
                .eq('category', name);
            
            await this.loadCategories();
            await this.loadDocuments();
            this.renderSidebar();
            this.populateCategorySelect();
            
        } catch (error) {
            console.error('Failed to delete category:', error);
        }
    }

    updateAuthUI() {
        const authBtn = document.getElementById('authBtn');
        const userProfile = document.getElementById('userProfile');
        const userEmail = document.getElementById('userEmail');
        const userMenuName = document.getElementById('userMenuName');
        const userMenuEmail = document.getElementById('userMenuEmail');
        
        // If user is signed in with Supabase, prioritize that over demo mode
        if (this.currentUser && !this.demoMode) {
            // Real Supabase user signed in
            authBtn.style.display = 'none';
            userProfile.style.display = 'flex';
            
            // Use the full name if available, otherwise extract username from email
            const displayName = this.currentUser.user_metadata?.full_name || this.currentUser.email.split('@')[0];
            userEmail.textContent = displayName;
            if (userMenuName) userMenuName.textContent = displayName;
            if (userMenuEmail) userMenuEmail.textContent = this.currentUser.email;
            console.log('🎯 UI updated for signed-in user:', this.currentUser.email);
        } else if (this.demoMode) {
            // Demo mode
            authBtn.style.display = 'block';
            userProfile.style.display = 'none';
            authBtn.textContent = 'Demo Mode';
            authBtn.className = 'auth-btn';
            authBtn.onclick = () => this.showAuthModal();
        } else {
            // Not signed in
            authBtn.style.display = 'block';
            userProfile.style.display = 'none';
            authBtn.textContent = 'Sign In';
            authBtn.className = 'auth-btn';
            authBtn.onclick = () => this.showAuthModal();
        }
    }

    showAuthModal() {
        const modal = document.getElementById('authModal');
        const resendSection = document.getElementById('resendConfirmationSection');
        modal.classList.add('show');
        
        // Check if there's a pending signup that needs email confirmation
        const pendingEmail = localStorage.getItem('pendingSignupEmail');
        if (pendingEmail) {
            // Show helpful guidance
            const emailInput = document.getElementById('authEmail');
            emailInput.value = pendingEmail;
            
            // Switch to sign-in tab by default if they have a pending confirmation
            switchAuthTab('signin');
            
            // Show the resend section
            resendSection.style.display = 'block';
            
            // Show a helpful hint
            setTimeout(() => {
                this.showNotification('Please check your email for the confirmation link. If you don\'t see it, check your spam folder or click "Resend Confirmation Email" below.', 'info', 8000);
            }, 500);
        } else {
            // Hide resend section if no pending email
            resendSection.style.display = 'none';
        }
        
        document.getElementById('authEmail').focus();
    }

    showSaveModal() {
        if (this.demoMode) {
            return this.localBackup.showSaveModal();
        }
        
        const modal = document.getElementById('saveModal');
        const nameInput = document.getElementById('documentName');
        const categorySelect = document.getElementById('documentCategory');
        
        // Populate categories
        this.populateCategorySelect();
        
        // Pre-fill if editing current document
        if (this.currentDocument) {
            nameInput.value = this.currentDocument.name;
            categorySelect.value = this.currentDocument.category;
        } else {
            nameInput.value = '';
            categorySelect.value = '';
        }
        
        modal.classList.add('show');
        nameInput.focus();
    }

    showCategoryModal() {
        const modal = document.getElementById('categoryModal');
        const nameInput = document.getElementById('categoryName');
        
        nameInput.value = '';
        modal.classList.add('show');
        nameInput.focus();
    }

    populateCategorySelect() {
        const select = document.getElementById('documentCategory');
        const categories = this.demoMode ? this.localBackup.getCategories() : (this.categories || []);
        
        select.innerHTML = '<option value="">Select category...</option>';
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            select.appendChild(option);
        });
        
        // Add "Create new category..." option
        const createOption = document.createElement('option');
        createOption.value = '__CREATE_NEW__';
        createOption.textContent = '+ Create new category...';
        createOption.style.fontStyle = 'italic';
        createOption.style.color = '#a855f7';
        select.appendChild(createOption);
    }

    renderSidebar() {
        if (this.demoMode) {
            return this.localBackup.renderSidebar();
        }
        
        const container = document.getElementById('categoriesList');
        const documents = this.documents || [];
        const categories = this.categories || [];
        
        // Group documents by category
        const groupedDocs = {};
        categories.forEach(cat => groupedDocs[cat] = []);
        
        documents.forEach(doc => {
            const category = doc.category || 'Uncategorized';
            if (!groupedDocs[category]) {
                groupedDocs[category] = [];
            }
            groupedDocs[category].push(doc);
        });

        container.innerHTML = '';

        Object.entries(groupedDocs).forEach(([category, docs]) => {
            if (docs.length === 0) return;

            const categoryGroup = document.createElement('div');
            categoryGroup.className = 'category-group';

            const categoryHeader = document.createElement('div');
            categoryHeader.className = 'category-header';
            categoryHeader.setAttribute('data-category', category);
            categoryHeader.innerHTML = `
                <div class="category-title">
                    <span>${category}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="category-count">${docs.length}</span>
                    ${category !== 'Uncategorized' ? `
                        <button class="document-action" onclick="documentStorage.deleteCategory('${category}')" title="Delete category" style="opacity: 0.6; transition: opacity 0.2s;">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" stroke="currentColor" stroke-width="2"/>
                            </svg>
                        </button>
                    ` : ''}
                    <svg class="category-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <polyline points="6,9 12,15 18,9" stroke="currentColor" stroke-width="2"/>
                    </svg>
                </div>
            `;
            
            // Add drop zone functionality
            this.addDropZoneListeners(categoryHeader, category);

            const categoryDocuments = document.createElement('div');
            categoryDocuments.className = 'category-documents';

            docs.forEach(doc => {
                const docItem = document.createElement('div');
                docItem.className = 'document-item';
                docItem.draggable = true;
                docItem.setAttribute('data-doc-id', doc.id);
                docItem.setAttribute('data-doc-category', doc.category);
                docItem.innerHTML = `
                    <span class="document-name" onclick="documentStorage.loadDocument('${doc.id}')" title="Click to open document">${doc.name}</span>
                    <div class="document-actions">
                        <button class="document-action" onclick="documentStorage.duplicateDocument('${doc.id}')" title="Duplicate">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="currentColor" stroke-width="2"/>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="2"/>
                            </svg>
                        </button>
                        <button class="document-action" onclick="documentStorage.deleteDocument('${doc.id}')" title="Delete">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" stroke="currentColor" stroke-width="2"/>
                            </svg>
                        </button>
                    </div>
                `;
                
                // Add drag event listeners
                this.addDragEventListeners(docItem, doc);
                
                categoryDocuments.appendChild(docItem);
            });

            // Toggle category collapse
            categoryHeader.addEventListener('click', () => {
                categoryHeader.classList.toggle('collapsed');
                categoryDocuments.classList.toggle('collapsed');
            });

            categoryGroup.appendChild(categoryHeader);
            categoryGroup.appendChild(categoryDocuments);
            container.appendChild(categoryGroup);
        });
    }

    showConnectionStatus(status) {
        let existingStatus = document.querySelector('.connection-status');
        if (existingStatus) {
            existingStatus.remove();
        }

        if (!status) {
            status = this.isOnline ? 'online' : 'offline';
        }

        if (this.demoMode) return; // Don't show connection status in demo mode

        const statusEl = document.createElement('div');
        statusEl.className = `connection-status ${status}`;
        
        const messages = {
            online: { text: 'Connected', icon: '●' },
            offline: { text: 'Offline', icon: '●' },
            syncing: { text: 'Syncing...', icon: '◐' }
        };
        
        const message = messages[status] || messages.offline;
        statusEl.innerHTML = `
            <span class="status-dot"></span>
            ${message.text}
        `;
        
        document.body.appendChild(statusEl);
        
        // Auto-hide after 3 seconds unless it's offline
        if (status !== 'offline') {
            setTimeout(() => {
                if (statusEl.parentNode) {
                    statusEl.remove();
                }
            }, 3000);
        }
    }

    showNotification(message, type = 'info', duration = 3000) {
        // Create notification element
        const notification = document.createElement('div');
        
        // Define colors based on type
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#6366f1'
        };
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${colors[type] || colors.info};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            z-index: 2000;
            animation: slideInRight 0.3s ease;
            box-shadow: 0 10px 25px rgba(0,0,0,0.1);
            max-width: 350px;
            word-wrap: break-word;
        `;
        notification.textContent = message;

        document.body.appendChild(notification);

        // Remove after delay
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, duration);
    }

    async syncOfflineChanges() {
        // TODO: Implement offline sync logic
        console.log('Syncing offline changes...');
    }

    handleEmailConfirmation() {
        // Check if the URL contains email confirmation parameters
        const hash = window.location.hash;
        if (hash && (hash.includes('type=signup') || hash.includes('access_token'))) {
            console.log('🔗 Detected email confirmation link, processing...');
            
            // Show loading message
            this.showNotification('Processing email confirmation...', 'info', 2000);
            
            // The auth state change handler will pick up the confirmation automatically
            // and show the success message
        }
    }

    async resendConfirmation(email) {
        if (this.demoMode) return;
        
        try {
            const { error } = await this.supabase.auth.resend({
                type: 'signup',
                email: email
            });
            
            if (error) throw error;
            
            this.showNotification('Confirmation email sent! Please check your inbox and spam folder.', 'success', 6000);
            return { error: null };
        } catch (error) {
            console.error('Resend confirmation error:', error);
            
            let errorMessage = 'Failed to resend confirmation email.';
            if (error.message.includes('already confirmed')) {
                errorMessage = 'This email is already confirmed. Try signing in instead.';
            } else if (error.message.includes('not found')) {
                errorMessage = 'Email not found. Please sign up first.';
            }
            
            this.showNotification(errorMessage, 'error');
            return { error };
        }
    }

    // === SPACES SUPPORT METHODS ===
    
    getSpaces() {
        if (this.demoMode) {
            return this.localBackup.getSpaces();
        }
        return this.spaces || [];
    }
    
    getCurrentSpace() {
        if (this.demoMode) {
            return this.localBackup.getCurrentSpace();
        }
        return this.currentSpace;
    }
    
    setCurrentSpace(spaceId) {
        if (this.demoMode) {
            return this.localBackup.setCurrentSpace(spaceId);
        }
        
        const space = this.getSpaces().find(s => s.id === spaceId);
        if (space) {
            this.currentSpace = space;
            this.renderSidebar();
            this.showNotification(`Switched to "${space.name}"`, 'success');
        }
    }
    
    addSpace(name, description = '', setAsCurrent = false) {
        if (this.demoMode) {
            return this.localBackup.addSpace(name, description, setAsCurrent);
        }
        
        // TODO: Implement Supabase space creation
        // For now, delegate to local backup
        return this.localBackup.addSpace(name, description, setAsCurrent);
    }
    
    updateSpace(spaceId, updates) {
        if (this.demoMode) {
            return this.localBackup.updateSpace(spaceId, updates);
        }
        
        // TODO: Implement Supabase space update
        // For now, delegate to local backup
        return this.localBackup.updateSpace(spaceId, updates);
    }
    
    deleteSpace(spaceId) {
        if (this.demoMode) {
            return this.localBackup.deleteSpace(spaceId);
        }
        
        // TODO: Implement Supabase space deletion
        // For now, delegate to local backup
        return this.localBackup.deleteSpace(spaceId);
    }
    
    showSpaceModal() {
        if (this.demoMode) {
            return this.localBackup.showSpaceModal();
        }
        
        const modal = document.getElementById('spaceModal');
        const nameInput = document.getElementById('spaceName');
        const descriptionInput = document.getElementById('spaceDescription');
        
        nameInput.value = '';
        descriptionInput.value = '';
        modal.classList.add('show');
        nameInput.focus();
    }
    
    showEditSpaceModal(spaceId) {
        if (this.demoMode) {
            return this.localBackup.showEditSpaceModal(spaceId);
        }
        
        const space = this.getSpaces().find(s => s.id === spaceId);
        if (!space) return;
        
        const modal = document.getElementById('editSpaceModal');
        const nameInput = document.getElementById('editSpaceName');
        const descriptionInput = document.getElementById('editSpaceDescription');
        
        nameInput.value = space.name;
        descriptionInput.value = space.description || '';
        
        // Store space ID for updating
        modal.setAttribute('data-space-id', spaceId);
        
        modal.classList.add('show');
        nameInput.focus();
    }
    
    updateSpaceSelector() {
        if (this.demoMode) {
            return this.localBackup.updateSpaceSelector();
        }
        
        const spaceSelector = document.getElementById('currentSpaceSelector');
        if (!spaceSelector) return;
        
        const currentSpace = this.currentSpace;
        
        if (currentSpace) {
            spaceSelector.textContent = currentSpace.name;
            spaceSelector.title = currentSpace.description || currentSpace.name;
        }
    }
    
    populateSpaceSelect() {
        if (this.demoMode) {
            return this.localBackup.populateSpaceSelect();
        }
        
        const select = document.getElementById('documentSpace');
        if (!select) return;
        
        const spaces = this.getSpaces();
        
        select.innerHTML = '';
        spaces.forEach(space => {
            const option = document.createElement('option');
            option.value = space.id;
            option.textContent = space.name;
            select.appendChild(option);
        });
    }

    // === DRAG AND DROP SUPPORT ===
    
    addDragEventListeners(docItem, doc) {
        if (this.demoMode) {
            return this.localBackup.addDragEventListeners(docItem, doc);
        }
        
        // For Supabase mode, delegate to local backup for now
        // TODO: Implement native Supabase drag and drop
        return this.localBackup.addDragEventListeners(docItem, doc);
    }
    
    addDropZoneListeners(categoryHeader, category) {
        if (this.demoMode) {
            return this.localBackup.addDropZoneListeners(categoryHeader, category);
        }
        
        // For Supabase mode, delegate to local backup for now
        // TODO: Implement native Supabase drag and drop
        return this.localBackup.addDropZoneListeners(categoryHeader, category);
    }
    
    moveDocumentToCategory(docId, newCategory) {
        if (this.demoMode) {
            return this.localBackup.moveDocumentToCategory(docId, newCategory);
        }
        
        // For Supabase mode, delegate to local backup for now
        // TODO: Implement native Supabase document moving
        return this.localBackup.moveDocumentToCategory(docId, newCategory);
    }
}

