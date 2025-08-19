# SnipDump

A modern, feature-rich HTML editor with real-time preview and a dedicated learning platform. Built with a modular architecture for easy maintenance and expansion.

## Features

- **Real-time HTML Editor**: Monaco-powered editor with syntax highlighting, auto-completion, and formatting
- **Live Preview**: Instant preview of your HTML with desktop and mobile device views
- **AI Assistant**: Context-aware coding assistant with support for OpenAI, Anthropic, Google Gemini, and custom endpoints
- **Separate Pages**: Editor and Learn sections are independent applications
- **Mobile Preview**: iPhone 15 Pro simulation for mobile testing
- **Export Tools**: Download HTML files and OpenGraph screenshot overlay
- **Responsive Design**: Works perfectly on desktop and mobile devices
- **Modular Architecture**: Clean separation of concerns for easy development

## File Structure

```
html-editor/
├── index.html              # HTML Editor page
├── learn.html               # Learning platform page
├── shared/
│   └── style.css           # Common styles (header, navigation, etc.)
├── editor/
│   ├── editor.css          # Editor-specific styles
│   └── editor.js           # Monaco editor & preview functionality
├── learn/
│   ├── learn.css           # Learn-specific styles
│   └── learn.js            # Learning platform functionality
└── README.md               # Project documentation
```

## Getting Started

### HTML Editor
1. Open `index.html` in a web browser
2. Start coding HTML in the Monaco editor
3. See real-time preview with device switching
4. Use format, download, and export features

### Learning Platform
1. Open `learn.html` or click "Learn" in the navigation
2. Access tutorials and educational content (coming soon)
3. Track progress and complete exercises

## Architecture Benefits

### **Modular Design**
- **Separation of Concerns**: Each section has its own CSS and JS
- **Independent Development**: Work on editor or learn features separately
- **Easy Maintenance**: Find and update specific functionality quickly
- **Scalability**: Add new features without affecting existing code

### **Shared Resources**
- **Common Styles**: Header and navigation styles shared between pages
- **Consistent Design**: Unified look and feel across the platform
- **Efficient Loading**: Browser caching for shared resources

### **Editor Section** (`index.html`)
- Complete HTML editing environment
- Monaco editor with advanced features
- Real-time preview with device simulation
- Export and download functionality
- Resizable panes with drag-and-drop

### **Learn Section** (`learn.html`)
- Dedicated learning platform
- Progress tracking system
- Interactive code examples (ready for implementation)
- Quiz functionality (ready for implementation)
- Clean, focused learning environment

## Development

### Adding Editor Features
- Edit `editor/editor.js` for new editor functionality
- Update `editor/editor.css` for editor-specific styling
- All Monaco editor features are self-contained

### Adding Learning Content
- Edit `learn/learn.js` for interactive learning features
- Update `learn/learn.css` for learning-specific styling
- Add content directly to `learn.html` or create dynamic loading

### Modifying Shared Elements
- Update `shared/style.css` for header, navigation, and common styles
- Changes automatically apply to both pages

## Future Enhancements

The modular structure makes it easy to add:

### Learning Platform
- **Interactive Tutorials**: Step-by-step HTML/CSS lessons
- **Code Playground**: Live coding exercises with instant feedback
- **Progress Tracking**: User progress saved in localStorage
- **Achievements**: Unlock badges for completing lessons
- **Syntax Highlighting**: Beautiful code examples
- **Responsive Lessons**: Mobile-friendly learning experience

### Editor Enhancements
- **Multiple File Support**: Work with CSS and JavaScript files
- **Project Management**: Save and load projects
- **Collaboration**: Real-time collaborative editing
- **Themes**: Multiple editor themes
- **Extensions**: Plugin system for additional features

## Technical Details

- **No Build Process**: Pure HTML, CSS, and JavaScript
- **Modern JavaScript**: ES6+ features with graceful fallbacks
- **Responsive CSS**: Mobile-first design approach
- **Monaco Editor**: Full-featured code editor from VS Code
- **Progressive Enhancement**: Works without JavaScript for basic functionality

Perfect foundation for a comprehensive web development learning platform!