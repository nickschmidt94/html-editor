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
        // Check for unclosed tags
        const openTags = [];
        const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g;
        let match;

        while ((match = tagRegex.exec(html)) !== null) {
            const tagName = match[1].toLowerCase();
            const isClosing = match[0].startsWith('</');
            const isSelfClosing = match[0].endsWith('/>') || ['img', 'br', 'hr', 'input', 'meta', 'link'].includes(tagName);

            if (isClosing) {
                const lastOpen = openTags.pop();
                if (!lastOpen || lastOpen !== tagName) {
                    analysis.errors.push({
                        type: 'unclosed_tag',
                        tag: lastOpen || tagName,
                        message: `Mismatched closing tag: ${tagName}`
                    });
                }
            } else if (!isSelfClosing) {
                openTags.push(tagName);
            }
        }

        // Report unclosed tags
        openTags.forEach(tag => {
            analysis.errors.push({
                type: 'unclosed_tag',
                tag: tag,
                message: `Unclosed tag: ${tag}`
            });
            analysis.fixes.push(`Browser automatically closed &lt;${tag}&gt;`);
        });

        // Check for malformed attributes
        const malformedAttrRegex = /\s+([a-zA-Z-]+)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/g;
        const attributeErrors = html.match(/\s+[a-zA-Z-]+=(?:[^"'\s>][^\s>]*)/g);
        if (attributeErrors) {
            analysis.errors.push({
                type: 'malformed_attribute',
                message: 'Unquoted attribute values detected'
            });
            analysis.fixes.push('Browser automatically quoted attribute values');
        }
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
// CSS Battle Arena - Interactive CSS Rule Fighting
// =============================================================================

class BattleArena {
    constructor() {
        this.rules = [];
        this.currentTab = 'rule1';
        this.targetElement = document.getElementById('battleTarget');
        this.battleLog = document.getElementById('battleLog');
        this.appliedStyles = new Map();
        
        this.init();
    }

    init() {
        this.setupTabs();
        this.setupEventListeners();
        this.setupInitialRules();
        this.updateDisplay();
    }

    setupTabs() {
        const tabBtns = document.querySelectorAll('.tab-btn');
        const ruleEditors = document.querySelectorAll('.rule-editor');
        
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.getAttribute('data-tab');
                this.switchTab(tabId);
            });
        });
    }

    switchTab(tabId) {
        this.currentTab = tabId;
        
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('data-tab') === tabId) {
                btn.classList.add('active');
            }
        });
        
        // Update rule editors
        document.querySelectorAll('.rule-editor').forEach(editor => {
            editor.classList.remove('active');
            if (editor.getAttribute('data-rule') === tabId) {
                editor.classList.add('active');
            }
        });
    }

    setupEventListeners() {
        // Apply buttons
        document.querySelectorAll('.apply-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const ruleId = btn.getAttribute('data-rule');
                this.applyRule(ruleId);
            });
        });

        // Important buttons
        document.querySelectorAll('.important-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const ruleId = btn.getAttribute('data-rule');
                this.toggleImportant(ruleId);
            });
        });

        // Remove buttons
        document.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const ruleId = btn.getAttribute('data-rule');
                this.removeRule(ruleId);
            });
        });

        // Battle controls
        document.getElementById('battleAll')?.addEventListener('click', () => this.startBattle());
        document.getElementById('clearAll')?.addEventListener('click', () => this.clearAll());
        document.getElementById('randomBattle')?.addEventListener('click', () => this.randomBattle());

        // Real-time specificity calculation
        document.querySelectorAll('.selector').forEach(input => {
            input.addEventListener('input', (e) => {
                const ruleId = input.getAttribute('data-rule');
                this.updateSpecificity(ruleId);
            });
        });
    }

    setupInitialRules() {
        // Add some default CSS to get started
        this.setRuleInput('rule1', 'div', 'background: #3b82f6;\ncolor: white;\npadding: 20px;');
        this.setRuleInput('rule2', '.hero', 'background: #ef4444;\nfont-size: 24px;\nborder-radius: 8px;');
        this.setRuleInput('rule3', '#main', 'background: #10b981;\nfont-weight: bold;\nborder: 3px solid gold;');
        
        this.updateSpecificity('rule1');
        this.updateSpecificity('rule2');
        this.updateSpecificity('rule3');
    }

    setRuleInput(ruleId, selector, css) {
        const selectorInput = document.querySelector(`.selector[data-rule="${ruleId}"]`);
        const cssInput = document.querySelector(`.css-props[data-rule="${ruleId}"]`);
        
        if (selectorInput) selectorInput.value = selector;
        if (cssInput) cssInput.value = css;
    }

    updateSpecificity(ruleId) {
        const selectorInput = document.querySelector(`.selector[data-rule="${ruleId}"]`);
        const display = document.querySelector(`.specificity-display[data-rule="${ruleId}"]`);
        
        if (!selectorInput || !display) return;
        
        const selector = selectorInput.value.trim();
        const specificity = this.calculateSpecificity(selector);
        display.textContent = specificity.join(',');
        
        // Color code the display based on specificity level
        const score = this.getSpecificityScore(specificity);
        if (score >= 1000) {
            display.style.background = '#ef4444'; // Inline/important
        } else if (score >= 100) {
            display.style.background = '#8b5cf6'; // ID
        } else if (score >= 10) {
            display.style.background = '#10b981'; // Class
        } else {
            display.style.background = '#f59e0b'; // Element
        }
    }

    calculateSpecificity(selector) {
        if (!selector) return [0, 0, 0, 0];
        
        // Simple specificity calculation
        let inline = 0;
        let ids = 0;
        let classes = 0;
        let elements = 0;
        
        // Count IDs
        const idMatches = selector.match(/#[\w-]+/g);
        if (idMatches) ids = idMatches.length;
        
        // Count classes, attributes, pseudo-classes
        const classMatches = selector.match(/\.[\w-]+|\[[\w-="']*\]|:[\w-]+(?:\([^)]*\))?/g);
        if (classMatches) classes = classMatches.length;
        
        // Count elements and pseudo-elements
        const elementMatches = selector.match(/(?:^|[\s>+~])(?![.#:])[a-zA-Z][a-zA-Z0-9-]*|::[\w-]+/g);
        if (elementMatches) elements = elementMatches.length;
        
        return [inline, ids, classes, elements];
    }

    getSpecificityScore(specificity) {
        return specificity[0] * 1000 + specificity[1] * 100 + specificity[2] * 10 + specificity[3];
    }

    applyRule(ruleId) {
        const selectorInput = document.querySelector(`.selector[data-rule="${ruleId}"]`);
        const cssInput = document.querySelector(`.css-props[data-rule="${ruleId}"]`);
        
        if (!selectorInput || !cssInput) return;
        
        const selector = selectorInput.value.trim();
        const css = cssInput.value.trim();
        
        if (!selector || !css) {
            this.addLogEntry('❌ Please enter both selector and CSS properties', 'error');
            return;
        }
        
        // Check if selector matches our target element
        if (!this.selectorMatches(selector)) {
            this.addLogEntry(`⚠️ Selector "${selector}" doesn't match div.hero#main`, 'warning');
            return;
        }
        
        const specificity = this.calculateSpecificity(selector);
        const rule = {
            id: ruleId,
            selector: selector,
            css: css,
            specificity: specificity,
            score: this.getSpecificityScore(specificity),
            important: false
        };
        
        // Remove existing rule with same ID
        this.rules = this.rules.filter(r => r.id !== ruleId);
        this.rules.push(rule);
        
        this.addLogEntry(`⚡ Applied rule: ${selector} (specificity: ${specificity.join(',')})`, 'info');
        this.updateDisplay();
    }

    selectorMatches(selector) {
        // Simple check if selector could match div.hero#main
        // This is a simplified check for demo purposes
        const target = 'div.hero#main';
        
        if (selector === '*') return true;
        if (selector.includes('div') || selector.includes('.hero') || selector.includes('#main')) return true;
        if (selector.match(/^[a-zA-Z]+$/)) return true; // Simple element selector
        if (selector.match(/^\.[a-zA-Z][\w-]*$/)) return true; // Simple class selector
        if (selector.match(/^#[a-zA-Z][\w-]*$/)) return true; // Simple ID selector
        
        return false;
    }

    toggleImportant(ruleId) {
        const cssInput = document.querySelector(`.css-props[data-rule="${ruleId}"]`);
        if (!cssInput) return;
        
        let css = cssInput.value;
        
        if (css.includes('!important')) {
            // Remove !important
            css = css.replace(/\s*!important/g, '');
            this.addLogEntry(`🔥 Removed !important from ${ruleId}`, 'info');
        } else {
            // Add !important to first property
            const lines = css.split('\n');
            if (lines.length > 0 && lines[0].trim()) {
                const firstLine = lines[0].trim();
                if (firstLine.endsWith(';')) {
                    lines[0] = firstLine.replace(';', ' !important;');
                } else {
                    lines[0] = firstLine + ' !important';
                }
                css = lines.join('\n');
                this.addLogEntry(`🔥 Added !important to ${ruleId}`, 'info');
            }
        }
        
        cssInput.value = css;
    }

    removeRule(ruleId) {
        this.rules = this.rules.filter(r => r.id !== ruleId);
        
        // Clear inputs
        const selectorInput = document.querySelector(`.selector[data-rule="${ruleId}"]`);
        const cssInput = document.querySelector(`.css-props[data-rule="${ruleId}"]`);
        
        if (selectorInput) selectorInput.value = '';
        if (cssInput) cssInput.value = '';
        
        this.addLogEntry(`🗑️ Removed rule ${ruleId}`, 'info');
        this.updateDisplay();
    }

    startBattle() {
        if (this.rules.length === 0) {
            this.addLogEntry('❌ No rules to battle! Apply some rules first.', 'error');
            return;
        }
        
        this.addLogEntry('⚔️ BATTLE BEGINS! Rules competing for control...', 'info');
        
        // Group rules by property
        const propertyBattles = new Map();
        
        this.rules.forEach(rule => {
            const properties = this.parseCSS(rule.css);
            Object.keys(properties).forEach(prop => {
                if (!propertyBattles.has(prop)) {
                    propertyBattles.set(prop, []);
                }
                propertyBattles.get(prop).push({
                    rule: rule,
                    value: properties[prop],
                    hasImportant: properties[prop].includes('!important')
                });
            });
        });
        
        // Battle for each property
        const winners = new Map();
        propertyBattles.forEach((competitors, property) => {
            const winner = this.battleForProperty(property, competitors);
            if (winner) {
                winners.set(property, winner);
            }
        });
        
        // Apply winning styles
        this.appliedStyles = winners;
        this.updateTargetElement();
        this.updateStylesList();
        
        this.addLogEntry(`🏆 Battle complete! ${winners.size} properties decided.`, 'info');
    }

    battleForProperty(property, competitors) {
        if (competitors.length === 0) return null;
        if (competitors.length === 1) {
            this.addLogEntry(`🎯 ${property}: ${competitors[0].rule.selector} wins uncontested`, 'winner');
            return competitors[0];
        }
        
        // Sort by specificity and source order
        competitors.sort((a, b) => {
            // !important wins over everything
            if (a.hasImportant && !b.hasImportant) return 1;
            if (!a.hasImportant && b.hasImportant) return -1;
            
            // Compare specificity
            const scoreA = this.getSpecificityScore(a.rule.specificity);
            const scoreB = this.getSpecificityScore(b.rule.specificity);
            
            if (scoreA !== scoreB) return scoreA - scoreB;
            
            // Same specificity - source order (last wins)
            const indexA = this.rules.findIndex(r => r.id === a.rule.id);
            const indexB = this.rules.findIndex(r => r.id === b.rule.id);
            return indexA - indexB;
        });
        
        const winner = competitors[competitors.length - 1];
        const loser = competitors[competitors.length - 2];
        
        this.addLogEntry(`🏆 ${property}: ${winner.rule.selector} beats ${loser.rule.selector}`, 'winner');
        this.addLogEntry(`💥 ${loser.rule.selector} defeated for ${property}`, 'loser');
        
        return winner;
    }

    parseCSS(css) {
        const properties = {};
        const lines = css.split('\n');
        
        lines.forEach(line => {
            const trimmed = line.trim();
            if (trimmed && trimmed.includes(':')) {
                const [prop, value] = trimmed.split(':').map(s => s.trim());
                if (prop && value) {
                    properties[prop] = value.replace(';', '');
                }
            }
        });
        
        return properties;
    }

    updateTargetElement() {
        if (!this.targetElement) return;
        
        let styles = '';
        this.appliedStyles.forEach((winner, property) => {
            const value = winner.value.replace('!important', '').trim();
            styles += `${property}: ${value}; `;
        });
        
        this.targetElement.style.cssText = styles + `
            transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            z-index: 2;
        `;
    }

    updateStylesList() {
        const stylesList = document.querySelector('.style-list');
        if (!stylesList) return;
        
        if (this.appliedStyles.size === 0) {
            stylesList.innerHTML = '<em>No styles applied yet</em>';
            return;
        }
        
        let html = '';
        this.appliedStyles.forEach((winner, property) => {
            const cleanValue = winner.value.replace('!important', '').trim();
            const important = winner.value.includes('!important') ? ' !important' : '';
            html += `<div class="style-item">`;
            html += `<span class="prop">${property}:</span> `;
            html += `<span class="value">${cleanValue}${important}</span>`;
            html += `<br><small>from ${winner.rule.selector}</small>`;
            html += `</div>`;
        });
        
        stylesList.innerHTML = html;
    }

    updateDisplay() {
        this.updateStylesList();
        if (this.rules.length === 0) {
            this.resetTargetElement();
        }
    }

    randomBattle() {
        const randomSelectors = ['div', '.hero', '#main', 'div.hero', '#main.hero', 'div#main', '.hero.special'];
        const randomProperties = [
            'background: #ff6b6b;\ncolor: white;',
            'background: linear-gradient(45deg, #667eea, #764ba2);\nborder-radius: 15px;',
            'font-size: 28px;\nfont-weight: bold;\ntext-shadow: 2px 2px 4px rgba(0,0,0,0.3);',
            'padding: 40px;\nborder: 5px solid gold;\nbox-shadow: 0 10px 20px rgba(0,0,0,0.2);'
        ];
        
        // Clear existing rules
        this.clearAll();
        
        // Add random rules
        ['rule1', 'rule2', 'rule3'].forEach((ruleId, index) => {
            const selector = randomSelectors[Math.floor(Math.random() * randomSelectors.length)];
            const props = randomProperties[Math.floor(Math.random() * randomProperties.length)];
            
            this.setRuleInput(ruleId, selector, props);
            this.updateSpecificity(ruleId);
            this.applyRule(ruleId);
        });
        
        this.addLogEntry('🎲 Random battle setup complete!', 'info');
        setTimeout(() => this.startBattle(), 500);
    }

    clearAll() {
        this.rules = [];
        this.appliedStyles.clear();
        
        // Clear all inputs
        document.querySelectorAll('.selector').forEach(input => input.value = '');
        document.querySelectorAll('.css-props').forEach(input => input.value = '');
        
        this.resetTargetElement();
        this.updateDisplay();
        this.clearLog();
        
        this.addLogEntry('🔄 Arena cleared! Ready for new battle.', 'info');
    }

    resetTargetElement() {
        if (this.targetElement) {
            this.targetElement.style.cssText = `
                background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
                color: white;
                padding: 30px;
                border-radius: 12px;
                font-weight: 600;
                font-size: 1.2rem;
                text-align: center;
                margin-bottom: 20px;
                position: relative;
                border: 3px solid rgba(255, 255, 255, 0.2);
                box-shadow: 0 8px 25px rgba(59, 130, 246, 0.4);
                transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
                z-index: 2;
            `;
        }
    }

    addLogEntry(message, type = 'info') {
        const logContent = this.battleLog?.querySelector('.log-content');
        if (!logContent) return;
        
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.textContent = `${new Date().toLocaleTimeString()}: ${message}`;
        
        logContent.appendChild(entry);
        logContent.scrollTop = logContent.scrollHeight;
    }

    clearLog() {
        const logContent = this.battleLog?.querySelector('.log-content');
        if (logContent) {
            logContent.innerHTML = '';
        }
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
        this.modules = ['mental-models', 'fundamentals', 'css-mastery', 'responsive', 'projects'];
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
        new BattleArena();
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