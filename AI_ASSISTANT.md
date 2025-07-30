# 🤖 AI Assistant - Your Coding Buddy

The AI Assistant is a powerful feature integrated into your HTML editor that provides contextual help, explanations, and debugging assistance. It's like having a friendly developer sitting next to you!

## ✨ Key Features

### 🔍 **Context-Aware Explanations**
- AI understands your current code and cursor position
- Provides explanations based on what you're working on
- Knows the full context of your HTML/CSS document

### 🎯 **Highlight & Ask**
- Select any code in the editor
- Get an instant "Explain this" tooltip
- Click to get detailed explanations of the selected code

### 🐛 **Smart Debugging**
- Automatically detects syntax errors and issues
- Suggests fixes for missing brackets, unclosed tags
- Provides CSS debugging help for styling problems

### 💬 **Conversational Interface**
- Chat naturally with the AI about your code
- Ask questions like "Why isn't my CSS working?"
- Get step-by-step guidance and suggestions

### ⚡ **Quick Actions**
- **Explain This**: Get explanations for selected code or current context
- **Debug Issues**: Review code for errors and get fix suggestions
- **Improve Code**: Get best practices and optimization tips

## 🚀 Getting Started

### 0. Setup Supabase (For Secure Storage)

If you want your API keys securely stored and synced across devices:

1. **Run the Database Setup**: Execute the SQL in `SUPABASE_SETUP.md` to create the `user_api_keys` table
2. **Sign Up/Sign In**: Create an account or sign in to your HTML editor
3. **Configure AI**: Your API keys will now be stored securely in Supabase

**Note**: You can use the AI assistant without signing in, but your configuration won't be saved or synced.

### 1. Setup Your AI Provider

The AI assistant supports multiple providers:

