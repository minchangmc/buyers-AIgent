
let userId = null;
let currentSessionId = null;

function startOrientation() {
  document.getElementById('landing').classList.add('hidden');
  document.getElementById('orientation').classList.remove('hidden');
}

let orientationAnswers = {};

function selectAnswer(questionNum, answer) {
  orientationAnswers[`question${questionNum}`] = answer;
  
  const currentQuestion = document.getElementById(`question${questionNum}`);
  const nextQuestion = questionNum === 3 && answer === 'Yes' 
    ? document.getElementById('contextQuestion')
    : document.getElementById(`question${questionNum + 1}`);
    
  currentQuestion.classList.remove('active');
  
  if (questionNum === 3 && answer === 'No') {
    submitOrientation();
    return;
  }
  
  if (nextQuestion) {
    setTimeout(() => {
      nextQuestion.classList.add('active');
    }, 300);
  }
}

async function submitOrientation() {
  const contextText = document.getElementById('additionalContext');
  if (contextText && contextText.value) {
    orientationAnswers.additionalContext = contextText.value;
  }
  
  const response = await fetch('/api/orientation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers: orientationAnswers })
  });
  
  const data = await response.json();
  userId = data.userId;
  
  document.getElementById('orientation').classList.add('hidden');
  document.getElementById('dashboard').classList.remove('hidden');
  loadSessions();
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
  const propertyAddress = formData.get('address');
  
  const response = await fetch('/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, propertyAddress })
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
  
  appendMessage(message, false);
  
  const response = await fetch(`/api/chat/${currentSessionId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message })
  });
  
  const data = await response.json();
  appendMessage(data.response, true);
});

function appendMessage(content, isAi) {
  const messages = document.getElementById('messages');
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${isAi ? 'ai-message' : 'user-message'}`;
  messageDiv.textContent = content;
  messages.appendChild(messageDiv);
  messages.scrollTop = messages.scrollHeight;
}

function openSession(sessionId) {
  currentSessionId = sessionId;
  document.getElementById('dashboard').classList.add('hidden');
  document.getElementById('chat').classList.remove('hidden');
}
