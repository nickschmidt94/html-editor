// Mental Models Lab JavaScript
// Interactive visualizations for understanding HTML and CSS

// =============================================================================
// DOM Tree Visualization
// =============================================================================

class DOMTreeBuilder {
    constructor() {
        this.htmlInput = document.getElementById('htmlInput');
        this.domTreeContainer = document.getElementById('domTree');
        this.currentHTML = '';
        this.nodeIdCounter = 0;
        this.updateTimeout = null;
        this.init();
    }

    init() {
        if (this.htmlInput && this.domTreeContainer) {
            this.htmlInput.addEventListener('input', () => this.scheduleUpdate());
            this.updateDOMTree(); // Initial render
        }
    }

    scheduleUpdate() {
        // Debounce updates for smoother animation
        clearTimeout(this.updateTimeout);
        this.updateTimeout = setTimeout(() => this.updateDOMTree(), 300);
    }

    updateDOMTree() {
        const html = this.htmlInput.value.trim();
        if (!html) {
            this.domTreeContainer.innerHTML = `
                <div class="dom-node text">
                    <span class="text-content">Enter HTML code to see the DOM tree...</span>
                </div>`;
            return;
        }

        if (html === this.currentHTML) return;
        this.currentHTML = html;
        
        // Reset node counter for consistent IDs
        this.nodeIdCounter = 0;

        // Parse and analyze HTML
        const analysis = this.analyzeHTML(html);
        const tree = this.buildAnimatedTree(analysis);
        
        // Clear and rebuild with animation
        this.domTreeContainer.innerHTML = '';
        setTimeout(() => {
            this.domTreeContainer.innerHTML = tree;
            this.setupHoverEffects();
        }, 100);
    }

    analyzeHTML(html) {
        const analysis = {
            original: html,
            corrected: '',
            errors: [],
            fixes: [],
            nodes: []
        };

        try {
            // Use DOMParser to parse and auto-correct HTML
            const parser = new DOMParser();
            const doc = parser.parseFromString(`<div id="root">${html}</div>`, 'text/html');
            const rootElement = doc.getElementById('root');
            
            // Get the corrected HTML
            analysis.corrected = rootElement.innerHTML;
            
            // Detect common errors
            this.detectErrors(html, analysis);
            
            // Build node tree
            this.buildNodeTree(rootElement, analysis.nodes, 0);
            
        } catch (error) {
            analysis.errors.push({ type: 'parse_error', message: 'Invalid HTML syntax' });
        }

        return analysis;
    }

    detectErrors(html, analysis) {
        // Error detection disabled - validation functionality removed
    }