#### **OpenAI (GPT)**
1. Get an API key from [platform.openai.com](https://platform.openai.com)
2. Click the AI button on the right side of the editor
3. Click "Configure API" when prompted
4. Choose "openai" as provider
5. Enter your API key

#### **Anthropic (Claude)**
1. Get an API key from [console.anthropic.com](https://console.anthropic.com)
2. Click the AI button and configure
3. Choose "anthropic" as provider
4. Enter your API key

#### **Google Gemini**
1. Get an API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Click the AI button and configure
3. Choose "gemini" as provider
4. Enter your API key

#### **Custom Endpoint**
1. Set up your own AI endpoint (local LLM, custom API, etc.)
2. Choose "custom" as provider
3. Enter your endpoint URL
4. Optionally provide an API key if required

### 2. Using the Assistant

#### **Toggle the Panel**
- Click the floating "AI" button on the right side
- The panel slides out with welcome message and quick actions

#### **Get Code Explanations**
1. **Highlight Method**: Select any code in the editor → Click "Explain this" tooltip
2. **Quick Action**: Click "Explain This" button (explains current context)
3. **Chat Method**: Ask "What does this code do?" in the chat

#### **Debug Your Code**
1. **Quick Debug**: Click "Debug Issues" button for automatic code review
2. **Ask Specific Questions**: "Why isn't my CSS centering working?"
3. **Get Targeted Help**: "There's something wrong with my flexbox layout"

#### **Improve Your Code**
1. **Quick Improve**: Click "Improve Code" for best practices suggestions
2. **Ask for Tips**: "How can I make this more accessible?"
3. **Performance Help**: "Can you optimize this CSS?"

## 💡 Usage Tips

### **For Beginners**
- Start with quick actions to understand how the AI works
- Highlight small sections of code and ask for explanations
- Ask "dumb" questions - the AI is there to help, not judge!

### **For Debugging**
- Copy error messages into the chat
- Describe what you expected vs what's happening
- Ask about specific CSS properties that aren't working

### **For Learning**
- Ask "Why is this approach better?"
- Request examples: "Show me a better way to do this"
- Learn best practices: "What are common HTML mistakes to avoid?"

### **For Code Review**
- Use "Improve Code" on sections you're unsure about
- Ask about accessibility: "Is this accessible?"
- Get performance tips: "How can I make this faster?"

## 🎨 UI Elements

### **AI Toggle Button**
- **Location**: Fixed on the right side of the screen
- **States**: 
  - Blue when inactive
  - Brighter blue when panel is open
  - Smooth hover animations

### **AI Panel**
- **Header**: Shows AI icon and title with close button
- **Quick Actions**: Three main action buttons
- **Chat Interface**: Scrollable message history
- **Input Area**: Text input with send button and context indicator

### **Explain Tooltip**
- **Trigger**: Appears when you select code
- **Position**: Near your selection
- **Action**: Click to explain the selected code

### **Context Indicators**
- **"Code selected"**: Shows when you have text selected
- **Loading States**: Animated spinner when AI is thinking
- **Message Types**: Different styling for user vs AI messages

## ⚙️ Configuration

### **API Settings Storage**
Your AI configuration is now stored securely:

#### **For Signed-in Users (Recommended)**
- **Supabase Database**: API keys are stored in your Supabase database
- **Encrypted & Secure**: Protected by Row Level Security (RLS)
- **Synced Across Devices**: Access your configuration anywhere
- **User-Specific**: Only you can access your API keys

#### **For Guest Users (Fallback)**
- **Browser localStorage**: Temporary storage for the current device
- **Session-based**: Lost when clearing browser data
- **Device-specific**: Not synced across devices

### **Switching Between Providers**
1. Open the AI Assistant panel
2. Click "Configure API" in the setup message
3. Choose your provider and enter your API key
4. Configuration is automatically saved to the appropriate storage

### **Reset Configuration**
#### **For Signed-in Users:**
```javascript
// In browser console:
window.aiAssistant.deleteApiConfig('openai'); // or 'anthropic', 'custom'
```

#### **For Guest Users:**
1. Open browser dev tools (F12)
2. Go to Application/Storage → Local Storage
3. Delete the ai-* keys
4. Refresh the page and reconfigure

## 🔒 Privacy & Security

### **Data Handling**
- **Signed-in Users**: API keys are stored in your Supabase database with Row Level Security
- **Guest Users**: API keys are stored locally in your browser only
- Code context is sent to your chosen AI provider
- You control which AI service processes your code

### **API Key Security**
#### **Supabase Storage (Signed-in Users)**
- Keys are encrypted and stored in your personal Supabase database
- Protected by Row Level Security - only you can access your keys
- Stored in a secure, isolated environment
- Synced across all your devices securely

#### **Local Storage (Guest Users)**
- Keys are stored in browser localStorage only
- Not transmitted to any servers except your chosen AI provider
- Use environment variables or secure key management for production
- Regularly rotate your API keys for security

### **Code Privacy**
- Only the relevant code context is sent to AI (not your entire codebase)
- You can see exactly what's being sent in the network tab
- Choose providers you trust with your code

## 🛠️ Troubleshooting

### **AI Not Responding**
1. Check your API key is correct
2. Verify you have API credits/quota remaining
3. Check browser console for error messages
4. Try switching providers

### **Tooltip Not Appearing**
1. Make sure you've selected enough text (3+ characters)
2. Check that Monaco Editor has focus
3. Try clicking in the editor first, then selecting

### **Panel Won't Open**
1. Check browser console for JavaScript errors
2. Ensure the page has fully loaded
3. Try refreshing the page

### **Poor AI Responses**
1. Provide more context in your questions
2. Be specific about what you want to know
3. Try rephrasing your question
4. Use the quick actions for common tasks

## 🚧 Advanced Usage

### **Custom Endpoints**
For teams or advanced users, you can set up custom AI endpoints:

```javascript
// Example custom endpoint format
POST /ai/chat
{
  "system": "System prompt...",
  "message": "User message...",
  "context": {
    "fullCode": "HTML content...",
    "selectedText": "Selected code...",
    "language": "html"
  }
}

// Expected response
{
  "response": "AI response text..."
}
```

### **Local AI Models**
You can use local AI models with tools like:
- **Ollama**: Run models locally
- **LM Studio**: Local model interface
- **Custom APIs**: Your own AI infrastructure

## 🎯 Best Practices

### **Getting Better Responses**
1. **Be Specific**: "Why isn't my flexbox centering?" vs "CSS not working"
2. **Provide Context**: Select relevant code before asking
3. **Ask Follow-ups**: "Can you show me an example?" "What about accessibility?"
4. **Use Quick Actions**: They provide good starting prompts

### **Code Quality**
1. **Regular Reviews**: Use "Debug Issues" periodically
2. **Learn from Suggestions**: Don't just copy, understand why
3. **Ask "Why"**: Understanding beats memorization
4. **Practice**: Use explanations to learn, then try without help

---

**Happy Coding! 🎉**

Your AI assistant is here to help you become a better developer. Don't hesitate to ask questions, no matter how basic they might seem. Every expert was once a beginner! 