
let userId = null;
let currentSessionId = null;

function getStarted() {
  document.getElementById('landing').classList.add('hidden');
  document.getElementById('dashboard').classList.remove('hidden');
}

function startNewAnalysis() {
  document.getElementById('dashboard').classList.add('hidden');
  document.getElementById('analysis').classList.remove('hidden');
}

async function loadSessions() {
  const response = await fetch(`/api/sessions?userId=${userId}`);
  const sessions = await response.json();
  
  const sessionsList = document.getElementById('sessionsList');
  sessionsList.innerHTML = sessions.map(session => `
    <div class="session" onclick="openSession(${session.id})">
      <h3>${session.property_address}</h3>
      <p>Created: ${new Date(session.timestamp).toLocaleString()}</p>
    </div>
  `).join('');
}

function startNewAnalysis() {
  document.getElementById('dashboard').classList.add('hidden');
  document.getElementById('analysis').classList.remove('hidden');
}

document.getElementById('analysisForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  
  const orientationData = {
    question1: "Buy",
    question2: formData.get('propertyType'),
    additionalContext: formData.get('additionalContext')
  };

  // Create user first
  const userResponse = await fetch('/api/orientation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers: orientationData })
  });
  
  const userData = await userResponse.json();
  userId = userData.userId;

  // Then create session
  const response = await fetch('/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      userId, 
      propertyAddress: formData.get('address')
    })
  });
  
  const data = await response.json();
  currentSessionId = data.sessionId;
  
  document.getElementById('analysis').classList.add('hidden');
  document.getElementById('chat').classList.remove('hidden');
});

document.getElementById('chatForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const messageInput = document.getElementById('messageInput');
  const message = messageInput.value;
  messageInput.value = '';
  
  if (!message.trim()) return;
  
  try {
    appendMessage(message, false);
    
    const response = await fetch(`/api/chat/${currentSessionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    
    if (!response.ok) throw new Error('Failed to send message');
    
    const data = await response.json();
    appendMessage(data.response, true);
  } catch (error) {
    console.error('Chat error:', error);
    appendMessage('Sorry, there was an error processing your message. Please try again.', true);
  }
});

function appendMessage(content, isAi) {
  const messages = document.getElementById('messages');
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${isAi ? 'ai-message' : 'user-message'}`;
  messageDiv.textContent = content;
  messages.appendChild(messageDiv);
  messages.scrollTop = messages.scrollHeight;
}

async function openSession(sessionId) {
  try {
    currentSessionId = sessionId;
    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('chat').classList.remove('hidden');
    
    // Clear existing messages
    document.getElementById('messages').innerHTML = '';
    
    // Load chat history
    const response = await fetch(`/api/chat/${sessionId}/history`);
    if (!response.ok) throw new Error('Failed to load chat history');
    
    const messages = await response.json();
    if (Array.isArray(messages)) {
      messages.forEach(msg => {
        if (msg && typeof msg.content === 'string') {
          appendMessage(msg.content, msg.is_ai === 1);
        }
      });
    }
  } catch (error) {
    console.error('Failed to load session:', error);
    appendMessage('Failed to load chat history. Please try again.', true);
  }
}

function exitToHome() {
  document.getElementById('chat').classList.add('hidden');
  document.getElementById('dashboard').classList.remove('hidden');
  document.getElementById('messages').innerHTML = '';
  currentSessionId = null;
  loadSessions();
}