    buildNodeTree(element, nodes, level, parentId = null) {
        const nodeId = this.nodeIdCounter++;
        
        for (let node of element.childNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
                const tagName = node.tagName.toLowerCase();
                const attributes = Array.from(node.attributes);
                
                // Opening tag
                const openingNode = {
                    id: `node-${nodeId}-open`,
                    type: 'element-open',
                    tagName: tagName,
                    attributes: attributes,
                    level: level,
                    parentId: parentId,
                    hasErrors: false
                };
                nodes.push(openingNode);

                // Attributes as separate nodes
                attributes.forEach((attr, index) => {
                    nodes.push({
                        id: `node-${nodeId}-attr-${index}`,
                        type: 'attribute',
                        name: attr.name,
                        value: attr.value,
                        level: level + 1,
                        parentId: openingNode.id
                    });
                });

                // Children
                if (node.childNodes.length > 0) {
                    this.buildNodeTree(node, nodes, level + 1, openingNode.id);
                }

                // Closing tag
                if (!this.isSelfClosing(tagName)) {
                    nodes.push({
                        id: `node-${nodeId}-close`,
                        type: 'element-close',
                        tagName: tagName,
                        level: level,
                        parentId: parentId,
                        openingNodeId: openingNode.id
                    });
                }
                
            } else if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent.trim();
                if (text) {
                    nodes.push({
                        id: `node-${nodeId}-text`,
                        type: 'text',
                        content: text,
                        level: level,
                        parentId: parentId
                    });
                }
            }
        }
    }

    buildAnimatedTree(analysis) {
        let html = '';
        
        // Show errors and fixes if any
        if (analysis.errors.length > 0) {
            html += '<div class="error-summary" style="margin-bottom: 15px; padding: 10px; background: #fef2f2; border: 1px solid #ef4444; border-radius: 6px;">';
            html += '<strong style="color: #dc2626;">Issues detected:</strong><br>';
            analysis.errors.forEach(error => {
                html += `<small style="color: #dc2626;">• ${error.message}</small><br>`;
            });
            if (analysis.fixes.length > 0) {
                html += '<strong style="color: #f59e0b; margin-top: 10px; display: block;">Browser fixes:</strong><br>';
                analysis.fixes.forEach(fix => {
                    html += `<small style="color: #d97706;">• ${fix}</small><br>`;
                });
            }
            html += '</div>';
        }

        // Build the tree with staggered animations
        analysis.nodes.forEach((node, index) => {
            const delay = index * 50; // Stagger animations
            html += this.buildNodeHTML(node, delay);
        });

        return html;
    }

    buildNodeHTML(node, delay) {
        const levelClass = `dom-level-${node.level}`;
        const style = `animation-delay: ${delay}ms;`;
        
        switch (node.type) {
            case 'element-open':
                const attrs = node.attributes.length > 0 ? 
                    ' ' + node.attributes.map(attr => `${attr.name}="${attr.value}"`).join(' ') : '';
                const errorIndicator = node.hasErrors ? '<span class="error-indicator">!</span>' : '';
                return `<div class="dom-node element ${levelClass}" data-node-id="${node.id}" style="${style}">
                    ${errorIndicator}
                    &lt;<span class="tag-name">${node.tagName}</span>${attrs}&gt;
                </div>`;
                
            case 'element-close':
                return `<div class="dom-node element ${levelClass}" data-node-id="${node.id}" data-opening-node="${node.openingNodeId}" style="${style}">
                    &lt;/<span class="tag-name">${node.tagName}</span>&gt;
                </div>`;
                
            case 'attribute':
                return `<div class="dom-node attribute ${levelClass}" data-node-id="${node.id}" data-parent-id="${node.parentId}" style="${style}">
                    <span class="attribute-name">${node.name}</span>=<span class="attribute-value">"${node.value}"</span>
                </div>`;
                
            case 'text':
                return `<div class="dom-node text ${levelClass}" data-node-id="${node.id}" data-parent-id="${node.parentId}" style="${style}">
                    <span class="text-content">"${node.content}"</span>
                </div>`;
                
            default:
                return '';
        }
    }

    setupHoverEffects() {
        const nodes = this.domTreeContainer.querySelectorAll('.dom-node');
        
        nodes.forEach(node => {
            node.addEventListener('mouseenter', (e) => this.highlightRelationships(e.target));
            node.addEventListener('mouseleave', () => this.clearHighlights());
        });
    }

    highlightRelationships(hoveredNode) {
        this.clearHighlights();
        
        const nodeId = hoveredNode.getAttribute('data-node-id');
        const parentId = hoveredNode.getAttribute('data-parent-id');
        const openingNodeId = hoveredNode.getAttribute('data-opening-node');
        
        // Highlight parent
        if (parentId) {
            const parent = this.domTreeContainer.querySelector(`[data-node-id="${parentId}"]`);
            if (parent) parent.classList.add('highlight-parent');
        }
        
        // Highlight children
        const children = this.domTreeContainer.querySelectorAll(`[data-parent-id="${nodeId}"]`);
        children.forEach(child => child.classList.add('highlight-child'));
        
        // Highlight matching opening/closing tags
        if (openingNodeId) {
            const opening = this.domTreeContainer.querySelector(`[data-node-id="${openingNodeId}"]`);
            if (opening) opening.classList.add('highlight-sibling');
        }
        
        // Highlight siblings (same parent)
        if (parentId) {
            const siblings = this.domTreeContainer.querySelectorAll(`[data-parent-id="${parentId}"]`);
            siblings.forEach(sibling => {
                if (sibling !== hoveredNode) {
                    sibling.classList.add('highlight-sibling');
                }
            });
        }
    }

    clearHighlights() {
        const highlighted = this.domTreeContainer.querySelectorAll('.highlight-parent, .highlight-child, .highlight-sibling');
        highlighted.forEach(node => {
            node.classList.remove('highlight-parent', 'highlight-child', 'highlight-sibling');
        });
    }

    isSelfClosing(tagName) {
        return ['img', 'br', 'hr', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr'].includes(tagName.toLowerCase());
    }
}

