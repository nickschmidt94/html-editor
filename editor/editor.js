// Editor-specific JavaScript
let editor;
let isMobile = false;
let ogOverlayVisible = false;
let isDragging = false;
let dragOffset = { x: 0, y: 0 };

// Initialize Monaco Editor
require.config({ paths: { vs: 'https://unpkg.com/monaco-editor@0.44.0/min/vs' } });
require(['vs/editor/editor.main'], function () {
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
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        
        .container {
            text-align: center;
            max-width: 600px;
        }
        
        h1 {
            font-size: 3rem;
            font-weight: 700;
            margin-bottom: 1rem;
            background: linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.8) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            animation: fadeInUp 0.8s ease-out;
        }
        
        p {
            font-size: 1.2rem;
            opacity: 0.9;
            line-height: 1.6;
            animation: fadeInUp 0.8s ease-out 0.2s both;
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
    </style>
</head>
<body>
    <div class="container">
        <h1>Beautiful HTML</h1>
        <p>Start creating something amazing. Changes appear instantly as you type.</p>
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

    // Update preview when content changes
    editor.onDidChangeModelContent(() => {
        updatePreview();
    });
    
    // Initial preview
    updatePreview();
});

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
        
        // Add label
        const label = document.createElement('div');
        label.style.cssText = `
            position: absolute;
            top: -35px;
            left: 0;
            background: #22c55e;
            color: white;
            padding: 4px 12px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
            white-space: nowrap;
            cursor: move;
        `;
        label.textContent = '1200×630px - Drag to position';
        overlay.appendChild(label);
        
        // Make overlay draggable
        setupDragging(overlay);
        
        // Make preview pane relative for positioning
        previewPane.style.position = 'relative';
        previewPane.appendChild(overlay);
        
        // Update button
        exportBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2"/><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2"/></svg>';
        exportBtn.title = 'Hide OpenGraph overlay';
        
    } else {
        // Remove overlay
        const overlay = document.getElementById('og-overlay');
        if (overlay) {
            overlay.remove();
        }
        
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
        
        // Keep within bounds
        newX = Math.max(0, Math.min(newX, previewRect.width - 1200));
        newY = Math.max(0, Math.min(newY, previewRect.height - 630));
        
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

// Clear editor content
function clearEditor() {
    if (!editor) return;
    
    // Show confirmation dialog to prevent accidental clearing
    const confirmed = confirm('Are you sure you want to clear all code? This action cannot be undone.');
    
    if (confirmed) {
        editor.setValue('');
        showCopyNotification('Editor cleared!', 'success');
        
        // Update preview to reflect empty editor
        updatePreview();
        
        // Reset current document reference
        if (window.documentStorage) {
            window.documentStorage.currentDocument = null;
        }
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

// Initialize storage systems when page loads
window.addEventListener('DOMContentLoaded', () => {
    // Try to initialize Supabase storage first, falls back to local storage
    try {
        window.documentStorage = new SupabaseDocumentStorage();
    } catch (error) {
        console.warn('Failed to initialize Supabase storage, using local storage:', error);
        window.documentStorage = new DocumentStorage();
    }
}); 

// Document Storage System
class DocumentStorage {
    constructor() {
        this.storageKey = 'html-editor-documents';
        this.categoriesKey = 'html-editor-categories';
        this.currentDocument = null;
        this.init();
    }

    init() {
        // Initialize default categories if none exist
        if (!this.getCategories().length) {
            this.addCategory('Personal');
            this.addCategory('Work');
            this.addCategory('Learning');
        }
        this.renderSidebar();
        this.setupEventListeners();
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
        return stored ? JSON.parse(stored) : [];
    }

    getCategories() {
        const stored = localStorage.getItem(this.categoriesKey);
        return stored ? JSON.parse(stored) : [];
    }

    saveDocument(name, category, content) {
        const documents = this.getDocuments();
        const now = new Date().toISOString();
        
        const document = {
            id: Date.now().toString(),
            name: name,
            category: category || 'Uncategorized',
            content: content,
            createdAt: now,
            updatedAt: now
        };

        // Check if document with same name exists in category
        const existingIndex = documents.findIndex(doc => 
            doc.name === name && doc.category === category
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
        const documents = this.getDocuments();
        const document = documents.find(doc => doc.id === id);
        
        if (document && editor) {
            editor.setValue(document.content);
            this.currentDocument = document;
            this.showNotification(`Loaded "${document.name}"`, 'success');
        }
    }

    deleteDocument(id) {
        const documents = this.getDocuments();
        const filtered = documents.filter(doc => doc.id !== id);
        localStorage.setItem(this.storageKey, JSON.stringify(filtered));
        this.renderSidebar();
        this.showNotification('Document deleted', 'success');
    }

    duplicateDocument(id) {
        const documents = this.getDocuments();
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
        const categories = this.getCategories();
        if (!categories.includes(name)) {
            categories.push(name);
            localStorage.setItem(this.categoriesKey, JSON.stringify(categories));
            this.renderSidebar();
            this.populateCategorySelect();
        }
    }

    deleteCategory(name) {
        const categories = this.getCategories().filter(cat => cat !== name);
        localStorage.setItem(this.categoriesKey, JSON.stringify(categories));
        
        // Move documents from deleted category to 'Uncategorized'
        const documents = this.getDocuments();
        documents.forEach(doc => {
            if (doc.category === name) {
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
    }

    renderSidebar() {
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
            categoryHeader.innerHTML = `
                <span>${category} (${docs.length})</span>
                <div style="display: flex; align-items: center; gap: 4px;">
                    ${category !== 'Uncategorized' ? `
                        <button class="document-action" onclick="documentStorage.deleteCategory('${category}')" title="Delete category">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" stroke="currentColor" stroke-width="2"/>
                            </svg>
                        </button>
                    ` : ''}
                    <svg class="category-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <polyline points="6,9 12,15 18,9" stroke="currentColor" stroke-width="2"/>
                    </svg>
                </div>
            `;

            const categoryDocuments = document.createElement('div');
            categoryDocuments.className = 'category-documents';

            docs.forEach(doc => {
                const docItem = document.createElement('div');
                docItem.className = 'document-item';
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

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#10b981' : '#6366f1'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            z-index: 2000;
            animation: slideInRight 0.3s ease;
            box-shadow: 0 10px 25px rgba(0,0,0,0.1);
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
        }, 3000);
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
            
            this.showNotification('Check your email to confirm your account!', 'success');
            // Note: For sign-up, user won't be signed in until email is confirmed
            return { data, error: null };
        } catch (error) {
            console.error('Sign up error:', error);
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
            
            this.updateAuthUI();
            this.showNotification('Successfully signed in!', 'success');
            
            return { data, error: null };
        } catch (error) {
            console.error('❌ Sign in error:', error);
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
        modal.classList.add('show');
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
            categoryHeader.innerHTML = `
                <span>${category} (${docs.length})</span>
                <div style="display: flex; align-items: center; gap: 4px;">
                    ${category !== 'Uncategorized' ? `
                        <button class="document-action" onclick="documentStorage.deleteCategory('${category}')" title="Delete category">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" stroke="currentColor" stroke-width="2"/>
                            </svg>
                        </button>
                    ` : ''}
                    <svg class="category-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <polyline points="6,9 12,15 18,9" stroke="currentColor" stroke-width="2"/>
                    </svg>
                </div>
            `;

            const categoryDocuments = document.createElement('div');
            categoryDocuments.className = 'category-documents';

            docs.forEach(doc => {
                const docItem = document.createElement('div');
                docItem.className = 'document-item';
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

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#6366f1'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            z-index: 2000;
            animation: slideInRight 0.3s ease;
            box-shadow: 0 10px 25px rgba(0,0,0,0.1);
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
        }, 3000);
    }

    async syncOfflineChanges() {
        // TODO: Implement offline sync logic
        console.log('Syncing offline changes...');
    }
}

// Modal Functions
function closeSaveModal() {
    document.getElementById('saveModal').classList.remove('show');
}

function closeCategoryModal() {
    document.getElementById('categoryModal').classList.remove('show');
}

function saveDocument() {
    const name = document.getElementById('documentName').value.trim();
    const category = document.getElementById('documentCategory').value;
    
    if (!name) {
        alert('Please enter a document name');
        return;
    }
    
    if (!editor) {
        alert('Editor not ready');
        return;
    }
    
    const content = editor.getValue();
    documentStorage.saveDocument(name, category, content);
    closeSaveModal();
}

function addCategory() {
    const name = document.getElementById('categoryName').value.trim();
    
    if (!name) {
        alert('Please enter a category name');
        return;
    }
    
    documentStorage.addCategory(name);
    closeCategoryModal();
}

// Add notification styles to head
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(notificationStyles);

// Global sidebar toggle function - independent of storage system
function toggleSidebar() {
    const sidebar = document.getElementById('documentsSidebar');
    if (sidebar) {
        sidebar.classList.toggle('collapsed');
        
        // Trigger Monaco layout update
        if (editor) {
            setTimeout(() => editor.layout(), 300);
        }
    }
}

// Set up sidebar toggle immediately when DOM is ready
function setupSidebarToggle() {
    const sidebarToggle = document.getElementById('sidebarToggle');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', toggleSidebar);
        console.log('✅ Sidebar toggle event listener set up');
    } else {
        console.warn('❌ Sidebar toggle button not found');
    }
}

// Initialize storage system with better debugging
let documentStorage;
let storageInitialized = false;

function initializeStorage() {
    if (storageInitialized) {
        console.log('⏩ Storage already initialized as:', documentStorage?.constructor.name);
        return;
    }
    
    console.log('=== Starting Storage Initialization ===');
    console.log('supabaseLoaded flag:', window.supabaseLoaded);
    console.log('window.supabase:', typeof window.supabase);
    console.log('window.createClient:', typeof window.createClient);
    
    try {
        // Check if Supabase is available and properly loaded
        if (window.supabaseLoaded && window.supabase && typeof window.supabase.createClient === 'function') {
            console.log('✅ Supabase is available, initializing SupabaseDocumentStorage...');
            documentStorage = new SupabaseDocumentStorage();
        } else {
            console.log('⚠️ Supabase not available, falling back to localStorage...');
            console.log('Supabase check details:');
            console.log('- supabaseLoaded:', window.supabaseLoaded);
            console.log('- supabase exists:', !!window.supabase);
            console.log('- createClient function:', typeof window.supabase?.createClient);
            documentStorage = new DocumentStorage();
        }
        storageInitialized = true;
        console.log('✅ Storage initialized successfully as:', documentStorage.constructor.name);
    } catch (error) {
        console.error('❌ Failed to initialize Supabase storage:', error);
        console.log('🔄 Falling back to localStorage...');
        documentStorage = new DocumentStorage();
        storageInitialized = true;
    }
}

// Listen for Supabase events
window.addEventListener('supabaseReady', () => {
    console.log('🎉 Supabase ready event received, re-initializing storage...');
    // If we're currently in demo mode, try to switch to Supabase
    if (documentStorage && documentStorage.demoMode) {
        console.log('🔄 Attempting to switch from demo mode to Supabase...');
        storageInitialized = false;
        initializeStorage();
    }
});

window.addEventListener('supabaseFailed', () => {
    console.log('⚠️ Supabase failed event received, using demo mode...');
    if (!storageInitialized) {
        initializeStorage();
    }
});

// Initialize when DOM is ready - but wait for Supabase decision
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Set up sidebar toggle immediately
        setupSidebarToggle();
        
        // Wait longer for Supabase to potentially load and expose globals
        setTimeout(() => {
            if (!storageInitialized) {
                console.log('⏰ Initial storage check after 2 seconds...');
                initializeStorage();
            }
        }, 2000);
        
        // Final fallback timer
        setTimeout(() => {
            if (!storageInitialized) {
                console.log('⏰ Final fallback initialization after 6 seconds...');
                initializeStorage();
            }
        }, 6000);
    });
} else {
    // Set up sidebar toggle immediately
    setupSidebarToggle();
    
    // Wait longer for Supabase to potentially load and expose globals
    setTimeout(() => {
        if (!storageInitialized) {
            console.log('⏰ Initial storage check after 2 seconds...');
            initializeStorage();
        }
    }, 2000);
    
    // Final fallback timer
    setTimeout(() => {
        if (!storageInitialized) {
            console.log('⏰ Final fallback initialization after 6 seconds...');
            initializeStorage();
        }
    }, 6000);
}

// Quick function to update your name for existing account
function updateMyName() {
    if (documentStorage && documentStorage.currentUser) {
        documentStorage.updateUserProfile('Nick');
    } else {
        alert('Please sign in first');
    }
}

// Authentication Functions
function toggleAuth() {
    if (documentStorage.demoMode) {
        documentStorage.showAuthModal();
    } else if (documentStorage.currentUser) {
        documentStorage.signOut();
    } else {
        documentStorage.showAuthModal();
    }
}

// User menu functions
function toggleUserMenu() {
    const userMenu = document.getElementById('userMenu');
    userMenu.classList.toggle('show');
}

// Close user menu when clicking outside
document.addEventListener('click', (e) => {
    const userMenu = document.getElementById('userMenu');
    const userMenuBtn = document.querySelector('.user-menu-btn');
    const userProfile = document.getElementById('userProfile');
    
    if (userMenu && userMenu.classList.contains('show')) {
        if (!userProfile.contains(e.target)) {
            userMenu.classList.remove('show');
        }
    }
});

function closeAuthModal() {
    document.getElementById('authModal').classList.remove('show');
}

function switchAuthTab(tab) {
    const tabs = document.querySelectorAll('.auth-tab');
    const title = document.getElementById('authModalTitle');
    const submitBtn = document.getElementById('authSubmitBtn');
    const nameGroup = document.getElementById('nameGroup');
    const nameInput = document.getElementById('authName');
    
    tabs.forEach(t => t.classList.remove('active'));
    document.querySelector(`[onclick="switchAuthTab('${tab}')"]`).classList.add('active');
    
    if (tab === 'signin') {
        title.textContent = 'Sign In to Save Your Work';
        submitBtn.textContent = 'Sign In';
        nameGroup.style.display = 'none';
        nameInput.required = false;
    } else {
        title.textContent = 'Create Your Account';
        submitBtn.textContent = 'Sign Up';
        nameGroup.style.display = 'block';
        nameInput.required = true;
    }
}

async function handleAuth(event) {
    event.preventDefault();
    
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;
    const name = document.getElementById('authName').value;
    const isSignUp = document.getElementById('authSubmitBtn').textContent === 'Sign Up';
    const submitBtn = document.getElementById('authSubmitBtn');
    
    // Disable button during request
    submitBtn.disabled = true;
    submitBtn.textContent = isSignUp ? 'Creating Account...' : 'Signing In...';
    
    try {
        let result;
        if (isSignUp) {
            result = await documentStorage.signUp(email, password, name);
        } else {
            result = await documentStorage.signIn(email, password);
        }
        
        if (result && result.error) {
            alert(result.error.message);
        } else {
            // Success!
            closeAuthModal();
            // Clear form
            document.getElementById('authForm').reset();
            
            // For sign-up, show a different message since they need to confirm email
            if (isSignUp) {
                alert('Account created! Please check your email to confirm your account before signing in.');
            } else {
                // For sign-in, give a moment for the auth state to update
                setTimeout(() => {
                    if (documentStorage.updateAuthUI) {
                        documentStorage.updateAuthUI();
                    }
                }, 100);
            }
        }
    } catch (error) {
        alert('Authentication failed: ' + error.message);
    } finally {
        // Re-enable button
        submitBtn.disabled = false;
        submitBtn.textContent = isSignUp ? 'Sign Up' : 'Sign In';
    }
}

function useDemoMode() {
    closeAuthModal();
    // Only show notification when user explicitly chooses demo mode
    documentStorage.useDemoMode(true);
} 