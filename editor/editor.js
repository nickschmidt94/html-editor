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

// Handle window resize for Monaco layout
window.addEventListener('resize', () => {
    if (editor) {
        setTimeout(() => editor.layout(), 0);
    }
}); 