// =============================================================================
// CSS Playground - Interactive CSS Learning
// =============================================================================

class CSSPlayground {
    constructor() {
        this.demoElement = document.getElementById('demoElement');
        this.cssEditor = document.getElementById('cssEditor');
        this.updateTimeout = null;
        
        this.examples = {
            card: `.demo-element {
  background: white;
  color: #2d3748;
  padding: 30px;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  border: 1px solid #e2e8f0;
  text-align: left;
}

.demo-element h3 {
  color: #1a202c;
  margin: 0 0 15px 0;
  font-size: 1.8rem;
}

.demo-element p {
  color: #4a5568;
  margin: 0 0 20px 0;
  line-height: 1.6;
}

.demo-element button {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 12px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s ease;
}

.demo-element button:hover {
  background: #2563eb;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}`,
            button: `.demo-element {
  background: #1a202c;
  color: white;
  padding: 40px;
  border-radius: 8px;
  text-align: center;
}

.demo-element h3 {
  margin: 0 0 20px 0;
  font-size: 1.5rem;
}

.demo-element p {
  margin: 0 0 25px 0;
  opacity: 0.8;
}

.demo-element button {
  background: linear-gradient(45deg, #ff6b6b, #ee5a24);
  color: white;
  border: none;
  padding: 15px 30px;
  border-radius: 50px;
  cursor: pointer;
  font-weight: 600;
  font-size: 1.1rem;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.demo-element button:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 25px rgba(255, 107, 107, 0.4);
}

.demo-element button:active {
  transform: translateY(0);
}`,
            gradient: `.demo-element {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 40px;
  border-radius: 20px;
  text-align: center;
  position: relative;
  overflow: hidden;
}

.demo-element::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(45deg, rgba(255,255,255,0.1) 0%, transparent 100%);
}

.demo-element h3 {
  margin: 0 0 15px 0;
  font-size: 2rem;
  text-shadow: 0 2px 4px rgba(0,0,0,0.3);
  position: relative;
  z-index: 1;
}

.demo-element p {
  margin: 0 0 20px 0;
  opacity: 0.9;
  position: relative;
  z-index: 1;
}

.demo-element button {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 2px solid rgba(255, 255, 255, 0.3);
  padding: 12px 24px;
  border-radius: 30px;
  cursor: pointer;
  font-weight: 500;
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
  position: relative;
  z-index: 1;
}

.demo-element button:hover {
  background: rgba(255, 255, 255, 0.3);
  border-color: rgba(255, 255, 255, 0.5);
  transform: translateY(-2px);
}`,
            shadow: `.demo-element {
  background: #f7fafc;
  color: #2d3748;
  padding: 30px;
  border-radius: 12px;
  text-align: center;
  box-shadow: 
    0 1px 3px rgba(0, 0, 0, 0.1),
    0 10px 30px rgba(0, 0, 0, 0.1),
    0 20px 60px rgba(0, 0, 0, 0.1);
}

.demo-element h3 {
  margin: 0 0 15px 0;
  font-size: 1.8rem;
  color: #1a202c;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.demo-element p {
  margin: 0 0 20px 0;
  color: #4a5568;
}

.demo-element button {
  background: #4299e1;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.3s ease;
  box-shadow: 
    0 4px 14px rgba(66, 153, 225, 0.3),
    0 2px 4px rgba(0, 0, 0, 0.1);
}

.demo-element button:hover {
  background: #3182ce;
  transform: translateY(-2px);
  box-shadow: 
    0 8px 25px rgba(66, 153, 225, 0.4),
    0 4px 8px rgba(0, 0, 0, 0.15);
}`,
            animation: `.demo-element {
  background: #2d3748;
  color: white;
  padding: 30px;
  border-radius: 15px;
  text-align: center;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
}

.demo-element h3 {
  margin: 0 0 15px 0;
  font-size: 1.6rem;
  animation: slideIn 1s ease-out;
}

@keyframes slideIn {
  from { opacity: 0; transform: translateY(-20px); }
  to { opacity: 1; transform: translateY(0); }
}

.demo-element p {
  margin: 0 0 20px 0;
  opacity: 0.9;
  animation: fadeIn 1.5s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 0.9; }
}

.demo-element button {
  background: #ed8936;
  color: white;
  border: none;
  padding: 12px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.3s ease;
  animation: bounce 1s ease-out 0.5s both;
}

@keyframes bounce {
  0% { opacity: 0; transform: translateY(20px); }
  50% { transform: translateY(-10px); }
  100% { opacity: 1; transform: translateY(0); }
}

.demo-element button:hover {
  background: #dd6b20;
  transform: translateY(-3px) rotate(2deg);
  box-shadow: 0 5px 15px rgba(237, 137, 54, 0.4);
}`
        };
        
        this.init();
    }

    init() {
        if (!this.demoElement || !this.cssEditor) return;
        
        this.setupEditor();
        this.setupQuickControls();
        this.setupExamples();
        this.applyCSS();
    }

    setupEditor() {
        this.cssEditor.addEventListener('input', () => {
            clearTimeout(this.updateTimeout);
            this.updateTimeout = setTimeout(() => this.applyCSS(), 300);
        });
    }

    setupQuickControls() {
        // Background color
        const bgColor = document.getElementById('bgColor');
        if (bgColor) {
            bgColor.addEventListener('input', (e) => {
                this.updateProperty('background', e.target.value);
            });
        }

        // Text color
        const textColor = document.getElementById('textColor');
        if (textColor) {
            textColor.addEventListener('input', (e) => {
                this.updateProperty('color', e.target.value);
            });
        }

        // Padding slider
        const paddingSlider = document.getElementById('paddingSlider');
        const paddingValue = document.getElementById('paddingValue');
        if (paddingSlider && paddingValue) {
            paddingSlider.addEventListener('input', (e) => {
                const value = e.target.value + 'px';
                paddingValue.textContent = value;
                this.updateProperty('padding', value);
            });
        }

        // Border radius slider
        const radiusSlider = document.getElementById('radiusSlider');
        const radiusValue = document.getElementById('radiusValue');
        if (radiusSlider && radiusValue) {
            radiusSlider.addEventListener('input', (e) => {
                const value = e.target.value + 'px';
                radiusValue.textContent = value;
                this.updateProperty('border-radius', value);
            });
        }

        // Preset buttons
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const property = btn.getAttribute('data-property');
                const value = btn.getAttribute('data-value');
                this.updateProperty(property, value);
            });
        });
    }

    setupExamples() {
        document.querySelectorAll('.example-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const example = btn.getAttribute('data-example');
                if (this.examples[example]) {
                    this.cssEditor.value = this.examples[example];
                    this.applyCSS();
                }
            });
        });

        document.querySelector('.reset-btn')?.addEventListener('click', () => {
            this.cssEditor.value = this.cssEditor.getAttribute('placeholder');
            this.applyCSS();
        });
    }

    updateProperty(property, value) {
        // Update the demo element directly for immediate feedback
        this.demoElement.style.setProperty(property, value);
        
        // Also update the CSS editor
        this.updateCSSEditor(property, value);
    }

    updateCSSEditor(property, value) {
        let css = this.cssEditor.value;
        const regex = new RegExp(`(\\s*${property}\\s*:\\s*)[^;\\n}]+`, 'i');
        
        if (regex.test(css)) {
            // Property exists, update it
            css = css.replace(regex, `$1${value}`);
        } else {
            // Property doesn't exist, add it to .demo-element rule
            const demoElementRule = css.match(/\.demo-element\s*\{[^}]*/);
            if (demoElementRule) {
                const insertPoint = demoElementRule[0].length;
                const before = css.substring(0, css.indexOf(demoElementRule[0]) + insertPoint);
                const after = css.substring(css.indexOf(demoElementRule[0]) + insertPoint);
                css = before + `\n  ${property}: ${value};` + after;
            }
        }
        
        this.cssEditor.value = css;
    }

    applyCSS() {
        const css = this.cssEditor.value;
        
        // Remove existing playground styles
        const existingStyle = document.getElementById('playground-styles');
        if (existingStyle) {
            existingStyle.remove();
        }
        
        // Create new style element
        const styleElement = document.createElement('style');
        styleElement.id = 'playground-styles';
        styleElement.textContent = css;
        document.head.appendChild(styleElement);
    }
}

// =============================================================================
// Box Model Interactive
// =============================================================================

class BoxModelInteractive {
    constructor() {
        this.marginSlider = document.getElementById('marginSlider');
        this.borderSlider = document.getElementById('borderSlider');
        this.paddingSlider = document.getElementById('paddingSlider');
        
        this.marginValue = document.getElementById('marginValue');
        this.borderValue = document.getElementById('borderValue');
        this.paddingValue = document.getElementById('paddingValue');
        
        this.boxModelDemo = document.getElementById('boxModelDemo');
        
        this.init();
    }

    init() {
        if (this.marginSlider && this.borderSlider && this.paddingSlider) {
            this.marginSlider.addEventListener('input', () => this.updateBoxModel());
            this.borderSlider.addEventListener('input', () => this.updateBoxModel());
            this.paddingSlider.addEventListener('input', () => this.updateBoxModel());
            
            this.updateBoxModel(); // Initial render
        }
    }

    updateBoxModel() {
        const margin = this.marginSlider.value;
        const border = this.borderSlider.value;
        const padding = this.paddingSlider.value;

        // Update display values
        this.marginValue.textContent = `${margin}px`;
        this.borderValue.textContent = `${border}px`;
        this.paddingValue.textContent = `${padding}px`;

        // Update the visual box model
        const marginArea = this.boxModelDemo.querySelector('.margin-area');
        const borderArea = this.boxModelDemo.querySelector('.border-area');
        const paddingArea = this.boxModelDemo.querySelector('.padding-area');

        marginArea.style.padding = `${margin}px`;
        borderArea.style.borderWidth = `${border}px`;
        paddingArea.style.padding = `${padding}px`;
    }
}

// =============================================================================
// Flexbox Axes Visualizer
// =============================================================================

class FlexboxAxesVisualizer {
    constructor() {
        this.flexDirection = document.getElementById('flexDirection');
        this.flexboxContainer = document.getElementById('flexboxContainer');
        this.mainAxis = document.getElementById('mainAxis');
        this.crossAxis = document.getElementById('crossAxis');
        
        this.init();
    }

    init() {
        if (this.flexDirection && this.flexboxContainer) {
            this.flexDirection.addEventListener('change', () => this.updateAxes());
            this.updateAxes(); // Initial render
        }
    }

    updateAxes() {
        const direction = this.flexDirection.value;
        
        // Update flexbox container
        this.flexboxContainer.style.flexDirection = direction;
        
        // Update axes visualization
        this.updateAxisPositions(direction);
    }

    updateAxisPositions(direction) {
        const containerRect = this.flexboxContainer.getBoundingClientRect();
        const containerStyle = getComputedStyle(this.flexboxContainer);
        const padding = parseInt(containerStyle.padding);

        // Reset axes
        this.mainAxis.style.cssText = 'position: absolute; pointer-events: none; border: 2px solid #ef4444; background: rgba(239, 68, 68, 0.1);';
        this.crossAxis.style.cssText = 'position: absolute; pointer-events: none; border: 2px solid #10b981; background: rgba(16, 185, 129, 0.1);';

        switch (direction) {
            case 'row':
            case 'row-reverse':
                // Main axis: horizontal
                this.mainAxis.style.width = '200px';
                this.mainAxis.style.height = '2px';
                this.mainAxis.style.top = '50%';
                this.mainAxis.style.left = '20px';
                this.mainAxis.style.transform = 'translateY(-50%)';

                // Cross axis: vertical
                this.crossAxis.style.width = '2px';
                this.crossAxis.style.height = '100px';
                this.crossAxis.style.top = '20px';
                this.crossAxis.style.left = '50%';
                this.crossAxis.style.transform = 'translateX(-50%)';

                // Position labels
                this.positionLabels('horizontal');
                break;

            case 'column':
            case 'column-reverse':
                // Main axis: vertical
                this.mainAxis.style.width = '2px';
                this.mainAxis.style.height = '100px';
                this.mainAxis.style.top = '20px';
                this.mainAxis.style.left = '50%';
                this.mainAxis.style.transform = 'translateX(-50%)';

                // Cross axis: horizontal
                this.crossAxis.style.width = '200px';
                this.crossAxis.style.height = '2px';
                this.crossAxis.style.top = '50%';
                this.crossAxis.style.left = '20px';
                this.crossAxis.style.transform = 'translateY(-50%)';

                // Position labels
                this.positionLabels('vertical');
                break;
        }
    }

    positionLabels(orientation) {
        const mainLabel = this.mainAxis.querySelector('.axis-label');
        const crossLabel = this.crossAxis.querySelector('.axis-label');

        if (orientation === 'horizontal') {
            mainLabel.style.top = '-25px';
            mainLabel.style.left = '50%';
            mainLabel.style.transform = 'translateX(-50%)';

            crossLabel.style.top = '50%';
            crossLabel.style.left = '10px';
            crossLabel.style.transform = 'translateY(-50%) rotate(-90deg)';
        } else {
            mainLabel.style.top = '50%';
            mainLabel.style.left = '10px';
            mainLabel.style.transform = 'translateY(-50%) rotate(-90deg)';

            crossLabel.style.top = '-25px';
            crossLabel.style.left = '50%';
            crossLabel.style.transform = 'translateX(-50%)';
        }
    }
}

// =============================================================================
// Module Navigation System
// =============================================================================

class ModuleManager {
    constructor() {
        this.currentModule = 'mental-models';
        this.modules = ['mental-models', 'why-lab', 'css-mastery', 'responsive', 'projects'];
        this.progressData = this.loadProgress();
        this.init();
    }

    init() {
        this.setupModuleNavigation();
        this.showModule(this.currentModule);
        this.updateProgress();
    }

    setupModuleNavigation() {
        const moduleButtons = document.querySelectorAll('.module-btn');
        
        moduleButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const moduleId = button.getAttribute('data-module');
                
                // Don't switch if it's a coming-soon module
                if (button.classList.contains('coming-soon')) {
                    return;
                }
                
                this.switchModule(moduleId);
            });
        });
    }

    switchModule(moduleId) {
        if (moduleId === this.currentModule) return;
        
        // Update button states
        document.querySelectorAll('.module-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('data-module') === moduleId) {
                btn.classList.add('active');
            }
        });

        // Hide current module
        const currentModuleElement = document.getElementById(`${this.currentModule}-module`);
        if (currentModuleElement) {
            currentModuleElement.classList.remove('active');
        }

        // Show new module
        this.showModule(moduleId);
        this.currentModule = moduleId;
        
        // Save state
        localStorage.setItem('currentModule', moduleId);
    }

    showModule(moduleId) {
        const moduleElement = document.getElementById(`${moduleId}-module`);
        if (moduleElement) {
            moduleElement.classList.add('active');
            
            // Initialize module-specific functionality
            if (moduleId === 'mental-models') {
                this.initializeMentalModelsLab();
            }
        }
    }

    initializeMentalModelsLab() {
        // Initialize Mental Models Lab components
        new DOMTreeBuilder();
        new CSSPlayground();
        new BoxModelInteractive();
        new FlexboxAxesVisualizer();
        
        console.log('Mental Models Lab initialized successfully!');
    }

    updateProgress() {
        // Update progress for current module
        const progressFill = document.querySelector(`#${this.currentModule}-module .progress-fill`);
        const progressText = document.querySelector(`#${this.currentModule}-module .progress-text`);
        
        if (progressFill && progressText) {
            const progress = this.calculateModuleProgress(this.currentModule);
            progressFill.style.width = `${progress}%`;
            progressText.textContent = `${progress}% Complete`;
        }
    }

    calculateModuleProgress(moduleId) {
        // For now, return 0% for all modules
        // This can be expanded when we add actual progress tracking
        return this.progressData[moduleId] || 0;
    }

    loadProgress() {
        const saved = localStorage.getItem('learningProgress');
        return saved ? JSON.parse(saved) : {};
    }

    saveProgress() {
        localStorage.setItem('learningProgress', JSON.stringify(this.progressData));
    }

    markSectionComplete(moduleId, sectionId) {
        if (!this.progressData[moduleId]) {
            this.progressData[moduleId] = { completedSections: [], totalSections: 4 };
        }
        
        if (!this.progressData[moduleId].completedSections.includes(sectionId)) {
            this.progressData[moduleId].completedSections.push(sectionId);
            this.saveProgress();
            this.updateProgress();
        }
    }
}

// =============================================================================
// Initialize All Systems
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Initialize the module management system
    window.moduleManager = new ModuleManager();
    
    // Load saved module state
    const savedModule = localStorage.getItem('currentModule');
    if (savedModule && window.moduleManager.modules.includes(savedModule)) {
        window.moduleManager.switchModule(savedModule);
    }
}); 